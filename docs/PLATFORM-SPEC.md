# PLATFORM-SPEC — МК «Игровой центр»: кроссплатформенная спецификация и грабли

**Версия документа: 2.2** | Статус: TG ✅ / MAX ✅ / VK ✅ / web ✅
Репозиторий: `github.com/ip19760118-code/games`
Pages: `https://ip19760118-code.github.io/games/`

> **⚠️ Чувствительные данные (API-ключи, токены, Firebase credentials, webhook-секреты) в этом документе НЕ хранятся. Используй env-переменные на Vercel и локальные `.env`.**

---

## 0. Архитектура на одной странице

| Компонент | Где живёт | Комментарий |
|---|---|---|
| Хаб (витрина 15 игр) | GitHub Pages, корень репо `games/` | `index.html` **v3.20** |
| Игры | папки `chess/ … trend-catch/` | каждая мультиплатформенная через `js/platform.js` |
| Онлайн-комнаты | Firebase RTDB | проект не переименовывать |
| Единая схема реванша | все 6 онлайн-игр | флаги, round, heartbeat/presence, автостарт |
| MAX-бот | Vercel проект, Root Dir `max-bot`, вебхук `/max` | Callback: platform-api2.max.ru |
| VK-бот | Vercel проект, Root Dir `vk-bot`, вебхук `/vk` | Callback API api.vk.com |
| TG-бот | меню-кнопка «Играть» → hub `?plat=tg` | Web App |
| Кэш | `sw.js` (service worker) | навигации network-first, статика stale-while-revalidate |
| Аналитика | Google Analytics 4 | событие hub_open/hub_game_click с меткой platform |

Единый слой платформ: `js/platform.js` → глобальный `Platform`
(init, haptic, share, toast, onBack/fireBack, close, colors, user, name, maxClientReal).

---

## 1. Telegram (эталон, граблей минимум)

- SDK: `https://telegram.org/js/telegram-web-app.js`.
  **Грабля:** не хардкодить тегом в `index.html` хаба — иначе `detect()` в VK/MAX
  увидит `window.Telegram` и ошибётся платформой. Грузим лениво через `platform.js`.
- Меню-кнопка: BotFather → Bot Settings → Menu Button: текст `Играть`,
  URL `https://ip19760118-code.github.io/games/?plat=tg`.
- Профиль пользователя: `Telegram.WebApp.initDataUnsafe.user`.
- Навигация внутри Web App: обычный `location.href` работает (в отличие от MAX).
- Шеринг: `switchInlineQuery` → fallback `openTelegramLink('https://t.me/share/url?...')`.
- Витрина: /setname «Игровой центр», /setabout, /setdescription, /setuserpic.

---

## 2. MAX (самое минное поле)

### 2.1 API и вебхуки
- Base: **`https://platform-api2.max.ru`** (не botapi, не platform-api).
- Авторизация: заголовок `Authorization: <ТОКЕН>` **сырой строкой**, без Bearer.
- Регистрация вебхука: **`POST /subscriptions`** с телом
  `{"url":"https://<vercel>/max","update_types":["message_created","message_callback","bot_started"]}`;
  снятие — `DELETE /subscriptions?url=<тот же url>`. Файл-памятка: `webhook.json` в корне репо.
- **Грабля TLS:** цепочка сертификатов УЦ Минцифры не ходится стандартным Node TLS →
  все исходящие вызовы через `node:https` с `rejectUnauthorized:false` (+таймаут 6с, resolve вместо throw).
- **Грабля адресации:** получатель личного диалога передаётся **в query-строке**:
  `POST /messages?user_id=<sender.user_id>`; тело — только `{text, attachments}`.
  Адресат диалога = `sender.user_id` (или `callback.user.user_id`), НЕ chat_id.
  Клавиатура: `attachments: [{type:'inline_keyboard', payload:{buttons:[[...]]}}]`,
  payload callback-кнопки — JSON-строка.
- **Грабля Vercel freeze:** после `res.send(...)` функция замораживается — ВСЕ вызовы API
  строго ДО ответа (иначе сообщения терялись). Ответ вебхуку: `res.sendStatus(200)` в конце.
