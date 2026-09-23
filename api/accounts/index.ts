import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initDB, getAccounts, createAccount } from '../../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  await initDB();

  if (req.method === 'GET') {
    try {
      const list = await getAccounts();
      return res.status(200).json(list);
    } catch (error: any) {
      console.error('Failed to fetch accounts:', error);
      return res.status(500).json({ error: 'Failed to fetch accounts' });
    }
  }

  if (req.method === 'POST') {
    try {
      const account = req.body;
      if (!account || !account.id || !account.institutionName) {
        return res.status(400).json({ error: 'Missing required account fields' });
      }
      const created = await createAccount(account);
      return res.status(201).json(created);
    } catch (error: any) {
      console.error('Error creating account:', error);
      return res.status(500).json({ error: 'Failed to create account' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
