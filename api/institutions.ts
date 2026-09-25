import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initDB, getInstitutions, createInstitution, updateInstitution, deleteInstitution } from '../lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await initDB();

    if (req.method === 'GET') {
      const list = await getInstitutions();
      return res.status(200).json(list);
    }

    if (req.method === 'POST') {
      const institution = req.body;
      if (!institution || !institution.id || !institution.name) {
        return res.status(400).json({ error: 'Missing required institution fields' });
      }
      const created = await createInstitution(institution);
      return res.status(201).json(created);
    }

    const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    if (!id) {
      return res.status(400).json({ error: 'Missing institution ID' });
    }

    if (req.method === 'PUT') {
      const updated = await updateInstitution(id, req.body);
      if (!updated) return res.status(404).json({ error: 'Institution not found' });
      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      const success = await deleteInstitution(id);
      if (!success) return res.status(404).json({ error: 'Institution not found' });
      return res.status(200).json({ success: true, id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Failed to handle institutions:', error);
    return res.status(500).json({ error: error?.message || 'Failed to handle institutions' });
  }
}
