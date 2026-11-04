# PLATFORM-SPEC — МК «Игровой центр»: кроссплатформенная спецификация и грабли

**Версия документа: 2.8** | Дата: 2026-11-04 | Статус: TG ✅ / MAX ✅ / VK ✅ / web ✅ / PC (Electron, Win 7 SP1–11) ✅ / Android (WebView, 8.0+) ✅
Репозиторий: `github.com/ip19760118-code/games`
Pages: `https://ip19760118-code.github.io/games/`

> **⚠️ Секреты (API-ключи Firebase, токены ботов, webhook-секреты, строки подтверждения)
> в этом документе НЕ хранятся. Только env-переменные Vercel и локальные `.env` (в `.gitignore`).**

---

## 0. Архитектура на одной странице

| Компонент | Где живёт | Комментарий |
|---|---|---|
| Хаб (витрина 18 игр + модалка скачивания + умная сортировка + ⚙️ android + чипы версий/NEW) | GitHub Pages, корень репо `games/` | `index.html` **v3.39** |
| Игры | папки `chess/ … trend-catch/`, `tetris/`, `pyatnashki/`, `tictactoe/` | мультиплатформенные через `js/platform.js` |
| Онлайн-комнаты | Firebase RTDB (имя проекта не менять!) | единая схема: раздел 5 |
| Desktop-оболочка (Windows) | локальный проект `gc-desktop/` (**НЕ в репо**) | Electron **22**, релизы GitHub Releases: раздел 6 |
| Android-оболочка | локальный проект `gc-android/` (**НЕ в репо**) | системный WebView, релизы там же: раздел 7 |
| MAX-бот | Vercel, Root Dir `max-bot`, вебхук `/max` | Callback: platform-api2.max.ru |
| VK-бот | Vercel, Root Dir `vk-bot`, вебхук `/vk` | Callback API api.vk.com |
| TG-бот | меню-кнопка «Играть» → hub `?plat=tg` | Web App |
| Кэш web | `sw.js` (service worker, **v9**) | навигации network-first, статика cache-first; в оболочках НЕ регистрируется |
| Аналитика | GA4 | hub_open / hub_game_click / hub_download_* / game_* / game_share(share_type) |

Единый слой платформ: `js/platform.js` (**v3.1**) → глобальный `Platform`
(init, haptic, share, **shareGame**, **gameDeepLink**, toast, onBack/fireBack, close, colors, user, name,
maxClientReal, isMaxExternal, maxNavMode, goToHub, hubBase, canonicalUrl).
Детект: `?plat=` → `AppBridge.platform` ('pc'|'android') → глобалки TG/VK/MAX → 'web'.

### 0.1 Текущие версии компонентов

| Компонент | Версия |
|---|---|
| hub `index.html` | v3.39 |
| `js/platform.js` | v3.1 |
| `sw.js` | v9 |
| `tools/gen-versions.js` (gc-desktop) | v1.4 |
| vk-bot `server.js` | v1.13 |
| max-bot `server.js` | v2.0 |
| Морской бой | v4.30 |
| Шахматы | v2.8 |
| Дурак | v3.15 |
| Домино | v2.3 |
| Шашки | v1.7 |
| Нарды | v2.8 |
| Тетрис | v1.2 |
| Сапёр | v1.7 |
| Пятнашки | v1.3 |
| Крестики-нолики | v1.5 |
| Desktop-оболочка | v0.3.3 (Electron 22.3.27) |
| Android-оболочка | v0.8.0 (system WebView) |

---

## 1. Telegram (эталон, граблей минимум)

- SDK: `https://telegram.org/js/telegram-web-app.js`.
  **Грабля:** не хардкодить тегом в `index.html` хаба — иначе `detect()` в VK/MAX
  увидит `window.Telegram` и ошибётся платформой. Грузим лениво через `platform.js`.
  (В играх синхронный тег удалён массовой правкой 2026-10-27 — он блокировал рендер.)
- Меню-кнопка: BotFather → Bot Settings → Menu Button: текст `Играть`, URL хаба с `?plat=tg`.
- Профиль: `Telegram.WebApp.initDataUnsafe.user`.
- Навигация внутри Web App: обычный `location.href` работает.
  **Грабля (исправлено v2.8):** `goToHub()` раньше вызывал `WebApp.close()` — кнопка
  «← В меню игр» в играх закрывала бота целиком. Теперь внутренняя навигация на хаб;
  `close()` остаётся единственным выходом в чат (back-хендлер хаба).
- Шеринг: `switchInlineQuery` → fallback `openTelegramLink('https://t.me/share/url?...')`.
- Витрина: /setname «Игровой центр», /setabout, /setdescription, /setuserpic.
- BotFather-грабля: порядок «команда → кнопка бота → текст»; заход в /mybots до команды сбрасывает выбор («Invalid bot selected»).

---

## 2. MAX (самое минное поле)

### 2.1 API и вебхуки
- Base: **`https://platform-api2.max.ru`** (не botapi, не platform-api).
- Авторизация: заголовок `Authorization: <ТОКЕН>` **сырой строкой**, без Bearer.
- Регистрация вебхука: **`POST /subscriptions`** с телом
  `{"url":"https://<vercel>/max","update_types":["message_created","message_callback","bot_started"]}`;
  снятие — `DELETE /subscriptions?url=<тот же url>`. Памятка: `webhook.json` в корне репо.
- **Грабля TLS:** цепочка УЦ Минцифры не ходится стандартным Node TLS →
  исходящие вызовы через `node:https` с `rejectUnauthorized:false` (+таймаут 6с, resolve вместо throw).
- **Грабля адресации:** получатель личного диалога — **в query-строке**:
  `POST /messages?user_id=<sender.user_id>`; тело — только `{text, attachments}`.
  Адресат = `sender.user_id` / `callback.user.user_id`, НЕ chat_id.
  Клавиатура: `attachments:[{type:'inline_keyboard',payload:{buttons:[[...]]}}]`, payload кнопки — JSON-строка.
- **Грабля Vercel freeze:** после `res.send(...)` функция замораживается — ВСЕ вызовы API строго ДО ответа.
- Лимит: 2 сообщения/сек в диалог. Фолбэк-цепочка: user_id+kb → user_id+список → chat_id+kb → chat_id+список.

### 2.2 Мини-приложения и контейнер
- MAX Bridge SDK: `https://st.max.ru/js/max-web-app.js`, глобалка **`window.WebApp`** (TG-подобная):
  `ready()`, `BackButton.show/onClick`, `HapticFeedback.*`, `shareMaxContent({text})`,
  `initDataUnsafe.user`, `platform`, `version`.
- **Грабля фейкового WebApp:** SDK в обычном браузере создаёт `window.WebApp` без клиента.
  Реальный клиент: `WebApp.initData` непустой (>10 символов) ИЛИ UA/referrer содержит max.ru
  → `Platform.maxClientReal()`.
- **Грабля навигации + официальный ответ поддержки MAX (2026-10-28):**
  1. Метода `navigate` (аналога TG) в Bridge **нет**.
  2. `WebApp.openLink` по дизайну открывает **только во внешнем браузере**.
  3. Top-level `location.href` внутри веб-вью: WebView ждёт событие `LoadingCompleted`
     от новой страницы; если страница его не шлёт — загрузка «виснет» (окно со спиннером).
     Это не баг, а архитектурное требование. JS исходной страницы на время навигации паузится
     (watchdog-фолбэки не успевают).
  4. **Рекомендованная архитектура — SPA с клиентским роутингом**: все экраны в одном HTML,
     навигация без перезагрузки.
  5. Кнопка «Назад»: `SetCanGoBack` + подписка `BackButtonPressed`; заголовок: `SetTitle`.
  6. Документация: `https://dev.max.ru/docs/webapps/bridge`.
  Ретест container-схемы 2026-10-27: спиннер-зависание подтвердилось.
- **Флаг схемы:** `MAX_NAV_MODE` в `js/platform.js`: `'container'` (dormant-эксперимент) |
  `'external'` (**продакшен**): хаб внутри клиента, игры во внешнем браузере через `openLink`.
- **Грабля iframe:** игры в iframe внутри MAX = блокировка Firebase anonymous auth и хранилища →
  `PERMISSION_DENIED`, чёрный экран на мобильном. Не использовать.
- **Грабля кнопки «В меню»:** во внешнем браузере перехват кликов по элементам со словом «меню»
  (capture-фаза) → `window.close()` → fallback диплинк бота.
- Описание бота в портале: **лимит 200 символов**, без списков игр.
- **Организационное:** меню-кнопка «Играть» ожила после обращения в поддержку (ответ 2026-10-26).
- **Pull-to-refresh:** свайп вниз обновлял страницу → блокировка `overscroll-behavior:none` +
  preventDefault touchmove в `platform.js` v2.4.

---

## 3. VK (второе минное поле)

### 3.1 Callback API
- Точка: `POST /vk`. Типы: `confirmation`, `message_new`, `message_event`. Секрет сверять с полем `secret`.
- Отвечать `ok` быстро (<3 c), всю работу ДО ответа.
- Русские имена событий в UI: «Входящее сообщение» = message_new,
  **«Действие с сообщением» = message_event** (нажатия callback-кнопок!).

### 3.2 Клавиатуры (главный источник 911)
- **912** «This is a chat bot feature» → Управление → «Настройки для бота» → «Возможности ботов: Включены».
- **911 «too much rows» / «too much buttons»**: держим **≤4 рядов и ≤10 кнопок** (пагинация).
- **911 «not compatible with setting colors»**: у `open_app`/`open_link` **нельзя задавать `color`**.
- **Постоянная кнопка** = нижняя клавиатура `{one_time:false, inline:false}`.
- **Грабля сброса:** сообщение БЕЗ `keyboard` сбрасывает нижнюю клавиатуру в веб-клиенте →
  keyboard прикрепляем к КАЖДОМУ исходящему.
- Callback-кнопка крутит спиннер, пока не вызвать `messages.sendMessageEventAnswer`.
  Фолбэк-цепочка в vk-bot: open_app → open_link → снакбар+ссылка.
- **Грабля ретраев:** VK повторно доставляет message_event (~раз в 15 мин) → дедуп по `event_id` (Map + TTL 6ч).

### 3.3 Mini Apps и витрина
- Кабинет мини-приложений: **`https://vk.com/apps?act=manage`** (НЕ «Приложения» сообщества).
- До модерации: «Режим разработки» + URL; публичность: «Состояние: Включено» + основные URL = хаб с `?plat=vk`.
- Модерация: чек-лист (URL, «Включено», иконка 512, иконка 100, скриншот) → «Пройти модерацию» ОДИН раз;
  «Rate limit reached» = ждать сутки.
