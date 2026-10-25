/* VK Bot "Игровой центр" — Callback API сервер v1.10
   v1.10: дедупликация message_event по event_id (VK ретраит события — были
   периодические письма); нажатие "🎮 Играть" = снакбар (гасит спиннер) + одно
   сообщение со ссылкой на мини-апп; клавиатура в каждом сообщении. */
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

/* ---------- v1.10: дедупликация событий ---------- */
const seenEvents = new Map();
function eventSeen(id) {
  if (!id) return false;
  const now = Date.now();
  const TTL = 6 * 3600 * 1000;
  if (seenEvents.has(id) && now - seenEvents.get(id) < TTL) return true;
  seenEvents.set(id, now);
  if (seenEvents.size > 500) {
    const cut = now - TTL;
    for (const [k, v] of seenEvents) if (v < cut) seenEvents.delete(k);
  }
  return false;
}

/* ---------- постоянная нижняя клавиатура ---------- */
function kbApp()     { return { one_time: false, inline: false, buttons: [[{ action: { type: 'open_app', app_id: VK_APP_ID, owner_id: VK_GROUP_ID, label: '🎮 Играть' }, color: 'positive' }]] }; }
function kbCallback(){ return { one_time: false, inline: false, buttons: [[{ action: { type: 'callback', label: '🎮 Играть', payload: JSON.stringify({ a: 1 }) }, color: 'positive' }]] }; }

let rnd = 0;
function nextRandomId() { rnd += 1; return Date.now() * 10 + (rnd % 10); }

async function send(peerId, text, kb) {
  return await api('messages.send', {
    peer_id: peerId, message: text, random_id: nextRandomId(),
    keyboard: JSON.stringify(kb || kbCallback())
  });
}

async function sendWelcome(peerId) {
  const r1 = await api('messages.send', {
    peer_id: peerId, message: START_TEXT, random_id: nextRandomId(),
    keyboard: JSON.stringify(kbApp())
  });
  if (apiOk(r1)) { console.log('[VK SEND] ok via app-bottom'); return r1; }
  const r2 = await send(peerId, START_TEXT, kbCallback());
  if (apiOk(r2)) { console.log('[VK SEND] ok via cb-bottom'); return r2; }
  console.log('[VK SEND] fallback text');
  return await send(peerId, START_TEXT + '\n\n🎮 Мини-апп: ' + VK_APP_URL, kbCallback());
}

function answerEvent(e, eventData) {
  return api('messages.sendMessageEventAnswer', {
    event_id: e.event_id, user_id: e.user_id, peer_id: e.peer_id,
    event_data: JSON.stringify(eventData)
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
        if (eventSeen(e.event_id)) {          /* повторная доставка — игнор */
          console.log('[VK EVENT] duplicate ignored', e.event_id);
          return res.send('ok');
        }
        await answerEvent(e, { type: 'show_snackbar', text: '🎮 Открываю игровой центр…' });
        await send(e.peer_id, '🎮 Игровой центр внутри VK 👇\n' + VK_APP_URL, kbCallback());
      }
    }
  } catch (e) { console.error('[VK] handler error:', e && e.message); }
  res.send('ok');
});

app.get('/', (req, res) => res.send('VK bot "Игровой центр" alive'));

module.exports = app;
if (require.main === module) app.listen(3000);