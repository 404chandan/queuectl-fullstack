#!/usr/bin/env node
import { Command } from 'commander';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Job from './models/Job.js';
import Worker from './models/Worker.js';
import { startWorkers } from './worker.js';
dotenv.config();

const program = new Command();
program
  .name('queuectl')
  .description('CLI for queuectl job system')
  .version('1.0.0');

async function db() {
  await mongoose.connect(process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/queuectl');
}

program
  .command('enqueue')
  .argument('<jobJson>', 'JSON job payload')
  .description('Add a new job to the queue')
  .action(async (jobJson) => {
    await db();
    try {
      const payload = JSON.parse(jobJson);
      if (!payload.id || !payload.command) {
        console.error('id and command are required');
        process.exit(1);
      }
      payload.state = payload.state || 'pending';
      payload.created_at = payload.created_at ? new Date(payload.created_at) : new Date();
      payload.updated_at = new Date();
      await Job.create(payload);
      console.log('Enqueued', payload.id);
    } catch (e) {
      console.error('Error:', e.message || e);
      process.exit(1);
    } finally {
      await mongoose.disconnect();
    }
  });

program
  .command('worker')
  .description('Manage workers')
  .option('--count <n>', 'number of workers', '1')
  .action(async (opts) => {
    await db();
    const n = parseInt(opts.count, 10) || 1;
    console.log(`Starting ${n} worker(s). Press Ctrl+C to stop.`);
    await startWorkers({ count: n });
    await mongoose.disconnect();
  });

program
  .command('status')
  .description('Show summary of all job states & active workers')
  .action(async () => {
    await db();
    const JobModel = Job;
    const states = ['pending','processing','completed','failed','dead'];
    const counts = {};
    for (const s of states) counts[s] = await JobModel.countDocuments({ state: s });
    const workers = await Worker.countDocuments({ active: true });
    console.log({ counts, active_workers: workers });
    await mongoose.disconnect();
  });

program
  .command('list')
  .option('--state <state>', 'filter by state')
  .description('List jobs by state')
  .action(async (opts) => {
    await db();
    const filter = opts.state ? { state: opts.state } : {};
    const jobs = await Job.find(filter).sort({ created_at: -1 }).limit(100);
    console.log(jobs.map(j => ({ id: j.id, state: j.state, attempts: j.attempts, command: j.command })));
    await mongoose.disconnect();
  });

program
  .command('dlq')
  .description('Dead Letter Queue operations')
  .option('list', 'list DLQ jobs')
  .action(async () => {
    await db();
    const jobs = await Job.find({ state: 'dead' }).sort({ updated_at: -1 }).limit(100);
    console.log(jobs.map(j => ({ id: j.id, attempts: j.attempts, last_error: j.last_error })));
    await mongoose.disconnect();
  });

program
  .command('dlq-retry')
  .argument('<id>', 'job id to retry')
  .action(async (id) => {
    await db();
    const job = await Job.findOne({ id });
    if (!job) {
      console.error('Not found'); process.exit(1);
    }
    job.state = 'pending';
    job.attempts = 0;
    job.run_at = new Date();
    job.updated_at = new Date();
    await job.save();
    console.log('Requeued', id);
    await mongoose.disconnect();
  });

program
  .command('config')
  .description('Manage configuration via env (BACKOFF_BASE, DEFAULT_MAX_RETRIES). Use .env file.')
  .action(() => {
    console.log({
      BACKOFF_BASE: process.env.BACKOFF_BASE || 2,
      DEFAULT_MAX_RETRIES: process.env.DEFAULT_MAX_RETRIES || 3
    });
  });

program.parseAsync(process.argv);