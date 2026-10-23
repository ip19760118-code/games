/* MAX Bot "Игровой центр" — webhook-сервер v1.8
   v1.8: убрана кнопка "Открыть все игры" из клавиатуры.
   v1.7: user_id/chat_id передаются в QUERY-строке POST /messages (официальный пример docs MAX).
   Адресат личного диалога — user_id отправителя (sender.user_id / callback.user.user_id).
   Исходящие вызовы через node:https c rejectUnauthorized:false (УЦ Минцифры).
   Лимит MAX: 2 сообщения/сек в диалог. */
const express = require('express');
const https = require('https');
const app = express();
app.use(express.json());

const MAX_TOKEN = process.env.MAX_TOKEN || '';
const MAX_SECRET = process.env.MAX_SECRET || '';
const API = 'https://platform-api2.max.ru';
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
];

function numList() {
  return GAMES.map(([id, l], i) => (i + 1) + '. ' + l).join('\n');
}

const START_TEXT =
`Что умеет этот бот?
🎮 Игровой Центр — 15 мини-игр в MAX!
Играй один против ИИ или создавай комнаты и зови друзей онлайн.

🔥 Что внутри:
• Аркады, логика, классика: Арканоид, Шутер, Самурай, Сапёр, Косынка, Маджонг, Кристаллы.
• Онлайн: Шахматы, Шашки, Нарды, Домино, Дурак, Морской бой 🚢.

⚡ Удобно:
• Запуск в один клик, без скачиваний.
• Сложности, рекорды, статистика.
• Звук, вибрация, адаптация под телефон.
• Новые игры регулярно.

Выбирай игру и играй! 🚀`;

/* ---------- API MAX: адресат в QUERY, тело — только text/attachments ---------- */
function api(method, body, query) {
  return new Promise((resolve) => {
    let url = API + method;
    if (query) {
      const qs = Object.keys(query).map(k => k + '=' + encodeURIComponent(query[k])).join('&');
      if (qs) url += '?' + qs;
    }
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Authorization': MAX_TOKEN, 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(url, {
      method: body ? 'POST' : 'GET',
      headers: headers,
      rejectUnauthorized: false,
      timeout: 6000
    }, (res) => {
      let txt = '';
      res.on('data', (c) => { txt += c; });
      res.on('end', () => {
        console.log('[MAX API]', url.replace(API, ''), '->', res.statusCode, txt.slice(0, 300));
        let json = {};
        try { json = JSON.parse(txt); } catch (e) { json = { raw: txt }; }
        resolve({ status: res.statusCode, json: json });
      });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout 6s')); });
    req.on('error', (e) => {
      console.log('[MAX API]', url.replace(API, ''), '-> ERROR', e.message);
      resolve({ status: 0, json: { error: e.message } });
    });
    if (data) req.write(data);
    req.end();
  });
}
function apiOk(r) { return r.status >= 200 && r.status < 300 && !(r.json && r.json.code); }

function idsOf(u) {
  const m = u.message || (u.callback && u.callback.message) || {};
  const cb = u.callback || {};
  const human = (m.sender && m.sender.user_id != null ? m.sender.user_id : null)
      ?? (cb.user && cb.user.user_id != null ? cb.user.user_id : null);
  const chat = (m.recipient && m.recipient.chat_id != null ? m.recipient.chat_id : null)
      ?? (m.chat_id != null ? m.chat_id : null);
  return { human: human, chat: chat };
}

/* ---------- v1.8: клавиатура БЕЗ кнопки "Открыть все игры" ---------- */
function menuKeyboard() {
  const rows = [];
  for (let i = 0; i < GAMES.length; i += 2) {
    rows.push(GAMES.slice(i, i + 2).map(([id, label]) => ({
      type: 'callback', text: label, payload: JSON.stringify({ g: id })
    })));
  }
  return { type: 'inline_keyboard', payload: { buttons: rows } };
}

async function send(ids, text, withKeyboard) {
  const kb = withKeyboard ? [menuKeyboard()] : null;
  const tries = [];
  if (ids.human != null && kb) tries.push({ tag: 'user_id+kb', q: { user_id: ids.human }, b: { text: text, attachments: kb } });
  if (ids.human != null)       tries.push({ tag: 'user_id',    q: { user_id: ids.human }, b: { text: withKeyboard ? text + '\n\n' + numList() + '\n\nОтветь номером игры.' : text } });
  if (ids.chat != null && kb)  tries.push({ tag: 'chat_id+kb', q: { chat_id: ids.chat },  b: { text: text, attachments: kb } });
  if (ids.chat != null)        tries.push({ tag: 'chat_id',    q: { chat_id: ids.chat },  b: { text: withKeyboard ? text + '\n\n' + numList() + '\n\nОтветь номером игры.' : text } });
  for (const t of tries) {
    const r = await api('/messages', t.b, t.q);
    if (apiOk(r)) { console.log('[MAX SEND] ok via', t.tag); return r; }
  }
  console.log('[MAX SEND] all variants failed');
  return { status: 0, json: { error: 'all variants failed' } };
}

async function sendGame(ids, id) {
  const g = GAMES.find(x => x[0] === id);
  const url = HUB + '?plat=max&game=' + id;
  await send(ids, (g ? g[1] : '🎮 Игра') + ' — открывай 👇\n' + url, false);
}

/* ---------- webhook ---------- */
app.all('/max', async (req, res) => {
  console.log('[MAX] incoming:', req.method, '| update_type:', (req.body && req.body.update_type) || '-');
  if (req.method !== 'POST') { res.status(200).send('ok'); return; }
  if (MAX_SECRET && req.headers['x-max-bot-api-secret'] !== MAX_SECRET) { res.sendStatus(403); return; }
  const u = req.body || {};
  console.log('[MAX] update body:', JSON.stringify(u).slice(0, 600));
  const ids = idsOf(u);
  console.log('[MAX] ids: human =', ids.human, '| chat =', ids.chat);
  if (ids.human != null || ids.chat != null) {
    try {
      if (u.update_type === 'bot_started' || u.update_type === 'message_created' || u.update_type === 'message_new') {
        const text = (u.message && u.message.body && u.message.body.text || '').trim();
        if (u.update_type === 'bot_started' || !text || /^(\/start|\/help|привет|меню|игры)/i.test(text)) {
          await send(ids, START_TEXT, true);
        } else {
          const byNum = /^(\d{1,2})$/.exec(text);
          if (byNum && GAMES[+byNum[1] - 1]) { await sendGame(ids, GAMES[+byNum[1] - 1][0]); }
          else {
            const low = text.toLowerCase();
            const hit = GAMES.find(([id, l]) => l.toLowerCase().includes(low) || id === low);
            if (hit) { await sendGame(ids, hit[0]); }
            else { await send(ids, 'Не понял 🙂 Отправь /start или номер игры из списка.', true); }
          }
        }
      }
      else if (u.update_type === 'message_callback') {
        let payload = u.callback && u.callback.payload;
        if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch (e) { payload = null; } }
        const g = payload && payload.g;
        if (g) await sendGame(ids, g);
      }
    } catch (e) { console.error('[MAX] handler error:', e && e.message); }
  }
  res.sendStatus(200);
});

app.get('/', (req, res) => res.send('MAX bot "Игровой центр" alive'));

module.exports = app;
if (require.main === module) app.listen(3000);