/**
 * Экспорт ядра приложения
 *
 * @module core/index
 */

export { configSchema, validateConfig } from '@/core/config/schema';
export {
  type Drama,
  type FetchAllResult,
  type FetchedDramas,
  fetchAllSources,
  fetchDramasFromSource,
  type SourceFailure,
} from '@/core/drama/fetcher';
export {
  appendNewDramas,
  getExistingDramas,
  getTimestamp,
} from '@/core/drama/storage';