- Лимит: 2 сообщения/сек в диалог. Фолбэк-цепочка отправки: user_id+kb → user_id+список → chat_id+kb → chat_id+список.

### 2.2 Мини-приложения и контейнер
- MAX Bridge SDK: `https://st.max.ru/js/max-web-app.js`, глобалка **`window.WebApp`**
  (TG-подобная): `ready()`, `BackButton.show/onClick`, `HapticFeedback.*`,
  `shareMaxContent({text})`, `initDataUnsafe.user`, `platform`, `version`.
- **Грабля фейкового WebApp:** SDK, загруженный в обычном браузере, создаёт `window.WebApp`
  без клиента. Реальный клиент детектим: `WebApp.initData` непустой (>10 символов)
  ИЛИ UA / referrer содержит max.ru → `Platform.maxClientReal()`.
- **Грабля навигации:** контейнер MAX глушит `location.href` верхнего уровня (хаб→игра «виснет»).
- **Грабля iframe:** игры в iframe внутри MAX = third-party контекст → Firebase anonymous auth
  и хранилище блокируются → `PERMISSION_DENIED` при создании комнаты, чёрный экран на мобильном.
- **Итоговая рабочая схема:** хаб живёт внутри MAX (кнопка «Играть»), игры открываются
  `WebApp.openLink(abs)` во внешнем окне (first-party → Firebase работает).
  В обычном браузере `openLink` — пустышка: сначала проверка `maxClientReal()`,
  затем `window.open`, затем `location.href`.
- **Грабля кнопки «В меню»:** во внешнем браузере перехватываем клики по элементам со словом
  «меню» (capture-фаза) → `window.close()` → fallback диплинк на бота.
- Описание бота в портале: **лимит 200 символов**, без списков игр.
- **Организационная грабля:** у профиля самозанятого раздела «Мини-приложения» в портале нет;
  кнопка «Играть» ожила после обращения в поддержку/волны раскатки. Тикет-шаблон лежит в истории чата разработки.

---

## 3. VK (второе минное поле)

### 3.1 Callback API
- Точка: `POST /vk`. Типы: `confirmation` (вернуть строку подтверждения из настроек сервера),
  `message_new`, `message_event`. Секрет сверять с полем `secret` события.
- Отвечать `ok` быстро (<3 c), всю работу ДО ответа.
- Русские имена событий в UI: «Входящее сообщение» = message_new,
  **«Действие с сообщением» = message_event** (нажатия callback-кнопок!).

### 3.2 Клавиатуры (главный источник 911)
- Ошибка **912** «This is a chat bot feature» → включить: Управление → «Настройки для бота» →
  «Возможности ботов: Включены». Без этого клавиатуры не отправляются вовсе.
- Ошибка **911 «too much rows»**: 8 рядов × 2 кнопки = отказ. Лимит рядов < 8.
- Ошибка **911 «too much buttons»**: 15 кнопок = отказ. Держим **≤4 рядов и ≤10 кнопок**
  (пагинация по 9 игр + навигация).
- Ошибка **911 «action type which is not compatible with setting colors»**:
  у кнопок `open_app`/`open_link` **нельзя задавать `color`**. Color только у callback/text.
  Эта грабля стоила недели: все open-варианты отклонялись именно из-за цвета.
- **Постоянная кнопка** = нижняя клавиатура `{one_time:false, inline:false}`.
  Inline-клавиатура не подходит для «всегда видимой» кнопки.
- **Грабля сброса:** если отправить сообщение БЕЗ параметра `keyboard`, веб-клиент VK
  сбрасывает нижнюю клавиатуру → прикрепляем keyboard к КАЖДОМУ исходящему сообщению.
- Callback-кнопка крутит спиннер, пока не вызвать `messages.sendMessageEventAnswer`
  (event_id + user_id + peer_id + event_data).
- Прямое открытие мини-аппа: `event_data {type:'open_app', app_id, owner_id:-group}` (работает),
  либо клавиатурная кнопка `open_app` **без color** (работает, открывается клиентом, событий нет).
