import { z } from 'zod';

const chatIdSchema = z.union([z.string(), z.number()]);

const sourceSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  type: z.literal('api'),
  jsonPath: z.string(),
});

const telegramConfigSchema = z.object({
  botToken: z.string(),
  chatId: z.union([chatIdSchema, z.array(chatIdSchema)]),
});

export const configSchema = z.object({
  sources: z.array(sourceSchema),
  telegram: telegramConfigSchema.optional(),
});

export type Source = z.infer<typeof sourceSchema>;
export type Config = z.infer<typeof configSchema>;
export type ChatId = z.infer<typeof chatIdSchema>;

export function validateConfig(config: unknown): Config {
  const result = configSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid config: ${result.error.message}`);
  }
  return result.data;
}
