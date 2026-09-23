import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initDB, getYieldHistory, createYieldRecord } from '../../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await initDB();

    if (req.method === 'GET') {
      const history = await getYieldHistory();
      return res.status(200).json(history);
    }

    if (req.method === 'POST') {
      const record = req.body;
      if (!record || !record.id || !record.bankName) {
        return res.status(400).json({ error: 'Invalid record data' });
      }
      const created = await createYieldRecord(record);
      return res.status(201).json(created);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('History API error:', {
      message: error?.message,
      stack: error?.stack,
      body: req.body,
    });

    return res.status(500).json({
      error: 'Database unavailable',
      details: error?.message || 'Unknown error',
    });
  }
}
