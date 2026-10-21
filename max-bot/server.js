/* MAX Bot "Игровой центр" — webhook-сервер (идентичен TG-боту) */
const express = require('express');
const app = express();
app.use(express.json());

const MAX_TOKEN = process.env.MAX_TOKEN || '';
const API = 'https://botapi.max.ru';
const HUB = 'https://ip19760118-code.github.io/tg-games/';

/* То же меню, что в TG-боте */
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

/* ---------- helpers ---------- */
async function api(method, body) {
  const url = API + method + '?token=' + encodeURIComponent(MAX_TOKEN);
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json().catch(() => ({}));
}

function chatOf(u) {
  const m = u.message || u.callback || {};
  return m.chat_id ?? m.rec_id ?? m.sender?.user_id ?? m.user?.user_id ?? null;
}

function menuKeyboard() {
  const rows = [];
  for (let i = 0; i < GAMES.length; i += 2) {
    rows.push(GAMES.slice(i, i + 2).map(([id, label]) => ({
      type: 'callback', text: label, payload: { g: id },
    })));
  }
  rows.push([{ type: 'callback', text: '🎮 Открыть все игры', payload: { g: 'hub' } }]);
  return { type: 'inline_keyboard', payload: { buttons: rows } };
}

async function send(chatId, text, withKeyboard) {
  const body = { chat_id: chatId, text };
  if (withKeyboard) body.attachments = [menuKeyboard()];
  let r = await api('/messages', body);
  if (!r.ok && body.attachments) {           // старый клиент без кнопок — шлем текстом
    const list = GAMES.map(([id, l], i) => `${i + 1}. ${l}`).join('\n');
    await api('/messages', { chat_id: chatId, text: text + '\n\n' + list + '\n\nОтветь номером игры.' });
  }
  return r;
}

async function sendGame(chatId, id) {
  const g = GAMES.find(x => x[0] === id);
  const url = HUB + '?plat=max&game=' + id;
  await api('/messages', { chat_id: chatId, text: (g ? g[1] : '🎮 Игра') + ' — открывай 👇\n' + url });
}

/* ---------- webhook ---------- */
app.post('/max', async (req, res) => {
  res.sendStatus(200);                        // MAX требует быстрый ответ
  const u = req.body || {};
  const chatId = chatOf(u);
  if (!chatId) return;
  try {
    if (u.update_type === 'message_new') {
      const text = (u.message?.body?.text || '').trim();
      const low = text.toLowerCase();
      if (!text || /^(\/start|\/help|привет|меню|игры)/i.test(text)) {
        await send(chatId, START_TEXT, true);
        return;
      }
      const byNum = /^(\d{1,2})$/.exec(text);
      if (byNum && GAMES[+byNum[1] - 1]) { await sendGame(chatId, GAMES[+byNum[1] - 1][0]); return; }
      const hit = GAMES.find(([id, l]) => l.toLowerCase().includes(low) || id === low);
      if (hit) { await sendGame(chatId, hit[0]); return; }
      await send(chatId, 'Не понял 🙂 Нажми кнопку ниже или отправь /start', true);
    }
    else if (u.update_type === 'message_callback') {
      const g = u.callback?.payload?.g;
      if (g === 'hub') await api('/messages', { chat_id: chatId, text: '🎮 Все игры здесь 👇\n' + HUB + '?plat=max' });
      else if (g) await sendGame(chatId, g);
    }
  } catch (e) { console.error('max webhook error', e); }
});

app.get('/', (req, res) => res.send('MAX bot "Игровой центр" alive'));
module.exports = app;                          // Vercel serverless
if (require.main === module) app.listen(3000); // локально: node server.js