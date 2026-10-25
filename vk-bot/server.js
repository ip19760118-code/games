/* VK Bot "Игровой центр" — Callback API сервер v1.6
   v1.6: упрощение — одна кнопка "Играть" (open_link на vk.com/app54850501)
   вместо клавиатуры из 15 игр. Паритет с TG/MAX: описание + одна кнопка входа. */
const express = require('express');
const app = express();
app.use(express.json());

const VK_TOKEN = process.env.VK_TOKEN || '';
const VK_SECRET = process.env.VK_SECRET || '';
const VK_CONFIRM = process.env.VK_CONFIRM || '';
const API = 'https://api.vk.com/method/';
const V = '5.199';
const VK_APP_URL = 'https://vk.com/app54850501';   /* VK Mini App "Игровой центр" */

const START_TEXT =
`Что умеет этот бот?
🎮 Игровой Центр — мини-игры в VK!
Играй один против ИИ или создавай комнаты и зови друзей онлайн.

🔥 Что внутри:
• Аркады, логика, классика.
• Онлайн: Шахматы, Шашки, Нарды, Домино, Дурак, Морской бой 🚢.

⚡ Удобно:
• Запуск в один клик, без скачиваний.
• Сложности, рекорды, статистика.
• Звук, вибрация, адаптация под телефон.

🎮 Жми «Играть» — все игры откроются внутри VK! 🚀`;

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

/* ---------- одна кнопка "Играть" (open_link на Mini App) ---------- */
function playKeyboard() {
  return {
    one_time: false,
    inline: true,
    buttons: [[{
      action: { type: 'open_link', label: '🎮 Играть', link: VK_APP_URL },
      color: 'positive'
    }]]
  };
}

let rnd = 0;
function nextRandomId() { rnd += 1; return Date.now() * 10 + (rnd % 10); }

async function sendWelcome(peerId) {
  const r = await api('messages.send', {
    peer_id: peerId,
    message: START_TEXT,
    random_id: nextRandomId(),
    keyboard: JSON.stringify(playKeyboard())
  });
  if (!apiOk(r)) {
    await api('messages.send', {
      peer_id: peerId,
      random_id: nextRandomId(),
      message: START_TEXT + '\n\n🎮 Мини-апп: ' + VK_APP_URL
    });
  }
  return r;
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
      if (peer) await sendWelcome(peer);    /* на любое сообщение — welcome + кнопка */
    }
  } catch (e) { console.error('[VK] handler error:', e && e.message); }
  res.send('ok');
});

app.get('/', (req, res) => res.send('VK bot "Игровой центр" alive'));

module.exports = app;
if (require.main === module) app.listen(3000);