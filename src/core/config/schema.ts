/**
 * Конфигурация схемы для валидации конфигурационного файла
 *
 * @module config/schema
 */

import { z } from 'zod';

const chatIdSchema = z.union([z.string(), z.number()]);

const sourceSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  type: z.literal('api'),
  jsonPath: z.string(),
  posterJsonPath: z.string().optional(),
  linkJsonPath: z.string().optional(),
  linkBaseUrl: z.string().url().optional(),
  posterBaseUrl: z.string().url().optional(),
  posterSize: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  flaresolverrUrl: z.string().url().optional(),
  flaresolverrApiKey: z.string().optional(),
});

const telegramConfigSchema = z.object({
  botToken: z.string(),
  chatId: z.union([chatIdSchema, z.array(chatIdSchema)]),
});

const vkConfigSchema = z.object({
  accessToken: z.string(),
  peerId: z.union([z.number(), z.array(z.number())]),
  apiVersion: z.string().optional(),
});

export const configSchema = z.object({
  sources: z.array(sourceSchema),
  telegram: telegramConfigSchema.optional(),
  vk: vkConfigSchema.optional(),
  userAgent: z.string().optional(),
});

export type Source = z.infer<typeof sourceSchema>;
export type Config = z.infer<typeof configSchema>;
export type ChatId = z.infer<typeof chatIdSchema>;
export type VkConfig = z.infer<typeof vkConfigSchema>;

/**
 * Валидирует конфигурацию и возвращает отвалидированные данные
 *
 * @param config - Необработанная конфигурация для валидации
 * @returns Отвалидированная конфигурация
 * @throws Ошибка валидации если конфигурация неверна
 */
export function validateConfig(config: unknown): Config {
  const result = configSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid config: ${result.error.message}`);
  }
  return result.data;
}
