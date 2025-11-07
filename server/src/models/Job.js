import mongoose from 'mongoose';

const JobSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  command: { type: String, required: true },
  state: { type: String, enum: ['pending','processing','completed','failed','dead'], default: 'pending' },
  attempts: { type: Number, default: 0 },
  max_retries: { type: Number, default: 3 },
  created_at: { type: Date, default: () => new Date() },
  updated_at: { type: Date, default: () => new Date() },
  locked_by: { type: String, default: null },
  lock_until: { type: Date, default: null },
  run_at: { type: Date, default: null },
  priority: { type: Number, default: 0 },
  last_error: { type: String, default: null },
  output_log: { type: String, default: '' }
}, { minimize: false });

JobSchema.index({ state: 1, priority: -1, created_at: 1 });
JobSchema.index({ run_at: 1 });
JobSchema.index({ lock_until: 1 });

export default mongoose.model('Job', JobSchema);