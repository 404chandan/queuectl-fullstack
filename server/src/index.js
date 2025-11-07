import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jobsRouter from './routes/jobs.js';
import configRouter from './routes/config.js';
import workersRouter from './routes/workers.js';
import { initSSE } from './utils/sse.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const sse = initSSE(app);
app.locals.sse = sse;

app.use('/api', jobsRouter);
app.use('/api/config', configRouter);
app.use('/api/workers', workersRouter);

const PORT = process.env.PORT || 4000;

mongoose.connect(process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/queuectl')
  .then(() => {
    console.log('Mongo connected');
    app.listen(PORT, () => console.log('Server on :', PORT));
  })
  .catch(err => {
    console.error('Mongo connection error:', err);
    process.exit(1);
  });