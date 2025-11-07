import mongoose from 'mongoose';

const WorkerSchema = new mongoose.Schema({
  worker_id: { type: String, unique: true, required: true },
  started_at: { type: Date, default: () => new Date() },
  last_heartbeat: { type: Date, default: () => new Date() },
  active: { type: Boolean, default: true }
});

export default mongoose.model('Worker', WorkerSchema);