- Кнопка действия сообщества: «Открыть приложение сообщества» → наше мини-приложение.
- VK Bridge: `VKWebAppInit`, `VKWebAppEnableSwipeBack` + subscribe(`VKWebAppSwipeBack`),
  `VKWebAppTapticImpactOccurred/NotificationOccurred`, `VKWebAppShare({link,text})`,
  `VKWebAppSetViewSettings`, `VKWebAppShowCloseButton`, `VKWebAppClose`, `VKWebAppGetUserInfo`.

---

## 4. Общий слой (hub + platform.js + sw.js + шеринг + релизы)

- Детект платформы: сначала `?plat=` из URL, затем `AppBridge.platform` ('pc'|'android'),
  затем глобалки (Telegram → vkBridge → WebApp+version). SDK грузим лениво (`ensureSdk`),
  хардкод тегов в hub запрещён.
- `openGame()`: TG/VK/web/pc/android — `location.href`; MAX real client — `openLink` во внешнее окно
  (тост «Открываю игру…» обязателен); MAX external browser — обычная навигация.
- Service worker `sw.js` (**v9**): навигации network-first с кэш-фолбэком; статика cache-first
  с фоновым освежением; **`cache:'no-store'` (versions.json) идёт мимо кэша**; при активации новый SW
  удаляет ВСЕ старые кэши (`skipWaiting` + `clients.claim`) — лечение «залипшего» platform.js в TG-desktop.
  Регистрация из `platform.js` по маске `^(.*\/games\/)` только на github.io
  **и только при отсутствии `window.AppBridge`** (в оболочках кэшем управляет апдейтер).
