
Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## Команды проекта

- `bun run lint` - Проверка кода линтером (biome)
- `bun run typecheck` - Проверка типов TypeScript
- `bun run test` - Запуск тестов (bun test)
- `bun run schema:generate` - Перегенерация config.schema.json
- `bun run src/index.ts` - Запуск приложения
- `bun run build:linux` / `build:windows` / `build:macos-intel` / `build:macos-arm` - Сборка бинарников

## Архитектура

```
src/
├── core/config/schema.ts        # Zod-схемы и валидация config.json
├── core/drama/fetcher.ts        # Загрузка дорам из API (JSONPath)
├── core/drama/storage.ts        # Работа с drama-list.md
├── services/telegram/notifications.ts  # Уведомления через grammy
└── index.ts                     # Точка входа
```

## Ключевые паттерны

- Импорты через алиас `@/` (tsconfig paths → `./src/*`)
- Конфиг: `config.json` валидируется zod-схемой; `config.schema.json` генерируется скриптом `schema:generate`
- `drama-list.md` — markdown-список дорам: секции `## ДД.ММ.ГГГГ ЧЧ:ММ`, подсекции `### <источник>`, строки `- <название>`
- `config.json` и `drama-list.md` в .gitignore
- Lefthook: pre-commit = biome + typecheck, pre-push = lint + typecheck + test; локально `bunx lefthook run <hook>` (не в PATH)
- При критической ошибке приложение ждёт Enter перед выходом (не для CI)
- `bun run lint` = `biome check --write` — модифицирует файлы
- `response.json()` в Bun возвращает `unknown` — кастуй к `object` для JSONPath

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

### Gotchas тестов

- Мок `globalThis.fetch`: `as unknown as typeof fetch` (у Bun-ового fetch есть `preconnect`, прямой каст не проходит)
- Мок `grammy` через `mock.module('grammy', ...)`
- `BunFile.delete()` бросает ENOENT, если файла нет — проверяй `.exists()` перед удалением
- storage-функции принимают опциональный `filePath` (по умолчанию `drama-list.md`) — тесты пишут во временный файл
- `RequestInfo` недоступен (lib ESNext без DOM) — в моке fetch используй `string` для url

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.
