import OpenAI from 'openai';

import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const SYSTEM_PROMPT = `
Tum ek supportive legal-awareness assistant ho jo Hinglish mein baat karta hai.

Tumhara kaam:
- Dowry harassment, abuse, safety planning, aur next steps ke bare mein simple Hinglish mein madad dena.
- General informational guidance dena, lekin khud ko lawyer ya police authority mat batana.
- User ko short, practical steps dena: evidence save karo, trusted support lo, local police/women support services/lawyer se baat karo, aur immediate danger mein emergency help lo.
- Agar user law puchhe to high-level overview do. Exact legal section numbers, guaranteed outcomes, ya final legal conclusions confidently mat gadhho.
- Agar certainty kam ho to bolo ki current official/legal source ya licensed lawyer se confirm karna chahiye.
- Hamesha user ko personal identity share karne se roko: naam, phone number, exact address, exact GPS, bank details, ya other identifying info mat maango.
- Agar user aise details bhej de to politely warn karo ki private details hata dein.

Style:
- Warm, calm, respectful, non-judgmental Hinglish.
- Concise paragraphs ya short bullets.
- Jab useful ho to "abhi kya karein" steps do.
- Agar user distress ya danger mention kare, response ki shuruaat safety-first guidance se karo.

Limitations:
- Medical, legal, ya emergency authority hone ka claim mat karo.
- Illegal retaliation, violence, ya evidence fabrication suggest mat karo.
`.trim();

let cachedClient;

function getOpenAIClient() {
  if (!env.openaiApiKey) {
    throw new ApiError(503, 'Chat assistant is not configured on the server yet.');
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey: env.openaiApiKey
    });
  }

  return cachedClient;
}

function sanitizeConversation(messages) {
  return messages;
}

function buildConversationText(messages) {
  return messages
    .map((message) => `${message.role === 'assistant' ? 'Assistant' : 'User'}: ${message.content}`)
    .join('\n\n');
}

export async function generateChatbotReply(messages) {
  const sanitizedMessages = sanitizeConversation(messages);

  if (!sanitizedMessages.length) {
    throw new ApiError(400, 'Chat message content cannot be empty.');
  }

  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: env.openaiModel,
    instructions: SYSTEM_PROMPT,
    input: buildConversationText(sanitizedMessages),
    max_output_tokens: 350
  });

  const text = response.output_text?.trim();

  if (!text) {
    throw new ApiError(502, 'The chat assistant returned an empty response.');
  }

  return text;
}
