import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initDB, updateAccountBalance } from '../../../lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await initDB();
    const ownerId = req.headers['x-user-id'];
    if (typeof ownerId !== 'string' || !ownerId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }
    const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    if (!id) {
      return res.status(400).json({ error: 'Missing account ID' });
    }

    const { amountDelta } = req.body || {};
    if (typeof amountDelta !== 'number') {
      return res.status(400).json({ error: 'amountDelta must be a number' });
    }
    const updated = await updateAccountBalance(id, amountDelta, ownerId);
    if (!updated) {
      return res.status(404).json({ error: 'Account not found' });
    }
    return res.status(200).json(updated);
  } catch (error: any) {
    console.error('Failed to update account balance:', error);
    return res.status(503).json({ error: error?.message || 'Database unavailable' });
  }
}
