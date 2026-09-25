import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initDB, getYieldHistory, createYieldRecord, updateYieldRecordBalance, updateYieldRecord } from '../../lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await initDB();

    if (req.method === 'GET') {
      const history = await getYieldHistory();
      return res.status(200).json(history);
    }

    if (req.method === 'POST') {
      const record = req.body;
      if (!record || !record.id || !record.bankName) {
        return res.status(400).json({ error: 'Invalid record data' });
      }
      const created = await createYieldRecord(record);
      return res.status(201).json(created);
    }

    if (req.method === 'PUT') {
      const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
      const balanceAtTime = Number(req.body?.balanceAtTime);
      const hasYieldChanges = ['grossYield', 'isrWithheld', 'netYield'].every(
        (field) => Number.isFinite(Number(req.body?.[field])),
      );
      if (!id || !Number.isFinite(balanceAtTime)) {
        return res.status(400).json({ error: 'Invalid record update data' });
      }
      const updated = hasYieldChanges
        ? await updateYieldRecord(id, {
            grossYield: Number(req.body.grossYield),
            isrWithheld: Number(req.body.isrWithheld),
            netYield: Number(req.body.netYield),
            balanceAtTime,
          })
        : await updateYieldRecordBalance(id, balanceAtTime);
      if (!updated) return res.status(404).json({ error: 'Record not found' });
      return res.status(200).json(updated);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('History API error:', {
      message: error?.message,
      stack: error?.stack,
      body: req.body,
    });

    return res.status(500).json({
      error: 'Database unavailable',
      details: error?.message || 'Unknown error',
    });
  }
}
