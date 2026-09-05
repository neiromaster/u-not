/**
 * Логика загрузки дорам из внешних источников
 *
 * @module core/drama/fetcher
 */

import { JSONPath } from 'jsonpath-plus';
import type { Source } from '@/core/config/schema';

const DEFAULT_POSTER_SIZE = '400x600';

export interface Drama {
  title: string;
  posterUrl?: string;
  link?: string;
}

export interface FetchedDramas {
  source: Source;
  dramas: Drama[];
}

/**
 * Нормализует URL постера: заменяет плейсхолдер {SIZE} на реальный размер
 * и подставляет posterBaseUrl перед относительным URL
 *
 * @param url - URL постера
 * @param posterSize - Размер постера
 * @param posterBaseUrl - Базовый домен для относительных URL (опционально)
 * @returns Нормализованный URL
 */
function normalizePosterUrl(
  url: string,
  posterSize: string,
  posterBaseUrl?: string,
): string {
  const sized = url.replaceAll('{SIZE}', posterSize);
  if (sized.startsWith('http')) {
    return sized;
  }
  return posterBaseUrl ? posterBaseUrl + sized : sized;
}

/**
 * Склеивает относительную ссылку с базовым доменом
 *
 * @param link - Ссылка из API
 * @param linkBaseUrl - Базовый домен (опционально)
 * @returns Полная ссылка
 */
function normalizeLink(link: string, linkBaseUrl?: string): string {
  if (link.startsWith('http')) {
    return link;
  }
  return linkBaseUrl ? linkBaseUrl + link : link;
}

/**
 * Загружает JSON напрямую из источника
 */
async function fetchDirect(
  source: Source,
  userAgent?: string,
): Promise<object> {
  const headers: Record<string, string> = {};

  if (userAgent) {
    headers['User-Agent'] = userAgent;
  }

  if (source.headers) {
    Object.assign(headers, source.headers);
  }

  const response = await fetch(source.url, { headers });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as object;
}

/**
 * Извлекает JSON из тела ответа FlareSolverr: браузер рендерит JSON
 * как страницу, поэтому тело может быть обёрнуто в <pre>...</pre>
 */
function parseFlareSolverrBody(body: string): object {
  try {
    return JSON.parse(body) as object;
  } catch {
    const content = body.match(/<pre>([\s\S]*?)<\/pre>/)?.[1];
    if (content) {
      return JSON.parse(content) as object;
    }
    throw new Error('ответ FlareSolverr не содержит JSON');
  }
}

/**
 * Загружает JSON через FlareSolverr — обходит антибот-защиту,
 * которая блокирует не-браузерные клиенты по TLS-fingerprint
 */
async function fetchViaFlareSolverr(source: Source): Promise<object> {
  const base = source.flaresolverrUrl!.replace(/\/+$/, '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (source.flaresolverrApiKey) {
    headers['X-Api-Key'] = source.flaresolverrApiKey;
  }

  const response = await fetch(`${base}/v1`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      cmd: 'request.get',
      url: source.url,
      maxTimeout: 60000,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `FlareSolverr HTTP ${response.status} ${response.statusText}`,
    );
  }

  const result = (await response.json()) as {
    solution?: { response?: string };
  };
  const body = result.solution?.response;
  if (typeof body !== 'string' || body.length === 0) {
    throw new Error('FlareSolverr вернул пустой ответ');
  }
  return parseFlareSolverrBody(body);
}

/**
 * Загружает дорамы из указанного источника
 *
 * @param source - Конфигурация источника данных
 * @param userAgent - Пользовательский агент для запроса (опционально)
 * @returns Объект с источником и списком дорам
 * @throws Ошибка, если запрос не удался или список дорам пуст —
 * пустой список означает, что API изменился или заблокировал запрос
 *
 * @remarks
 * `posterJsonPath` и `linkJsonPath` должны разделять объектный префикс
 * с `jsonPath` (часть пути до массива объектов). Например, для
 * `jsonPath: 'results.*.title'` постер должен быть `results.*.assets.poster`,
 * а не `data.*.assets.poster` — иначе относительный путь не построится
 * и постер/ссылка будут молча потеряны (в лог попадёт предупреждение).
 * `posterBaseUrl` (как и `linkBaseUrl`) подставляется перед относительным
 * URL постера, если тот не начинается с `http`.
 * Если задан `flaresolverrUrl`, запрос идёт через FlareSolverr
 * (обход антибот-защиты); `flaresolverrApiKey` передаётся в заголовке
 * `X-Api-Key`.
 */
export async function fetchDramasFromSource(
  source: Source,
  userAgent?: string,
): Promise<FetchedDramas> {
  try {
    const json = source.flaresolverrUrl
      ? await fetchViaFlareSolverr(source)
      : await fetchDirect(source, userAgent);
    const objectPath = source.jsonPath.replace(/\.\w+$/, '');
    const toRelative = (path: string): string => {
      if (!path.startsWith(objectPath)) {
        console.warn(
          `⚠️ Путь ${path} не начинается с объектного пути ${objectPath} — постер/ссылка могут не извлекаться.`,
        );
      }
      return path.slice(objectPath.length).replace(/^\./, '');
    };
    const titlePath = toRelative(source.jsonPath);
    const posterPath = source.posterJsonPath
      ? toRelative(source.posterJsonPath)
      : undefined;
    const linkPath = source.linkJsonPath
      ? toRelative(source.linkJsonPath)
      : undefined;

    const items = JSONPath({
      path: objectPath,
      json,
    }) as Record<string, unknown>[];

    const posterSize = source.posterSize ?? DEFAULT_POSTER_SIZE;

    const dramas: Drama[] = [];
    for (const item of items) {
      // jsonPath указывает прямо на массив строк (без поля-листа)
      if (titlePath === '') {
        if (typeof item === 'string') {
          dramas.push({ title: item });
        }
        continue;
      }

      const title = JSONPath({ path: titlePath, json: item })[0];
      if (typeof title !== 'string') {
        continue;
      }

      const drama: Drama = { title };

      if (posterPath) {
        const poster = JSONPath({ path: posterPath, json: item })[0];
        if (typeof poster === 'string') {
          drama.posterUrl = normalizePosterUrl(
            poster,
            posterSize,
            source.posterBaseUrl,
          );
        }
      }

      if (linkPath) {
        const link = JSONPath({ path: linkPath, json: item })[0];
        if (typeof link === 'string') {
          drama.link = normalizeLink(link, source.linkBaseUrl);
        }
      }

      dramas.push(drama);
    }

    if (dramas.length === 0) {
      throw new Error(
        'получен пустой список дорам — возможно, API изменился или заблокировал запрос',
      );
    }

    return { source, dramas };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Источник ${source.name} (${source.url}): ${reason}`, {
      cause: error,
    });
  }
}
