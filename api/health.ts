import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initDB } from '../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  try {
    await initDB();
    return res.status(200).json({
      status: 'ok',
      database: 'neondb:postgresql',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: error?.message || 'Database connection error',
    });
  }
}