- **Грабля ретраев:** VK повторно доставляет message_event (~раз в 15 мин) →
  дедупликация по `event_id` (Map + TTL 6ч) обязательна, иначе спам-письма.

### 3.3 Mini Apps и витрина
- Кабинет мини-приложений: **`https://vk.com/apps?act=manage`** (НЕ раздел «Приложения»
  сообщества — там каталог чужих приложений).
- До модерации: «Режим разработки» + URL; публичность: «Состояние: Включено» + основные URL
  (мобильный и десктоп) = `https://ip19760118-code.github.io/games/?plat=vk`.
- Модерация: чек-лист (URL, «Включено», иконка 512, иконка 100, скриншот) → «Пройти модерацию»
  ОДИН раз; «Rate limit reached» = лимит попыток, ждать сутки; баннер
  «Часть функций недоступна — уже чиним» = авария на стороне VK.
- Кнопка действия сообщества: тип «Открыть приложение сообщества» → приложение «Игровой центр».
- VK Bridge: `https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js`;
  `VKWebAppInit`, `VKWebAppEnableSwipeBack` + subscribe(`VKWebAppSwipeBack`),
  `VKWebAppTapticImpactOccurred/NotificationOccurred`, `VKWebAppShare({link,text})`,
  `VKWebAppSetViewSettings`, `VKWebAppShowCloseButton`, `VKWebAppClose`, `VKWebAppGetUserInfo`.

---

## 4. Общий слой (hub + platform.js + sw.js)

- Детект платформы: сначала `?plat=` из URL, затем глобалки (Telegram → vkBridge → WebApp+version).
  Любой SDK грузим лениво (`ensureSdk`), хардкод тегов в hub запрещён.
- `openGame()`: TG/VK/web — `location.href`; MAX — `openLink` (только при maxClientReal),
  затем `window.open`, затем `location.href`. Тост «Открываю игру…» обязателен (фидбек клика).
- Service worker `sw.js`: навигации — network-first с кэш-фолбэком; статика — cache-first
  с фоновым обновлением; имя кэша `igrovoj-centr-vN` менять при принудительном сбросе.
  Регистрация из `platform.js` по маске пути `^(.*\/games\/)` только на github.io.
- Prefetch топовых игр (chess/seabattle/durak/tetris) через `<link rel=prefetch>` в простое,
  пропуск при `navigator.connection.saveData`.
- Firebase-комнаты работают ТОЛЬКО в first-party контексте: никаких iframe с играми
  внутри мессенджерских веб-вью (см. 2.2).
- `window.open` может блокироваться popup-блокером → всегда иметь fallback `location.href`.

---

## 5. Единая архитектура онлайн-комнат (v2.0)

**Применяется во всех 6 онлайн-играх**: Морской бой, Шахматы, Дурак, Домино, Шашки, Нарды.

### 5.1 Структура комнаты в Firebase RTDB

```
rooms/{code}/
├── game: 'chess'|'seabattle'|'durak'|'domino'|'shashki'|'nardy'
├── host: seat|side|uid хоста
├── round: number            // счётчик партий, +1 на каждую новую
├── status: 'waiting'|'playing'|'finished'
├── createdAt: timestamp
├── players|seats: {key: {name, uid, at}}   // состав (схемы различаются, см. 5.9)
├── presence: {key: {name, uid, at}}        // heartbeat
├── rematch: {key: true}                    // флаги согласия на реванш
├── flags: {drawOffer, drawAccept, surrender, winner}
├── scores: {key: number}                   // суммарные победы
└── state: {...}                            // игровое состояние
```

### 5.2 Жизненный цикл партии

```
waiting ──[host: «▶ Начать»]──► playing ──[result зафиксирован]──► finished
   ▲                                                                  │
   └──[все активные rematch=true && isHost]───────────────────────────┘
        (status='playing', round+1, rematch={}, players=только активные, state=new)
```

### 5.3 Heartbeat / presence

