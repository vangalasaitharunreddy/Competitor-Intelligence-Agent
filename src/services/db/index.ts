import type { IntelligenceRepository } from './repository.ts';
import { SqliteRepository } from './sqlite-repository.ts';
import { PostgresRepository } from './postgres-repository.ts';

let repositoryInstance: IntelligenceRepository | null = null;
let dbStatusInfo: {
  type: 'postgres_durable' | 'sqlite_local_preview';
  label: string;
  status: 'connected' | 'error';
  warning?: string;
} = {
  type: 'sqlite_local_preview',
  label: 'SQLite Local Preview Storage (Ephemeral - Not durable across redeployments)',
  status: 'connected',
  warning: 'Preview filesystem storage does not survive redeployments. Set DATABASE_URL for durable PostgreSQL deployment.',
};

export async function getRepository(): Promise<IntelligenceRepository> {
  if (repositoryInstance) return repositoryInstance;

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl && (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://'))) {
    try {
      console.log('Attempting PostgreSQL connection via DATABASE_URL...');
      const pgRepo = new PostgresRepository(databaseUrl);
      await pgRepo.init();
      console.log('PostgreSQL durable database initialized successfully.');
      repositoryInstance = pgRepo;
      const isSupabase = databaseUrl.includes('supabase');
      dbStatusInfo = {
        type: 'postgres_durable',
        label: isSupabase ? 'PostgreSQL Durable Cloud Database (Supabase)' : 'PostgreSQL Durable Cloud Database',
        status: 'connected',
      };
      return repositoryInstance;
    } catch (err: any) {
      console.error('Failed to initialize PostgreSQL from DATABASE_URL, falling back to SQLite preview:', err.message);
      dbStatusInfo = {
        type: 'sqlite_local_preview',
        label: 'SQLite Local Preview Storage (Fallback)',
        status: 'connected',
        warning: `DATABASE_URL was provided but failed to connect (${err.message}). Using local preview SQLite.`,
      };
    }
  }

  // Fallback to SQLite Preview
  console.log('Using SQLite local preview repository...');
  const sqliteRepo = new SqliteRepository();
  await sqliteRepo.init();
  repositoryInstance = sqliteRepo;
  dbStatusInfo = {
    type: 'sqlite_local_preview',
    label: 'SQLite Local Preview Storage (Ephemeral)',
    status: 'connected',
    warning: 'Local preview filesystem will not survive redeployments. For production persistence, configure DATABASE_URL in environment.',
  };
  return repositoryInstance;
}

export function getDatabaseStatusInfo() {
  return dbStatusInfo;
}
