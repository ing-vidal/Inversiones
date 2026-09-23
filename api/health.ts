import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initDB } from '../lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({
        status: 'error',
        message: 'DATABASE_URL is not configured in Vercel.',
      });
    }

    await initDB();
    return res.status(200).json({
      status: 'ok',
      database: 'neondb:postgresql',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Health check/init error:', {
      message: error?.message,
      stack: error?.stack,
      dbConfigured: Boolean(process.env.DATABASE_URL),
    });
    return res.status(500).json({
      status: 'error',
      message: error?.message || 'Database initialization error',
    });
  }
}
