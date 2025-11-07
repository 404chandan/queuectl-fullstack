import express from 'express';
import Worker from '../models/Worker.js';
import { startWorkers } from '../worker.js';

const router = express.Router();

let running = false;
let runningPromise = null;

router.post('/start', async (req, res) => {
  if (running) return res.json({ ok: true, message: 'already running' });
  const { count = 1 } = req.body || {};
  running = true;
  runningPromise = startWorkers({ count, workerIdPrefix: 'api-worker' , sse: req.app.locals.sse});
  res.json({ ok: true });
});

router.post('/stop', async (_req, res) => {
  // There is no central kill; suggest Ctrl+C on process. For API, mark workers inactive.
  await Worker.updateMany({}, { active: false });
  res.json({ ok: true });
});

router.get('/list', async (_req, res) => {
  const workers = await Worker.find({}).sort({ last_heartbeat: -1 });
  res.json(workers);
});

export default router;