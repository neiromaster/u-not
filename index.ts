import { Bot } from 'grammy';
import { JSONPath } from 'jsonpath-plus';

// --- Типы и константы ---

const DRAMA_LIST_FILE = 'drama-list.md';
const CONFIG_FILE = 'config.json';

interface Source {
  name: string;
  url: string;
  type: 'api';
  jsonPath: string;
}

type ChatId = string | number;

interface TelegramConfig {
  botToken: string;
  chatId: ChatId[] | ChatId;
}

interface Config {
  sources: Source[];
  telegram: TelegramConfig;
}

// --- Логика скрипта ---

/**
 * Загружает конфигурацию из JSON-файла.
 */
async function loadConfig(): Promise<Config> {
  const file = Bun.file(CONFIG_FILE);
  const exists = await file.exists();
  if (!exists) {
    throw new Error(`Файл конфигурации ${CONFIG_FILE} не найден.`);
  }
  try {
    const config: Config = await file.json();
    return config;
  } catch (error) {
    throw new Error(
      `Ошибка парсинга ${CONFIG_FILE}. Убедитесь, что это валидный JSON.`,
      { cause: error },
    );
  }
}

/**
 * Читает файл drama-list.md и возвращает Set с уникальными названиями дорам.
 */
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

/**
 * Загружает и парсит дорамы из одного источника.
 */
async function fetchDramasFromSource(source: Source): Promise<FetchedDramas> {
  try {
    const response = await fetch(source.url);
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

/**
 * Форматирует дату для заголовка.
 */
function getTimestamp(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/**
 * Добавляет новые дорамы в файл.
 */
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

/**
 * Отправляет уведомление в Telegram.
 */
async function sendTelegramNotification(
  botToken: string,
  chatIds: ChatId[] | ChatId,
  newDramasBySource: Map<string, string[]>,
): Promise<void> {
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

/**
 * Основная функция
 */
async function main() {
  console.log('🔍 Начинаем поиск новых дорам...');

  const config = await loadConfig();
  const { sources, telegram } = config;
  console.log(
    `📂 Конфигурация загружена. Источников для проверки: ${sources.length}`,
  );

  const existingDramas = await getExistingDramas();
  console.log(`📝 Найдено ${existingDramas.size} дорам в текущем списке.`);

  const fetchPromises = sources.map(fetchDramasFromSource);
  const results = await Promise.all(fetchPromises);

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
    await sendTelegramNotification(
      telegram.botToken,
      telegram.chatId,
      newDramasBySource,
    );
  }

  console.log('🏁 Работа скрипта завершена.');
}

// Запуск
main().catch((error) => {
  console.error('❌ Произошла критическая ошибка:', error.message);
  process.exit(1);
});
