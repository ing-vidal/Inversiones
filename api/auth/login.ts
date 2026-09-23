import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initAuthDB, loginUser } from '../../lib/db';
import { hashPassword } from '../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await initAuthDB();
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son requeridos.' });
    }

    const hashedPassword = hashPassword(password);
    const result = await loginUser(email, hashedPassword);
    if ('error' in result) {
      return res.status(401).json({ error: result.error });
    }
    return res.status(200).json({ user: result.user });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Error al iniciar sesión.' });
  }
}
