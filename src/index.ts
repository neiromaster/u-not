/**
 * Точка входа приложения
 *
 * @module index
 */

import { stdin as input, stdout as output } from 'node:process';
import * as readline from 'node:readline/promises';
import { type Config, validateConfig } from '@/core/config/schema';
import { type Drama, fetchAllSources } from '@/core/drama/fetcher';
import { appendNewDramas, getExistingDramas } from '@/core/drama/storage';
import { sendTelegramNotification } from '@/services/telegram/notifications';
import { sendVkNotification } from '@/services/vk/notifications';

const CONFIG_FILE = 'config.json';

async function loadConfig(): Promise<Config> {
  const file = Bun.file(CONFIG_FILE);
  const exists = await file.exists();
  if (!exists) {
    throw new Error(`Файл конфигурации ${CONFIG_FILE} не найден.`);
  }
  try {
    const config = await file.json();
    return validateConfig(config);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Ошибка парсинга ${CONFIG_FILE}. Убедитесь, что это валидный JSON. ${error.message}`,
        { cause: error },
      );
    }
    throw new Error(
      `Ошибка парсинга ${CONFIG_FILE}. Убедитесь, что это валидный JSON.`,
    );
  }
}

async function main() {
  console.log('🔍 Начинаем поиск новых дорам...');

  const config = await loadConfig();
  const { sources, telegram, userAgent } = config;
  console.log(
    `📂 Конфигурация загружена. Источников для проверки: ${sources.length}`,
  );

  const existingDramas = await getExistingDramas();
  console.log(`📝 Найдено ${existingDramas.size} дорам в текущем списке.`);

  const { results, failedSources } = await fetchAllSources(sources, userAgent);

  console.log('\n📊 Дорамы, полученные из источников:');
  for (const result of results) {
    const sourceName = result.source.name;
    console.log(`  - ${sourceName}: ${result.dramas.length} дорам`);
  }
  for (const failed of failedSources) {
    console.log(`  - ${failed.name}: ❌ ошибка`);
  }
  console.log('');

  const newDramasBySource = new Map<string, Drama[]>();
  let totalNewDramas = 0;

  for (const result of results) {
    const newDramas = result.dramas.filter(
      (drama) => !existingDramas.has(drama.title),
    );
    if (newDramas.length > 0) {
      newDramasBySource.set(result.source.name, newDramas);
      totalNewDramas += newDramas.length;
    }
  }

  console.log(`📥 Всего найдено ${totalNewDramas} новых дорам.`);

  if (totalNewDramas === 0) {
    console.log('✅ Новых дорам не найдено.');
  } else {
    await appendNewDramas(newDramasBySource);
    await sendTelegramNotification(telegram, newDramasBySource);
    await sendVkNotification(config.vk, newDramasBySource, userAgent);
  }

  if (failedSources.length > 0) {
    const details = failedSources
      .map((failed) => `  - ${failed.name}: ${failed.error.message}`)
      .join('\n');
    throw new Error(
      `Не удалось получить список дорам из источников:\n${details}`,
    );
  }

  console.log('🏁 Работа скрипта завершена.');
}

async function waitForUserInput(): Promise<void> {
  const rl = readline.createInterface({ input, output });
  try {
    await rl.question('Нажмите Enter для выхода...');
  } finally {
    rl.close();
  }
}

main().catch(async (error) => {
  if (error instanceof Error) {
    console.error('❌ Произошла критическая ошибка:', error.message);
  } else {
    console.error('❌ Произошла критическая ошибка:', error);
  }

  if (process.stdin.isTTY) {
    await waitForUserInput();
  }
  process.exit(1);
});
