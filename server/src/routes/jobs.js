import express from 'express';
import Job from '../models/Job.js';

const router = express.Router();

router.post('/enqueue', async (req, res) => {
  try {
    const { id, command, max_retries, run_at, priority } = req.body;
    if (!id || !command) return res.status(400).json({ error: 'id and command are required' });
    const job = await Job.create({
      id, command,
      max_retries: max_retries ?? 3,
      run_at: run_at ? new Date(run_at) : null,
      priority: priority ?? 0
    });
    res.json(job);
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

router.get('/list', async (req, res) => {
  const { state } = req.query;
  const filter = state ? { state } : {};
  const jobs = await Job.find(filter).sort({ created_at: -1 }).limit(500);
  res.json(jobs);
});

router.get('/status', async (_req, res) => {
  const states = ['pending','processing','completed','failed','dead'];
  const counts = {};
  for (const s of states) {
    counts[s] = await Job.countDocuments({ state: s });
  }
  res.json({ counts });
});

router.post('/dlq/retry/:id', async (req, res) => {
  const { id } = req.params;
  const job = await Job.findOne({ id });
  if (!job) return res.status(404).json({ error: 'not found' });
  job.state = 'pending';
  job.attempts = 0;
  job.run_at = new Date();
  job.updated_at = new Date();
  await job.save();
  res.json({ ok: true });
});

router.get('/dlq/list', async (_req, res) => {
  const jobs = await Job.find({ state: 'dead' }).sort({ updated_at: -1 });
  res.json(jobs);
});

export default router;