/**
 * Логика загрузки дорам из внешних источников
 *
 * @module core/drama/fetcher
 */

import { JSONPath } from 'jsonpath-plus';
import type { Source } from '@/core/config/schema';

export interface FetchedDramas {
  source: Source;
  titles: string[];
}

/**
 * Загружает дорамы из указанного источника
 *
 * @param source - Конфигурация источника данных
 * @param userAgent - Пользовательский агент для запроса (опционально)
 * @returns Объект с источником и списком названий дорам
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
      return { source, titles: [] };
    }

    const json = await response.json();
    const titles = JSONPath({ path: source.jsonPath, json: json as object });

    const fetchedTitles = Array.isArray(titles)
      ? titles.filter((t) => typeof t === 'string')
      : [];

    return { source, titles: fetchedTitles };
  } catch (error) {
    console.error(`Не удалось обработать источник ${source.url}:`, error);
    return { source, titles: [] };
  }
}
