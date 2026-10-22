/* MAX Bot "Игровой центр" — webhook-сервер v1.3
   Домен: platform-api2.max.ru, токен через заголовок Authorization.
   v1.3: полное логирование ответов MAX API + цепочка фолбэков отправки
   (chat_id+клавиатура -> chat_id текст -> user_id+клавиатура -> user_id текст). */
const express = require('express');
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

/* ---------- API MAX с ЛОГИРОВАНИЕМ каждого ответа ---------- */
async function api(method, body) {
  const res = await fetch(API + method, {
    method: body ? 'POST' : 'GET',
    headers: { 'Authorization': MAX_TOKEN, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const txt = await res.text().catch(() => '');
  let json = {};
  try { json = JSON.parse(txt); } catch (e) { json = { raw: txt }; }
  console.log('[MAX API]', method, '->', res.status, txt.slice(0, 400));
  return { status: res.status, json: json };
}
function apiOk(r) { return r.status >= 200 && r.status < 300 && !(r.json && r.json.code); }

function chatOf(u) {
  const m = u.message || (u.callback && u.callback.message) || u.callback || {};
  return (m.chat_id != null ? m.chat_id : null)
      ?? (m.sender && m.sender.user_id != null ? m.sender.user_id : null)
      ?? (u.callback && u.callback.user && u.callback.user.user_id != null ? u.callback.user.user_id : null);
}

function menuKeyboard() {
  const rows = [];
  for (let i = 0; i < GAMES.length; i += 2) {
    rows.push(GAMES.slice(i, i + 2).map(([id, label]) => ({ type: 'callback', text: label, payload: { g: id } })));
  }
  rows.push([{ type: 'callback', text: '🎮 Открыть все игры', payload: { g: 'hub' } }]);
  return { type: 'inline_keyboard', payload: { buttons: rows } };
}

/* ---------- отправка с цепочкой фолбэков ---------- */
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
  /* последний шанс: нумерованный список игр текстом */
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

/* ---------- webhook: отвечаем 200 на всё, логируем каждое событие ---------- */
app.all('/max', (req, res, next) => {
  console.log('[MAX] incoming:', req.method, '| update_type:', (req.body && req.body.update_type) || '-');
  if (req.method !== 'POST') return res.status(200).send('ok');
  if (MAX_SECRET && req.headers['x-max-bot-api-secret'] !== MAX_SECRET) return res.sendStatus(403);
  res.sendStatus(200);                            // MAX ждёт 200 в течение 30 секунд
  const u = req.body || {};
  console.log('[MAX] update body:', JSON.stringify(u).slice(0, 600));
  const chatId = chatOf(u);
  console.log('[MAX] resolved chatId:', chatId);
  if (!chatId) return;
  try {
    if (u.update_type === 'bot_started' || u.update_type === 'message_created' || u.update_type === 'message_new') {
      const text = (u.message && u.message.body && u.message.body.text || '').trim();
      if (u.update_type === 'bot_started' || !text || /^(\/start|\/help|привет|меню|игры)/i.test(text)) {
        send(chatId, START_TEXT, true); return;
      }
      const byNum = /^(\d{1,2})$/.exec(text);
      if (byNum && GAMES[+byNum[1] - 1]) { sendGame(chatId, GAMES[+byNum[1] - 1][0]); return; }
      const low = text.toLowerCase();
      const hit = GAMES.find(([id, l]) => l.toLowerCase().includes(low) || id === low);
      if (hit) { sendGame(chatId, hit[0]); return; }
      send(chatId, 'Не понял 🙂 Нажми кнопку ниже или отправь /start', true);
    }
    else if (u.update_type === 'message_callback') {
      let payload = u.callback && u.callback.payload;
      if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch (e) { payload = null; } }
      const g = payload && payload.g;
      if (g === 'hub') send(chatId, '🎮 Все игры здесь 👇\n' + HUB + '?plat=max', false);
      else if (g) sendGame(chatId, g);
    }
  } catch (e) { console.error('max webhook error', e); }
});

app.get('/', (req, res) => res.send('MAX bot "Игровой центр" alive'));

module.exports = app;
if (require.main === module) app.listen(3000);