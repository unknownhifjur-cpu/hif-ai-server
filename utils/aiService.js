/**
 * AI Integration Utility
 * Supports Gemini, Groq, OpenRouter, and OpenAI
 * Uses a fallback chain: tries each provider in order until one succeeds
 */

const https = require('https');

// Student-focused system prompt in both English and Bengali
const SYSTEM_PROMPT = `🌟 Hey there! I'm Hif AI — your personal AI tutor and study buddy! Think of me as a super-smart friend who’s always patient, never judges, and genuinely loves helping you understand things. Let’s make learning feel like an adventure, not a chore 🚀

## 🎯 What I’m All About:
- **Step-by-step explanations** – I break things down like we’re building with LEGO bricks.  
- **Answer exactly what’s asked** – Only give info the user asks for. No extra details unless requested.  
- **Interactive dialogue** – Ask me anything, anytime. I'll guide you and make sure you're following along.  
- **Adapt to your level** – Match your pace, simpler or advanced as needed.  
- **Celebrate your wins** – Every “aha!” moment is a victory 🎉

## 📚 Subjects I Excel In:
- **Math 🧮** – Full solutions with step-by-step logic if required.  
- **Science 🔬** – Analogy-based explanations when needed.  
- **Programming 💻** – Working code, explained clearly.  
- **History & Geography 🌍** – Only relevant stories and explanations when asked.  
- **English & Literature ✍️** – Grammar, essays, poetry analysis, explained only if requested.  

## 🗣️ Language & Communication:
- Start in **English**, then adapt to your preferred language (like Bengali / বাংলা).  
- Keep answers simple, friendly, and precise.  

## 🌈 My Personality:
- Encouraging and patient.  
- Playful, with jokes or memes **only if relevant**.  
- Supportive, never sarcastic.  

## 📖 How I Format Answers:
- Markdown: headings, bullets, code blocks, bold for key terms.  
- Code includes comments and explanations when necessary.  
- Math: equations formatted clearly, step by step when needed.  

## 🆘 If You're Stuck:
- Say “I don’t get it” or “explain differently.”  
- I can give hints first, then full answers if requested.  

## 💡 About My Creator (only if asked):
- Hifjur? That curious human! A student who built me to make learning fun and accessible.  
- **Birthday:** 24th June 2008  
- Born in **Malda district, West Bengal, India**, currently in **Class 12 (2026)**.  
- Loves **coding** and exploring new technologies.  
- Completed **10th (Madhyamik) at Bhagabanpur KBS High School.  
- Only share these details if the user asks explicitly.

## ✨ Let’s Start!
Ask me anything — I’ll give **just the answer you need**, short or detailed depending on the question. No extra info unless you request it.`;

/**
 * Make an HTTPS POST request
 */
function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Call Google Gemini API
 */
async function callGemini(messages, apiKey) {
  if (!apiKey) throw new Error('No Gemini API key');

  // Convert messages to Gemini format
  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  const response = await httpsPost(
    'generativelanguage.googleapis.com',
    `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {},
    {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    }
  );

  return response.candidates[0].content.parts[0].text;
}

/**
 * Call Groq API (OpenAI-compatible)
 */
async function callGroq(messages, apiKey) {
  if (!apiKey) throw new Error('No Groq API key');

  const response = await httpsPost(
    'api.groq.com',
    '/openai/v1/chat/completions',
    { Authorization: `Bearer ${apiKey}` },
    {
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 2048
    }
  );

  return response.choices[0].message.content;
}

/**
 * Call OpenRouter API (OpenAI-compatible, access to many models)
 */
async function callOpenRouter(messages, apiKey) {
  if (!apiKey) throw new Error('No OpenRouter API key');

  const response = await httpsPost(
    'openrouter.ai',
    '/api/v1/chat/completions',
    {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://hif-ai.app',
      'X-Title': 'Hif AI - Student Tutor'
    },
    {
      model: 'meta-llama/llama-3.1-8b-instruct:free', // Free model on OpenRouter
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 2048
    }
  );

  return response.choices[0].message.content;
}

/**
 * Call OpenAI API
 */
async function callOpenAI(messages, apiKey) {
  if (!apiKey) throw new Error('No OpenAI API key');

  const response = await httpsPost(
    'api.openai.com',
    '/v1/chat/completions',
    { Authorization: `Bearer ${apiKey}` },
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 2048
    }
  );

  return response.choices[0].message.content;
}

/**
 * Main AI call function with fallback chain
 * Order: Gemini → Groq → OpenRouter → OpenAI
 * Falls back to next provider if one fails
 */
async function getAIResponse(messages) {
  const providers = [
    { name: 'Gemini', fn: callGemini, key: process.env.GEMINI_API_KEY },
    { name: 'Groq', fn: callGroq, key: process.env.GROQ_API_KEY },
    { name: 'OpenRouter', fn: callOpenRouter, key: process.env.OPENROUTER_API_KEY },
    { name: 'OpenAI', fn: callOpenAI, key: process.env.OPENAI_API_KEY }
  ];

  const errors = [];

  for (const provider of providers) {
    if (!provider.key) {
      errors.push(`${provider.name}: No API key configured`);
      continue;
    }

    try {
      console.log(`[AI] Trying ${provider.name}...`);
      const response = await provider.fn(messages, provider.key);
      console.log(`[AI] Success with ${provider.name}`);
      return { response, provider: provider.name };
    } catch (error) {
      console.error(`[AI] ${provider.name} failed:`, error.message);
      errors.push(`${provider.name}: ${error.message}`);
    }
  }

  // All providers failed
  throw new Error(`All AI providers failed:\n${errors.join('\n')}`);
}

module.exports = { getAIResponse };
