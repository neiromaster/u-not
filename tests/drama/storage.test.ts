/**
 * Тесты хранения и управления списком дорам
 *
 * @module tests/drama/storage
 */

import { afterEach, expect, test } from 'bun:test';
import {
  appendNewDramas,
  getExistingDramas,
  getTimestamp,
} from '@/core/drama/storage';

const TEST_FILE = 'drama-list.test.md';

afterEach(async () => {
  const file = Bun.file(TEST_FILE);
  if (await file.exists()) {
    await file.delete();
  }
});

test('getTimestamp возвращает формат ДД.ММ.ГГГГ ЧЧ:ММ', () => {
  const timestamp = getTimestamp();
  expect(timestamp).toMatch(/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/);
});

test('getExistingDramas возвращает пустой Set для несуществующего файла', async () => {
  const dramas = await getExistingDramas(TEST_FILE);
  expect(dramas.size).toBe(0);
});

test('getExistingDramas читает названия из файла', async () => {
  await Bun.write(
    TEST_FILE,
    '# Список дорам\n\n## 01.01.2026 10:00\n### Okko\n- Дорама 1\n- Дорама 2\n',
  );

  const dramas = await getExistingDramas(TEST_FILE);
  expect(dramas).toEqual(new Set(['Дорама 1', 'Дорама 2']));
});

test('appendNewDramas пишет только названия из Drama[]', async () => {
  await appendNewDramas(
    new Map([
      [
        'Okko',
        [
          {
            title: 'Дорама 1',
            posterUrl: 'https://img.example.com/poster1.jpg',
            link: 'https://example.com/watch/1',
          },
        ],
      ],
    ]),
    TEST_FILE,
  );

  const content = await Bun.file(TEST_FILE).text();
  expect(content).toContain('- Дорама 1');
  expect(content).not.toContain('poster1.jpg');
  expect(content).not.toContain('https://');
});

test('appendNewDramas создаёт файл с новой секцией', async () => {
  await appendNewDramas(
    new Map([['Okko', [{ title: 'Дорама 1' }]]]),
    TEST_FILE,
  );

  const content = await Bun.file(TEST_FILE).text();
  expect(content).toContain('### Okko');
  expect(content).toContain('- Дорама 1');
});

test('appendNewDramas дополняет существующий файл', async () => {
  await Bun.write(TEST_FILE, '## 01.01.2026 10:00\n### Okko\n- Старая\n');
  await appendNewDramas(
    new Map([['Netflix', [{ title: 'Новая' }]]]),
    TEST_FILE,
  );

  const content = await Bun.file(TEST_FILE).text();
  expect(content).toContain('- Старая');
  expect(content).toContain('### Netflix');
  expect(content).toContain('- Новая');
});
