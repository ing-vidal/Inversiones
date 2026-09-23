import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initDB, getInstitutions } from '../lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await initDB();
    const list = await getInstitutions();
    return res.status(200).json(list);
  } catch (error: any) {
    console.error('Failed to fetch institutions:', error);
    return res.status(500).json({ error: 'Failed to fetch institutions' });
  }
}