| Параметр | Значение |
|---|---|
| Интервал | 5000 мс (`HEARTBEAT_INTERVAL`) |
| TTL свежести | 15000 мс (`HEARTBEAT_TTL`) |
| Запуск | после `createRoom`/`joinRoom` с задержкой ~500 мс (дать seats записаться) |
| Остановка | `leaveRoom()`, `beforeunload` |
| Проверка | `isPresenceFresh(p) = p && p.at && (now - p.at) < TTL` |

**Грабля:** одного `onDisconnect().remove()` мало — при микро-обрывах мобильной связи presence исчезает, и игрок становится «офлайн» мгновенно. Устойчивую картину даёт только heartbeat + TTL.
**Грабля правил:** `.write` для `presence/$role` должен покрывать ВСЕ схемы состава (см. 5.9), иначе `permission_denied` каждые 5 секунд и серые кружки.

### 5.4 Реванш — флаговая схема с автостартом

1. Кнопка «🔄 Реванш» у **всех** игроков (endOverlay + шторка комнаты при finished).
2. Нажатие (`requestRematch`) пишет `rematch/{key}=true` и закрывает endOverlay. Больше ничего.
3. В подписке `on('value')` триггер (выполняет хост):
   - условие: **`status==='finished'`** (НЕ `s.result` — см. граблю Нард ниже);
   - `active` = места с fresh presence; `active.length>=2 && active.every(k=>rematch[k])`;
   - атомарный `update`: `status='playing'`, `round+1`, `rematch:{}`, `players=active`, `state=new`.
4. Round-триггер у всех клиентов: `rr!==myRound` → закрыть endOverlay/fieldView, сбросить `shownEndAt`, `sel/dests`, локальный сброс доски.
5. Защита от гонок: оба клиента могут написать одинаковый update — значения идемпотентны.
   (Морской бой v4.28 использует вариант с `transaction` на счётчике `rematchCount` — тоже валидно.)

**Грабля Нард (v2.4):** `checkWin` ставил только `state.result`, а `status` оставался `'playing'` → триггер реванша мёртв. Лечение: авто-перевод `status='finished'` при появлении `s.result` (пишет хост) + принудительный перевод в `requestRematch`.

**Грабля Шахмат (v2.8):** `checkEndOnline` передавал в `endGame` оффлайн-семантику (`'player'/'computer'`), а онлайн-ветка сравнивала с `'w'/'b'` → **оба игрока видели «Поражение»**. Лечение: передавать объективную сторону-победителя (`turn==='w' ? 'b' : 'w'`).

### 5.5 Динамический состав между партиями

- Вход разрешён в `waiting` **и** `finished` (deeplink-реванш с новыми игроками).
- При автостарте реванша `players/seats` перезаписываются только активными — ушедшие удаляются.
- «📤 Пригласить» disabled при полном составе; вне лобби скрывается или недоступна.

### 5.6 Лобби в выпадающей шторке

Лобби — НЕ отдельная модалка: `lobbyBox` внутри `rb-extra` (room-bar).
Шторка автораскрывается при `status='waiting'` и скрывается при старте партии.
Надпись для 2-местных игр: «Ожидание игрока…» (ед. ч.).

### 5.7 Умные кнопки шторки по статусу

| Status | Кнопки |
|---|---|
| waiting | 📤 Пригласить (disabled при полном), 🔢 Код, ▶ Начать (хост, disabled при <2), 🚪 Выйти |
| playing | 🔢 Код,  Ничья, 🏳 Сдаться, 🚪 Выйти |
| finished | 🔢 Код,  Реванш,  Выйти |

### 5.8 Просмотр партии после окончания

- Кнопка «👁 Посмотреть партию/поле» в endOverlay (онлайн и офлайн).
- Плавающая панель `fieldViewBar` сверху; `fieldViewMode=true` блокирует все ходы
  (onPt/onCell/tapOff/rollBtn); закрытие кнопкой или BackHandler возвращает endOverlay.

### 5.9 Схемы состава и правила Firebase

| Игра | Ключи мест |
|---|---|
| Морской бой | `host` / `guest` (объекты с `id`) |
| Шахматы, Шашки, Нарды | `players/w`, `players/b` (объекты с `uid`) |
| Домино | `players/{uid}` |
| Дурак | `seats/p0..p3` (объекты с `uid`) |

