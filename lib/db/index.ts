export {
  getDb,
  getSql,
  closeDb,
  safeQuery,
  isDatabaseConfigured,
  isPooledConnection,
  checkDatabaseHealth,
  type Database,
} from './client';

export * as schema from './schema';
