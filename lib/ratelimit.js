import { Ratelimit } from '@upstash/ratelimit';
import { redis } from './redis.js';

// Webアプリ用の窓口（api/chat.js）の回数制限。
// 同じ接続元（IPアドレス）から、1分に10回・1日に100回まで。
// 普通に会話する分には届かない回数で、機械的な大量送信だけを止める。
const perMinute = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'ratelimit:chat:minute',
});

const perDay = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(100, '1 d'),
  prefix: 'ratelimit:chat:day',
});

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || 'unknown';
}

// 制限内なら true、超えていたら false を返す
export async function checkChatLimit(ip) {
  const minute = await perMinute.limit(ip);
  if (!minute.success) return false;
  const day = await perDay.limit(ip);
  return day.success;
}
