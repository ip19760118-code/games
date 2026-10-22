/* MAX Bot "Игровой центр" — webhook-сервер v1.1
   Актуальный домен: platform-api2.max.ru, токен только в заголовке Authorization,
   типы событий: message_created / message_callback / bot_started */
const express = require('express');
const app = express();
app.use(express.json());

const MAX_TOKEN = process.env.MAX_TOKEN || '';
const MAX_SECRET = process.env.MAX_SECRET || '';   // необязательно: проверка X-Max-Bot-Api-Secret
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
🎮 Игровой Центр — 16 мини-игр в MAX!
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

async function api(method, body) {
  const res = await fetch(API + method, {
    method: body ? 'POST' : 'GET',
    headers: { 'Authorization': MAX_TOKEN, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json().catch(() => ({}));
}

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

async function send(chatId, text, withKeyboard) {
  const body = { chat_id: chatId, text };
  if (withKeyboard) body.attachments = [menuKeyboard()];
  let r = await api('/messages', body);
  if (!r.ok) {                                   // фолбэк: личные чаты по user_id
    const b2 = { user_id: chatId, text };
    if (withKeyboard) b2.attachments = [menuKeyboard()];
    r = await api('/messages', b2);
  }
  if (!r.ok && withKeyboard) {                   // фолбэк: клиент без кнопок — список текстом
    const list = GAMES.map(([id, l], i) => (i + 1) + '. ' + l).join('\n');
    await api('/messages', { chat_id: chatId, text: text + '\n\n' + list + '\n\nОтветь номером игры.' });
  }
  return r;
}

async function sendGame(chatId, id) {
  const g = GAMES.find(x => x[0] === id);
  const url = HUB + '?plat=max&game=' + id;
  await send(chatId, (g ? g[1] : '🎮 Игра') + ' — открывай 👇\n' + url, false);
}

app.post('/max', async (req, res) => {
  if (MAX_SECRET && req.headers['x-max-bot-api-secret'] !== MAX_SECRET) return res.sendStatus(403);
  res.sendStatus(200);                            // MAX ждёт 200 в течение 30 секунд
  const u = req.body || {};
  const chatId = chatOf(u);
  if (!chatId) return;
  try {
    if (u.update_type === 'bot_started' || u.update_type === 'message_created' || u.update_type === 'message_new') {
      const text = (u.message && u.message.body && u.message.body.text || '').trim();
      if (u.update_type === 'bot_started' || !text || /^(\/start|\/help|привет|меню|игры)/i.test(text)) {
        await send(chatId, START_TEXT, true); return;
      }
      const byNum = /^(\d{1,2})$/.exec(text);
      if (byNum && GAMES[+byNum[1] - 1]) { await sendGame(chatId, GAMES[+byNum[1] - 1][0]); return; }
      const low = text.toLowerCase();
      const hit = GAMES.find(([id, l]) => l.toLowerCase().includes(low) || id === low);
      if (hit) { await sendGame(chatId, hit[0]); return; }
      await send(chatId, 'Не понял 🙂 Нажми кнопку ниже или отправь /start', true);
    }
    else if (u.update_type === 'message_callback') {
      let payload = u.callback && u.callback.payload;
      if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch (e) { payload = null; } }
      const g = payload && payload.g;
      if (g === 'hub') await send(chatId, '🎮 Все игры здесь 👇\n' + HUB + '?plat=max', false);
      else if (g) await sendGame(chatId, g);
    }
  } catch (e) { console.error('max webhook error', e); }
});

app.get('/', (req, res) => res.send('MAX bot "Игровой центр" alive'));
module.exports = app;
if (require.main === module) app.listen(3000);