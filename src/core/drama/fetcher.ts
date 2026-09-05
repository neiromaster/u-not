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

export interface SourceFailure {
  name: string;
  error: Error;
}

export interface FetchAllResult {
  results: FetchedDramas[];
  failedSources: SourceFailure[];
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
 * Браузер рендерит JSON как HTML-страницу: тело заворачивается в <pre>...</pre>,
 * а &, <, > экранируются в HTML-сущности. Возвращает объект из чистого JSON
 * или изнутри <pre>-обёртки.
 */
function parseFlareSolverrBody(body: string): object {
  try {
    return JSON.parse(body) as object;
  } catch {
    const content = body.match(/<pre>([\s\S]*)<\/pre>/)?.[1];
    if (content) {
      try {
        return JSON.parse(unescapeHtml(content)) as object;
      } catch {
        throw new Error('ответ FlareSolverr не содержит JSON');
      }
    }
    throw new Error('ответ FlareSolverr не содержит JSON');
  }
}

/**
 * Раскрывает HTML-сущности, которыми браузер заэкранировал текст: & → &amp;,
 * < → &lt;, > → &gt;. &amp; заменяется последним, чтобы не двойное декодирование.
 */
function unescapeHtml(text: string): string {
  return text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');
}

async function readFlareSolverrError(response: Response): Promise<string> {
  const body = await response.text();
  try {
    const json = JSON.parse(body) as { error?: string };
    if (json.error) {
      return json.error;
    }
  } catch {
    // тело не JSON — вернём его как есть
  }
  return body ? body.slice(0, 200) : response.statusText;
}

interface FlareSolverrSolution {
  status?: number;
  response?: string;
}

interface FlareSolverrResponse {
  solution?: FlareSolverrSolution;
  error?: string;
}

function flareBaseUrl(source: Source): string {
  const url = source.flaresolverrUrl;
  if (!url) {
    throw new Error(`Источник ${source.name}: не задан flaresolverrUrl`);
  }
  return url.replace(/\/+$/, '');
}

/**
 * Загружает JSON через FlareSolverr — обходит антибот-защиту,
 * которая блокирует не-браузерные клиенты по TLS-fingerprint
 */
async function fetchViaFlareSolverr(
  source: Source,
  userAgent?: string,
  sessionId?: string,
): Promise<object> {
  const base = flareBaseUrl(source);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (source.flaresolverrApiKey) {
    headers['X-Api-Key'] = source.flaresolverrApiKey;
  }

  const targetHeaders: Record<string, string> = {};
  if (userAgent) {
    targetHeaders['User-Agent'] = userAgent;
  }
  if (source.headers) {
    Object.assign(targetHeaders, source.headers);
  }

  const body: Record<string, unknown> = {
    cmd: 'request.get',
    url: source.url,
    maxTimeout: 60000,
    headers: targetHeaders,
  };
  if (sessionId) {
    body.session = sessionId;
  }

  const response = await fetch(`${base}/v1`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `FlareSolverr HTTP ${response.status} ${await readFlareSolverrError(response)}`,
    );
  }

  let result: FlareSolverrResponse;
  try {
    result = (await response.json()) as FlareSolverrResponse;
  } catch {
    throw new Error(
      `FlareSolverr вернул не JSON (HTTP ${response.status}). Возможно, это HTML-страница ошибки.`,
    );
  }

  const solution = result.solution;
  if (!solution) {
    throw new Error(
      `FlareSolverr вернул ошибку: ${result.error ?? 'нет solution'}`,
    );
  }

  if (solution.status !== undefined && solution.status >= 400) {
    throw new Error(`целевой источник ответил HTTP ${solution.status}`);
  }

  const flareBody = solution.response;
  if (typeof flareBody !== 'string' || flareBody.length === 0) {
    throw new Error('FlareSolverr вернул пустой ответ');
  }
  return parseFlareSolverrBody(flareBody);
}

