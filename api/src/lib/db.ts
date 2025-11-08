import dotenv from 'dotenv';
import pkg, { type QueryResultRow } from 'pg';

dotenv.config();

const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX ?? 10),
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

export const query = async <T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) => {
  const result = await pool.query<T>(sql, params);
  return result.rows;
};

export const withTransaction = async <T>(handler: (client: pkg.PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
