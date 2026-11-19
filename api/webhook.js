import crypto from 'crypto';
import { askDify } from '../lib/dify.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function isValidSignature(rawBody, signature, channelSecret) {
  const expected = crypto
    .createHmac('sha256', channelSecret)
    .update(rawBody)
    .digest('base64');
  return signature === expected;
}

async function replyToLine(replyToken, text) {
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  });

  if (!res.ok) {
    throw new Error(`LINE reply error: ${res.status} ${await res.text()}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const rawBody = await getRawBody(req);
  const signature = req.headers['x-line-signature'];

  if (!signature || !isValidSignature(rawBody, signature, process.env.LINE_CHANNEL_SECRET)) {
    res.status(401).send('invalid signature');
    return;
  }

  const body = JSON.parse(rawBody.toString('utf8'));
  const events = body.events || [];

  for (const event of events) {
    if (event.type !== 'message' || event.message.type !== 'text') continue;
    try {
      const answer = await askDify(event.source.userId, event.message.text);
      await replyToLine(event.replyToken, answer);
    } catch (err) {
      console.error(err);
    }
  }

  res.status(200).send('OK');
}
