import { JSONPath } from 'jsonpath-plus';

// --- Типы и константы ---

const DRAMA_LIST_FILE = 'drama-list.md';
const CONFIG_FILE = 'config.json';

interface Source {
  url: string;
  type: 'api';
  jsonPath: string;
}

// --- Логика скрипта ---

/**
 * Загружает конфигурацию из JSON-файла.
 */
async function loadConfig(): Promise<Source[]> {
  const file = Bun.file(CONFIG_FILE);
  const exists = await file.exists();
  if (!exists) {
    throw new Error(`Файл конфигурации ${CONFIG_FILE} не найден.`);
  }
  try {
    const sources: Source[] = await file.json();
    return sources;
  } catch (error) {
    throw new Error(`Ошибка парсинга ${CONFIG_FILE}. Убедитесь, что это валидный JSON.`, { cause: error });
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
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('##') && !line.startsWith('# '))
    .map(line => line.replace(/^- /g, '').trim());

  return new Set(dramas);
}

/**
 * Загружает и парсит дорамы из одного источника.
 */
async function fetchDramasFromSource(source: Source): Promise<string[]> {
  try {
    const response = await fetch(source.url);
    if (!response.ok) {
      console.error(`Ошибка при загрузке ${source.url}: ${response.statusText}`);
      return [];
    }
    const json = await response.json();
    const titles = JSONPath({ path: source.jsonPath, json: json as any });
    
    return Array.isArray(titles) ? titles.filter(t => typeof t === 'string') : [];
  } catch (error) {
    console.error(`Не удалось обработать источник ${source.url}:`, error);
    return [];
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
async function appendNewDramas(newDramas: string[]): Promise<void> {
  const sortedDramas = [...newDramas].sort((a, b) => a.localeCompare(b));
  
  const timestamp = getTimestamp();
  const existingContent = await Bun.file(DRAMA_LIST_FILE).exists() ? await Bun.file(DRAMA_LIST_FILE).text() : "";

  let newSection = `\n## ${timestamp}\n`;
  newSection += sortedDramas.map(drama => `- ${drama}`).join('\n');
  newSection += '\n';

  await Bun.write(DRAMA_LIST_FILE, existingContent + newSection);
  
  console.log(`✨ Найдено и добавлено ${sortedDramas.length} новых дорам:`);
  sortedDramas.forEach(drama => console.log(`  - ${drama}`));
}

/**
 * Основная функция
 */
async function main() {
  console.log('🔍 Начинаем поиск новых дорам...');

  const SOURCES = await loadConfig();
  console.log(`📂 Конфигурация загружена. Источников для проверки: ${SOURCES.length}`);

  const existingDramas = await getExistingDramas();
  console.log(`📝 Найдено ${existingDramas.size} дорам в текущем списке.`);

  const fetchPromises = SOURCES.map(fetchDramasFromSource);
  const results = await Promise.all(fetchPromises);
  const allFetchedDramas = new Set(results.flat().filter(Boolean)); // filter(Boolean) уберет пустые строки

  console.log(`📥 Всего загружено ${allFetchedDramas.size} уникальных названий из всех источников.`);

  const newDramas = [...allFetchedDramas].filter(drama => !existingDramas.has(drama));

  if (newDramas.length === 0) {
    console.log('✅ Новых дорам не найдено.');
  } else {
    await appendNewDramas(newDramas);
  }
  
  console.log('🏁 Работа скрипта завершена.');
}

// Запуск
main().catch(error => {
    console.error('❌ Произошла критическая ошибка:', error.message);
    process.exit(1);
});