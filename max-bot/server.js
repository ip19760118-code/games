/* MAX Bot "Игровой центр" v2.0 — webhook-сервер Callback API MAX.
   v2.0: START_TEXT без числа игр (универсальный).
   Особенности MAX (см. docs/PLATFORM-SPEC.md):
   - base https://platform-api2.max.ru, заголовок Authorization: <token> сырой строкой;
   - TLS: rejectUnauthorized:false (цепочка УЦ Минцифры);
   - получатель личного диалога в QUERY: POST /messages?user_id=...;
   - ВСЕ вызовы API строго ДО ответа вебхуку (Vercel freeze);
   - клавиатура: attachments [{type:'inline_keyboard', payload:{buttons}}];
   - фолбэк-цепочка: user_id+kb -> user_id -> chat_id+kb -> chat_id. */
const express = require('express');
const https = require('https');
const app = express();
app.use(express.json());

const MAX_TOKEN = process.env.MAX_TOKEN || '';
const MAX_SECRET = process.env.MAX_SECRET || '';
const HUB = 'https://ip19760118-code.github.io/games/';

const GAMES = [
  ['chess',     '♟️ Шахматы'],
  ['seabattle', '🚢 Морской бой'],
  ['durak',     '🃏 Дурак'],
  ['nardy',     '🎲 Нарды'],
  ['shashki',   '⚫ Шашки'],
  ['domino',    '🧩 Домино'],
  ['solitaire', '♠️ Косынка'],
  ['mahjong',   '🀄 Маджонг'],
  ['mines',     '💣 Сапёр'],
  ['crystals',  '💎 Кристаллы'],
  ['arkanoid',  '🧱 Арканоид'],
  ['shooter',   '🔫 3D Шутер'],
  ['samurai',   '🍉 Самурай'],
  ['lights',    '💡 Выключи свет'],
  ['trend',     '📈 Trend Catch'],
  ['tetris',    '🧱 Тетрис'],
];

const START_TEXT =
`Что умеет этот бот?
🎮 Игровой Центр — мини-игры в MAX!
Играй один против ИИ или создавай комнаты и зови друзей онлайн.

🔥 Что внутри:
• Аркады, логика и классика: от арканоида и шутера до пасьянса и маджонга.
• Онлайн-дуэли: шахматы, шашки, нарды, домино, дурак, морской бой и другие.

⚡ Удобно:
• Запуск в один клик, без скачиваний.
• Сложности, рекорды, статистика.
• Звук, вибрация, адаптация под телефон.

Выбирай игру кнопкой ниже — ссылка откроется в один тап! 🚀`;

/* ---------- HTTP-клиент MAX с отключённой проверкой сертификата ---------- */
function maxPost(path, body) {
  return new Promise(function (resolve) {
    try {
      const data = JSON.stringify(body || {});
      const u = new URL('https://platform-api2.max.ru' + path);
      const req = https.request({
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': MAX_TOKEN,
          'Content-Length': Buffer.byteLength(data)
        },
        rejectUnauthorized: false
      }, function (res) {
        let s = '';
        res.on('data', function (c) { s += c; });
        res.on('end', function () {
          let j = {};
          try { j = JSON.parse(s); } catch (e) {}
          console.log('[MAX API]', path, res.statusCode, s.slice(0, 250));
          resolve({ ok: res.statusCode === 200 && !j.errorCode, j: j });
        });
      });
      req.on('error', function (e) { console.log('[MAX API err]', path, e.message); resolve({ ok: false }); });
      req.setTimeout(6000, function () { try { req.destroy(); } catch (e) {} resolve({ ok: false }); });
      req.end(data);
    } catch (e) { resolve({ ok: false }); }
  });
}

/* ---------- клавиатура: callback-кнопки направлений ---------- */
function menuKeyboard() {
  const rows = [];
  for (let i = 0; i < GAMES.length; i += 2) {
    rows.push(GAMES.slice(i, i + 2).map(function (g) {
      return { type: 'callback', text: g[1], payload: JSON.stringify({ g: g[0] }) };
    }));
  }
  rows.push([{ type: 'callback', text: '🎮 Открыть весь центр', payload: JSON.stringify({ hub: 1 }) }]);
  return [{ type: 'inline_keyboard', payload: { buttons: rows } }];
}