Консолидированные правила RTDB (покрывают все схемы; `.write` комнаты = создание ИЛИ участник):

```json
{
  "rules": {
    "rooms": {
      "$code": {
        ".read": "auth != null",
        ".validate": "$code.matches(/^[A-Z0-9]{4,10}$/)",
        ".write": "auth != null && (!data.exists() || data.child('host').child('id').val() === auth.uid || data.child('guest').child('id').val() === auth.uid || data.child('players').child(auth.uid).exists() || data.child('players').child('w').child('uid').val() === auth.uid || data.child('players').child('b').child('uid').val() === auth.uid || data.child('seats').child('p0').child('uid').val() === auth.uid || data.child('seats').child('p1').child('uid').val() === auth.uid || data.child('seats').child('p2').child('uid').val() === auth.uid || data.child('seats').child('p3').child('uid').val() === auth.uid)",
        "guest": {
          ".write": "auth != null && (!data.exists() || data.child('id').val() === auth.uid)"
        },
        "players": {
          "$key": {
            ".write": "auth != null && (!data.exists() || data.child('uid').val() === auth.uid || data.child('id').val() === auth.uid || $key === auth.uid)"
          }
        },
        "seats": {
          "$key": {
            ".write": "auth != null && (!data.exists() || data.child('uid').val() === auth.uid || data.child('id').val() === auth.uid || $key === auth.uid)"
          }
        },
        "presence": {
          "$role": {
            ".write": "auth != null && (root.child('rooms/'+$code+'/host/id').val() === auth.uid || root.child('rooms/'+$code+'/guest/id').val() === auth.uid || root.child('rooms/'+$code+'/players').child(auth.uid).exists() || root.child('rooms/'+$code+'/players/w/uid').val() === auth.uid || root.child('rooms/'+$code+'/players/b/uid').val() === auth.uid || root.child('rooms/'+$code+'/seats/p0/uid').val() === auth.uid || root.child('rooms/'+$code+'/seats/p1/uid').val() === auth.uid || root.child('rooms/'+$code+'/seats/p2/uid').val() === auth.uid || root.child('rooms/'+$code+'/seats/p3/uid').val() === auth.uid)"
          }
        }
      }
    },
    ".read": false,
    ".write": false
  }
}
```

**Грабля Дурака (v3.8):** без явных `seats/p0..p3` в блоке `presence` каждый heartbeat получал `permission_denied` → серые кружки и мёртвый реванш.

### 5.10 Префиксы логов и ключевые сообщения

| Игра | Префикс |
|---|---|
| Морской бой | `[SB]` |
| Шахматы | `[CH]` |
| Дурак | `[DU]` |
| Домино | `[DO]` |
| Шашки | `[SH]` |
| Нарды | `[NA]` |

Ключевые строки для диагностики: `startHeartbeat …`, `presence write failed …`,
`propose rematch …`, `rematch check: rm=… active=… allAgreed=…`,
`all agreed -> start new game immediately`, `result detected, setting status=finished`,
`round change N -> M`.

### 5.11 Watchdog автоходов

Хост каждые 5 с проверяет: если текущий актёр без fresh presence и `turnAt` старше 30 с →
автоход по правилам игры (взятие/пропуск/бито/ролл) с пометкой
`lastMove.action='автоход (нет связи)'`.

---

## 6. Таблица «симптом → причина → лечение»

### 6.1 Платформы

