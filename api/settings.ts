import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initDB, getUserSettings, updateUserSettings } from '../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  await initDB();

  if (req.method === 'GET') {
    try {
      const settings = await getUserSettings();
      return res.status(200).json(settings);
    } catch (error: any) {
      console.error('Failed to fetch settings:', error);
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const updated = await updateUserSettings(req.body);
      return res.status(200).json(updated);
    } catch (error: any) {
      console.error('Failed to update settings:', error);
      return res.status(500).json({ error: 'Failed to update settings' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
