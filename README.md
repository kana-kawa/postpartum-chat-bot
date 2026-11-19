# 産後ママの話し相手Bot

産後のママが、LINEやスマホのアプリから気軽に話しかけられるAIの話し相手です。
AIの会話部分はDify（チャットフロー）で作り、LINE・Webアプリとの間を中継するサーバーを自作しました。

## 全体の構成

```
LINEユーザー ─→ LINE Messaging API ─→ 中継サーバー（Vercel / api/webhook.js）─→ Dify
Webアプリ（React）─────────────────→ 中継サーバー（Vercel / api/chat.js）  ─→ Dify
                                          │
                                          └─ Upstash Redis（利用者ごとの会話IDを保存）
```

- **Dify**：安全確保のフロー（危険な内容を先に確認）→ 会話の目的ごとに4つに分岐するチャットフロー
- **中継サーバー**：DifyにはLINEと直接つなぐ機能がなかったため自作
  - LINEから届いたリクエストの署名を確認し、なりすましを防ぐ（HMAC-SHA256）
  - 利用者ごとにDifyの会話IDをRedisに保存し、続きから会話できるようにする
- **Webアプリ**：React＋Vite＋Tailwind CSSのPWA（スマホのホーム画面に追加できる）
  - チャット画面（音声入力あり）
  - 気分記録（MoodTracker）

## 使った技術

Dify / LINE Messaging API / Vercel（サーバーレス関数）/ Upstash Redis / React / TypeScript / Vite / Tailwind CSS

開発はClaude Codeを使って進めました。

## フォルダ構成

| 場所 | 内容 |
|---|---|
| `api/webhook.js` | LINEからのWebhookを受け、Difyに送って返信する |
| `api/chat.js` | Webアプリからのメッセージを受け、Difyに送って返す |
| `lib/dify.js` | Dify APIの呼び出しと、会話IDの保存 |
| `src/` | Webアプリ（チャット画面・気分記録） |

## 動かし方

1. `.env.example` をコピーして `.env.local` を作り、値を入れる
   - `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN`（LINE Developersで発行）
   - `DIFY_API_KEY` / `DIFY_API_BASE`（Difyのアプリで発行）
   - `KV_REST_API_URL` / `KV_REST_API_TOKEN`（Upstash Redis）
2. `npm install`
3. `npm run dev`（Webアプリ）、Vercelにデプロイすると `api/` も動きます

※ Difyのチャットフロー本体はこのリポジトリには含まれていません。
