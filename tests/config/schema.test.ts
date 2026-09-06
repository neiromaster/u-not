/**
 * Тесты валидации конфигурации
 *
 * @module tests/config/schema
 */

import { describe, expect, test } from 'bun:test';
import { validateConfig } from '@/core/config/schema';

describe('validateConfig', () => {
  test('принимает валидный конфиг', () => {
    const config = {
      sources: [
        {
          name: 'Okko',
          url: 'https://example.com/api',
          type: 'api',
          jsonPath: 'result.*.title',
        },
      ],
    };

    expect(() => validateConfig(config)).not.toThrow();
  });

  test('принимает опциональные telegram и userAgent', () => {
    const config = {
      sources: [
        {
          name: 'Okko',
          url: 'https://example.com/api',
          type: 'api',
          jsonPath: 'result.*.title',
        },
      ],
      telegram: {
        botToken: 'token',
        chatId: ['-1001234567890'],
      },
      userAgent: 'Mozilla/5.0',
    };

    const result = validateConfig(config);
    expect(result.telegram?.botToken).toBe('token');
    expect(result.userAgent).toBe('Mozilla/5.0');
  });

  test('принимает posterJsonPath, linkJsonPath, linkBaseUrl, posterSize', () => {
    const config = {
      sources: [
        {
          name: 'Amediateka',
          url: 'https://example.com/api',
          type: 'api',
          jsonPath: 'results.*.title',
          posterJsonPath: 'results.*.assets.productPoster',
          linkJsonPath: 'results.*.webUrl',
          linkBaseUrl: 'https://amediateka.ru',
          posterSize: '400x600',
        },
      ],
    };

    expect(() => validateConfig(config)).not.toThrow();
  });

  test('бросает ошибку при отсутствии sources', () => {
    expect(() => validateConfig({})).toThrow();
  });

  test('бросает ошибку при невалидном url', () => {
    const config = {
      sources: [
        {
          name: 'Okko',
          url: 'not-a-url',
          type: 'api',
          jsonPath: 'result.*.title',
        },
      ],
    };

    expect(() => validateConfig(config)).toThrow();
  });

  test('бросает ошибку при неверном типе источника', () => {
    const config = {
      sources: [
        {
          name: 'Okko',
          url: 'https://example.com/api',
          type: 'html',
          jsonPath: 'result.*.title',
        },
      ],
    };

    expect(() => validateConfig(config)).toThrow();
  });

  test('принимает топ-уровневый flaresolverr с url и api', () => {
    const config = {
      sources: [
        {
          name: 'Okko',
          url: 'https://example.com/api',
          type: 'api',
          jsonPath: 'result.*.title',
          flaresolverr: true,
        },
      ],
      flaresolverr: {
        url: 'http://192.168.0.222:30098',
        api: 'secret-key',
      },
    };

    const result = validateConfig(config);
    expect(result.flaresolverr?.url).toBe('http://192.168.0.222:30098');
    expect(result.flaresolverr?.api).toBe('secret-key');
    expect(result.sources[0]?.flaresolverr).toBe(true);
  });

  test('принимает flaresolverr без api', () => {
    const config = {
      sources: [
        {
          name: 'Okko',
          url: 'https://example.com/api',
          type: 'api',
          jsonPath: 'result.*.title',
        },
      ],
      flaresolverr: {
        url: 'http://192.168.0.222:30098',
      },
    };

    expect(() => validateConfig(config)).not.toThrow();
  });

  test('бросает ошибку при невалидном url в flaresolverr', () => {
    const config = {
      flaresolverr: {
        url: 'not-a-url',
      },
    };

    expect(() => validateConfig(config)).toThrow();
  });

  test('бросает ошибку, если источник использует flaresolverr, но он не настроен', () => {
    const config = {
      sources: [
        {
          name: 'Okko',
          url: 'https://example.com/api',
          type: 'api',
          jsonPath: 'result.*.title',
          flaresolverr: true,
        },
      ],
    };

    expect(() => validateConfig(config)).toThrow();
  });

  test('принимает errorSleepSeconds', () => {
    const config = {
      sources: [
        {
          name: 'Okko',
          url: 'https://example.com/api',
          type: 'api',
          jsonPath: 'result.*.title',
        },
      ],
      errorSleepSeconds: 5,
    };

    const result = validateConfig(config);
    expect(result.errorSleepSeconds).toBe(5);
  });

  test('бросает ошибку при отрицательном errorSleepSeconds', () => {
    const config = {
      sources: [
        {
          name: 'Okko',
          url: 'https://example.com/api',
          type: 'api',
          jsonPath: 'result.*.title',
        },
      ],
      errorSleepSeconds: -1,
    };

    expect(() => validateConfig(config)).toThrow();
  });
});
