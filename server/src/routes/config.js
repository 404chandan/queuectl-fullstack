import express from 'express';
import Config from '../models/Config.js';

const router = express.Router();

router.get('/', async (_req, res) => {
  const docs = await Config.find({});
  const cfg = {};
  for (const d of docs) cfg[d.key] = d.value;
  res.json(cfg);
});

router.post('/set', async (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'key required' });
  await Config.findOneAndUpdate({ key }, { key, value }, { upsert: true });
  res.json({ ok: true });
});

export default router;