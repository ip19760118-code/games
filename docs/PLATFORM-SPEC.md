# PLATFORM-SPEC — МК «Игровой центр»: кроссплатформенная спецификация и грабли

**Версия документа: 2.3** | Дата: 2026-10-31 | Статус: TG ✅ / MAX ✅ / VK ✅ / web ✅ / PC(Electron) ✅
Репозиторий: `github.com/ip19760118-code/games`
Pages: `https://ip19760118-code.github.io/games/`

> **⚠️ Секреты (API-ключи Firebase, токены ботов, webhook-секреты, строки подтверждения)
> в этом документе НЕ хранятся. Только env-переменные Vercel и локальные `.env` (в `.gitignore`).**

---

## 0. Архитектура на одной странице

| Компонент | Где живёт | Комментарий |
|---|---|---|
| Хаб (витрина 16 игр + кнопка «Скачать приложение») | GitHub Pages, корень репо `games/` | `index.html` **v3.27** |
| Игры | папки `chess/ … trend-catch/`, `tetris/` | мультиплатформенные через `js/platform.js` |
| Онлайн-комнаты | Firebase RTDB (имя проекта не менять!) | единая схема: раздел 5 |
| Desktop-оболочка (Windows) | локальный проект `gc-desktop/` (**НЕ в репо**) | Electron, релизы через GitHub Releases: раздел 6 |
| MAX-бот | Vercel, Root Dir `max-bot`, вебхук `/max` | Callback: platform-api2.max.ru |
| VK-бот | Vercel, Root Dir `vk-bot`, вебхук `/vk` | Callback API api.vk.com |
| TG-бот | меню-кнопка «Играть» → hub `?plat=tg` | Web App |
| Кэш web | `sw.js` (service worker) | навигации network-first, статика cache-first |
| Аналитика | GA4 | hub_open / hub_game_click / hub_download_* с меткой platform |

Единый слой платформ: `js/platform.js` (**v2.8**) → глобальный `Platform`
(init, haptic, share, toast, onBack/fireBack, close, colors, user, name,
maxClientReal, isMaxExternal, maxNavMode, goToHub, hubBase, canonicalUrl).

### 0.1 Текущие версии компонентов

| Компонент | Версия |
|---|---|
| hub `index.html` | v3.27 |
| `js/platform.js` | v2.8 |
| vk-bot `server.js` | v1.13 |
| max-bot `server.js` | v2.0 |
| Морской бой | v4.28 |
| Шахматы | v2.8 |
| Дурак | v3.8 |
| Домино | v2.3 |
| Шашки | v1.7 |
| Нарды | v2.4 |
| Тетрис | v1.2 |
| Сапёр | v1.6 |
| Desktop-оболочка (Electron) | v0.2.2 |

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

## 4. Общий слой (hub + platform.js + sw.js + релизы)

- Детект платформы: сначала `?plat=` из URL, затем глобалки (Telegram → vkBridge → WebApp+version → AppBridge='pc').
  SDK грузим лениво (`ensureSdk`), хардкод тегов в hub запрещён.
- `openGame()`: TG/VK/web/pc — `location.href`; MAX real client — `openLink` во внешнее окно
  (тост «Открываю игру…» обязателен); MAX external browser — обычная навигация.
- Service worker `sw.js`: навигации network-first с кэш-фолбэком; статика cache-first;
  имя кэша `igrovoj-centr-vN` менять при принудительном сбросе. Регистрация из `platform.js`
  по маске `^(.*\/games\/)` только на github.io. **В desktop-оболочке SW не регистрируется** (кэшем управляет апдейтер).
- Prefetch топовых игр (chess/seabattle/durak/tetris) через `<link rel=prefetch>`; пропуск при `saveData`.
- Firebase-комнаты работают ТОЛЬКО в first-party контексте: никаких iframe внутри мессенджер-вью.
- `window.open` может блокироваться popup-блокером → всегда fallback `location.href`.
- **Favicon:** во всех играх и хабе `<link rel="icon" … icon-32.png>` (ранее `data:,`); убирает 404 `/favicon.ico`.
- **Звук:** mp3 в `assets/snd` отсутствуют → эффекты через синтез в приоритете; `SND.preload()` не вызывать (404).
- **Кнопка «📥 Скачать приложение» в хабе (v3.22+):** модалка с вариантами Windows (прямая загрузка exe),
  Android (disabled, «скоро»), «Отправить ссылку другу», «Страница релиза».
  Прямая ссылка ассета стабильна: `…/releases/latest/download/IgrovojCentr-Setup.exe`
  (artifactName без версии в electron-builder.yaml).
