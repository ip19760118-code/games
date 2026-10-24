/* VK Bot "Игровой центр" — Callback API сервер v1.2
   v1.2: пагинация клавиатуры — каждая страница <= 4 рядов и <= 10 кнопок
   (VK error 911: лимиты на ряды и на общее число кнопок).
   События: message_new, message_event. Обработка ДО res.send('ok'). */
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

const PER_PAGE = 9;
const TOTAL_PAGES = Math.ceil(GAMES.length / PER_PAGE);

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

/* ---------- v1.2: клавиатура одной страницы: 3 ряда игр + ряд навигации ---------- */
function pageKeyboard(page) {
  const startIdx = (page - 1) * PER_PAGE;
  const slice = GAMES.slice(startIdx, startIdx + PER_PAGE);
  const rows = [];
  for (let i = 0; i < slice.length; i += 3) {
    rows.push(slice.slice(i, i + 3).map(([id, label]) => ({
      action: { type: 'callback', label: label, payload: JSON.stringify({ g: id }) },
      color: 'primary'
    })));
  }
  const nav = [];
  if (page > 1) nav.push({ action: { type: 'callback', label: '⬅️ Назад', payload: JSON.stringify({ p: page - 1 }) }, color: 'secondary' });
  if (page < TOTAL_PAGES) nav.push({ action: { type: 'callback', label: 'Ещё ➡️', payload: JSON.stringify({ p: page + 1 }) }, color: 'secondary' });
  if (nav.length) rows.push(nav);
  return { one_time: false, inline: true, buttons: rows };   // стр.1: 4 ряда/10 кнопок, стр.2: 3 ряда/7 кнопок
}

let rnd = 0;
function nextRandomId() { rnd += 1; return Date.now() * 10 + (rnd % 10); }

/* ---------- отправка меню со страницей клавиатуры + фолбэк списком ---------- */
async function sendMenu(peerId, page) {
  const text = page === 1 ? START_TEXT : '🎮 Игры — страница ' + page + ' из ' + TOTAL_PAGES + ':';
  const r = await api('messages.send', {
    peer_id: peerId, message: text, random_id: nextRandomId(),
    keyboard: JSON.stringify(pageKeyboard(page))
  });
  if (!apiOk(r)) {
    await api('messages.send', {
      peer_id: peerId, random_id: nextRandomId(),
      message: text + '\n\n' + numList() + '\n\nОтветь номером игры.'
    });
  }
  return r;
}

async function send(peerId, text, withKeyboard) {
  const params = { peer_id: peerId, message: text, random_id: nextRandomId() };
  if (withKeyboard) return sendMenu(peerId, 1);
  return api('messages.send', params);
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
  if (u.type === 'confirmation') {
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
          await sendMenu(peer, 1);
        } else {
          const byNum = /^(\d{1,2})$/.exec(text);
          if (byNum && GAMES[+byNum[1] - 1]) { await sendGame(peer, GAMES[+byNum[1] - 1][0]); }
          else {
            const low = text.toLowerCase();
            const hit = GAMES.find(([id, l]) => l.toLowerCase().includes(low) || id === low);
            if (hit) { await sendGame(peer, hit[0]); }
            else { await sendMenu(peer, 1); }
          }
        }
      }
    }
    else if (u.type === 'message_event') {   // нажатие inline-кнопки
      const e = u.object || {};
      let payload = e.payload;
      if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch (err) { payload = null; } }
      if (!payload) { res.send('ok'); return; }
      if (payload.p) { await sendMenu(e.peer_id, payload.p); }
      else if (payload.g) { await sendGame(e.peer_id, payload.g); }
    }
  } catch (e) { console.error('[VK] handler error:', e && e.message); }
  res.send('ok');
});

app.get('/', (req, res) => res.send('VK bot "Игровой центр" alive'));

module.exports = app;
if (require.main === module) app.listen(3000);