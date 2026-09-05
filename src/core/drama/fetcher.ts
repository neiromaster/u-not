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
 * Заменяет плейсхолдер {SIZE} в URL постера на реальный размер
 *
 * @param url - URL постера
 * @param posterSize - Размер постера
 * @returns Нормализованный URL
 */
function normalizePosterUrl(url: string, posterSize: string): string {
  return url.replaceAll('{SIZE}', posterSize);
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
 * Загружает дорамы из указанного источника
 *
 * @param source - Конфигурация источника данных
 * @param userAgent - Пользовательский агент для запроса (опционально)
 * @returns Объект с источником и списком дорам
 */
export async function fetchDramasFromSource(
  source: Source,
  userAgent?: string,
): Promise<FetchedDramas> {
  try {
    const headers: Record<string, string> = {};

    if (userAgent) {
      headers['User-Agent'] = userAgent;
    }

    if (source.headers) {
      Object.assign(headers, source.headers);
    }

    const response = await fetch(source.url, { headers });
    if (!response.ok) {
      console.error(
        `Ошибка при загрузке ${source.url}: ${response.statusText}`,
      );
      return { source, dramas: [] };
    }

    const json = await response.json();
    const objectPath = source.jsonPath.replace(/\.\w+$/, '');
    const toRelative = (path: string): string =>
      path.slice(objectPath.length).replace(/^\./, '');
    const titlePath = toRelative(source.jsonPath);
    const posterPath = source.posterJsonPath
      ? toRelative(source.posterJsonPath)
      : undefined;
    const linkPath = source.linkJsonPath
      ? toRelative(source.linkJsonPath)
      : undefined;

    const items = JSONPath({
      path: objectPath,
      json: json as object,
    }) as Record<string, unknown>[];

    const posterSize = source.posterSize ?? DEFAULT_POSTER_SIZE;

    const dramas: Drama[] = [];
    for (const item of items) {
      const title = JSONPath({ path: titlePath, json: item })[0];
      if (typeof title !== 'string') {
        continue;
      }

      const drama: Drama = { title };

      if (posterPath) {
        const poster = JSONPath({ path: posterPath, json: item })[0];
        if (typeof poster === 'string') {
          drama.posterUrl = normalizePosterUrl(poster, posterSize);
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

    return { source, dramas };
  } catch (error) {
    console.error(`Не удалось обработать источник ${source.url}:`, error);
    return { source, dramas: [] };
  }
}