| Симптом | Причина | Лечение |
|---|---|---|
| MAX: сообщения не уходят, тишина в логах | вызовы после res.send (freeze) | всё ДО ответа |
| MAX: 404/сертификат при вызовах API | УЦ Минцифры | rejectUnauthorized:false |
| MAX: меню без клавиатуры | адресат не в query | user_id в query-строке |
| MAX: игра «виснет» из хаба | контейнер глушит location.href | openLink во внешнее окно |
| MAX: спиннер-окно виснет навсегда (container-режим) | WebView ждёт `LoadingCompleted` от новой страницы; JS хаба паузится → watchdog не тикает (официально подтверждено поддержкой MAX 2026-10-28) | `MAX_NAV_MODE='external'`; нативный путь — SPA с клиентским роутингом (см. 2.2 и 9) |
| MAX: PERMISSION_DENIED комнаты | iframe = third-party storage | убрать iframe |
| MAX: кнопка «меню» не возвращает | внешний браузер, нет WebApp | перехват клика + window.close/диплинк |
| MAX/VK: свайп вниз обновляет страницу | pull-to-refresh браузера | overscroll-behavior:none + preventDefault touchmove |
| VK: 912 | не включены «Возможности ботов» | включить в настройках для бота |
| VK: 911 too much rows/buttons | лимиты клавиатур | ≤4 рядов, ≤10 кнопок, пагинация |
| VK: 911 not compatible with colors | color у open_app/open_link | убрать color |
| VK: спиннер на кнопке | нет sendMessageEventAnswer | снакбар/open_app/open_link |
| VK: письма-дубли раз в ~15 мин | ретраи message_event | дедуп по event_id |
| VK: пропала нижняя клавиатура | сообщение без keyboard | keyboard в каждом send |
| VK: Rate limit reached (модерация) | лимит попыток подачи | одна попытка в сутки |
| TG: платформа определилась как tg в VK/MAX | хардкод TG SDK в hub | ленивая загрузка SDK |
| TG/BotFather: «Invalid bot selected» | бот выбран ДО команды | порядок: команда → кнопка бота → текст |

### 6.2 Онлайн-комнаты

| Симптом | Причина | Лечение |
|---|---|---|
| `permission_denied on /presence/...` каждые 5 с | rules не покрывают схему мест | консолидированные rules (5.9) |
| Серые кружки / «сразу офлайн» | onDisconnect без heartbeat | heartbeat + TTL 15 с |
| Реванш завис («ожидание соперника» навсегда) | триггер внутри ветки status / зависимость от s.result | триггер только по status='finished' + rematch-флагам |
| После реванша старое поле / нужно жать «Начать» | реванш писал waiting или не писал round | автостарт: status='playing', round+1 одним update |
| У обоих «Поражение» (Шахматы онлайн) | оффлайн-семантика winner в онлайн-ветке | передавать сторону 'w'/'b' |
| Точность 0% в онлайне (Морской бой) | счётчики только в оффлайн-ветке | инкремент в applyResolve |
| Лобби открывалось повторно после «Начать» | триггер реванша без проверки status | guard по status в триггере |
| Можно ходить в лобби до старта | нет проверки status | `isGameActive()` + блокировка обработчиков |
| «Пригласить» активна при полном составе | нет disabled | disabled при players>=max |
| Ушедший игрок висит в составе | seats не чистятся | перезапись players=active при автостарте |
| 404 mp3 в консоли | SND.preload/play без файлов | синтез-приоритет, preload не вызывать |
| 404 favicon | нет иконки | `<link rel="icon" href="data:,">` |
| Presence висит после закрытия вкладки | нет beforeunload | removePresence() в beforeunload |

---

## 7. Чек-листы

### 7.1 Новая игра (офлайн)
1. Папка игры + кнопка в `index.html` хаба + алиасы в `GAME_MAP` (боты шлют `?game=<alias>`).
2. `Platform.init({bg, back})`; звук/вибро только через `Platform.haptic/share`.
3. GA через `trackEvent` — платформа подставляется автоматически.
4. BackHandler: просмотр партии → rules → stats → set → lobby/room → mode → hub.
5. Favicon `data:,`; `overscroll-behavior:none`; описания витрин без чисел игр.

### 7.2 Новая онлайн-игра (подключение к единой схеме)
1. Структура комнаты по 5.1 (status/round/players|seats/presence/rematch/state/scores/flags).
2. Heartbeat 5 с / TTL 15 с; запуск с задержкой ~500 мс после записи места.
3. `removePresence()` в `leaveRoom()` и `beforeunload`.
4. Кнопка «🔄 Реванш» у всех (endOverlay + шторка при finished).
5. `requestRematch()` только пишет флаг; автостарт — в подписке у хоста (условия 5.4).
6. Round-триггер: закрытие endOverlay/fieldView, сброс shownEndAt/sel/dests.
7. Лобби = `lobbyBox` в шторке; автораскрытие при waiting.
8. `isGameActive()` и блокировка ходов вне playing.
9. Умные кнопки шторки по статусу (5.7).
10. `showFieldView()/closeFieldView()` с блокировкой ходов.
11. Вход в finished по deeplink разрешён.
12. Правила Firebase обновить под свою схему мест (5.9).
13. Префикс логов `[XX]`; ключевые строки 5.10.
14. Если движок не меняет `status` на 'finished' сам — добавить авто-перевод (грабля Нард).
15. Watchdog автоходов хоста (5.11).

