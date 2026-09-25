import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initDB, resetDatabase, getAccounts, getYieldHistory, getUserSettings } from '../lib/db.js';

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
    await resetDatabase(ownerId);
    const [accounts, history, settings] = await Promise.all([
      getAccounts(ownerId),
      getYieldHistory(ownerId),
      getUserSettings(),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Base de datos restaurada con éxito',
      accounts,
      history,
      settings,
    });
  } catch (error: any) {
    console.error('Failed to reset database:', error);
    return res.status(500).json({ error: 'Failed to reset database' });
  }
}
