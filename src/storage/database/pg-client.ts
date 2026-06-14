import { Pool, type QueryResult, type QueryResultRow } from 'pg';

let pool: Pool | null = null;

function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
}

function getPgPool(): Pool {
  if (!pool) {
    const connectionString = getDatabaseUrl();
    pool = connectionString
      ? new Pool({ connectionString })
      : new Pool({
          host: process.env.PGHOST || '127.0.0.1',
          port: Number(process.env.PGPORT || 5432),
          database: process.env.PGDATABASE || 'vpn_node_tool',
          user: process.env.PGUSER || 'postgres',
          password: process.env.PGPASSWORD || undefined,
        });
  }

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return getPgPool().query<T>(text, params);
}

export { getPgPool };
