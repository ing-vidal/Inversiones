import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initDB, updateAccount, deleteAccount } from '../../lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await initDB();
    const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    if (!id) {
      return res.status(400).json({ error: 'Missing account ID' });
    }

    if (req.method === 'PUT') {
      const updated = await updateAccount(id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Account not found' });
      }
      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      const success = await deleteAccount(id);
      if (!success) {
        return res.status(404).json({ error: 'Account not found' });
      }
      return res.status(200).json({ success: true, id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Account API error:', error);
    return res.status(503).json({ error: error?.message || 'Database unavailable' });
  }
}
