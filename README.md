# QueueCTL — Full-Stack (CLI + API + React Dashboard)

A minimal production-style background job queue that supports:
- Enqueue and manage jobs
- Multiple workers with locking
- Exponential backoff retry + DLQ
- Persistent storage (MongoDB)
- CLI (`queuectl`) + REST API + React dashboard (Vite)
- Live updates via Server-Sent Events (SSE)

## Monorepo Layout
```
queuectl-fullstack/
  server/   # Node.js, Express, MongoDB, CLI
  web/      # Vite + React dashboard
```

## Quick Start

### 1) Start MongoDB
Local Mongo on default port is fine (mongodb://127.0.0.1:27017).

### 2) Backend
```bash
cd server
cp .env.sample .env   # adjust if needed
npm install
npm run start         # starts API on http://localhost:4000
```

### 3) Frontend
```bash
cd ../web
npm install
npm run dev           # http://localhost:5173 (proxied to server)
```

### 4) CLI (from /server)
```bash
# enqueue
npm run cli -- enqueue '{"id":"job1","command":"echo hello","max_retries":3}'

# start workers (Ctrl+C to stop)
npm run cli -- worker --count 2

# status
npm run cli -- status

# list jobs
npm run cli -- list --state pending

# DLQ list and retry
npm run cli -- dlq
npm run cli -- dlq-retry job1
```

## API Endpoints
- `POST /api/enqueue` { id, command, max_retries?, run_at?, priority? }
- `GET  /api/list?state=pending|processing|completed|failed|dead`
- `GET  /api/status`
- `GET  /api/dlq/list`
- `POST /api/dlq/retry/:id`
- `POST /api/workers/start` { count }
- `POST /api/workers/stop`
- `GET  /api/workers/list`
- `GET  /events` (SSE stream)

## Notes & Trade-offs
- Locking: `findOneAndUpdate` transitions a `pending` job to `processing` and sets a lease.
- Backoff: `delay = base^attempts` (base from `BACKOFF_BASE` env; default 2)
- Max retries: per-job `max_retries` or `DEFAULT_MAX_RETRIES` env (default 3)
- Graceful stop: CLI workers stop on Ctrl+C; API `/workers/stop` marks records inactive.
- This demo keeps things small—no external message broker needed.

## Testing the Core Flows
1. Enqueue a success job: `echo done`
2. Enqueue a failing job: `bash -c 'exit 42'` — watch retries and DLQ
3. Start 2+ workers; enqueue several jobs; verify no overlaps (each picked once)
4. Restart server; list jobs — data persists
5. Use dashboard to monitor live status and manage DLQ

## License
MIT