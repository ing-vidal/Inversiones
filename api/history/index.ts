import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initDB, getYieldHistory, createYieldRecord } from '../../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  await initDB();

  if (req.method === 'GET') {
    try {
      const history = await getYieldHistory();
      return res.status(200).json(history);
    } catch (error: any) {
      console.error('Failed to fetch history:', error);
      return res.status(500).json({ error: 'Failed to fetch history' });
    }
  }

  if (req.method === 'POST') {
    try {
      const record = req.body;
      if (!record || !record.id || !record.bankName) {
        return res.status(400).json({ error: 'Invalid record data' });
      }
      const created = await createYieldRecord(record);
      return res.status(201).json(created);
    } catch (error: any) {
      console.error('Failed to save yield record:', error);
      return res.status(500).json({ error: 'Failed to save yield record' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