- Описания витрин без чисел игр (лимиты платформ).

---

## 5. Единая архитектура онлайн-комнат

Применяется во всех 6 онлайн-играх: Морской бой, Шахматы, Дурак, Домино, Шашки, Нарды.

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
- «📤 Пригласить» disabled при полном составе; вне лобби скрывается.

### 5.6 Лобби в выпадающей шторке

Лобби — НЕ отдельная модалка: `lobbyBox` внутри `rb-extra` (room-bar).
Шторка автораскрывается при `status='waiting'`, скрывается при старте.
Надпись для 2-местных игр: «Ожидание игрока…» (ед. ч.).

### 5.7 Умные кнопки шторки по статусу

| Status | Кнопки |
|---|---|
| waiting | 📤 Пригласить (disabled при полном), 🔢 Код, ▶ Начать (хост, disabled при <2), 🚪 Выйти |
| playing | 🔢 Код,  Ничья, 🏳 Сдаться, 🚪 Выйти |
| finished | 🔢 Код,  Реванш,  Выйти |

### 5.8 Просмотр партии после окончания

- Кнопка «👁 Посмотреть партию/поле» в endOverlay (онлайн и офлайн).
- Плавающая панель `fieldViewBar`; `fieldViewMode=true` блокирует все ходы;
  закрытие кнопкой/BackHandler возвращает endOverlay.

### 5.9 Схемы состава и правила Firebase

| Игра | Ключи мест |
|---|---|
| Морской бой | `host` / `guest` (объекты с `id`) |
| Шахматы, Шашки, Нарды | `players/w`, `players/b` (объекты с `uid`) |
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

Ключевые строки: `startHeartbeat …`, `presence write failed …`, `propose rematch …`,
`rematch check: rm=… active=… allAgreed=…`, `all agreed -> start new game immediately`,
`result detected, setting status=finished`, `round change N -> M`.

### 5.11 Watchdog автоходов

Хост каждые 5 c: если актёр без fresh presence и `turnAt` старше 30 с → автоход по правилам игры
(взятие/пропуск/бито/ролл) с `lastMove.action='автоход (нет связи)'`.

---

## 6. Desktop-оболочка (Windows, Electron) — v0.2.2

### 6.1 Состав и расположение

- Проект **локальный**: `C:\Telegram\gc-desktop\` (в репо НЕ коммитится; в `.gitignore` были бы
  `node_modules/`, `release/` — репо не трогает).
- `src/main/`: `main.js` (окно, протокол, меню, IPC), `config.js` (JSON в userData),
  `updater.js` (контент), `shell-updater.js` (оболочка, electron-updater).
- `src/preload/preload.js` → `window.AppBridge` (platform='pc').
- `src/renderer/settings.html` — экран настроек (`app://shell/settings.html`).
- `tools/gen-versions.js` — генератор манифеста `versions.json` **в корень репо**.
- `assets/icons/` — вывод electron-icon-builder (`win/icon.ico`, `png/*`).
- `electron-builder.yaml`, `package.json` (version = версия оболочки).

### 6.2 Контент: паки и протокол

- Привилегированный scheme `app://games` (`standard, secure, corsEnabled`) → стабильный origin →
  localStorage (uid Firebase, статистика) переживает обновления.
