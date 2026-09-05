/**
 * Генерация JSON-схемы конфигурации
 *
 * @module config/generate-schema
 */

import { z } from 'zod';
import { configSchema } from './schema';

const jsonSchema = z.toJSONSchema(configSchema, {
  override: (ctx) => {
    if (ctx.zodSchema === configSchema && ctx.jsonSchema.properties) {
      ctx.jsonSchema.properties.$schema = { type: 'string' };
    }
  },
});

await Bun.write('config.schema.json', JSON.stringify(jsonSchema, null, 2));

console.log('JSON schema generated successfully!');
