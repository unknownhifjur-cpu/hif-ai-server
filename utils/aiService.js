/**
 * AI Integration Utility
 * Supports Gemini, Groq, OpenRouter, and OpenAI
 * Fallback chain + Language adaptive + India time + Full SYSTEM_PROMPT
 */

const https = require('https');

/**
 * Full SYSTEM_PROMPT
 */
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
- Start in **English**, then adapt to your preferred language dynamically.  
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
- Completed **10th (Madhyamik) at Bhagabanpur KBS High School**.  
- Only share these details if the user asks explicitly.

## ✨ Let’s Start!
Ask me anything — I’ll give **just the answer you need**, short or detailed depending on the question. No extra info unless you request it.`;

/**
 * Detect user language
 */
function detectLanguage(text) {
  const banglaRegex = /[\u0980-\u09FF]/;
  return banglaRegex.test(text) ? 'bn' : 'en';
}

/**
 * Handle special date/time questions
 */
function handleSpecialQuestions(messages, lang) {
  const userMsg = messages[messages.length - 1].content.toLowerCase();
  const now = new Date();
  const indiaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

  const pad = (n) => String(n).padStart(2, '0');

  if (userMsg.includes('আজকের তারিখ') || userMsg.includes("today's date")) {
    return lang === 'bn'
      ? `আজকের তারিখ (ভারত সময়) হলো ${indiaTime.getFullYear()}-${pad(indiaTime.getMonth()+1)}-${pad(indiaTime.getDate())}`
      : `Today's date (India time) is ${indiaTime.getFullYear()}-${pad(indiaTime.getMonth()+1)}-${pad(indiaTime.getDate())}`;
  }

  if (userMsg.includes('কত সময়') || userMsg.includes('current time')) {
    return lang === 'bn'
      ? `ভারত সময় এখন ${pad(indiaTime.getHours())}:${pad(indiaTime.getMinutes())}:${pad(indiaTime.getSeconds())}`
      : `India time now is ${pad(indiaTime.getHours())}:${pad(indiaTime.getMinutes())}:${pad(indiaTime.getSeconds())}`;
  }

  return null;
}

/**
 * HTTPS POST helper
 */
function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = { hostname, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers } };
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
          else reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
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
 * API calls
 */
async function callGemini(messages, apiKey, systemPromptOverride) {
  if (!apiKey) throw new Error('No Gemini API key');

  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  const response = await httpsPost(
    'generativelanguage.googleapis.com',
    `/v1/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
    {},
    {
      system_instruction: { parts: [{ text: systemPromptOverride || SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    }
  );

  return response.candidates[0].content.parts[0].text;
}

async function callGroq(messages, apiKey, systemPromptOverride) {
  if (!apiKey) throw new Error('No Groq API key');
  const response = await httpsPost('api.groq.com', '/openai/v1/chat/completions', { Authorization: `Bearer ${apiKey}` }, {
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'system', content: systemPromptOverride || SYSTEM_PROMPT }, ...messages],
    temperature: 0.7,
    max_tokens: 2048
  });
  return response.choices[0].message.content;
}

async function callOpenRouter(messages, apiKey, systemPromptOverride) {
  if (!apiKey) throw new Error('No OpenRouter API key');
  const response = await httpsPost('openrouter.ai', '/api/v1/chat/completions', {
    Authorization: `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://hif-ai.app',
    'X-Title': 'Hif AI - Student Tutor'
  }, {
    model: 'meta-llama/llama-3.1-8b-instruct:free',
    messages: [{ role: 'system', content: systemPromptOverride || SYSTEM_PROMPT }, ...messages],
    temperature: 0.7,
    max_tokens: 2048
  });
  return response.choices[0].message.content;
}

async function callOpenAI(messages, apiKey, systemPromptOverride) {
  if (!apiKey) throw new Error('No OpenAI API key');
  const response = await httpsPost('api.openai.com', '/v1/chat/completions', { Authorization: `Bearer ${apiKey}` }, {
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: systemPromptOverride || SYSTEM_PROMPT }, ...messages],
    temperature: 0.7,
    max_tokens: 2048
  });
  return response.choices[0].message.content;
}

/**
 * Main AI call function
 */
async function getAIResponse(messages) {
  const lang = detectLanguage(messages[messages.length - 1].content);

  const specialAnswer = handleSpecialQuestions(messages, lang);
  if (specialAnswer) return { response: specialAnswer, provider: 'SpecialHandler' };

  const systemPromptWithLang = SYSTEM_PROMPT + (lang === 'bn' ? '\n\n💡 এখন বাংলায় সংক্ষিপ্তভাবে উত্তর দাও।' : '\n\n💡 Answer concisely in English.');

  const providers = [
    { name: 'Gemini', fn: callGemini, key: process.env.GEMINI_API_KEY },
    { name: 'Groq', fn: callGroq, key: process.env.GROQ_API_KEY },
    { name: 'OpenRouter', fn: callOpenRouter, key: process.env.OPENROUTER_API_KEY },
    { name: 'OpenAI', fn: callOpenAI, key: process.env.OPENAI_API_KEY }
  ];

  const errors = [];

  for (const provider of providers) {
    if (!provider.key) { errors.push(`${provider.name}: No API key configured`); continue; }
    try {
      console.log(`[AI] Trying ${provider.name}...`);
      const response = await provider.fn(messages, provider.key, systemPromptWithLang);
      console.log(`[AI] Success with ${provider.name}`);
      return { response, provider: provider.name };
    } catch (error) {
      console.error(`[AI] ${provider.name} failed:`, error.message);
      errors.push(`${provider.name}: ${error.message}`);
    }
  }

  throw new Error(`All AI providers failed:\n${errors.join('\n')}`);
}

module.exports = { getAIResponse };