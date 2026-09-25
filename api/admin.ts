import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initDB, getAdminUsers, deleteUser } from '../lib/db.js';

const ADMIN_USER = 'admin';
const ADMIN_PASSWORD = 'admin';

function isAdmin(req: VercelRequest): boolean {
  return req.headers['x-admin-user'] === ADMIN_USER
    && req.headers['x-admin-password'] === ADMIN_PASSWORD;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await initDB();

    if (req.method === 'POST' && req.body?.action === 'login') {
      const { username, password } = req.body;
      if (username !== ADMIN_USER || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Credenciales administrativas incorrectas' });
      }
      return res.status(200).json({ authenticated: true });
    }

    if (!isAdmin(req)) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    if (req.method === 'GET') {
      return res.status(200).json({ users: await getAdminUsers() });
    }

    if (req.method === 'DELETE') {
      const userId = typeof req.body?.userId === 'string' ? req.body.userId : '';
      if (!userId) return res.status(400).json({ error: 'Usuario requerido' });
      const deleted = await deleteUser(userId);
      if (!deleted) return res.status(404).json({ error: 'Usuario no encontrado' });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Admin API error:', error);
    return res.status(503).json({ error: error?.message || 'Database unavailable' });
  }
}
