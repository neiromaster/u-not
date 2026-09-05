/**
 * Экспорт ядра приложения
 *
 * @module core/index
 */

export { configSchema, validateConfig } from '@/core/config/schema';
export {
  type FetchedDramas,
  fetchDramasFromSource,
} from '@/core/drama/fetcher';
export {
  appendNewDramas,
  getExistingDramas,
  getTimestamp,
} from '@/core/drama/storage';