/* ---------- извлечение адресата из апдейта ---------- */
function peerOf(u) {
  try {
    if (u.message_callback && u.message_callback.callback) {
      const c = u.message_callback.callback;
      return {
        user: (c.user && c.user.user_id) || (c.message && c.message.sender && c.message.sender.user_id) || null,
        chat: (c.message && c.message.chat && c.message.chat.chat_id) || null
      };
    }
  } catch (e) {}
  try {
    const m = (u.message_created && u.message_created.message) ||
              (u.bot_started && u.bot_started.message) || u.message;
    if (m) {
      return {
        user: (m.sender && m.sender.user_id) || null,
        chat: (m.chat && m.chat.chat_id) || null
      };
    }
  } catch (e) {}
  return { user: null, chat: null };
}

/* ---------- отправка с фолбэк-цепочкой ---------- */
async function send(peer, text, withKb) {
  const kb = withKb ? menuKeyboard() : undefined;
  const tries = [];
  if (peer.user) tries.push({ path: '/messages?user_id=' + peer.user, body: { text: text, attachments: kb } });
  if (peer.user) tries.push({ path: '/messages?user_id=' + peer.user, body: { text: text } });
  if (peer.chat) tries.push({ path: '/messages?chat_id=' + peer.chat, body: { text: text, attachments: kb } });
  if (peer.chat) tries.push({ path: '/messages?chat_id=' + peer.chat, body: { text: text } });
  for (const t of tries) {
    const r = await maxPost(t.path, t.body);
    if (r.ok) return r;
  }
  return { ok: false };
}

function numList() {
  return GAMES.map(function (g, i) { return (i + 1) + '. ' + g[1]; }).join('\n');
}

async function sendMenu(peer) {
  const r = await send(peer, START_TEXT, true);
  if (!r.ok) await send(peer, START_TEXT + '\n\n' + numList() + '\n\nОтветь номером игры.', false);
  return r;
}

async function sendGame(peer, id) {
  const g = GAMES.find(function (x) { return x[0] === id; });
  if (!g) return sendMenu(peer);
  const url = HUB + id + '/?plat=max';
  return send(peer, g[1] + ' — открывай 👇\n' + url, false);
}

/* ---------- webhook ---------- */
app.post('/max', async (req, res) => {
  const u = req.body || {};
  console.log('[MAX] incoming:', u.update_type || u.type || Object.keys(u).join(','));

  if (MAX_SECRET) {
    const hs = req.headers || {};
    const got = hs['x-max-bot-api-secret'] || '';
    if (got !== MAX_SECRET) { console.log('[MAX] bad secret'); return res.status(403).send('bad secret'); }
  }

  /* ВСЯ работа ДО ответа: Vercel замораживает функцию после res.send */
  try {
    const peer = peerOf(u);

    if (u.message_callback) {
      let payload = u.message_callback.callback && u.message_callback.callback.payload;
      if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch (e) { payload = null; } }
      if (payload && payload.g) await sendGame(peer, payload.g);
      else if (payload && payload.hub) await send(peer, '🎮 Игровой центр 👇\n' + HUB + '?plat=max', false);
      else await sendMenu(peer);
    }
    else if (u.bot_started || u.message_created) {
      const text = ((u.message_created && u.message_created.message && u.message_created.message.text) || '').trim();
      const low = text.toLowerCase();
      if (!text || low === '/start' || low === 'привет' || low === 'меню' || low === 'игры') {
        await sendMenu(peer);
      } else {
        const byNum = /^(\d{1,2})$/.exec(text);
        if (byNum && GAMES[+byNum[1] - 1]) await sendGame(peer, GAMES[+byNum[1] - 1][0]);
        else {
          const hit = GAMES.find(function (g) { return g[1].toLowerCase().indexOf(low) >= 0 || g[0] === low; });
          if (hit) await sendGame(peer, hit[0]);
          else await sendMenu(peer);
        }
      }
    }
  } catch (e) { console.error('[MAX] handler error:', e && e.message); }

  res.sendStatus(200);
});

app.get('/', (req, res) => res.send('MAX bot "Игровой центр" alive'));

module.exports = app;
if (require.main === module) app.listen(3000);