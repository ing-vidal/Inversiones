import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initDB, getAccounts, createAccount } from '../../lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await initDB();
    const ownerId = req.headers['x-user-id'];
    if (typeof ownerId !== 'string' || !ownerId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    if (req.method === 'GET') {
      const list = await getAccounts(ownerId);
      return res.status(200).json(list);
    }

    if (req.method === 'POST') {
      const account = req.body;
      if (!account || !account.id || !account.institutionName) {
        return res.status(400).json({ error: 'Missing required account fields' });
      }
      const created = await createAccount(account, ownerId);
      return res.status(201).json(created);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Accounts API error:', error);
    return res.status(503).json({ error: error?.message || 'Database unavailable' });
  }
}