### 7.3 Новая платформа (бот)
1. Вебхук на Vercel (отдельный проект, Root Dir); ответ ДО/ПОСЛЕ обработки — по freeze-модели платформы.
2. Реестр: подписка/вебхук + секрет + строка подтверждения.
3. Клавиатура: постоянная кнопка входа; лимиты платформы изучить ДО разработки.
4. Витрина: имя «Игровой центр», описание без чисел игр, аватар 🎮, кнопка действия.
5. `platform.js`: ветки detect/ensureSdk/init/haptic/share/close + мост платформы.

### 7.4 Деплой/переезд
1. Rename репо → `git remote set-url`; Pages пересобирается сам; Vercel едет по ID репо.
2. Правка env → обязателен Redeploy.
3. Кэш SW: поднять версию `CACHE` для принудительного обновления.
4. Bump VER в игре + `verTag`/`verTag2` + строка в таблице версий (0.1).

---

## 8. Справочник конфигурации

| Ключ | Значение |
|---|---|
| Hub URL | `https://ip19760118-code.github.io/games/` |
| MAX webhook | Vercel-проект max-bot, path `/max` |
| VK webhook | Vercel-проект vk-bot, path `/vk` |
| VK Mini App | кабинет `vk.com/apps?act=manage`; диплинк `/app<id>` |
| Firebase | проект RTDB (имя не менять); конфиг — в коде игр |
| Env MAX | `MAX_TOKEN`, `MAX_SECRET` |
| Env VK | `VK_TOKEN`, `VK_SECRET`, `VK_CONFIRM` |
| GA | measurement id в `index.html` |
| HEARTBEAT_INTERVAL / TTL | 5000 / 15000 мс |
| Lobby heartbeat delay | ~500 мс после create/join |
| Watchdog | тик 5 с, порог неактивности 30 с |
| MAX_NAV_MODE | `'external'` (продакшен); `'container'` — dormant-эксперимент |

> 🔒 Значения секретов хранятся только в Vercel → Environment Variables и локальных `.env` (в `.gitignore`). В репозиторий и в этот документ секреты не коммитятся.

---

## 9. История ключевых решений

| Версия | Дата | Изменения |
|---|---|---|
| 1.0 | — | Первая спецификация: TG/MAX/VK/web, хаб, боты, грабли платформ |
| 2.0 | 2026-10-27 | Единая архитектура онлайн-комнат (реванш, heartbeat, лобби в шторке, автостарт, просмотр партии); правила Firebase под все схемы; префиксы логов; чек-лист онлайн-игры; секреты вынесены из документа |
| 2.1 | 2026-10-27 | Ретест MAX container-навигации: спиннер-зависание, пауза JS → watchdog мёртв; фиксация `MAX_NAV_MODE='external'`; таблица текущих версий; новые грабли: chess winner-семантика, nardy status='finished', seabattle точность/расстановка, durak presence-rules, 404 mp3/favicon |
| 2.2 | 2026-10-28 | Официальный ответ поддержки MAX: метода `navigate` нет; `openLink` — только внешний браузер; зависание `location.href` — WebView ждёт `LoadingCompleted`; рекомендована SPA-архитектура с клиентским роутингом; BackButton через `SetCanGoBack`+`BackButtonPressed`, заголовок через `SetTitle`; док: dev.max.ru/docs/webapps/bridge. SPA зафиксирована как путь будущего развития; current best practice — external |

---

**Конец документа.** Обновлять при каждой новой грабле — цена ошибки уже оплачена.