/**
 * Логика хранения и управления списком дорам
 *
 * @module core/drama/storage
 */

import type { Drama } from '@/core/drama/fetcher';

const DRAMA_LIST_FILE = 'drama-list.md';

/**
 * Загружает существующие дорамы из файла
 *
 * @param filePath - Путь к файлу со списком дорам (по умолчанию drama-list.md)
 * @returns Set с названиями существующих дорам
 */
export async function getExistingDramas(
  filePath = DRAMA_LIST_FILE,
): Promise<Set<string>> {
  const file = Bun.file(filePath);
  const exists = await file.exists();

  if (!exists) {
    console.log(`Файл ${filePath} не найден. Будет создан новый.`);
    return new Set();
  }

  const content = await file.text();
  const lines = content.split('\n');

  const dramas = lines
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('##') && !line.startsWith('# '))
    .map((line) => line.replace(/^- /g, '').trim());

  return new Set(dramas);
}

/**
 * Добавляет новые дорамы в файл
 *
 * @param newDramasBySource - Карта с новыми дорамами по источникам
 * @param filePath - Путь к файлу со списком дорам (по умолчанию drama-list.md)
 */
export async function appendNewDramas(
  newDramasBySource: Map<string, Drama[]>,
  filePath = DRAMA_LIST_FILE,
): Promise<void> {
  const timestamp = getTimestamp();
  const existingContent = (await Bun.file(filePath).exists())
    ? await Bun.file(filePath).text()
    : '';

  let newSection = `\n## ${timestamp}\n`;
  for (const [sourceName, dramas] of newDramasBySource.entries()) {
    newSection += `### ${sourceName}\n`;
    newSection += dramas.map((drama) => `- ${drama.title}`).join('\n');
    newSection += '\n';
  }

  await Bun.write(filePath, existingContent + newSection);

  console.log(
    `✨ Найдено и добавлено ${newDramasBySource.size} источников с новыми дорамами:`,
  );
  for (const [sourceName, dramas] of newDramasBySource.entries()) {
    console.log(`  - ${sourceName}: ${dramas.length} дорам`);
  }
}

/**
 * Получает текущую метку времени
 *
 * @returns Форматированная строка с датой и временем
 */
export function getTimestamp(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}
