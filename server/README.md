# queuectl Server (Express + MongoDB)

## Setup
1. Copy `.env.sample` to `.env` and set `MONGO_URL` if needed.
2. `npm install`
3. `npm run start`

Exposes REST API at `http://localhost:4000` and an SSE stream at `/events`.
Also provides a CLI via `npm run cli -- <command>` (or after `npm link`, use `queuectl`).