import { Redis } from '@upstash/redis';

// Upstash Redis への接続（会話IDの保存と、回数制限の両方で使う）
// Vercelで作り直したRedisは UPSTASH_ で始まる名前で登録されている
export const redis = new Redis({
  url: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});
