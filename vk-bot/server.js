/* VK Bot "Игровой центр" — Callback API сервер v1.8
   v1.8: нажатие постоянной кнопки "🎮 Играть" отвечает event_data open_link —
   клиент VK открывает мини-апп мгновенно, без лишних сообщений в чате.
   Клавиатура: нижняя постоянная (inline:false, one_time:false), цепочка вариантов. */
const express = require('express');
const app = express();
app.use(express.json());

const VK_TOKEN = process.env.VK_TOKEN || '';
const VK_SECRET = process.env.VK_SECRET || '';
const VK_CONFIRM = process.env.VK_CONFIRM || '';
const API = 'https://api.vk.com/method/';
const V = '5.199';
const VK_APP_URL = 'https://vk.com/app54850501';
const VK_APP_ID = 54850501;
const VK_GROUP_ID = -242534673;

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

🎮 Жми «Играть» под полем ввода — все игры откроются внутри VK! 🚀`;

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

/* ---------- постоянная нижняя клавиатура: цепочка вариантов ---------- */
function kbApp()     { return { one_time: false, inline: false, buttons: [[{ action: { type: 'open_app', app_id: VK_APP_ID, owner_id: VK_GROUP_ID, label: '🎮 Играть' }, color: 'positive' }]] }; }
function kbCallback(){ return { one_time: false, inline: false, buttons: [[{ action: { type: 'callback', label: '🎮 Играть', payload: JSON.stringify({ a: 1 }) }, color: 'positive' }]] }; }

let rnd = 0;
function nextRandomId() { rnd += 1; return Date.now() * 10 + (rnd % 10); }

async function sendWelcome(peerId) {
  const variants = [
    { tag: 'app-bottom', kb: kbApp() },
    { tag: 'cb-bottom',  kb: kbCallback() }
  ];
  for (const v of variants) {
    const r = await api('messages.send', {
      peer_id: peerId, message: START_TEXT, random_id: nextRandomId(),
      keyboard: JSON.stringify(v.kb)
    });
    if (apiOk(r)) { console.log('[VK SEND] ok via', v.tag); return r; }
  }
  console.log('[VK SEND] fallback text');
  return await api('messages.send', {
    peer_id: peerId, random_id: nextRandomId(),
    message: START_TEXT + '\n\n🎮 Мини-апп: ' + VK_APP_URL
  });
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
      if (peer) await sendWelcome(peer);
    }
    else if (u.type === 'message_event') {
      const e = u.object || {};
      let payload = e.payload;
      if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch (err) { payload = null; } }
      if (payload && payload.a) {
        /* v1.8: главный путь — клиент сам открывает мини-апп по ответу события */
        const r = await api('messages.sendMessageEventAnswer', {
          event_id: e.event_id, user_id: e.user_id, peer_id: e.peer_id,
          event_data: JSON.stringify({ type: 'open_link', link: VK_APP_URL })
        });
        if (!apiOk(r)) {
          /* если open_link в ответе события не прошёл — снакбар + ссылка сообщением */
          await api('messages.sendMessageEventAnswer', {
            event_id: e.event_id, user_id: e.user_id, peer_id: e.peer_id,
            event_data: JSON.stringify({ type: 'show_snackbar', text: '🎮 Ссылка ниже' })
          });
          await api('messages.send', {
            peer_id: e.peer_id, random_id: nextRandomId(),
            message: '🎮 Игровой центр внутри VK 👇\n' + VK_APP_URL
          });
        }
      }
    }
  } catch (e) { console.error('[VK] handler error:', e && e.message); }
  res.send('ok');
});

app.get('/', (req, res) => res.send('VK bot "Игровой центр" alive'));

module.exports = app;
if (require.main === module) app.listen(3000);