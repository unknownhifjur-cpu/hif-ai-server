/**
 * Hif AI - Express Server
 * Student AI Tutor Backend
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');

const chatRoutes = require('./routes/chat');
const Chat = require('./models/Chat');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── CORS Configuration ─────────────────────────────────────────────────────
// Allow multiple origins: localhost for development, and the production frontend URL from env
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL, // e.g., https://hifai.vercel.app
].filter(Boolean); // remove undefined

app.use(cors({
  origin: allowedOrigins,
  credentials: true, // if you ever need cookies/auth headers
}));

// ─── Middleware ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/chat', chatRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Hif AI is running!',
    timestamp: new Date().toISOString(),
    aiProviders: {
      gemini: !!process.env.GEMINI_API_KEY,
      groq: !!process.env.GROQ_API_KEY,
      openrouter: !!process.env.OPENROUTER_API_KEY,
      openai: !!process.env.OPENAI_API_KEY
    }
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── MongoDB Connection ─────────────────────────────────────────────────────
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hif-ai');
    console.log('[DB] MongoDB connected successfully');

    // Ensure TTL indexes exist for auto-deletion after 24 hours
    const chatCollection = mongoose.connection.db.collection('chats');
    await chatCollection.createIndex({ lastActivity: 1 }, { expireAfterSeconds: 86400 });
    console.log('[DB] TTL index ensured on lastActivity (24h expiry)');
  } catch (error) {
    console.error('[DB] MongoDB connection failed:', error.message);
    console.log('[DB] Retrying in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
}

/**
 * Cron job backup cleanup: runs every hour to delete chats older than 24 hours
 * This is a backup to MongoDB's TTL index for extra reliability
 */
cron.schedule('0 * * * *', async () => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await Chat.deleteMany({ lastActivity: { $lt: cutoff } });
    if (result.deletedCount > 0) {
      console.log(`[Cron] Cleaned up ${result.deletedCount} expired chats`);
    }
  } catch (error) {
    console.error('[Cron] Cleanup error:', error.message);
  }
});

// ─── Start Server ───────────────────────────────────────────────────────────
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Hif AI Server running on http://localhost:${PORT}`);
    console.log(`📚 Student AI Tutor — Ready to help!\n`);
  });
});