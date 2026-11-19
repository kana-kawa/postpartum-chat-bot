import { askDify } from '../lib/dify.js';
import { checkChatLimit, getClientIp } from '../lib/ratelimit.js';

const MAX_MESSAGE_LENGTH = 1000;

// Web版チャットUI（Bolt.newで作成）から叩くエンドポイント。
// LINEのユーザーIDの代わりに、ブラウザ側で生成したセッションID（sessionId）を
// Difyの会話継続キーとして使う。

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const { message, sessionId } = req.body || {};

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'message is required' });
    return;
  }
  if (!sessionId || typeof sessionId !== 'string') {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ error: 'message is too long' });
    return;
  }

  // 回数制限（同じ接続元からの大量送信を止める）
  try {
    const allowed = await checkChatLimit(getClientIp(req));
    if (!allowed) {
      res.status(429).json({ error: 'too many requests' });
      return;
    }
  } catch (err) {
    // Redisに一時的につながらないときは、会話を止めないよう通す
    console.error('rate limit check failed', err);
  }

  try {
    const answer = await askDify(`web-${sessionId}`, message);
    res.status(200).json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
}
