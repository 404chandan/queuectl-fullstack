import { exec } from 'child_process';
import Job from './models/Job.js';
import Worker from './models/Worker.js';
import { backoffDelay } from './utils/backoff.js';
import dotenv from 'dotenv';
dotenv.config();

const BACKOFF_BASE = Number(process.env.BACKOFF_BASE || 2);

export async function startWorkers({ count = 1, workerIdPrefix = 'worker' , sse=null}) {
  const workers = [];
  for (let i = 0; i < count; i++) {
    const id = `${workerIdPrefix}-${Math.random().toString(36).slice(2, 8)}`;
    workers.push(runWorker(id, sse));
  }
  await Promise.all(workers);
}

async function runWorker(workerId, sse) {
  await Worker.findOneAndUpdate(
    { worker_id: workerId },
    { worker_id: workerId, started_at: new Date(), last_heartbeat: new Date(), active: true },
    { upsert: true }
  );

  let shutdown = false;
  process.on('SIGINT', async () => {
    shutdown = true;
  });

  while (!shutdown) {
    // heartbeat
    await Worker.updateOne({ worker_id: workerId }, { last_heartbeat: new Date(), active: true });

    const now = new Date();
    const job = await Job.findOneAndUpdate(
      {
        state: 'pending',
          $and: [
            { $or: [{ run_at: null }, { run_at: { $lte: now } }] },
            { $or: [{ locked_by: null }, { lock_until: { $lte: now } }] }
          ]
      },
      {
        $set: {
          state: 'processing',
          locked_by: workerId,
          lock_until: new Date(Date.now() + 60 * 1000),
          updated_at: new Date()
        }
      },
      { sort: { priority: -1, created_at: 1 }, new: true }
    ).setOptions({ overwriteDiscriminatorKey: true });

    // Note: Mongoose doesn't allow two $or keys; we rely on the fact pending jobs shouldn't be locked

    if (!job) {
      // sleep briefly
      await new Promise(r => setTimeout(r, 500));
      continue;
    }

    if (sse) sse.broadcast('job-picked', { id: job.id, workerId });

    const start = Date.now();
    try {
      const output = await execCommand(job.command);
      job.state = 'completed';
      job.output_log = (job.output_log || '') + `\n[${new Date().toISOString()}] OUTPUT:\n${output}`;
      job.locked_by = null;
      job.lock_until = null;
      job.updated_at = new Date();
      await job.save();
      if (sse) sse.broadcast('job-completed', { id: job.id, ms: Date.now() - start });
    } catch (err) {
      job.attempts += 1;
      job.last_error = String(err && err.message ? err.message : err);
      const maxRetries = job.max_retries ?? Number(process.env.DEFAULT_MAX_RETRIES || 3);

      if (job.attempts > maxRetries) {
        job.state = 'dead';
        job.locked_by = null;
        job.lock_until = null;
        job.updated_at = new Date();
        await job.save();
        if (sse) sse.broadcast('job-dead', { id: job.id, error: job.last_error });
      } else {
        const delaySec = backoffDelay(BACKOFF_BASE, job.attempts);
        job.state = 'failed'; // transient fail before requeue
        job.updated_at = new Date();
        await job.save();

        // requeue with run_at
        job.state = 'pending';
        job.run_at = new Date(Date.now() + delaySec * 1000);
        job.locked_by = null;
        job.lock_until = null;
        job.updated_at = new Date();
        await job.save();
        if (sse) sse.broadcast('job-retry', { id: job.id, attempts: job.attempts, delaySec });
      }
    }
  }

  await Worker.updateOne({ worker_id: workerId }, { active: false, last_heartbeat: new Date() });
}

function execCommand(cmd) {
  return new Promise((resolve, reject) => {
    const child = exec(cmd, { shell: true }, (error, stdout, stderr) => {
      if (error) return reject(error);
      resolve(stdout || stderr || '');
    });
  });
}