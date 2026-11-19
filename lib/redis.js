import { Redis } from '@upstash/redis';

// Upstash Redis への接続（会話IDの保存と、回数制限の両方で使う）
export const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});
