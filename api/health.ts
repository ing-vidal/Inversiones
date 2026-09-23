import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  try {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
    if (!url) {
      return res.status(503).json({
        status: 'error',
        message: 'DATABASE_URL is not configured in Vercel.',
      });
    }

    const sql = neon(url);
    await sql`SELECT 1`;
    return res.status(200).json({
      status: 'ok',
      database: 'neondb:postgresql',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Health check error:', error);
    return res.status(500).json({
      status: 'error',
      message: error?.message || 'Database connection error',
    });
  }
}
