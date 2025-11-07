import mongoose from 'mongoose';

const ConfigSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true }
});

export default mongoose.model('Config', ConfigSchema);