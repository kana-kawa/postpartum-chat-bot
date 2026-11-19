import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const CONVERSATION_KEY_PREFIX = 'dify:conversation:';

export async function askDify(key, userMessage) {
  const apiBase = process.env.DIFY_API_BASE || 'https://api.dify.ai/v1';
  const conversationId = (await redis.get(`${CONVERSATION_KEY_PREFIX}${key}`)) || '';

  const res = await fetch(`${apiBase}/chat-messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: {},
      query: userMessage,
      response_mode: 'blocking',
      conversation_id: conversationId,
      user: key,
    }),
  });

  if (!res.ok) {
    throw new Error(`Dify API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  if (data.conversation_id) {
    await redis.set(`${CONVERSATION_KEY_PREFIX}${key}`, data.conversation_id);
  }
  return data.answer;
}
