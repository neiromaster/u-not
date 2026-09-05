# u-not (Updates NOTifier)

[![CI](https://github.com/neiromaster/u-not/actions/workflows/ci.yml/badge.svg)](https://github.com/neiromaster/u-not/actions/workflows/ci.yml)
[![Release](https://github.com/neiromaster/u-not/actions/workflows/release.yml/badge.svg)](https://github.com/neiromaster/u-not/actions/workflows/release.yml)

Утилита для мониторинга новых дорам на различных платформах и уведомления об обновлениях через Telegram.

## Установка зависимостей

```bash
bun install
```

## Запуск

```bash
bun run src/index.ts
```

## Структура проекта

```
src/
├── core/                  # Ядро приложения
│   ├── config/            # Конфигурация и валидация
│   │   └── schema.ts      # Zod схемы и валидация
│   ├── drama/             # Логика работы с дорамами
│   │   ├── fetcher.ts     # Загрузка данных из источников
│   │   └── storage.ts     # Хранение и обновление списка дорам
│   └── index.ts           # Экспорт ядра
│
├── services/              # Внешние сервисы
│   └── telegram/          # Telegram интеграция
│       └── notifications.ts # Отправка уведомлений
│
└── index.ts               # Точка входа приложения
```

## Конфигурация

Создайте файл `config.json` на основе примера:

```json
{
  "$schema": "https://raw.githubusercontent.com/neiromaster/u-not/main/config.schema.json",
  "sources": [
    {
      "name": "Amediateka",
      "url": "https://api.amediateka.tech/...",
      "type": "api",
      "jsonPath": "results.*.title",
      "posterJsonPath": "results.*.assets.productPoster",
      "linkJsonPath": "results.*.webUrl",
      "linkBaseUrl": "https://amediateka.ru",
      "posterSize": "400x600"
    }
  ],
  "telegram": {
    "botToken": "YOUR_BOT_TOKEN",
    "chatId": ["-1001234567890"]
  },
  "vk": {
    "accessToken": "YOUR_GROUP_TOKEN",
    "peerId": [2000000001],
    "apiVersion": "5.199"
  },
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0"
}
```

## Команды

- `bun run lint` - Проверка кода линтером
- `bun run typecheck` - Проверка типов TypeScript
- `bun run test` - Запуск тестов
- `bun run schema:generate` - Перегенерация `config.schema.json`
- `bun run src/index.ts` - Запуск приложения

## Архитектура

### Core
- **config/schema.ts**: Валидация конфигурации с использованием Zod
- **drama/fetcher.ts**: Загрузка данных из API источников
- **drama/storage.ts**: Работа с файлом drama-list.md

### Services
- **telegram/notifications.ts**: Отправка уведомлений через Telegram Bot API
- **vk/notifications.ts**: Отправка уведомлений в беседу VK через messages.send

### Утилиты
- Биоме для форматирования и линтинга
- Lefthook для пре-коммит хуков

## Лицензия

MIT License