- Паки: `%APPDATA%\igrovoj-centr\packs\current\` (зеркало структуры репо);
  `staging/` → атомарный swap → `old/` удаляется; sha256 каждого файла сверяется с манифестом.
- Источники: `local` (dev: паки = рабочая копия репо) | `pages` (боевой: загрузка с GitHub Pages).
  В установленном exe дефолт `pages` (если локального репо нет).
- Бутстрап: `pages` + (`auto` ИЛИ нет валидного контента) → синхронизация ДО окна (таймаут 60 с).
- Самовосстановление `packsRoot` при старте: local-репо → packs/current → pages.
- Если index.html контента нет — русская страница-ошибка с кнопками «Настройки / Повторить /
  Открыть в браузере» вместо чёрного экрана.
- **Селективная синхронизация (v1.1):** скачиваются только паки, чьи версии отличаются от
  `installed.json`; если менять нечего — тост «Версии игр актуальны», загрузка не стартует.
- Прогресс: тосты `Обновление: N/M` (последний тик не троттлится), финал
  «✅ Приложения обновлены: N/N файлов» до перезагрузки окна и повторно после (`did-finish-load`).
  Ошибка = тост + системное уведомление (не пропадает бесследно).

### 6.3 Манифест versions.json и грабля хэшей

- Лежит в корне репо, публикуется на Pages; структура: `hub{version,files[]}`, `games{id:{version,online,files[]}}`,
  каждый файл `{path, sha256, size}`; `baseUrl` = Pages.
- **Грабля (2026-10-31, `sha256 mismatch: sw.js`):** генератор хэшировал байты рабочей папки,
  а Pages отдаёт байты git-блоба (CRLF-нормализация git на Windows / устаревший манифест после
  коммита без регенерации). **Лечение (gen-versions v1.2): байты берутся из `git show HEAD:path`**;
  незакоммиченные файлы → фолбэк на рабочую папку + предупреждение в консоли.
- **Правило деплоя:** коммит контента → `node tools/gen-versions.js` → коммит `versions.json` → push одним пакетом.

### 6.4 Обновление оболочки (electron-updater)

- Фид: GitHub Releases репо `games` (`publish: provider github` в yml).
- В каждый релиз **обязательно** прикреплять `latest.yml` из `release\` — без него апдейтер слеп.
- Режимы из конфига контента: `auto` — тихая закачка + диалог «Перезапустить сейчас?»;
  `manual` — тост «Доступна новая версия оболочки» + «Файл → Обновить приложение…».
- Тихая проверка через 6 c после старта (только `app.isPackaged`); в dev — заглушка с пояснением.
- Обновления дельтовые (differential downloader) — обычно единицы МБ.
- v0.1.0 обновиться сама не может (кода апдейтера не было) — только ручная переустановка.

### 6.5 Релизы оболочки

- Тег `vN.N.N`, title «Игровой центр N.N.N (Windows)», ассеты: `IgrovojCentr-Setup.exe` + `latest.yml`.
- `artifactName: IgrovojCentr-Setup.exe` (без версии) → стабильная ссылка хаба
  `…/releases/latest/download/IgrovojCentr-Setup.exe`; шеринг = `…/releases/latest`.
- NSIS per-user (админ не нужен), oneClick=false, ярлыки desktop+start.
- Подписи нет → SmartScreen предупреждает («Подробнее → Выполнить всё равно»); это ожидаемо до сертификата/Store.

### 6.6 Иконки

- Источник: `icon-512.png` в корне репо (он же og:image и логотип хаба `.hub-logo`).
- `npx electron-icon-builder --input=…\icon-512.png --output=assets` → `assets/icons/win/icon.ico`,
  `assets/icons/png/*.png` (**именно `icons/`, не `icon/` — грабля путей v0.2.2**).
- yml: `win.icon` и `nsis.installerIcon/uninstallerIcon` = `assets/icons/win/icon.ico`.
- `pickAppIcon()` в main.js: цепочка фолбэков `icons/png/512x512.png → icons/win/icon.ico → … → icon-512.png репо`
  (иначе в dev окно получает дефолтную иконку Electron, отличную от логотипа хаба).
- Производные favicon: `icon-32.png`, `icon-180.png` генерируются PowerShell-скриптом (System.Drawing).

### 6.7 Размер установщика и roadmap

- 150 МБ → 143 МБ после `compression: maximum` + `electronLanguages: [ru, en]` (минус 53 локали).
- **~140 МБ — пол Electron x64** (Chromium+V8+Node ~300 МБ unpacked); игры/хаб в установщике = 0 байт.
- Roadmap «мало»: (A) Tauri v2 на системном WebView2 → 3–10 МБ, контракт `AppBridge` сохраняется,
  веб-часть не меняется; (B) PWA-установка из браузера → 0 МБ (manifest + существующий sw.js).

### 6.8 UX оболочки

- Меню RU: Файл (Настройки Ctrl+,, Проверить обновления игр, Обновить приложение…, Выход),
  Вид, Помощь. Вкладка «Правка» удалена; Ctrl+Z/X/C/V/A/Y перехватываются `before-input-event`
  (копирование кода комнаты/имени не ломается).
- Esc = системная «Назад» для страниц `app://games` → backHandler игры → оверлеи → хаб.
- Настройки: имя игрока (видно в онлайн-комнатах), источник контента, режим обновлений,
  статус автообновления оболочки (живой прогресс), сведения (пути, версии), кнопки
  «Проверить обновления игр/оболочки», «Установить обновление», «Папка контента».
- Внешние ссылки (`http(s)`) всегда уходят в системный браузер; навигация вне `app://` запрещена.

---

## 7. Таблица «симптом → причина → лечение»

### 7.1 Платформы

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

### 7.2 Онлайн-комнаты

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

### 7.3 Desktop-оболочка и сборка

| Симптом | Причина | Лечение |
|---|---|---|
| Чёрное окно + бледный «404: /index.html» | packsRoot указывает на пустую/битую папку | самовосстановление packsRoot + страница-ошибка (v0.5) |
| Сборка: «Cannot create symbolic link … darwin» | winCodeSign-7z с simlink-ами macOS; нет прав | ручная распаковка кэша + удалить `darwin/` ИЛИ `signAndEditExecutable:false` |
| Сборка: «cannot find specified resource assets/icon.ico» | electron-icon-builder пишет в `assets/icons/…` | пути `assets/icons/win/icon.ico` в yml |
| Иконка окна ≠ логотип хаба | `assets/icon.png` не существует → дефолт Electron | pickAppIcon() с цепочкой фолбэков |
| `sha256 mismatch: sw.js` при обновлении контента | хэши рабочей папки vs байты git-блоба (CRLF) / устаревший манифест | gen-versions v1.2 из `git show HEAD:path`; реген ПОСЛЕ коммита контента |
| Прогресс обновления «исчезает» | троттлинг последнего тика + тост стирался перезагрузкой | финальный тост N/N + повтор после did-finish-load + системное уведомление при ошибке |
| Качает все файлы всегда | sync без диффа | селективная синхронизация по версиям (updater v1.1) |
| Ctrl+C/V не работают без меню «Правка» | роли меню удалены | перехват Ctrl+Z/X/C/V/A/Y в before-input-event |
| Установщик 143 МБ | пол Electron x64 | compression maximum + electronLanguages ru/en; дальше — Tauri/PWA (6.7) |
| Автообновление не видит релиз | в релизе нет `latest.yml` | прикреплять latest.yml в каждый релиз |

---

## 8. Чек-листы

### 8.1 Новая игра (офлайн)
1. Папка игры + кнопка в хабе + алиасы в `GAME_MAP` (боты шлют `?game=<alias>`).
2. `Platform.init({bg, back})`; звук/вибро только через `Platform.haptic/share`.
3. GA через `trackEvent`; платформа подставляется автоматически.
4. BackHandler: просмотр партии → rules → stats → set → lobby/room → mode → hub.
5. Favicon-линки на `../icon-32.png`; overscroll-behavior:none; описания витрин без чисел.
6. Head без синхронных внешних SDK-тегов (telegram/gstatic) — только ленивая загрузка.

### 8.2 Новая онлайн-игра (подключение к единой схеме)
1. Структура комнаты по 5.1. 2. Heartbeat 5/15 с, запуск +500 мс после записи места.
3. `removePresence()` в leaveRoom/beforeunload. 4. Реванш у всех; requestRematch только пишет флаг.
5. Триггер автостарта по 5.4 (условие status='finished'!). 6. Round-триггер. 7. Лобби в шторке.
8. `isGameActive()` + блокировка ходов. 9. Умные кнопки шторки. 10. fieldView. 11. Вход в finished.
12. Rules Firebase под свою схему мест. 13. Префикс логов `[XX]`. 14. Если движок не ставит
status='finished' сам — авто-перевод (грабля Нард). 15. Watchdog автоходов.

### 8.3 Релиз desktop-оболочки
1. Bump `version` в `package.json`. 2. `npm run dist`. 3. Release: tag `vN.N.N`,
   ассеты `IgrovojCentr-Setup.exe` + `latest.yml`. 4. Publish → hub-кнопка подхватит через
   `latest/download` автоматически. 5. Проверка автообновления с предыдущей установленной версии.

### 8.4 Деплой контента
1. Коммит контента → 2. `node tools/gen-versions.js` (v1.2, из git-блобов) →
3. коммит `versions.json` → 4. push одним пакетом. 5. В оболочке: «Проверить обновления игр».

### 8.5 Новая платформа (бот) / переезд
1. Вебхук на Vercel; ответ ДО/ПОСЛЕ обработки по freeze-модели. 2. Реестр: подписка + секрет + confirmation.
3. Клавиатура: постоянная кнопка входа; лимиты изучить ДО разработки. 4. Витрина без чисел игр.
5. `platform.js`: ветки detect/ensureSdk/init/haptic/share/close + мост.
6. Rename репо → `git remote set-url`; Pages пересобирается; Vercel едет по ID репо; env → Redeploy.

---

## 9. Справочник конфигурации

| Ключ | Значение |
|---|---|
| Hub URL | `https://ip19760118-code.github.io/games/` |
| MAX webhook | Vercel-проект max-bot, path `/max` |
| VK webhook | Vercel-проект vk-bot, path `/vk` |
| VK Mini App | кабинет `vk.com/apps?act=manage`; диплинк `/app<id>` |
| Firebase | проект RTDB (имя не менять); конфиг — в коде игр |
| Env MAX / VK | `MAX_TOKEN`, `MAX_SECRET` / `VK_TOKEN`, `VK_SECRET`, `VK_CONFIRM` |
| GA | measurement id в `index.html` хаба |
| EXE (стабильная ссылка) | `…/releases/latest/download/IgrovojCentr-Setup.exe` |
| Манифест контента | `…/games/versions.json` |
| Паки оболочки | `%APPDATA%\igrovoj-centr\packs\current` |
| HEARTBEAT_INTERVAL / TTL | 5000 / 15000 мс |
| Watchdog комнат | тик 5 с, порог неактивности 30 с |
| MAX_NAV_MODE | `'external'` (продакшен) |
| Бутстрап контента | таймаут 60 с до окна |

> 🔒 Значения секретов — только Vercel Environment Variables и локальные `.env`.

---

## 10. История ключевых решений

| Версия | Дата | Изменения |
|---|---|---|
| 1.0 | — | Первая спецификация: TG/MAX/VK/web, хаб, боты, грабли платформ |
| 2.0 | 2026-10-27 | Единая архитектура онлайн-комнат (реванш, heartbeat, лобби в шторке, автостарт, просмотр партии); rules под все схемы; префиксы логов; чек-листы; секреты вынесены |
| 2.1 | 2026-10-27 | Ретест MAX container: спиннер-зависание, пауза JS → watchdog мёртв; `MAX_NAV_MODE='external'`; таблица версий; грабли chess/nardy/seabattle/durak; 404 mp3/favicon |
| 2.2 | 2026-10-28 | Официальный ответ поддержки MAX: нет navigate; openLink только внешний; зависание = ожидание LoadingCompleted; рекомендована SPA; SetCanGoBack/BackButtonPressed/SetTitle; док dev.max.ru |
| 2.3 | 2026-10-31 | Desktop-оболочка Electron v0.2.2 целиком (раздел 6): протокол app://, паки и селективный апдейтер, manifest-грабля sha256 и gen из git-блобов, electron-updater + latest.yml, иконки assets/icons/, размер 143 МБ и roadmap Tauri/PWA; TG goToHub-фикс (v2.8); hub v3.27 (кнопка скачивания, hover, логотип); меню без «Правки» + перехват Ctrl |

---

**Конец документа.** Обновлять при каждой новой грабле — цена ошибки уже оплачена.