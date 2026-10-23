/* VK Bot "Игровой центр" — Callback API сервер v1.0
   События: message_new (текст), message_event (нажатие inline-кнопки).
   Ответ VK должен прийти за <3 сек — вся обработка ДО res.send('ok')
   (иначе Vercel заморозит функцию, как было в MAX).
   Клавиатура: inline, callback-кнопки, payload — JSON-строка. */
const express = require('express');
const app = express();
app.use(express.json());

const VK_TOKEN = process.env.VK_TOKEN || '';
const VK_SECRET = process.env.VK_SECRET || '';
const VK_CONFIRM = process.env.VK_CONFIRM || '';
const API = 'https://api.vk.com/method/';
const V = '5.199';
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
🎮 Игровой Центр — 15 мини-игр в VK!
Играй один против ИИ или создавай комнаты и зови друзей онлайн.

🔥 Что внутри:
• Аркады, логика, классика: Арканоид, Шутер, Самурай, Сапёр, Косынка, Маджонг, Кристаллы.
• Онлайн: Шахматы, Шашки, Нарды, Домино, Дурак, Морской бой 🚢.

⚡ Удобно:
• Запуск в один клик, без скачиваний.
• Сложности, рекорды, статистика.
• Звук, вибрация, адаптация под телефон.

Выбирай игру и играй! 🚀`;

/* ---------- VK API ---------- */
async function api(method, params) {
  const p = Object.assign({ access_token: VK_TOKEN, v: V }, params);
  const res = await fetch(API + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(p).toString()
  });
  const j = await res.json().catch(() => ({}));
  console.log('[VK API]', method, '->', res.status, JSON.stringify(j).slice(0, 300));
  return j;
}
function apiOk(j) { return j && !j.error && j.response !== undefined; }

/* ---------- inline-клавиатура 15 игр ---------- */
function menuKeyboard() {
  const rows = [];
  for (let i = 0; i < GAMES.length; i += 2) {
    rows.push(GAMES.slice(i, i + 2).map(([id, label]) => ({
      action: { type: 'callback', label: label, payload: JSON.stringify({ g: id }) },
      color: 'primary'
    })));
  }
  return { one_time: false, inline: true, buttons: rows };
}

let rnd = 0;
function nextRandomId() { rnd += 1; return Date.now() * 10 + (rnd % 10); }

async function send(peerId, text, withKeyboard) {
  const params = { peer_id: peerId, message: text, random_id: nextRandomId() };
  if (withKeyboard) params.keyboard = JSON.stringify(menuKeyboard());
  const r = await api('messages.send', params);
  if (!apiOk(r) && withKeyboard) {           // фолбэк: текст со списком, если клавиатура не прошла
    await api('messages.send', {
      peer_id: peerId, random_id: nextRandomId(),
      message: text + '\n\n' + numList() + '\n\nОтветь номером игры.'
    });
  }
  return r;
}

async function sendGame(peerId, id) {
  const g = GAMES.find(x => x[0] === id);
  const url = HUB + '?plat=vk&game=' + id;
  return send(peerId, (g ? g[1] : '🎮 Игра') + ' — открывай 👇\n' + url, false);
}

/* ---------- Callback API ---------- */
app.post('/vk', async (req, res) => {
  const u = req.body || {};
  console.log('[VK] incoming:', u.type);
  if (u.type === 'confirmation') {           // VK проверяет сервер при привязке
    console.log('[VK] confirmation requested');
    return res.status(200).send(VK_CONFIRM);
  }
  if (VK_SECRET && u.secret !== VK_SECRET) {
    console.log('[VK] bad secret, reject');
    return res.status(403).send('bad secret');
  }
  try {
    if (u.type === 'message_new') {
      const m = (u.object && u.object.message) || {};
      const peer = m.peer_id;
      const text = (m.text || '').trim();
      if (peer) {
        if (!text || /^(\/start|\/help|привет|меню|игры)/i.test(text)) {
          await send(peer, START_TEXT, true);
        } else {
          const byNum = /^(\d{1,2})$/.exec(text);
          if (byNum && GAMES[+byNum[1] - 1]) { await sendGame(peer, GAMES[+byNum[1] - 1][0]); }
          else {
            const low = text.toLowerCase();
            const hit = GAMES.find(([id, l]) => l.toLowerCase().includes(low) || id === low);
            if (hit) { await sendGame(peer, hit[0]); }
            else { await send(peer, 'Не понял 🙂 Напиши «меню» или номер игры из списка.', true); }
          }
        }
      }
    }
    else if (u.type === 'message_event') {   // нажатие inline-кнопки
      const e = u.object || {};
      let payload = e.payload;
      if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch (err) { payload = null; } }
      const g = payload && payload.g;
      if (g && e.peer_id) await sendGame(e.peer_id, g);
    }
  } catch (e) { console.error('[VK] handler error:', e && e.message); }
  res.send('ok');                             // VK ждёт "ok" быстро
});

app.get('/', (req, res) => res.send('VK bot "Игровой центр" alive'));

module.exports = app;
if (require.main === module) app.listen(3000);