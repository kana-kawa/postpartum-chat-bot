# LINE連携部分について

「産後ママの話し相手Bot」（Dify）を、LINE公式アカウントから使えるようにするための連携部分の資料です。

## 全体構成

```
LINEユーザー
    │  メッセージ送信
    ▼
LINE Messaging API
    │  Webhook（ユーザーのメッセージを送信）
    ▼
橋渡しサーバー（Vercel上で稼働）
    │  Difyのバックエンドサービス API を呼び出し
    ▼
Dify（安全確保フロー → 会話目的別4分岐のチャットフロー）
    │  回答を生成
    ▼
橋渡しサーバー
    │  LINE返信APIで送信
    ▼
LINEユーザーに回答が届く
```

Difyには外部チャットサービス（LINEなど）とノーコードで直接つなぐ機能がなかったため、間に「橋渡しサーバー」を自作して仲介させています。

## 4. デプロイ環境

| 項目 | 内容 |
|---|---|
| ホスティング | Vercel（サーバーレス関数） |
| 公開URL | https://postpartum-bot-line-bridge.vercel.app |
| Webhookエンドポイント | https://postpartum-bot-line-bridge.vercel.app/api/webhook |
| 実行環境 | Node.js 24.x |
| 管理している環境変数 | `LINE_CHANNEL_SECRET`、`LINE_CHANNEL_ACCESS_TOKEN`、`DIFY_API_KEY`、`DIFY_API_BASE`（値はすべてVercel側で非公開のSecretとして管理し、コードには含めていない） |

## 3. 橋渡しサーバーのコード（`api/webhook.js`）

やっていることは大きく4ステップです。

1. **署名検証**：LINEから届いたリクエストが本物か、チャネルシークレットを使ったHMAC-SHA256署名で確認する
2. **Difyへ転送**：ユーザーのメッセージを、DifyのチャットAPI（`/v1/chat-messages`）に送信して回答を取得する。LINEのユーザーIDごとにDifyの会話IDを覚えておくことで、同じ人との会話を継続させている
3. **LINEへ返信**：Difyから返ってきた回答を、LINEの返信API（`/v2/bot/message/reply`）でユーザーに送り返す
4. **200応答**：LINE側の仕様上、Webhookは受信したら素早く200を返す必要があるため、それに対応している

```js
const crypto = require('crypto');

module.exports.config = {
  api: { bodyParser: false }, // 署名検証のため、生のリクエストボディを扱う
};

// LINEからの署名とチャネルシークレットを照合し、なりすましリクエストを弾く
function isValidSignature(rawBody, signature, channelSecret) {
  const expected = crypto
    .createHmac('sha256', channelSecret)
    .update(rawBody)
    .digest('base64');
  return signature === expected;
}

// LINEユーザーIDごとにDifyの会話IDを保持し、会話を継続させる
const conversationIdByUser = new Map();

async function askDify(userId, userMessage) {
  const conversationId = conversationIdByUser.get(userId) || '';
  const res = await fetch(`${process.env.DIFY_API_BASE}/chat-messages`, {
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
      user: userId,
    }),
  });
  const data = await res.json();
  if (data.conversation_id) conversationIdByUser.set(userId, data.conversation_id);
  return data.answer;
}

async function replyToLine(replyToken, text) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  // 生のリクエストボディを読み取って署名を検証
  const rawBody = await getRawBody(req);
  const signature = req.headers['x-line-signature'];
  if (!isValidSignature(rawBody, signature, process.env.LINE_CHANNEL_SECRET)) {
    return res.status(401).send('invalid signature');
  }

  // メッセージイベントごとにDifyへ転送→返信
  const { events } = JSON.parse(rawBody.toString('utf8'));
  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const answer = await askDify(event.source.userId, event.message.text);
      await replyToLine(event.replyToken, answer);
    }
  }

  res.status(200).send('OK');
};
```

（`getRawBody` はリクエストボディをストリームから読み取るヘルパー関数。全文は `api/webhook.js` を参照）
