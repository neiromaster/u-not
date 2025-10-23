import { writeFileSync } from 'fs';
import { z } from 'zod';
import { configSchema } from './config';

const jsonSchema = z.toJSONSchema(configSchema, {
  override: (ctx) => {
    if (ctx.zodSchema === configSchema && ctx.jsonSchema.properties) {
      ctx.jsonSchema.properties.$schema = { type: 'string' };
    }
  },
});

writeFileSync('config.schema.json', JSON.stringify(jsonSchema, null, 2));

console.log('JSON schema generated successfully!');
