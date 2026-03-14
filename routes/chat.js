/**
 * Chat Routes
 * POST /api/chat/ask       - Send question, get AI answer, save to DB
 * POST /api/chat/new       - Create a new empty chat
 * GET  /api/chat/history   - Get all chats for a session
 * GET  /api/chat/:chatId   - Get full messages of a chat
 * DELETE /api/chat/:chatId - Delete a specific chat
 */

const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const { getAIResponse } = require('../utils/aiService');

/**
 * Generate a short title from the first user message
 */
function generateTitle(message, subject) {
  const trimmed = message.trim();
  if (trimmed.length <= 50) return trimmed;
  return trimmed.substring(0, 47) + '...';
}

/**
 * POST /api/chat/ask
 * Body: { sessionId, chatId (optional), question, subject }
 * Creates a new chat if chatId not provided, then gets AI answer
 */
router.post('/ask', async (req, res) => {
  try {
    const { sessionId, chatId, question, subject = 'General' } = req.body;

    if (!sessionId || !question) {
      return res.status(400).json({ error: 'sessionId and question are required' });
    }

    let chat;

    // Find existing chat or create new one
    if (chatId) {
      chat = await Chat.findOne({ _id: chatId, sessionId });
      if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
      }
    } else {
      // Create a new chat
      chat = new Chat({
        sessionId,
        title: generateTitle(question, subject),
        subject
      });
    }

    // Add user message
    const userMessage = {
      role: 'user',
      content: question,
      subject,
      createdAt: new Date()
    };
    chat.messages.push(userMessage);

    // Prepare conversation history for AI (last 10 messages for context)
    const conversationHistory = chat.messages.slice(-10).map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Get AI response with fallback chain
    let aiText;
    let usedProvider;
    try {
      const result = await getAIResponse(conversationHistory);
      aiText = result.response;
      usedProvider = result.provider;
    } catch (aiError) {
      console.error('[Route] AI error:', aiError.message);
      return res.status(503).json({
        error: 'AI service temporarily unavailable. Please try again.',
        details: aiError.message
      });
    }

    // Add AI response message
    const assistantMessage = {
      role: 'assistant',
      content: aiText,
      subject,
      createdAt: new Date()
    };
    chat.messages.push(assistantMessage);

    // Update chat metadata
    if (chat.messages.length === 2) {
      // First exchange — set title from question
      chat.title = generateTitle(question, subject);
    }
    chat.subject = subject;
    chat.lastActivity = new Date();

    await chat.save();

    res.json({
      chatId: chat._id,
      title: chat.title,
      userMessage,
      assistantMessage: {
        ...assistantMessage,
        provider: usedProvider
      }
    });
  } catch (error) {
    console.error('[Route /ask] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/chat/new
 * Body: { sessionId, subject }
 * Creates a blank chat and returns its ID
 */
router.post('/new', async (req, res) => {
  try {
    const { sessionId, subject = 'General' } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const chat = new Chat({ sessionId, subject, title: 'New Chat' });
    await chat.save();

    res.json({ chatId: chat._id, title: chat.title, subject: chat.subject });
  } catch (error) {
    console.error('[Route /new] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/chat/history
 * Query: sessionId
 * Returns all chats for the session (no messages, just metadata)
 */
router.get('/history', async (req, res) => {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const chats = await Chat.find({ sessionId })
      .select('_id title subject createdAt lastActivity')
      .sort({ lastActivity: -1 })
      .lean();

    res.json({ chats });
  } catch (error) {
    console.error('[Route /history] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/chat/:chatId
 * Returns full chat with all messages
 */
router.get('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { sessionId } = req.query;

    const chat = await Chat.findOne({ _id: chatId, sessionId }).lean();

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json({ chat });
  } catch (error) {
    console.error('[Route /:chatId GET] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/chat/:chatId
 * Manually deletes a specific chat
 */
router.delete('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { sessionId } = req.query;

    const result = await Chat.findOneAndDelete({ _id: chatId, sessionId });

    if (!result) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json({ success: true, message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('[Route /:chatId DELETE] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