- Prefetch топовых игр (chess/seabattle/durak/tetris/**tictactoe**) через `<link rel=prefetch>`; пропуск при `saveData`.
- Firebase-комнаты работают ТОЛЬКО в first-party контексте: никаких iframe внутри мессенджер-вью.
- `window.open` может блокироваться popup-блокером → всегда fallback `location.href`.
- **Favicon:** во всех играх и хабе `<link rel="icon" … icon-32.png>` (+apple-touch 180); убирает 404 `/favicon.ico`.
- **Звук:** mp3 в `assets/snd` отсутствуют → эффекты через синтез в приоритете; `SND.preload()` не вызывать (404).
  AudioContext создаётся/разблокируется ТОЛЬКО после user gesture (autoplay-policy); эталон-функция `unlockAudio()`
  (однократный silent-осциллятор + resume; повторные вызовы дешёвые).
- **Модалка скачивания хаба (v3.29–3.33), двухэтапная:**
  1. Экран действий: «⬇️ Скачать приложение» / «📤 Отправить ссылку» / «💾 Скачать ссылку» (буфер обмена).
  2. Экран платформ: «🪟 Windows 7 и новее · Для ПК и ноутбуков. (~140Мб)» и
     «🤖 Android 8 и новее · Лёгкое приложение (~3 МБ) с офлайн-играми».
  Действия: download = прямая загрузка ассета (в оболочках — `AppBridge.openExternal`);
  share = `Platform.share` (системный chooser / шеринг мессенджеров);
  «Скачать ссылку» = копирование в буфер (`navigator.clipboard` + fallback `execCommand`).
  Системная «Назад»/Esc на экране платформ возвращает на экран действий (`ov.dataset.screen`).
- **Шестерёнка настроек (hub v3.34):** кнопка `#hubSetBtn` в правом верхнем углу панели;
  видна только при `Platform.name==='android' && AppBridge.openSettings` → открывает нативный
  экран настроек оболочки (7.9). На pc/web/TG/MAX/VK скрыта.
- **Чипы версий игр и бейдж NEW (hub v3.35–3.36):** источник — `versions.json`
  (`games[id].version`, `games[id].addedAt` из реестра `games-added.json`, сид 2026-10-01;
  NEW живёт 7 суток с даты добавления игры). Чтение манифеста (v3.36) двойное:
  сначала локально `./versions.json` (Pages web / паки android / паки desktop),
  при любой ошибке (404-страница оболочек, HTML вместо JSON) — фолбэк на абсолютный
  Pages-URL (`Access-Control-Allow-Origin: *`); оба fail → чипы молча скрываются.
  **Чип/NEW есть ТОЛЬКО у игр, присутствующих в манифесте** — см. правило GAMES генератора (6.3).
- **📤 Вирусный шеринг (platform.js v3.0–3.1):**
  - `Platform.gameDeepLink(key)` = `CANONICAL_ORIGIN + '/?game=' + key` — получатель открывается
    в хабе и сразу попадает в игру (`handleDeepLink`), plat подставляется уже на его стороне.
  - `Platform.shareGame(key, text, opts)` — шеринг результата/анонса: url = диплинк; к тексту
    авто-добавки: строка «👉 Сыграть сейчас: <диплинк>» (opts.game) и бренд-строка
    «🎮 Игровой центр — классика и новинки, онлайн и офлайн» (opts.game ИЛИ opts.brand).
    **Бренд без чисел** — никаких «16/17 игр» в текстах (числа устаревают).
  - Обычный `Platform.share(url,text,opts)` без опций НЕ меняется: модалка хаба и инвайты комнат
    остаются как были (инвайтам добавляем `{brand:true}` при миграции).
  - **v3.1 фикс десктоп-web:** `navigator.share` (OS share-sheet) на Windows отдаёт таргетам
    (Telegram) только url, текст терялся → при `name==='web'` и pointer:fine шеринг идёт
    в буфер обмена полным сообщением + тост; мобильный web (pointer:coarse) и оболочки — прежние пути.
- **UX-паттерн шеринга в играх (эталон с Пятнашек v1.3; мигрированы Сапёр v1.7, Нарды v2.8, Крестики v1.0):**
  - главный экран: кнопка **«📤 Отправить ссылку на игру»** (анонс + диплинк);
  - **«📤 Отправить результат»** (время/ходы/счёт/линия) — в финальном оверлее после окончания
    (в Крестиках v1.4+ — при любом исходе, не только победа: поражение и ничья тоже вирусны);
  - GA `game_share` с `share_type:'link'|'result'` — метрика виральности K = hub_deeplink / игроки.
- **UX-паттерн pulse-подсказок и авто-шторки (Морской бой v4.29–4.30 → Нарды v2.8 → Крестики v1.0):**
  - `@keyframes btnPulse` / `cellPulse`: подсвечивается контроль, который стоит нажать СЕЙЧАС
    (📤 Пригласить → ▶ Начать → бросок/ход → 🔄 Реванш; в Крестиках — пустые клетки в твой ход);
    подсказка снимается сразу после действия;
  - шторка комнаты (room-bar): **автораскрытие** при `status='waiting'` и `'finished'`,
    **автосворачивание** при `'playing'`, раскрытие по клику «Реванш» (видно согласие соперника);
  - цель: снять вопросы «что нажать дальше» и «где лобби» без единой строки текста-инструкции.
- **Картинки-ассеты игр (эталон Крестики v1.5):** папка `<game>/img/`, PNG **512×512**, прозрачный фон,
  **имена файлов ТОЛЬКО ASCII** (кириллические `х.png`/`о.png` визуально неотличимы от `x.png`/`o.png` —
  грабля 8.5). Проба при старте: `new Image()` на оба файла → флаг `useImg`;
  файлы отсутствуют → фолбэк на встроенный объёмный SVG (игра не ломается).
  В манифест папка попадает автоматически (walk по папке игры).
- **Стабильные ссылки ассетов:** `WIN_EXE_URL = …/releases/latest/download/IgrovojCentr-Setup.exe`,
  `APK_URL = …/releases/latest/download/IgrovojCentr.apk` (artifactName без версии в конфиге сборки).
  **ПРАВИЛО РЕЛИЗА:** каждый релиз содержит ВСЕ ассеты (apk + exe + latest.yml), иначе
  `latest/download/*` сломается на том, чего нет в свежем релизе.
- **Умная сортировка списка игр (hub v3.28):** локальная статистика запусков `localStorage['hub_sort_stats']`
  `{key:{n,t}}`; score = `n × 0.5^(дней простоя/30)`; пересортировка DOM при загрузке хаба;
  нулевые — в кураторском порядке; «Скоро» всегда последняя; сброс `?sort=reset`.
  Ключ нормализуется из пути папки (`./trend-catch/` → `trend_catch`), работает и для диплинков.
- Описания витрин без чисел игр (лимиты платформ).

---

## 5. Единая архитектура онлайн-комнат

Применяется во всех 7 онлайн-играх: Морской бой, Шахматы, Дурак, Домино, Шашки, Нарды, Крестики-нолики.

### 5.1 Структура комнаты в Firebase RTDB

```
rooms/{code}/
├── game: 'chess'|'seabattle'|'durak'|'domino'|'shashki'|'nardy'|'tictactoe'
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

**Грабля:** одного `onDisconnect().remove()` мало — при микро-обрывах presence исчезает мгновенно.
**Грабля правил:** `.write` для `presence/$role` должен покрывать ВСЕ схемы состава (см. 5.9),
иначе `permission_denied` каждые 5 сек и серые кружки (кейс Дурака v3.8).

### 5.4 Реванш — флаговая схема с автостартом

1. Кнопка «🔄 Реванш» у **всех** игроков (endOverlay + шторка при finished).
2. Нажатие (`requestRematch`) пишет `rematch/{key}=true` и закрывает endOverlay. Больше ничего.
3. Триггер в подписке `on('value')` у хоста:
   - условие: **`status==='finished'`** (НЕ `s.result` — грабля Нард);
   - `active` = места с fresh presence; `active.length>=2 && active.every(k=>rematch[k])`;
   - атомарный `update`: `status='playing'`, `round+1`, `rematch:{}`, `players=active`, `state=new`.
4. Round-триггер у всех: `rr!==myRound` → закрыть endOverlay/fieldView, сбросить `shownEndAt`, `sel/dests`.
5. Гоны не страшны: значения идемпотентны. Морской бой v4.28 использует variant с `transaction`
   на счётчике `rematchCount` — тоже валидно.

**Грабля Нард (v2.4):** `checkWin` ставил только `state.result`, `status` оставался `'playing'` →
триггер мёртв. Лечение: авто-перевод `status='finished'` при появлении `s.result` (пишет хост)
+ принудительный перевод в `requestRematch`.

**Грабля Шахмат (v2.8):** `checkEndOnline` передавал оффлайн-семантику (`'player'/'computer'`),
онлайн-ветка сравнивала с `'w'/'b'` → оба видели «Поражение». Лечение: объективная сторона-победитель.

### 5.5 Динамический состав между партиями

- Вход разрешён в `waiting` **и** `finished` (deeplink-реванш с новыми игроками).
- При автостарте `players/seats` перезаписываются только активными — ушедшие удаляются.
- «📤 Пригласить» disabled при полном составе; вне лобби скрывается или недоступна.

### 5.6 Лобби в выпадающей шторке

Лобби — НЕ отдельная модалка: `lobbyBox` внутри `rb-extra` (room-bar).
Шторка автораскрывается при `status='waiting'`, скрывается при старте (паттерн авто-шторки, раздел 4).
Надпись для 2-местных игр: «Ожидание игрока…» (ед. ч.).

### 5.7 Умные кнопки шторки по статусу

| Status | Кнопки |
|---|---|
| waiting | 📤 Пригласить (disabled при полном), 🔢 Код, ▶ Начать (хост, disabled при <2), 🚪 Выйти |
| playing | 🔢 Код, 🤝 Ничья, 🏳 Сдаться, 🚪 Выйти |
| finished | 🔢 Код,  Реванш,  Выйти |

### 5.8 Просмотр партии после окончания

- Кнопка «👁 Посмотреть партию/поле» в endOverlay (онлайн и офлайн).
- Плавающая панель `fieldViewBar`; `fieldViewMode=true` блокирует все ходы;
  закрытие кнопкой/BackHandler возвращает endOverlay.
- **Упрощение для игр без длинной истории (Крестики v1.5):** просмотр = финальная позиция БЕЗ
  пошаговой отмотки (кнопки ◀/▶ и `renFv` удалены намеренно): «👁 Посмотреть поле» просто убирает
  endOverlay, поле остаётся с win-подсветкой клеток и полосой-перечёркиванием; «Закрыть» возвращает карточку.
- **Полоса-перечёркивание собранной линии (Крестики v1.5, паттерн для будущих линий):**
  absolute-div `.strike` в обёртке поля (не внутри board, чтобы не сносился `innerHTML=''`);
  длина/угол = по rect первой и последней клеток линии (+выступы ~0.3 клетки), пересчёт на resize/повороте;
  градиент accent→accent2 + свечение; при ничьей/новой партии скрывается.

### 5.9 Схемы состава и правила Firebase

| Игра | Ключи мест |
|---|---|
| Морской бой | `host` / `guest` (объекты с `id`) |
| Шахматы, Шашки, Нарды, Крестики-нолики | `players/w`, `players/b` (объекты с `uid`; в Крестиках w=❌, b=⭕) |
| Домино | `players/{uid}` |
| Дурак | `seats/p0..p3` (объекты с `uid`) |

Консолидированные правила RTDB (`.write` комнаты = создание ИЛИ участник):

```json
{
  "rules": {
    "rooms": {
      "$code": {
        ".read": "auth != null",
        ".validate": "$code.matches(/^[A-Z0-9]{4,10}$/)",
        ".write": "auth != null && (!data.exists() || data.child('host').child('id').val() === auth.uid || data.child('guest').child('id').val() === auth.uid || data.child('players').child(auth.uid).exists() || data.child('players').child('w').child('uid').val() === auth.uid || data.child('players').child('b').child('uid').val() === auth.uid || data.child('seats').child('p0').child('uid').val() === auth.uid || data.child('seats').child('p1').child('uid').val() === auth.uid || data.child('seats').child('p2').child('uid').val() === auth.uid || data.child('seats').child('p3').child('uid').val() === auth.uid)",
        "guest": { ".write": "auth != null && (!data.exists() || data.child('id').val() === auth.uid)" },
        "players": { "$key": { ".write": "auth != null && (!data.exists() || data.child('uid').val() === auth.uid || data.child('id').val() === auth.uid || $key === auth.uid)" } },
        "seats": { "$key": { ".write": "auth != null && (!data.exists() || data.child('uid').val() === auth.uid || data.child('id').val() === auth.uid || $key === auth.uid)" } },
        "presence": { "$role": { ".write": "auth != null && (root.child('rooms/'+$code+'/host/id').val() === auth.uid || root.child('rooms/'+$code+'/guest/id').val() === auth.uid || root.child('rooms/'+$code+'/players').child(auth.uid).exists() || root.child('rooms/'+$code+'/players/w/uid').val() === auth.uid || root.child('rooms/'+$code+'/players/b/uid').val() === auth.uid || root.child('rooms/'+$code+'/seats/p0/uid').val() === auth.uid || root.child('rooms/'+$code+'/seats/p1/uid').val() === auth.uid || root.child('rooms/'+$code+'/seats/p2/uid').val() === auth.uid || root.child('rooms/'+$code+'/seats/p3/uid').val() === auth.uid)" } }
      }
    },
    ".read": false,
    ".write": false
  }
}
```

### 5.10 Префиксы логов и ключевые сообщения

| Игра | Префикс |
|---|---|
| Морской бой | `[SB]` |
| Шахматы | `[CH]` |
| Дурак | `[DU]` |
| Домино | `[DO]` |
| Шашки | `[SH]` |
| Нарды | `[NA]` |
| Крестики-нолики | `[TT]` |

Ключевые строки: `startHeartbeat …`, `presence write failed …`, `propose rematch …`,
`rematch check: rm=… active=… allAgreed=…`, `all agreed -> start new game immediately`,
`result detected, setting status=finished`, `round change N -> M`, `[TT] img NOT FOUND: <url>` (проба картинок).

### 5.11 Watchdog автоходов

Хост каждые 5 c: если актёр без fresh presence и `turnAt` старше 30 с → автоход по правилам игры
(взятие/пропуск/бито/ролл/бросок костей; **Крестики: простая передача хода** сменой `turn`
и `lastMove.action='авто-передача (нет связи)'`).

---

## 6. Desktop-оболочка (Windows, Electron 22) — v0.3.3

### 6.1 Состав и расположение

- Проект **локальный**: `C:\Telegram\gc-desktop\` (в репо НЕ коммитится).
- `src/main/`: `main.js` (окно, протокол, меню, IPC), `config.js` (JSON в userData),
  `updater.js` (контент, **v1.4.2**), `shell-updater.js` (оболочка, electron-updater).
- `src/preload/preload.js` → `window.AppBridge` (platform='pc'): share/openExternal/notify/
  getProfile/getVersions/quit/onBack/onToast/getUpdateWarnings/getShellInfo/setProfile/
  setUpdateMode/setContentSource/openPath/checkUpdates/getShellUpdateStatus/shellUpdateCheck/
  shellUpdateInstall/onShellUpdateState.
- `src/renderer/settings.html` — экран настроек (`app://shell/settings.html`).
- `tools/gen-versions.js` (**v1.4**: +игра `tictactoe` в массиве GAMES; v1.3: `addedAt` и реестр
  `games-added.json`) — генератор манифеста `versions.json` **в корень репо**.
- `assets/icons/` — вывод electron-icon-builder (`win/icon.ico`, `png/*`).
- `electron-builder.yaml`, `package.json` (version = версия оболочки).
- **Electron 22.3.27** — последняя линейка с поддержкой Windows 7 SP1/8/8.1 (Chromium 108, Node 16).
  Electron 23+ требует Windows 10 (см. 8.3). electron-builder 24.x: NSIS per-user,
  `artifactName: IgrovojCentr-Setup.exe`, `compression: maximum`, `electronLanguages: [ru, en]`,
  `publish: github`, иконки `assets/icons/win/icon.ico`.

### 6.2 Контент: паки, протокол app://, контракт updater.js

- `registerSchemesAsPrivileged([{scheme:'app',privileges:{standard,secure,supportFetchAPI,corsEnabled,stream}}])`
  ДО ready → стабильный origin → localStorage (uid Firebase, статистика) переживает обновления.
- **Отдача контента ТОЛЬКО через `protocol.registerFileProtocol` (v0.11):** Chromium сам выставляет
  MIME по расширению файла.
  **ГРАБЛЯ (2026-10-31, v0.3.0 на Win10):** `protocol.registerBufferProtocol` с объектом
  `{mimeType, data}` на Electron 22 для standard-схемы отдаёт `text/plain` → хаб открывается
  как исходный текст. `protocol.handle` в Electron 22 отсутствует вовсе. Не использовать
  buffer/handle-протоколы в оболочке на Electron 22.
- Паки: `%APPDATA%\igrovoj-centr\packs\{current,staging,old}` + `installed.json`;
  скачивание в staging → проверка sha256 каждого файла → атомарный swap current↔staging → old удаляется.
- **Копия манифеста в паках (updater v1.4.2):** при каждом успешном sync `versions.json`
  записывается в `packs/current/versions.json` (при пустом diff — напрямую в current,
  при swap — через staging). Хаб v3.35+ читает его локально → чипы версий и NEW работают
  в desktop **без сети**. Ошибка копирования манифеста не ломает sync (warn в консоль).
- **🔒 API-КОНТРАКТ `updater.js` (НЕ НАРУШАТЬ):** main.js ожидает
  `const { Updater } = require('./updater')`; `new Updater(app, config)`; методы
  `syncChanged(onProgress) → {man, changed, total}`, `fetchManifest()`, `computeWarnings(man)`,
  `readInstalled()`; поля `currentDir`, `warnings`; экспорт `{ Updater, sha256buf, MANIFEST_URL }`.
  Любая замена имени класса/сигнатур/экспорта = TypeError в `whenReady` ДО создания окна:
  процессы висят в диспетчере, окна нет, автообновление не стартует (кейс v1.4.1, фикс v1.4.2).
  Менять можно только внутренности методов.
- Источники: `local` (dev: паки = рабочая копия репо) | `pages` (боевой: GitHub Pages).
  В установленном exe дефолт `pages`, если локального репо нет.
- Бутстрап: `pages` + (`auto` ИЛИ нет валидного контента) → синхронизация ДО окна (таймаут 60 с).
- Самовосстановление `packsRoot` при старте: local-репо → packs/current → pages.
- Страницы-ошибки (v0.11): статические файлы `error.html` / `404.html` в userData
  («⚠️ Контент игр не найден» с кнопками Настройки/Повторить/Открыть в браузере) вместо чёрного экрана.
- **Селективная синхронизация (updater v1.1+):** скачиваются только паки, чьи **версии** отличаются от
  `installed.json` (hub — по `hub.version`, игры — по `games[id].version`); если менять нечего —
  тост «Версии игр актуальны», загрузка не стартует. **Хэши файлов НЕ сравниваются** → см. правило HUB_VER (6.3).
  **Следствие:** игры, отсутствующей в манифесте, в паках НЕ будет НИКОГДА, даже при «актуальных версиях»
  (кейс tictactoe 2026-11-04, см. 6.3 и 8.3).
- Прогресс: тосты `Обновление: N/M` (последний тик `d===t` не троттлится); финал
  «✅ Приложения обновлены: N/N файлов» до перезагрузки окна и повторно после (`did-finish-load`).
  Ошибка = тост + системное `Notification` (не пропадает бесследно).
- Service worker в оболочке НЕ регистрируется (platform.js gated по host github.io и AppBridge).

### 6.3 Манифест versions.json, грабля хэшей, 🔒 ПРАВИЛО HUB_VER и 🔒 ПРАВИЛО GAMES

- Лежит в корне репо, публикуется на Pages; структура: `hub{version,files[]}`,
  `games{id:{version,online,addedAt,files[]}}`, каждый файл `{path, sha256, size}`; `baseUrl` = Pages.
- **🔒 ПРАВИЛО HUB_VER:** селективная синхронизация оболочек сравнивает **строку версии хаба**
  (`HUB_VER` в `index.html`), а не хэши файлов. Поэтому ЛЮБОЕ изменение hub-файлов —
  `js/platform.js`, `sw.js`, `js/snd.js`, `icon-512/32/180.png` — обязано сопровождаться
  bump'ом `HUB_VER` в том же коммите, иначе ПК/Android продолжат жить со старыми файлами
  (кейс 2026-11-03: platform.js v3.0/v3.1 и sw.js v9 не доехали до паков при HUB_VER 3.37;
  web/мессенджеры работали, т.к. грузят с Pages напрямую). Изменения ОТДЕЛЬНЫХ ИГР правила не требуют:
  игры сравниваются по собственной `VER`.
- **🔒 ПРАВИЛО GAMES (gen-versions v1.4, кейс 2026-11-04):** массив `GAMES` в `tools/gen-versions.js`
  — единственный источник состава манифеста. Новая игра, закоммиченная БЕЗ добавления id в массив,
  не попадает в `versions.json` → паки оболочек её не скачивают (на ПК клик = страница «Файл не найден»,
  т.к. fallback в сеть у desktop-протокола НЕТ), хаб не рисует чип версии и NEW;
  при этом web/мессенджеры и Android (сетевой fallback перехватчика) работают — диагностика сбивает с толку.
  Лечение: добавить `['<id>', online?]` в GAMES → реген ПОСЛЕ коммита игры → коммит
  `versions.json` + `games-added.json` → push → синхронизация оболочек.
- **Реестр дат добавления игр:** `games-added.json` в корне репо (`{id:'YYYY-MM-DD'}`), ведёт
  gen-versions v1.3: первая генерация засеивает все существующие игры датой `2026-10-01`
  (бейджей NEW нет), каждая новая игра получает реальную дату автоматически → хаб рисует NEW 7 дней.
- **Грабля (2026-10-31, `sha256 mismatch: sw.js`):** генератор хэшировал байты рабочей папки,
  а Pages отдаёт байты git-блоба (CRLF-нормализация git на Windows / устаревший манифест после
  коммита без регенерации). **Лечение (gen-versions v1.2): байты берутся из `git show HEAD:path`**;
  незакоммиченные файлы → фолбэк на рабочую папку + предупреждение в консоли.
- **Правило деплоя:** коммит контента → `node tools/gen-versions.js` → коммит `versions.json`
  (+`games-added.json` при первом добавлении игры) → push одним пакетом.

### 6.4 Обновление оболочки (electron-updater)

- Фид: GitHub Releases репо `games` (`publish: provider github` в yml).
- В каждый релиз **обязательно** прикреплять `latest.yml` из `release\` — без него апдейтер слеп.
- **Грабля «актуальна» при новом релизе:** `latest.yml` несёт `version:` из `package.json`;
  если версию не bump-нули перед сборкой, установленная оболочка видит равную версию и не обновляется.
  Чек-лист: bump `package.json` → `npm run dist` → `type release\latest.yml | findstr version`
  → сверить → только потом релиз.
- Режимы из конфига контента: `auto` — тихая закачка + диалог «Перезапустить сейчас?»;
  `manual` — тост «Доступна новая версия оболочки» + «Файл → Обновить приложение…».
- Тихая проверка через 6 c после старта (только `app.isPackaged`); в dev — заглушка с пояснением.
- Обновления дельтовые (differential downloader) — обычно единицы МБ.
- v0.1.0 обновиться сама не может (кода апдейтера не было) — только ручная переустановка.
- **Сломанная сборка не самолечится:** если main.js падает до инициализации shell-updater
  (кейс контракта updater.js), автообновление не стартует — лечим ручной установкой нового exe.
- **Грабля Node 16 (Electron 22):** глобального `fetch` в main-процессе нет →
  `updater.js` качает через `node:https`-хелпер `httpGetBuffer` (редиректы до 5,
  `Accept-Encoding: identity`, таймаут 30 с, 1 ретрай на файл).

### 6.5 Релизы оболочки и ссылки скачивания

- Тег `vN.N.N`, title «Игровой центр N.N.N»; ассеты **три**: `IgrovojCentr-Setup.exe` +
  `latest.yml` + `IgrovojCentr.apk` (актуальный или перезалитый без изменений — правило раздела 4).
- `artifactName: IgrovojCentr-Setup.exe` (без версии) → стабильная ссылка хаба
  `…/releases/latest/download/IgrovojCentr-Setup.exe`; шеринг = `…/releases/latest`.
- Кнопка хаба «📥 Скачать приложение» (v3.22+, двухэтапная с v3.29): модалка действий и платформ;
  в оболочке exe открывается через `AppBridge.openExternal`.
- Подписи нет → SmartScreen предупреждает («Подробнее → Выполнить всё равно»); ожидаемо до сертификата/Store.

### 6.6 Иконки и процедура замены логотипа

- Источник: `icon-512.png` в корне репо (он же og:image, логотип хаба `.hub-logo`, источник favicon).
  **Требования к новому исходнику:** PNG, квадрат 512×512 (или 1024), **непрозрачный фон**
  (лаунчеры Android и темы Windows рисуют прозрачность как чёрный/белый квадрат), поля ~10–15%.
- `npx --yes electron-icon-builder --input=…\icon-512.png --output=assets` →
  `assets/icons/win/icon.ico`, `assets/icons/png/*.png` (**именно папка `icons/`** —
  грабля путей v0.2.2: yml искал `assets/icon.ico`). **`npx` без `--yes` спрашивает
  `Ok to proceed? (y)` — вставленная следом команда уйдёт в этот prompt и npm отменится.**
- yml: `win.icon` и `nsis.installerIcon/uninstallerIcon` = `assets/icons/win/icon.ico`.
- `pickAppIcon()` в main.js: цепочка фолбэков `icons/png/512x512.png → icons/win/icon.ico →
  assets/icon.png → assets/icon.ico → icon-512.png репо`; иначе в dev окно получает дефолтную
  иконку Electron, отличную от логотипа хаба.
- Производные favicon: `icon-32.png`, `icon-180.png` — скрипт `games/tools/make-favicons.ps1`
  (System.Drawing, HighQualityBicubic), запуск `powershell -ExecutionPolicy Bypass -File …`.
- **Процедура замены логотипа (все платформы):**
  1. Новый PNG → поверх `games/icon-512.png` (имя не менять).
  2. `make-favicons.ps1` → icon-32/180.
  3. Android: `gen-icons.ps1` (mipmap 48–192) → пересборка APK.
  4. Desktop: `electron-icon-builder` → `npm run dist`.
  5. Коммит иконок → **bump HUB_VER** (иконки — hub-файлы!, правило 6.3) → `gen-versions.js`
     (иконки входят в хэши паков) → коммит versions.json → push.
  6. Релиз с тремя ассетами; на устройствах — кэш иконок: Android удалить старую версию/перезагрузка,
     Windows `ie4uinit.exe -show` или перезапуск explorer.
  7. Аватары ботов TG/VK/MAX обновляются ВРУЧНУЮ в порталах (из файла не подтягиваются).
- **Грабля «иконка вернулась к атому»:** `signAndEditExecutable: false` в yml отключает rcedit —
  встраивание иконки/версий в exe (добавлялось как обход winCodeSign, ломает иконку).
  Правильный обход winCodeSign — см. 8.3, флаг не трогать.

### 6.7 Размер установщика и совместимость с ОС

- 150 МБ → 143 МБ после `compression: maximum` + `electronLanguages: [ru, en]` (минус 53 локали).
- **~140 МБ — пол Electron x64** (Chromium+V8+Node ~300 МБ unpacked); игры/хаб в установщике = 0 байт
  (докачиваются при первом запуске).
- **Грабля ОС:** Electron 31 на Windows 8.1 даёт системное «Невозможно запустить это приложение
  на вашем ПК» (манифест exe требует Win10). С v0.3.0 оболочка на **Electron 22** →
  работает на Windows 7 SP1 / 8 / 8.1 / 10 / 11 одним установщиком.
- Electron 22 = EOL (Chromium 108, без обновлений безопасности) — осознанный компромисс ради старых ОС;
  веб-контент изолирован (`contextIsolation`, `sandbox:true`), внешних страниц внутри оболочки нет.
- На очень старых 8.1 без обновлений может понадобиться UCRT (KB2999226).
- Roadmap «мало»: (A) Tauri v2 на системном WebView2 → 3–10 МБ, контракт `AppBridge` сохраняется,
  веб-часть не меняется (но только Win10+); (B) PWA-установка из браузера → 0 МБ (manifest + sw.js).

### 6.8 UX оболочки

- Меню RU: Файл (Настройки Ctrl+,, Проверить обновления игр, Обновить приложение…, Выход),
  Вид, Помощь. Вкладка «Правка» удалена; **Ctrl+Z/X/C/V/A/Y перехватываются `before-input-event`**
  (`wc.undo/cut/copy/paste/selectAll/redo`) — копирование кода комнаты/имени не ломается.
- Esc = системная «Назад» для страниц `app://` → backHandler игры → оверлеи → хаб;
  на хабе back → `AppBridge.quit()` (выход из приложения).
- Настройки: имя игрока (видно в онлайн-комнатах через `Platform.user()`), источник контента,
  режим обновлений, живой статус автообновления оболочки, сведения (пути/версии), кнопки
  «Проверить обновления игр/оболочки», «Установить обновление», «Папка контента».
- Внешние ссылки (`http(s)`) всегда уходят в системный браузер (`setWindowOpenHandler` +
  `will-navigate`); навигация вне `app://` запрещена.
- Тосты: IPC `app-toast` → `Platform.toast` в странице (3 с); тосты оболочки через hooks shellUpdater.

---

## 7. Android-оболочка (system WebView) — v0.8.0

### 7.1 Состав и расположение

- Проект **локальный**: `C:\Telegram\gc-android\` (в репо НЕ коммитится, как и gc-desktop).
- `app/build.gradle` (Groovy; namespace `ru.ip19760118.igrovojcentr`; minSdk 26 = Android 8.0;
  compile/targetSdk 34; `buildFeatures { buildConfig = true }`; signingConfigs.release из локального keystore).
- `app/src/main/java/ru/ip19760118/igrovojcentr/`: `MainActivity.java`, `AppBridge.java`,
  `ContentUpdater.java` (**v1.4**), `AppUpdater.java`, `ApkProvider.java`, `SettingsActivity.java` (**v1.1**),
  `PrefsStore.java`, `MimeUtils.java`.
- `app/src/main/AndroidManifest.xml`: INTERNET / ACCESS_NETWORK_STATE / VIBRATE /
  REQUEST_INSTALL_PACKAGES; activity `singleTask` + `configChanges`; SettingsActivity (exported=false);
  provider `ApkProvider` (authorities `${applicationId}.apk`); intent-filter VIEW
  `https://ip19760118-code.github.io/games/*` (диплинки комнат и игр).
- `res/values/themes.xml` = `android:Theme.Material.NoActionBar` (тёмный фон #070B16);
  `res/values/strings.xml` = «Игровой центр»; иконки `res/mipmap-*/ic_launcher.png`.
- `keystore/release.keystore` — ключ подписи, **локально + резервная копия на накопителе**
  (потеря ключа = невозможность обновлять APK поверх).
- Зависимостей НОЛЬ: только системный WebView → APK ~2–4 МБ.
- Тулчейн на рабочем ПК: Android Studio (папка программы и JBR), SDK отдельно;
  `JAVA_HOME=<studio>\jbr`; `local.properties:sdk.dir=<реальный SDK>` (см. грабли 8.4).

### 7.2 Контент и «локальный origin»

- WebView грузит `https://ip19760118-code.github.io/games/index.html?plat=android`
  (+ query из входящего intent: `?room=…`, `?game=…`).
- `WebViewClient.shouldInterceptRequest`: запросы к host Pages с путём `/games/…` отдаются
  из локальных паков (`WebResourceResponse` с MIME по расширению); файла нет локально →
  прозрачный fallback в сеть (Pages). Origin остаётся Pages-овским → инвайты/`canonicalUrl`
  игр работают БЕЗ правок, localStorage стабилен.
  **Следствие-диагностика:** игра, отсутствующая в паках (кейс GAMES, 6.3), на Android
  всё равно играбельна онлайн — в отличие от ПК, где fallback нет.
- Паки: `context.filesDir/packs/{current,staging,old}` + `installed.json`.
  `ContentUpdater` = порт десктопного updater: `versions.json`, селективная закачка по версиям
  (hub — по `hub.version`, игры — по `games[id].version`; **правило HUB_VER действует и здесь**, 6.3),
  sha256 каждого файла, атомарный swap; синхронизация при КАЖДОМ запуске (bootstrap-оверлей
  с прогрессом `Обновление: N/M`; тап по оверлею = повтор после ошибки).
- **Офлайн-старт (ContentUpdater v1.3):** манифест недоступен (DNS/сеть), но `packsValid()` →
  статус «Офлайн: игры из памяти устройства» и запуск WebView из паков; экран ошибки —
  только когда контента нет вовсе.
- **Манифест в паках (v1.2):** `versions.json` перезаписывается в `current/` при каждом sync
  (включая пустой diff) и кладётся в staging при swap → хаб v3.35+ рисует чипы версий и NEW офлайн.
- Источника «local repo» нет: всегда `pages`.
- SW не регистрируется (platform.js v2.9+: гейт по `window.AppBridge`).

### 7.3 Мост AppBridge (platform='android')

- `getPlatform()='android'`; `getProfile()` (имя из SharedPreferences, дефолт «ИгрокNNN»);
  `getVersions()` (shell=versionName, content=hub из installed.json); `getUpdateWarnings()`;
  `share(text,url)` → `ACTION_SEND` chooser; `openExternal(url)` → `ACTION_VIEW`;
  `quit()` → finish; `notify/toast` → `pageToast` (evaluateJavascript `Platform.toast`);
  `checkUpdates()` → принудительный sync контента с тостами.
- v0.5.0+: `checkAppUpdate()` → ручная проверка обновления APK (игнорирует троттлинг).
- v0.6.0+: `openSettings()` → нативный SettingsActivity; `getUpdateMode()` / `setUpdateMode(m)`.
- Аппаратная «Назад»: `onBackPressed` → `evaluateJavascript(window.__androidBack…)`;
  `false` → finish. `platform.js` v2.9 в init/android и onBack назначает `window.__androidBack`.
- Вибро: `navigator.vibrate` (permission VIBRATE) — ветка fallback в `Platform.haptic`.
- Шеринг игр: `Platform.share` → сначала `AppBridge.share` (нативный chooser), иначе мессенджер-фолбэки.

### 7.4 Диплинки и жизненный цикл

- Клик по ссылке-приглашению (`…/games/seabattle/?room=CODE`) в Telegram/браузере → chooser
  предлагает «Игровой центр» → комната открывается внутри приложения (query сохраняется).
- `launchMode=singleTask` + `configChanges` — один инстанс, повороты без перезагрузки WebView.
- Обновления самого APK: см. 7.8 (авто с v0.5.0).

### 7.5 Иконка приложения

- Генерация БЕЗ Android Studio: PowerShell-скрипт `gen-icons.ps1` (System.Drawing,
  HighQualityBicubic) из `games/icon-512.png` → `mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher.png`
  (48/72/96/144/192 px). Запуск: `powershell -ExecutionPolicy Bypass -File gen-icons.ps1`.
- **Грабли:** см. 8.4 (leftover mipmap-anydpi, Material3-темы шаблона, кэш иконок лаунчера)
  и 6.6 (требования к исходнику: непрозрачный фон, поля).

### 7.6 Сборка и подпись

- Keystore один раз: `keytool -genkeypair … -keystore keystore\release.keystore -alias igrovoj …`
  (keytool берём из JBR студии: `<studio>\jbr\bin\keytool.exe`).
- Сборка: `set JAVA_HOME=<studio>\jbr` → `gradlew.bat assembleRelease` →
  `app\build\outputs\apk\release\app-release.apk` → переименовать в `IgrovojCentr.apk`.
- `signingConfigs.release` в app/build.gradle указывает на локальный keystore (пароли только локально).

### 7.7 Релизы

- Релиз GitHub содержит **ТРИ ассета**: `IgrovojCentr.apk` + `IgrovojCentr-Setup.exe` + `latest.yml`
  (правило раздела 4: ссылки `latest/download/*` живут только в свежем релизе).
- Hub v3.31+: кнопка 🤖 «Android 8 и новее» активна; действия модалки работают и для APK
  (download → anchor/openExternal, share → Platform.share, «скачать ссылку» → буфер).
- Теги релизов общие для проекта (`v0.N.N`); **versionName APK ведётся отдельно** в build.gradle
  и сверяется с `android-update.json` (7.8).

### 7.8 Автообновление APK (v0.5.0+)

- **Манифест обновления:** `android-update.json` в корне репо → Pages:
  `{"versionName":"0.8.0","versionCode":6,"notes":"…"}`. Приложение сравнивает `versionName`
  с `BuildConfig.VERSION_NAME` (почленный числовой cmp). GitHub API НЕ используется
  (rate-limits, User-Agent) — только Pages-json + стабильная ссылка ассета.
- **Ссылка загрузки:** `APK_URL = …/releases/latest/download/IgrovojCentr.apk` →
  `cacheDir/update/IgrovojCentr.apk`; прогресс — тосты (`pageToast` в MainActivity,
  `Toast` в SettingsActivity).
- **Когда проверяем:** при старте после готовности контента, если режим `auto`
  (PrefsStore.updateMode) и прошло ≥6 ч (pref `apkCheckAt`); вручную — кнопка в настройках (7.9)
  и `AppBridge.checkAppUpdate()` (троттлинг игнорируется).
- **Установка:** собственный `ApkProvider` (ContentProvider без androidx; authorities
  `${applicationId}.apk`; путь `update.apk`) → `Intent.ACTION_VIEW` с `content://…` +
  MIME `application/vnd.android.package-archive` + `FLAG_GRANT_READ_URI_PERMISSION`.
  `Uri.fromFile` запрещён с API 24 (FileUriExposedException) — не использовать.
- **Гейт Android 8+:** permission `REQUEST_INSTALL_PACKAGES`; если
  `canRequestPackageInstalls()==false` → AlertDialog → `Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES`;
  флаг `pendingInstall` + повтор в `onResume` после возврата из настроек.
- **Подтверждение:** нативный AlertDialog «Доступна версия X. Установить сейчас?» (Обновить/Позже).
- **Правило деплоя android-update.json:** коммит/пуш json — строго ПОСЛЕ Publish релиза
  (иначе устройства скачают старый ассет под новой версией). Порядок: bump versionName/versionCode →
  assembleRelease → Release (3 ассета) → push json.
- **Историческая оговорка:** сборки ≤0.4.x апдейтера не содержат — обновляются вручную один раз
  (модалка хаба 🤖); цепочка замкнута с 0.5.0.

### 7.9 Экран настроек (SettingsActivity, v0.6.0+; v1.1 — динамическое «О приложении»)

- **Вход:** шестерёнка ⚙️ в хабе (v3.34+, только android) → `AppBridge.openSettings()`;
  Activity нативная, UI собран кодом (без XML и зависимостей), тема тёмная (#070B16/#1b2228/#7cffc4).
- **Секции:**
  1. *Имя игрока*: EditText + «💾 Сохранить имя» → `PrefsStore.setName` (имя идёт в
     `AppBridge.getProfile` → `Platform.user()` → онлайн-комнаты; обрезка до 24 символов).
  2. *Обновление оболочки*: RadioGroup Авто/Вручную → `PrefsStore.updateMode`;
     «🔄 Проверить обновление оболочки» → AppUpdater.checkAsync(true) + диалог + установка (7.8);
     «🎮 Обновить игры сейчас» → ContentUpdater.syncAsync с тостами прогресса.
  3. *Сведения*: оболочка vN.N.N (код N) / контент: hub vN.NN (installed.json) /
     **игр в паках: N** (`installedGamesCount()` из installed.json, ContentUpdater v1.4) /
     WebView: Chrome NN (парсинг `WebSettings.getDefaultUserAgent`).
  4. *Ещё*: «🌐 Игровой центр в браузере» → ACTION_VIEW Pages; «ℹ️ О приложении» →
     AlertDialog **без зашитых чисел**: версия/код оболочки, состав и количество игр и версия контента
     берутся из installed.json в момент открытия (кейс v0.7.1: «16 игр» устарело после добавления 17-й),
     neutral «Страница релизов» → releases/latest.
- **Навигация:** кнопка «← Назад» и системная «Назад» → finish() в хаб.
- **Хранилище:** единый SharedPreferences-файл `igrovoj`: `name`, `updateMode`, `apkCheckAt`.
- Режим «Вручную» отключает автопроверку APK при старте (MainActivity.bootstrap читает режим);
  синхронизация КОНТЕНТА выполняется при каждом запуске независимо от режима.

---

## 8. Таблица «симптом → причина → лечение»

### 8.1 Платформы

| Симптом | Причина | Лечение |
|---|---|---|
| MAX: сообщения не уходят, тишина в логах | вызовы после res.send (freeze) | всё ДО ответа |
| MAX: 404/сертификат при вызовах API | УЦ Минцифры | rejectUnauthorized:false |
| MAX: меню без клавиатуры | адресат не в query | user_id в query-строке |
| MAX: игра «виснет» из хаба | контейнер глушит location.href | openLink во внешнее окно |
| MAX: спиннер-окно виснет навсегда (container) | WebView ждёт LoadingCompleted; JS паузится → watchdog мёртв | MAX_NAV_MODE='external'; нативный путь — SPA (ответ поддержки 2026-10-28) |
| MAX: PERMISSION_DENIED комнаты | iframe = third-party storage | убрать iframe |
| MAX: кнопка «меню» не возвращает | внешний браузер, нет WebApp | перехват клика + window.close/диплинк |
| MAX/VK: свайп вниз обновляет страницу | pull-to-refresh | overscroll-behavior:none + preventDefault |
| **TG desktop / web: после деплоя работает старый platform.js** | **SW cache-first держит старую статику в кэше** | **sw.js v9: purge старых кэшей при активации + skipWaiting/clients.claim; переоткрыть мини-приложение (1–2 раза)** |
| VK: 912 | не включены «Возможности ботов» | включить в настройках для бота |
| VK: 911 rows/buttons | лимиты клавиатур | ≤4 рядов, ≤10 кнопок, пагинация |
| VK: 911 colors | color у open_app/open_link | убрать color |
| VK: спиннер на кнопке | нет sendMessageEventAnswer | снакбар/open_app/open_link |
| VK: письма-дубли ~15 мин | ретраи message_event | дедуп по event_id |
| VK: пропала нижняя клавиатура | сообщение без keyboard | keyboard в каждом send |
| VK: Rate limit reached | лимит попыток модерации | одна попытка в сутки |
| TG: платформа tg в VK/MAX | хардкод TG SDK в hub | ленивая загрузка SDK |
| TG: «В меню игр» закрывает бота | goToHub вызывал WebApp.close | platform.js v2.8: внутренняя навигация на хаб |
| TG/BotFather: «Invalid bot selected» | бот выбран ДО команды | порядок: команда → кнопка бота → текст |
| Игры грузятся медленно везде | синхронный тег telegram-web-app.js в head | тег удалён массовой правкой; SDK лениво |
| Звук не стартует, консоль: AudioContext not allowed | autoplay-policy: контекст до user gesture | unlockAudio() на первом клике/свайпе/клавише (эталон Пятнашки) |

### 8.2 Онлайн-комнаты

| Симптом | Причина | Лечение |
|---|---|---|
| `permission_denied on /presence/...` каждые 5 с | rules не покрывают схему мест | консолидированные rules (5.9) |
| Серые кружки / «сразу офлайн» | onDisconnect без heartbeat | heartbeat + TTL 15 с |
| Реванш завис навсегда | триггер внутри ветки status / зависимость от s.result | триггер только по status='finished' + rematch-флагам |
| После реванша старое поле / нужно жать «Начать» | реванш писал waiting или не писал round | автостарт: status='playing', round+1 одним update |
| У обоих «Поражение» (Шахматы онлайн) | оффлайн-семантика winner | передавать сторону 'w'/'b' |
| Точность 0% в онлайне (Морской бой) | счётчики только в оффлайн-ветке | инкремент в applyResolve |
| Лобби открывалось повторно после «Начать» | триггер реванша без проверки status | guard по status |
| Можно ходить в лобби до старта | нет проверки status | `isGameActive()` + блокировка обработчиков |
| «Пригласить» активна при полном составе | нет disabled | disabled при players>=max |
| Ушедший игрок висит в составе | seats не чистятся | перезапись players=active при автостарте |
| 404 mp3 в консоли | SND.preload/play без файлов | синтез-приоритет, preload не вызывать |
| Presence висит после закрытия вкладки | нет beforeunload | removePresence() в beforeunload |

### 8.3 Desktop-оболочка и сборка (Windows)

| Симптом | Причина | Лечение |
|---|---|---|
| Чёрное окно + бледный «404: /index.html» | packsRoot указывает на пустую/битую папку | самовосстановление packsRoot + страница-ошибка (v0.5; с v0.11 — статические error.html/404.html) |
| Окно не создаётся, 2–3 процесса «Игровой центр» висят в диспетчере | нарушен API-контракт updater.js (имя класса/экспорт/сигнатуры), main.js падает в whenReady до окна; автообновление не стартует | контракт v1.3 неприкосновенен (6.2); сломанную сборку лечим ручной установкой нового exe (кейс v1.4.1→v1.4.2) |
| **Оболочки не получают новый platform.js/sw.js/иконки при живом обновлении игр** | **hub-файлы изменены без bump HUB_VER: селективный sync сравнивает версии, не хэши** | **🔒 правило HUB_VER (6.3): bump `HUB_VER` в том же коммите; кейс 2026-11-03 v3.37→v3.38** |
| **Кнопка игры в хабе есть, на ПК клик = «Файл не найден», чипа/NEW нет нигде; Android и мессенджеры работают** | **id новой игры не добавлен в массив GAMES генератора: манифест без секции игры → паки не скачивают (у desktop-протокола нет сетевого fallback), хаб без метаданных; Android живёт за счёт fallback перехватчика, web/мессенджеры — напрямую с Pages** | **🔒 правило GAMES (6.3): добавить id в GAMES (gen-versions v1.4), реген ПОСЛЕ коммита игры, коммит versions.json+games-added.json, push, синхронизация оболочек; кейс tictactoe 2026-11-04** |
| «Оболочка актуальна», хотя релиз свежий | `latest.yml.version` равен установленной: version в package.json не bump-нули перед сборкой | bump → dist → `type release\latest.yml | findstr version` → сверить → релиз (6.4) |
| Кнопка шеринга в игре молчит (TypeError: shareGame is not a function) в оболочках | в паках старый platform.js (см. правило HUB_VER) | bump HUB_VER + regen + push + синхронизация оболочек |
| Шеринг с ПК-web уходит «голой ссылкой» без текста | navigator.share → OS share-sheet: таргет (Telegram) берёт только url | platform.js v3.1: web + pointer:fine → полное сообщение в буфер + тост |
| Иконка exe/ярлыка «вернулась к атому Electron» | `signAndEditExecutable: false` отключает rcedit (встраивание иконки) | флаг убрать; winCodeSign чинить распаковкой кэша; кэш иконок Windows: `ie4uinit.exe -show` / перезапуск explorer (6.6) |
| Сборка: «Cannot create symbolic link … darwin» | winCodeSign-7z с симлинками macOS; нет прав разработчика | распаковать 7z из кэша в `…\winCodeSign\winCodeSign-2.6.0` (`7za.exe x -bd … -y`), `rmdir /s /q …\darwin`; ИЛИ включить Режим разработчика Windows |
| `npx …` пишет «Ok to proceed? (y)» и следующая команда ломается (`npm error canceled`) | ввод ушёл в prompt npx, а не в shell | `npx --yes …` либо ответить `y`+Enter и только потом следующая команда |
| Сборка: «cannot find specified resource assets/icon.ico» | electron-icon-builder пишет в `assets/icons/…` | пути `assets/icons/win/icon.ico` в yml |
| Иконка окна ≠ логотип хаба | `assets/icon.png` не существует → дефолт Electron | pickAppIcon() с цепочкой фолбэков |
| `sha256 mismatch: sw.js` при обновлении контента | хэши рабочей папки vs байты git-блоба (CRLF) / устаревший манифест | gen-versions v1.2 из `git show HEAD:path`; реген ПОСЛЕ коммита контента |
| Прогресс обновления «исчезает» | троттлинг последнего тика + тост стирался перезагрузкой | финальный тост N/N + повтор после did-finish-load + системное уведомление при ошибке |
| Качает все файлы всегда | sync без диффа | селективная синхронизация по версиям (updater v1.1) |
| Чипы версий/NEW пропадали офлайн на ПК | versions.json не лежал в паках (до v1.4) / не писался при пустом diff (до v1.4.1) | updater v1.4.2: манифест в current при любом sync (6.2) |
| Ctrl+C/V не работают без меню «Правка» | роли меню удалены | перехват Ctrl+Z/X/C/V/A/Y в before-input-event |
| Установщик 143 МБ | пол Electron x64 | compression maximum + electronLanguages ru/en; игры вне установщика; roadmap Tauri/PWA |
| Автообновление не видит релиз | в релизе нет `latest.yml` | прикреплять latest.yml в каждый релиз |
| Win 8.1: «Невозможно запустить это приложение на вашем ПК» | Electron 23+ манифест exe требует Win10 | Electron 22 (оболочка v0.3.0+); один установщик на Win 7 SP1–11 |
| Win10: хаб открывается как текст (исходник) | `registerBufferProtocol` на Electron 22 для standard-схемы отдаёт `text/plain` | `registerFileProtocol` (v0.11): MIME по расширению; страницы-ошибки файлами |
| Updater: `fetch is not defined` | Node 16 (Electron 22) без глобального fetch | https-хелпер `httpGetBuffer` в updater.js v1.3 |
| На новом ПК нет `gc-desktop` | проект оболочки никогда не коммитился в репо | копия с накопителя или воссоздание файлов; генератор манифеста = `gc-desktop\tools\gen-versions.js` |

### 8.4 Android-оболочка и сборка APK

| Симптом | Причина | Лечение |
|---|---|---|
| Приложение не стартует без сети: «Unable to resolve host …» | bootstrap всегда начинался с fetch манифеста; офлайн → ошибка поверх валидных паков | ContentUpdater v1.3: манифест недоступен + packsValid() → «Офлайн: игры из памяти устройства» и запуск из паков (7.2) |
| **«О приложении» показывает устаревшее число игр / версию** | **числа зашиты в текст SettingsActivity** | **v1.1: состав и количество игр — `installedGamesCount()` из installed.json (ContentUpdater v1.4), версия контента — installed hub; никаких хардкодов (7.9)** |
| `Task 'assembleRelease' not found in root project` | скрипт модуля назван `build.gradle.groovy`/`.kts` не по имени, либо settings не включает `:app` | файл должен быть `app/build.gradle` (Groovy) или `app/build.gradle.kts`; в settings `include(":app")` |
| `Directory … does not contain a Gradle build` | отсутствуют settings/build в корне | воссоздать `settings.gradle.kts` + корневой `build.gradle.kts` (явная версия AGP `apply false`) |
| `License for package … not accepted` | свежий SDK без принятых лицензий | `sdkmanager --licenses` (пайп `echo y|`) + `platforms;android-34` `build-tools;35.0.0` |
| `sdkmanager` не найден; «Using Android SDK: <папка студии>» | `sdk.dir` указывает на папку программы студии (bin/jbr/plugins), а не на SDK | найти реальный SDK (`platforms/`, `build-tools/`) или поставить cmdline-tools в отдельную папку; исправить `local.properties` |
| `Theme.Material3… not found` | шаблонные themes.xml/values-night тянут Material без зависимости | удалить `values-night`, тема = `android:Theme.Material.NoActionBar` |
| `layout_constraint… not found` | шаблонный `activity_main.xml` с ConstraintLayout при пустых dependencies | удалить `res/layout` (UI создаётся программно) |
| `cannot find symbol BuildConfig` | AGP 8+ не генерирует BuildConfig по умолчанию | `buildFeatures { buildConfig = true }` в app/build.gradle |
| AAPT: `drawable/ic_launcher_background not found` | leftover `mipmap-anydpi*` с adaptive-xml после ручной генерации png | удалить `mipmap-anydpi` и `mipmap-anydpi-v26` |
| PowerShell: «Отсутствует имя переменной после foreach» | внешний PowerShell раскрыл `$переменные` строки `powershell -Command "…"` до передачи | писать скрипт в `.ps1` и запускать `powershell -ExecutionPolicy Bypass -File …` |
| `Java compiler version 25 has deprecated support for source/target 8` | новый JDK студии | `compileOptions` VERSION_17 (или подавить warning) |
| Иконка не меняется после установки новой версии | кэш иконок лаунчера | удалить старую версию / перезагрузить устройство |
| Старый WebView на устройствах без Google Play | системный WebView не обновляется | детект версии WebView → экран «обновите WebView / откройте в браузере» (roadmap) |
| Автообновление предлагает СТАРЫЙ APK | `android-update.json` запушен ДО Publish релиза | json коммитить строго после Publish (порядок 7.8) |
| Установщик не стартует, ошибок нет | нет `REQUEST_INSTALL_PACKAGES` / `canRequestPackageInstalls()==false` | диалог → `ACTION_MANAGE_UNKNOWN_APP_SOURCES` + `pendingInstall` + повтор в onResume (7.8) |
| `FileUriExposedException` при install-intent | `Uri.fromFile` запрещён с API 24 | свой `ApkProvider` + `content://` URI (7.8) |
| Шестерёнка ⚙️ не появляется в хабе | hub < v3.34 или в оболочке нет `AppBridge.openSettings` | обновить контент (versions.json) И оболочку ≥0.6.0 |
| Имя из настроек не видно в уже открытой комнате | игры читают `Platform.user()` при инициализации | пересоздать/перезайти в комнату после сохранения имени |

### 8.5 Игры (геймплейные и игровые грабли 2026-10/11)

| Симптом | Причина | Лечение |
|---|---|---|
| Дурак: «Ход компьютера» и вечное зависание, логов нет | v3.14: пауза 2 c применялась к первой атаке бота + штампы сбрасывались каждым тиком repairTick | v3.15: пауза только для подкидывания (бот ≠ атакующий); штампы по эпизодам раунда |
| Дурак: галка «переводной» снята, а перевод работает | правило фиксировалось при раздаче партии | v3.12: переключатель действует сразу на текущую партию; онлайн меняет только хост (`state/transferEnabled`) |
| Дурак: боты подкидывают всё сразу, игроку нет места | нет дозирования | v3.14: `BOT_ADD_GAP=2000` — 2 c от первой возможности и не чаще 1 карты в 2 c на бота |
| Нарды: статус «Нажми Бросить кости», кнопки нет | `isGameActive()` возвращала false вне онлайна | v2.5: офлайн-ветка `G && !G.result` |
| Нарды: после частичного дубля суммы не работают на других фишках | allDests генерировал комбо только для длин 2 и 4 | v2.7: комбо для любого числа оставшихся костей (2..N) на любую фишку |
| Морской бой: «В бой!» disabled пока не сбросишь/расставишь | newGame: флот расставлен, но `qi=0` | v4.29: `qi=queue.length`; онлайн `resetPlacing()` авто-расставляет флот |
| Морской бой: непонятно, что нажимать дальше | нет подсказок | v4.29: pulse-подсветка кнопок (Пригласить → Авто → В бой → Реванш/Сыграть ещё) |
| Морской бой: панель инструментов мешает в бою | ручное сворачивание | v4.30: авто-сворачивание при старте боя, авто-разворачивание при реванше; ручное переключение всегда доступно |
| Пятнашки: stack overflow при перемешивании | защитная проверка решаемости с перевёрнутой формулой уходила в рекурсию | v1.0-fix: проверка убрана — walk-генерация из собранного состояния гарантирует решаемость по построению |
| Пятнашки: шапка наезжала на кнопки на узких экранах | один flex-ряд «кнопка+title+кнопки» | v1.1: два ряда — логотип+название сверху, кнопки ниже (flex-wrap) |
| Хаб: популярные игры внизу списка | статический порядок | v3.28: умная сортировка по частоте запусков (score с полураспадом 30 дней, `?sort=reset`) |
| Крестики: «полоска» вместо крестика | SVG-атрибуты БЕЗ кавычек: HTML-парсер в SVG-контексте терял вторую диагональ | все атрибуты SVG в кавычках (v1.3) |
| Крестики: любой исход = «Поражение», линия не подсвечена | результат писали ключами `{winner,line}`, читали `{w,l}` (ключи chkL) → `undefined` | единые ключи `{w,l,at}` во всех 4 точках записи (v1.4) |
| Крестики: ReferenceError `turn` / `sM` | минификация-реноймы: черновая переменная `turn` в aiMove; функция объявлена `sMv`, вызывалась `sM` | черновик удалён; определение `sM` (v1.1/v1.2) |
| Крестики: символы чёрно-белые | потеряно `color:var(--x)/var(--o)` — `currentColor` стал текстовым | явные `style="stroke:var(--x)"` + тень `var(--x2)`/`var(--o2)` + блик (v1.3) |
| Настройки: надписи в select невидимы | `<option>` не наследует color: системный чёрный на тёмном фоне | `.selrow option{background:var(--bg2);color:var(--text)}` (v1.3) |
| Модалка: кнопка «← В меню» поверх заголовка | `position:absolute` над длинным названием | отдельная строка `.mhdr` над заголовком (v1.4) |
| Крестики: картинки не грузятся (ERR_FILE_NOT_FOUND), «имена правильные» | (а) кириллические `х.png`/`о.png` вместо латинских — визуально идентичны; (б) двойное расширение `o.png.png` при скрытых расширениях проводника; (в) тест автономной копией HTML вне папки игры — относительный `img/` указывает в пустоту | ASCII-имена (правило раздела 4); `dir /b` за реальными именами; галка «Расширения имён файлов»; тестировать только настоящий `index.html`; onerror-лог пробы `[TT] img NOT FOUND: <url>` (v1.5) |
| Крестики: просмотр партии сбрасывал подсветку и полосу | `renFv()` перерисовывал клетки без win-классов | просмотр = финал без отмотки: перерисовка убрана, ◀/▶ удалены (v1.5) |

---

## 9. Чек-листы

### 9.1 Новая игра (офлайн)
1. Папка игры + кнопка в хабе (с `data-game` для умной сортировки) + алиасы в `GAME_MAP`;
   **bump `HUB_VER`** (правка hub-файла, правило 6.3).
2. **Добавить id игры в массив `GAMES` в `gc-desktop\tools\gen-versions.js`**
   (🔒 правило GAMES, 6.3: без этого манифест пуст по игре → паки не скачают, хаб без чипа/NEW).
3. `Platform.init({bg, back, game:'<key>'})`; звук/вибро только через `Platform.haptic/share`;
   AudioContext разблокируется по user gesture (`unlockAudio()`).
4. Шеринг по паттерну 4-го раздела: на главном экране «📤 Отправить ссылку на игру»
   (`Platform.shareGame`), «📤 Отправить результат» в финальном оверлее; GA `share_type`.
5. Pulse-подсказки и (для онлайн) авто-шторка по паттерну раздела 4.
6. GA через `trackEvent`; платформа подставляется автоматически.
7. BackHandler: оверлеи (правила→настройки→статистика→финал) → hub.
8. Favicon-линки на `../icon-32.png`; overscroll-behavior:none; описания витрин без чисел.
9. Head без синхронных внешних SDK-тегов (telegram/gstatic) — только ленивая загрузка.
10. Картинки-ассеты (если есть): `<game>/img/*.png` 512×512 прозрачные, **имена ASCII**,
    проба с SVG-фолбэком (раздел 4).
11. Первая генерация манифеста проставит `addedAt` = сегодня → NEW 7 дней (6.3).
12. Bump `VER` игры при каждой правке её файлов (игры сравниваются по своей версии; HUB_VER не нужен).

### 9.2 Новая онлайн-игра (подключение к единой схеме)
1. Структура комнаты по 5.1. 2. Heartbeat 5/15 с, запуск +500 мс после записи места.
3. `removePresence()` в leaveRoom/beforeunload. 4. Реванш у всех; requestRematch только пишет флаг.
5. Триггер автостарта по 5.4 (условие status='finished'!). 6. Round-триггер. 7. Лобби в шторке + авто-шторка.
8. `isGameActive()` + блокировка ходов (учитывать офлайн-ветку! грабля Нард v2.5). 9. Умные кнопки шторки.
10. fieldView (для простых игр допустим финал без отмотки, 5.8). 11. Вход в finished.
12. Rules Firebase под свою схему мест. 13. Префикс логов `[XX]`.
14. Если движок не ставит status='finished' сам — авто-перевод (грабля Нард). 15. Watchdog автоходов.
16. Инвайты: `Platform.share(roomUrl, text, {brand:true})`.

### 9.3 Релиз desktop-оболочки
1. Bump `version` в `package.json` (**без этого автообновление считает релиз «актуальным»!**).
2. `npm run dist`; проверить `type release\latest.yml | findstr version` = новой версии.
3. Проверить иконку exe в проводнике ДО загрузки ассета (rcedit не сломан, 6.6).
4. Release: tag `vN.N.N`, ассеты **три**: `IgrovojCentr-Setup.exe` + `latest.yml` + `IgrovojCentr.apk`.
5. Publish → hub-кнопки подхватят через `latest/download` автоматически.
6. Проверка автообновления с предыдущей установленной версии (Win10) + установка на Win 8.1.
7. Сломанную сборку (если main.js падал) автообновление не лечит — таким машинам ручная установка.

### 9.4 Деплой контента
1. Коммит контента. **Если коммит трогает `js/platform.js`, `sw.js`, `js/snd.js`, `icon-*.png` —
   в том же коммите bump `HUB_VER`** (🔒 правило 6.3).
   **Если коммит добавляет новую игру — её id уже должен быть в GAMES генератора** (🔒 правило 6.3).
2. `node tools/gen-versions.js` (v1.4, из git-блобов, +`games-added.json`) →
3. коммит `versions.json` (+`games-added.json` при первом добавлении игры) → 4. push одним пакетом.
5. В оболочках: авто-синхронизация при запуске (desktop: «Проверить обновления игр»;
   android: bootstrap при старте, офлайн — из памяти с v1.3).
6. Для web/TG-desktop после замены sw.js: переоткрытие мини-приложения (SW v9 сносит старые кэши).

### 9.5 Новая платформа (бот) / переезд
1. Вебхук на Vercel; ответ ДО/ПОСЛЕ обработки по freeze-модели. 2. Реестр: подписка + секрет + confirmation.
3. Клавиатура: постоянная кнопка входа; лимиты изучить ДО разработки. 4. Витрина без чисел игр.
5. `platform.js`: ветки detect/ensureSdk/init/haptic/share/close + мост. **Помнить: правка platform.js = bump HUB_VER (6.3).**
6. Rename репо → `git remote set-url`; Pages пересобирается; Vercel едет по ID репо; env → Redeploy.

### 9.6 Релиз Android-оболочки
1. Bump `versionName`/`versionCode` в `app/build.gradle`.
2. `set JAVA_HOME=<studio>\jbr` → `gradlew.bat assembleRelease` → rename в `IgrovojCentr.apk`.
3. Release GitHub: **три ассета** (apk + exe + latest.yml), tag общий `v0.N.N`.
4. **ПОСЛЕ Publish:** коммит+пуш `android-update.json` с новой `versionName`/`versionCode` (7.8);
   сверить, что json.versionName == versionName внутри APK.
5. Тест: устройство с предыдущей версией → авто-диалог обновления (режим auto) или
   ⚙️ → «Проверить обновление оболочки» (режим manual) → загрузка → гейт неизвестных источников →
   установщик показывает НОВУЮ версию → установка поверх без потери паков и имени.
6. Свежая установка: bootstrap-загрузка паков; **авиарежим → старт из памяти (v1.3)**;
   диплинк комнаты, шеринг, иконка (кэш лаунчера!), ⚙️ и все секции настроек (7.9, без хардкодов чисел).

---

## 10. Справочник конфигурации

| Ключ | Значение |
|---|---|
| Hub URL | `https://ip19760118-code.github.io/games/` |
| Диплинк игры | `https://ip19760118-code.github.io/games/?game=<key>` (handleDeepLink хаба; key из GAME_MAP) |
| MAX webhook | Vercel-проект max-bot, path `/max` |
| VK webhook | Vercel-проект vk-bot, path `/vk` |
| VK Mini App | кабинет `vk.com/apps?act=manage`; диплинк `/app<id>` |
| Firebase | проект RTDB (имя не менять); конфиг — в коде игр |
| Env MAX / VK | `MAX_TOKEN`, `MAX_SECRET` / `VK_TOKEN`, `VK_SECRET`, `VK_CONFIRM` |
| GA | measurement id в `index.html` хаба; game_share с share_type link/result |
| Бренд-строка шеринга | «🎮 Игровой центр — классика и новинки, онлайн и офлайн» (без чисел!) |
| EXE (стабильная ссылка) | `…/releases/latest/download/IgrovojCentr-Setup.exe` |
| APK (стабильная ссылка) | `…/releases/latest/download/IgrovojCentr.apk` |
| Манифест контента | `…/games/versions.json` (+ копия в паках оболочек, 6.2/7.2) |
| Манифест автообновления APK | `…/games/android-update.json` (коммит строго ПОСЛЕ Publish релиза) |
| Реестр дат добавления игр | `…/games/games-added.json` (сид 2026-10-01; NEW = 7 суток) |
| GAMES генератора | 18 id в `gc-desktop\tools\gen-versions.js` (v1.4); новая игра — добавить ДО регена |
| Паки desktop | `%APPDATA%\igrovoj-centr\packs\current` (+`versions.json`) |
| Паки android | `context.filesDir/packs/current` (+`versions.json`) |
| APK android (загрузка обновления) | `context.cacheDir/update/IgrovojCentr.apk` |
| Pref'ы android | SharedPreferences `igrovoj`: `name`, `updateMode` (auto/manual), `apkCheckAt` |
| Ключи Пятнашек | localStorage `pyatnashki_set` {vol,diff,skin}, `pyatnashki_stats` |
| Ключи Крестиков | localStorage `tt_set` {aiLvl,first,vol,skin}, `tt_stats`; картинки `tictactoe/img/{x,o}.png` (512×512, ASCII!) |
| Троттлинг автопроверки APK | 6 часов (ручной вызов игнорирует) |
| Desktop: runtime | Electron 22.3.27 (Win 7 SP1–11), electron-builder 24, NSIS per-user |
| Desktop: контракт updater | 6.2 — НЕ НАРУШАТЬ (имя класса/экспорт/сигнатуры) |
| Android: runtime | system WebView; minSdk 26 (Android 8.0), compile/targetSdk 34, AGP 8.9.1+, Gradle 9.6 |
| Android: подписи | `gc-android\keystore\release.keystore` (alias igrovoj) + резервная копия |
| Android: JDK сборки | JBR студии (`JAVA_HOME=<studio>\jbr`); keytool там же |
| HEARTBEAT_INTERVAL / TTL | 5000 / 15000 мс |
| Watchdog комнат | тик 5 с, порог неактивности 30 с |
| MAX_NAV_MODE | `'external'` (продакшен) |
| Бутстрап контента desktop | таймаут 60 с до окна |
| Бутстрап контента android | sync при каждом запуске; офлайн + валидные паки → старт из памяти (v1.3) |
| BOT_ADD_GAP (Дурак) | 2000 мс на бота-подкидывателя |
| Hub smart-sort | полураспад 30 дней, ключ `hub_sort_stats`, сброс `?sort=reset` |

> 🔒 Значения секретов — только Vercel Environment Variables и локальные `.env`.

---

## 11. История ключевых решений

| Версия | Дата | Изменения |
|---|---|---|
| 1.0 | — | Первая спецификация: TG/MAX/VK/web, хаб, боты, грабли платформ |
| 2.0 | 2026-10-27 | Единая архитектура онлайн-комнат (реванш, heartbeat, лобби в шторке, автостарт, просмотр партии); rules под все схемы; префиксы логов; чек-листы; секреты вынесены |
| 2.1 | 2026-10-27 | Ретест MAX container: спиннер-зависание, пауза JS → watchdog мёртв; `MAX_NAV_MODE='external'`; таблица версий; грабли chess/nardy/seabattle/durak; 404 mp3/favicon |
| 2.2 | 2026-10-28 | Официальный ответ поддержки MAX: нет navigate; openLink только внешний; зависание = ожидание LoadingCompleted; рекомендована SPA; SetCanGoBack/BackButtonPressed/SetTitle; док dev.max.ru |
| 2.3 | 2026-11-01 | Desktop-оболочка финально: Electron 22 (Win 7 SP1–11), `registerFileProtocol` вместо buffer, https-апдейтер без fetch, иконки `assets/icons/`, релизы exe+latest.yml, размер 143 МБ и roadmap Tauri/PWA; игры: Дурак v3.9–3.15, Нарды v2.5–2.7, Морской бой v4.29–4.30; hub v3.28 (умная сортировка); platform.js v2.8 |
| 2.4 | 2026-11-02 | Android-оболочка v0.1.0 полным циклом (раздел 7): WebView + intercept под Pages-origin, ContentUpdater, AppBridge android, диплинки, иконки mipmap, keystore-подпись, gradle-грабли; hub v3.29–3.33 (двухэтапная модалка, буфер обмена); platform.js v2.9; правило трёх ассетов; релиз v0.4.0 |
| 2.5 | 2026-11-03 | Android v0.5.0–0.6.0: автообновление APK (android-update.json, ApkProvider, гейт REQUEST_INSTALL_PACKAGES, троттлинг 6 ч) и нативный экран настроек; hub v3.34 (⚙️); bridge openSettings/getUpdateMode/setUpdateMode/checkAppUpdate; релиз v0.6.0 |
| 2.6 | 2026-11-03 | Hub v3.35–3.36 (чипы версий + NEW 7 суток, двойной fetch манифеста); versions.json в паках обеих оболочек; android офлайн-старт v1.3; грабля API-контракта updater.js (v1.4.1→v1.4.2); грабли релизов/иконок (latest.yml, signAndEditExecutable, winCodeSign, npx); процедура замены логотипа; hub v3.36, desktop v0.3.3, android v0.7.1; релизы v0.7.1/v0.7.2 |
| 2.7 | 2026-11-03 | **🔒 Правило HUB_VER** (6.3): правка hub-файлов без bump версии не доезжает до оболочек — кейс platform.js v3.0/v3.1 + sw.js v9 при HUB_VER 3.37; **вирусный шеринг** platform.js v3.0–3.1 (shareGame/gameDeepLink/бренд-строка без чисел; desktop-web → буфер вместо OS share-sheet); **sw.js v9** (purge старых кэшей, no-store мимо кэша); **Пятнашки v1.0–1.3** (walk-генерация решаемых раскладов, 3D-костяшки, темы, настройки, статистика, шапка в два ряда, паттерн «ссылка до победы / результат после», схема-цель в правилах); Android v0.8.0: динамическое «О приложении» (installedGamesCount, ContentUpdater v1.4, SettingsActivity v1.1); hub v3.38; версии: platform.js v3.1, sw v9, Пятнашки v1.3 |
| 2.8 | 2026-11-04 | **Крестики-нолики v1.0–1.5** полным циклом: 7-я онлайн-игра (players w/b = ❌/⭕, watchdog авто-передачи), ИИ-минимакс 3 уровней + hot-seat, 5 тем, картинки-символы 512×512 с SVG-фолбэком и ASCII-правилом имён, полоса-перечёркивание линии, финал без отмотки с сохранением подсветки; **её грабли** (SVG без кавычек, ключи результата {winner,line} vs {w,l}, реноймы turn/sM, ч/б символы, невидимые option, кнопка поверх заголовка, кириллица/двойные расширения в именах файлов, тест копией вне папки); **Сапёр v1.7** и **Нарды v2.8** мигрированы на вирусный шеринг + pulse + авто-шторку (паттерн закрепён в разделе 4); **🔒 правило GAMES** (6.3): кейс tictactoe — игра в хабе и на Pages, но не в манифесте → ПК «Файл не найден», без чипа/NEW; gen-versions v1.4; hub v3.39 (кнопка+алиасы tictactoe/xo/крестики, prefetch); 18 игр |

---

**Конец документа.** Обновлять при каждой новой грабле — цена ошибки уже оплачена.