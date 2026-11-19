import { askDify } from '../lib/dify.js';

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

  try {
    const answer = await askDify(`web-${sessionId}`, message);
    res.status(200).json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
}