function sessionKey(source: Source): string | null {
  if (!source.flaresolverrUrl) {
    return null;
  }
  return `${source.flaresolverrUrl.replace(/\/+$/, '')}|${source.flaresolverrApiKey ?? ''}`;
}

async function createFlareSolverrSession(source: Source): Promise<string> {
  const base = flareBaseUrl(source);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (source.flaresolverrApiKey) {
    headers['X-Api-Key'] = source.flaresolverrApiKey;
  }
  const sessionId = crypto.randomUUID();

  const response = await fetch(`${base}/v1`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ cmd: 'sessions.create', session: sessionId }),
  });
  if (!response.ok) {
    throw new Error(`FlareSolverr sessions.create HTTP ${response.status}`);
  }
  return sessionId;
}

async function destroyFlareSolverrSession(
  source: Source,
  sessionId: string,
): Promise<void> {
  const base = flareBaseUrl(source);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (source.flaresolverrApiKey) {
    headers['X-Api-Key'] = source.flaresolverrApiKey;
  }

  const response = await fetch(`${base}/v1`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ cmd: 'sessions.destroy', session: sessionId }),
  });
  if (!response.ok) {
    throw new Error(`FlareSolverr sessions.destroy HTTP ${response.status}`);
  }
}

/**
 * Загружает дорамы из всех источников. Для источников через FlareSolverr
 * создаётся одна сессия на сервер (переиспользуется между источниками,
 * чтобы не поднимать браузер на каждый запрос) и уничтожается по завершении.
 */
export async function fetchAllSources(
  sources: Source[],
  userAgent?: string,
): Promise<FetchAllResult> {
  const flareServers = new Map<string, Source>();
  for (const source of sources) {
    const key = sessionKey(source);
    if (key !== null && !flareServers.has(key)) {
      flareServers.set(key, source);
    }
  }

  const sessions = new Map<string, { source: Source; id: string }>();
  for (const [key, source] of flareServers) {
    try {
      sessions.set(key, {
        source,
        id: await createFlareSolverrSession(source),
      });
    } catch (error) {
      console.warn(
        `⚠️ Не удалось создать сессию FlareSolverr для ${source.name}: ${error instanceof Error ? error.message : String(error)}. Продолжаем без неё.`,
      );
    }
  }

  const results: FetchedDramas[] = [];
  const failedSources: SourceFailure[] = [];

  try {
    const outcomes = await Promise.allSettled(
      sources.map((source) => {
        const key = sessionKey(source);
        const sessionId = key !== null ? sessions.get(key)?.id : undefined;
        return fetchDramasFromSource(source, userAgent, sessionId);
      }),
    );
    for (const [index, outcome] of outcomes.entries()) {
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value);
      } else {
        const reason = outcome.reason;
        failedSources.push({
          name: sources[index]?.name ?? 'неизвестный источник',
          error: reason instanceof Error ? reason : new Error(String(reason)),
        });
      }
    }
  } finally {
    await Promise.allSettled(
      [...sessions.values()].map(({ source, id }) =>
        destroyFlareSolverrSession(source, id).catch((error: unknown) => {
          console.warn(
            `⚠️ Не удалось уничтожить сессию FlareSolverr: ${error instanceof Error ? error.message : String(error)}`,
          );
        }),
      ),
    );
  }

  return { results, failedSources };
}

/**
 * Загружает дорамы из указанного источника
 *
 * @param source - Конфигурация источника данных
 * @param userAgent - Пользовательский агент для запроса (опционально)
 * @param flareSolverrSessionId - ID сессии FlareSolverr (опционально)
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
 * `X-Api-Key`, а `headers` и верхнеуровневый `userAgent` — в целевой запрос.
 */
export async function fetchDramasFromSource(
  source: Source,
  userAgent?: string,
  flareSolverrSessionId?: string,
): Promise<FetchedDramas> {
  try {
    const json = source.flaresolverrUrl
      ? await fetchViaFlareSolverr(source, userAgent, flareSolverrSessionId)
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
