import { stdin as input, stdout as output } from 'node:process';
import * as readline from 'node:readline/promises';
import { Bot } from 'grammy';
import { JSONPath } from 'jsonpath-plus';
import type { Config, Source } from './config';
import { validateConfig } from './config';

// --- Типы и константы ---

const DRAMA_LIST_FILE = 'drama-list.md';
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

async function getExistingDramas(): Promise<Set<string>> {
  const file = Bun.file(DRAMA_LIST_FILE);
  const exists = await file.exists();

  if (!exists) {
    console.log(`Файл ${DRAMA_LIST_FILE} не найден. Будет создан новый.`);
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

interface FetchedDramas {
  source: Source;
  titles: string[];
}

async function fetchDramasFromSource(
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
    const titles = JSONPath({ path: source.jsonPath, json: json as any });

    const fetchedTitles = Array.isArray(titles)
      ? titles.filter((t) => typeof t === 'string')
      : [];
    return { source, titles: fetchedTitles };
  } catch (error) {
    console.error(`Не удалось обработать источник ${source.url}:`, error);
    return { source, titles: [] };
  }
}

function getTimestamp(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

async function appendNewDramas(
  newDramasBySource: Map<string, string[]>,
): Promise<void> {
  const timestamp = getTimestamp();
  const existingContent = (await Bun.file(DRAMA_LIST_FILE).exists())
    ? await Bun.file(DRAMA_LIST_FILE).text()
    : '';

  let newSection = `\n## ${timestamp}\n`;
  for (const [sourceName, dramas] of newDramasBySource.entries()) {
    newSection += `### ${sourceName}\n`;
    newSection += dramas.map((drama) => `- ${drama}`).join('\n');
    newSection += '\n';
  }

  await Bun.write(DRAMA_LIST_FILE, existingContent + newSection);

  console.log(
    `✨ Найдено и добавлено ${newDramasBySource.size} источников с новыми дорамами:`,
  );
  for (const [sourceName, dramas] of newDramasBySource.entries()) {
    console.log(`  - ${sourceName}: ${dramas.length} дорам`);
  }
}

async function sendTelegramNotification(
  telegram: Config['telegram'],
  newDramasBySource: Map<string, string[]>,
): Promise<void> {
  if (!telegram) {
    console.log(
      '🔔 Конфигурация Telegram не найдена, уведомление не будет отправлено.',
    );
    return;
  }

  const { botToken, chatId: chatIds } = telegram;

  if (
    !botToken ||
    !chatIds ||
    (Array.isArray(chatIds) && chatIds.length === 0)
  ) {
    console.log(
      '🔔 Токен или ID чата для Telegram не указаны, уведомление не будет отправлено.',
    );
    return;
  }

  const bot = new Bot(botToken);
  let message = `<b>✨ Найдены новые дорамы!</b>\n\n`;

  for (const [sourceName, dramas] of newDramasBySource.entries()) {
    message += `<b>${sourceName}:</b>\n`;
    message += dramas.map((d) => `• ${d}`).join('\n');
    message += '\n\n';
  }

  const ids = Array.isArray(chatIds) ? chatIds : [chatIds];

  for (const chatId of ids) {
    try {
      await bot.api.sendMessage(chatId, message, { parse_mode: 'HTML' });
      console.log(
        `📤 Уведомление в Telegram успешно отправлено в чат ${chatId}.`,
      );
    } catch (error) {
      console.error(
        `❌ Ошибка при отправке уведомления в Telegram в чат ${chatId}:`,
        error,
      );
    }
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
