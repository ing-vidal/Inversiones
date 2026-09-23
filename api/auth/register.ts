import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initAuthDB, registerUser } from '../../lib/db';
import { hashPassword } from '../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, correo y contraseña son requeridos.' });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    await initAuthDB();
    const hashedPassword = hashPassword(password);
    const result = await registerUser(name, email, hashedPassword);
    if ('error' in result) {
      return res.status(409).json({ error: result.error });
    }
    return res.status(201).json({ user: result.user });
  } catch (error: any) {
    console.error('Register error:', error);
    if (error instanceof Error && error.message.includes('Database connection is not configured')) {
      return res.status(503).json({
        error: 'La base de datos no está configurada en Vercel. Añade DATABASE_URL y vuelve a desplegar.',
      });
    }
    return res.status(500).json({ error: 'Error al registrar usuario.' });
  }
}
