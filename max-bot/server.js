/* MAX Bot "Игровой центр" — webhook-сервер v1.5
   v1.5: вся обработка ДО отправки ответа 200 — Vercel замораживает функцию
   сразу после ответа, фоновые вызовы не успевают выполниться.
   Таймаут 6с на каждый запрос к MAX API. chatId из message.recipient.chat_id.
   Исходящие вызовы через node:https c rejectUnauthorized:false (УЦ Минцифры). */
const express = require('express');
const https = require('https');
const app = express();
app.use(express.json());

const MAX_TOKEN = process.env.MAX_TOKEN || '';
const MAX_SECRET = process.env.MAX_SECRET || '';
const API = 'https://platform-api2.max.ru';
const HUB = 'https://ip19760118-code.github.io/tg-games/';

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

/* ---------- API MAX через node:https + таймаут ---------- */
function api(method, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Authorization': MAX_TOKEN, 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(API + method, {
      method: body ? 'POST' : 'GET',
      headers: headers,
      rejectUnauthorized: false,
      timeout: 6000
    }, (res) => {
      let txt = '';
      res.on('data', (c) => { txt += c; });
      res.on('end', () => {
        console.log('[MAX API]', method, '->', res.statusCode, txt.slice(0, 400));
        let json = {};
        try { json = JSON.parse(txt); } catch (e) { json = { raw: txt }; }
        resolve({ status: res.statusCode, json: json });
      });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout 6s')); });
    req.on('error', (e) => {
      console.log('[MAX API]', method, '-> ERROR', e.message);
      resolve({ status: 0, json: { error: e.message } });
    });
    if (data) req.write(data);
    req.end();
  });
}
function apiOk(r) { return r.status >= 200 && r.status < 300 && !(r.json && r.json.code); }

function chatOf(u) {
  const m = u.message || (u.callback && u.callback.message) || {};
  const rec = m.recipient || {};
  const cb = u.callback || {};
  return (rec.chat_id != null ? rec.chat_id : null)
      ?? (m.chat_id != null ? m.chat_id : null)
      ?? (cb.user && cb.user.user_id != null ? cb.user.user_id : null)
      ?? (m.sender && m.sender.user_id != null ? m.sender.user_id : null);
}

function menuKeyboard() {
  const rows = [];
  for (let i = 0; i < GAMES.length; i += 2) {
    rows.push(GAMES.slice(i, i + 2).map(([id, label]) => ({ type: 'callback', text: label, payload: { g: id } })));
  }
  rows.push([{ type: 'callback', text: '🎮 Открыть все игры', payload: { g: 'hub' } }]);
  return { type: 'inline_keyboard', payload: { buttons: rows } };
}

async function send(chatId, text, withKeyboard) {
  const variants = [];
  if (withKeyboard) variants.push({ chat_id: chatId, text: text, attachments: [menuKeyboard()] });
  variants.push({ chat_id: chatId, text: text });
  if (withKeyboard) variants.push({ user_id: chatId, text: text, attachments: [menuKeyboard()] });
  variants.push({ user_id: chatId, text: text });
  for (let i = 0; i < variants.length; i++) {
    const r = await api('/messages', variants[i]);
    if (apiOk(r)) { console.log('[MAX SEND] ok, variant', i); return r; }
  }
  const list = GAMES.map(([id, l], idx) => (idx + 1) + '. ' + l).join('\n');
  const full = text + '\n\n' + list + '\n\nОтветь номером игры.';
  const r1 = await api('/messages', { chat_id: chatId, text: full });
  if (apiOk(r1)) return r1;
  return await api('/messages', { user_id: chatId, text: full });
}

async function sendGame(chatId, id) {
  const g = GAMES.find(x => x[0] === id);
  const url = HUB + '?plat=max&game=' + id;
  await send(chatId, (g ? g[1] : '🎮 Игра') + ' — открывай 👇\n' + url, false);
}

/* ---------- webhook: сначала работа, ПОТОМ ответ 200 ---------- */
app.all('/max', async (req, res) => {
  console.log('[MAX] incoming:', req.method, '| update_type:', (req.body && req.body.update_type) || '-');
  if (req.method !== 'POST') { res.status(200).send('ok'); return; }
  if (MAX_SECRET && req.headers['x-max-bot-api-secret'] !== MAX_SECRET) { res.sendStatus(403); return; }
  const u = req.body || {};
  console.log('[MAX] update body:', JSON.stringify(u).slice(0, 600));
  const chatId = chatOf(u);
  console.log('[MAX] resolved chatId:', chatId);
  if (chatId) {
    try {
      if (u.update_type === 'bot_started' || u.update_type === 'message_created' || u.update_type === 'message_new') {
        const text = (u.message && u.message.body && u.message.body.text || '').trim();
        if (u.update_type === 'bot_started' || !text || /^(\/start|\/help|привет|меню|игры)/i.test(text)) {
          await send(chatId, START_TEXT, true);
        } else {
          const byNum = /^(\d{1,2})$/.exec(text);
          if (byNum && GAMES[+byNum[1] - 1]) { await sendGame(chatId, GAMES[+byNum[1] - 1][0]); }
          else {
            const low = text.toLowerCase();
            const hit = GAMES.find(([id, l]) => l.toLowerCase().includes(low) || id === low);
            if (hit) { await sendGame(chatId, hit[0]); }
            else { await send(chatId, 'Не понял 🙂 Нажми кнопку ниже или отправь /start', true); }
          }
        }
      }
      else if (u.update_type === 'message_callback') {
        let payload = u.callback && u.callback.payload;
        if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch (e) { payload = null; } }
        const g = payload && payload.g;
        if (g === 'hub') await send(chatId, '🎮 Все игры здесь 👇\n' + HUB + '?plat=max', false);
        else if (g) await sendGame(chatId, g);
      }
    } catch (e) { console.error('[MAX] handler error:', e && e.message); }
  }
  res.sendStatus(200);   // только после всех вызовов MAX API (лимит MAX — 30 секунд)
});

app.get('/', (req, res) => res.send('MAX bot "Игровой центр" alive'));

module.exports = app;
if (require.main === module) app.listen(3000);