const mongoose = require('mongoose');

// Message Schema
// TTL index on createdAt ensures messages auto-delete after 24 hours
const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    enum: ['Math', 'Science', 'Programming', 'English', 'History', 'Geography', 'General', 'Other'],
    default: 'General'
  },
  // TTL: messages expire after 24 hours automatically via MongoDB TTL index
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // 24 hours in seconds
  }
});

// Chat Schema
const chatSchema = new mongoose.Schema({
  // sessionId identifies a user session (stored in browser localStorage)
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    default: 'New Chat'
  },
  subject: {
    type: String,
    enum: ['Math', 'Science', 'Programming', 'English', 'History', 'Geography', 'General', 'Other'],
    default: 'General'
  },
  messages: [messageSchema],
  // TTL on chat: entire chat auto-deletes after 24 hours of inactivity
  lastActivity: {
    type: Date,
    default: Date.now,
    expires: 86400 // 24 hours
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Update lastActivity whenever a chat is modified
chatSchema.pre('save', function (next) {
  this.lastActivity = new Date();
  next();
});

module.exports = mongoose.model('Chat', chatSchema);
