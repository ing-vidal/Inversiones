import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initDB, updateUserAvatar } from '../../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await initDB();
    const { userId, avatar } = req.body || {};
    if (!userId || !avatar) {
      return res.status(400).json({ error: 'userId y avatar son requeridos.' });
    }
    if (typeof avatar !== 'string' || !avatar.startsWith('data:image/')) {
      return res.status(400).json({ error: 'El avatar debe ser una imagen válida.' });
    }
    if (avatar.length > 2_800_000) {
      return res.status(413).json({ error: 'La imagen es demasiado grande. Máximo 2 MB.' });
    }

    const updated = await updateUserAvatar(userId, avatar);
    if (!updated) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    return res.status(200).json({ user: updated });
  } catch (error: any) {
    console.error('Avatar update error:', error);
    return res.status(500).json({ error: 'Error al actualizar la foto de perfil.' });
  }
}
