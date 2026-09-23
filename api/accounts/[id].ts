import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initDB, updateAccount, deleteAccount } from '../../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  await initDB();

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) {
    return res.status(400).json({ error: 'Missing account ID' });
  }

  if (req.method === 'PUT') {
    try {
      const updated = await updateAccount(id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Account not found' });
      }
      return res.status(200).json(updated);
    } catch (error: any) {
      console.error('Failed to update account:', error);
      return res.status(500).json({ error: 'Failed to update account' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const success = await deleteAccount(id);
      if (!success) {
        return res.status(404).json({ error: 'Account not found' });
      }
      return res.status(200).json({ success: true, id });
    } catch (error: any) {
      console.error('Failed to delete account:', error);
      return res.status(500).json({ error: 'Failed to delete account' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
