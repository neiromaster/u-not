/**
 * Точка входа приложения
 *
 * @module index
 */

import { stdin as input, stdout as output } from 'node:process';
import * as readline from 'node:readline/promises';
import { type Config, validateConfig } from '@/core/config/schema';
import { fetchDramasFromSource } from '@/core/drama/fetcher';
import { appendNewDramas, getExistingDramas } from '@/core/drama/storage';
import { sendTelegramNotification } from '@/services/telegram/notifications';

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

  const fetchPromises = sources.map((source) =>
    fetchDramasFromSource(source, userAgent),
  );
  const results = await Promise.all(fetchPromises);

  console.log('\n📊 Дорамы, полученные из источников:');
  for (const result of results) {
    const sourceName = result.source.name ?? result.source.url;
    console.log(`  - ${sourceName}: ${result.titles.length} дорам`);
  }
  console.log('');

  const newDramasBySource = new Map<string, string[]>();
  let totalNewDramas = 0;

  for (const result of results) {
    const newTitles = result.titles.filter(
      (title) => !existingDramas.has(title),
    );
    if (newTitles.length > 0) {
      newDramasBySource.set(result.source.name ?? result.source.url, newTitles);
      totalNewDramas += newTitles.length;
    }
  }

  console.log(`📥 Всего найдено ${totalNewDramas} новых дорам.`);

  if (totalNewDramas === 0) {
    console.log('✅ Новых дорам не найдено.');
  } else {
    await appendNewDramas(newDramasBySource);
    await sendTelegramNotification(telegram, newDramasBySource);
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

  try {
    await waitForUserInput();
  } finally {
    process.exit(1);
  }
});
