import { writeFileSync } from 'fs';
import { z } from 'zod';
import { configSchema } from './config';

const jsonSchema = z.toJSONSchema(configSchema);

writeFileSync('config.schema.json', JSON.stringify(jsonSchema, null, 2));

console.log('JSON schema generated successfully!');
