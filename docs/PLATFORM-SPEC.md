# PLATFORM-SPEC — МК «Игровой центр»: кроссплатформенная спецификация и грабли

Версия документа: 1.0 | Статус: TG ✅ / MAX ✅ / VK ✅ / web ✅
Репозиторий: github.com/ip19760118-code/games (Pages: https://ip19760118-code.github.io/games/)

---

## 0. Архитектура на одной странице

| Компонент | Где живёт | Комментарий |
|---|---|---|
| Хаб (витрина 15 игр) | GitHub Pages, корень репо `games/` | `index.html` v3.16+ |
| Игры | папки `chess/ … trend-catch/` | каждая мультиплатформенная через `js/platform.js` |
| Онлайн-комнаты | Firebase RTDB, проект `tg-games-69c06` | ⚠️ НЕ путать с именем репозитория! Не переименовывать |
| MAX-бот | Vercel проект `tg-games`, Root Dir `max-bot`, вебхук `/max` | Callback: platform-api2.max.ru |
| VK-бот | Vercel проект `vk-bot`, Root Dir `vk-bot`, вебхук `/vk` | Callback API api.vk.com |
| TG-бот | меню-кнопка «Играть» → hub `?plat=tg` | Web App |
| Кэш | `sw.js` (service worker) | навигации network-first, статика stale-while-revalidate |
| Аналитика | GA `G-ZD8QE6XKTR` | событие hub_open/hub_game_click с меткой platform |

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
  «меню» (capture-фаза) → `window.close()` → fallback диплинк `https://max.ru/se14729332_bot`.
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
- group_id виден в payload confirmation (у нас 242534673 → owner_id = -242534673).

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
- Prefetch топовых игр (chess/seabattle/durak) через `<link rel=prefetch>` в простое,
  пропуск при `navigator.connection.saveData`.
- Firebase-комнаты работают ТОЛЬКО в first-party контексте: никаких iframe с играми
  внутри мессенджерских веб-вью (см. 2.2).
-window.open может блокироваться popup-блокером → всегда иметь fallback `location.href`.

---

## 5. Таблица «симптом → причина → лечение»

| Симптом | Причина | Лечение |
|---|---|---|
| MAX: сообщения не уходят, тишина в логах | вызовы после res.send (freeze) | всё ДО ответа |
| MAX: 404/сертификат при вызовах API | УЦ Минцифры | rejectUnauthorized:false |
| MAX: меню без клавиатуры | адресат не в query | user_id в query-строке |
| MAX: игра «виснет» из хаба | контейнер глушит location.href | openLink во внешнее окно |
| MAX: PERMISSION_DENIED комнаты | iframe = third-party storage | убрать iframe |
| MAX: кнопка «меню» не возвращает | внешний браузер, нет WebApp | перехват клика + window.close/диплинк |
| VK: 912 | не включены «Возможности ботов» | включить в настройках для бота |
| VK: 911 too much rows/buttons | лимиты клавиатур | ≤4 рядов, ≤10 кнопок, пагинация |
| VK: 911 not compatible with colors | color у open_app/open_link | убрать color |
| VK: спиннер на кнопке | нет sendMessageEventAnswer | отвечать снакбаром/open_app |
| VK: письма-дубли раз в ~15 мин | ретраи message_event | дедуп по event_id |
| VK: пропала нижняя клавиатура | сообщение без keyboard | keyboard в каждом send |
| VK: Rate limit reached (модерация) | лимит попыток подачи | одна попытка в сутки |
| TG: платформа определилась как tg в VK/MAX | хардкод TG SDK в hub | ленивая загрузка SDK |

---

## 6. Чек-листы

### Новая игра
1. Папка игры + кнопка в `index.html` хаба + алиасы в `GAME_MAP` (боты шлют `?game=<alias>`).
2. Внутри игры: `Platform.init({bg, back})`, звук/вибро только через `Platform.haptic/share`.
3. Онлайн: Firebase-пути комнат, инвайт через `location.origin+pathname` (никаких хардкодов домена).
4. GA-события через `trackEvent` (хаб) — платформа подставляется автоматически.

### Новая платформа (бот)
1. Сервер-вебхук на Vercel (отдельный проект, Root Dir), ответ событию ДО обработки/после — по заморозке платформы.
2. Реестр: подписка/вебхук + секрет + строка подтверждения.
3. Клавиатура: постоянная кнопка входа в мини-апп/хаб; лимиты платформы изучить ДО разработки.
4. Витрина: имя «Игровой центр», описание без числа игр (лимиты!), аватар 🎮, кнопка действия.
5. `platform.js`: ветка detect/ensureSdk/init/haptic/share/close + мост платформы.

### Деплой/переезд
1. Rename репо → `git remote set-url`, Pages пересобирается сам, Vercel едет по ID репо.
2. Env-переменные правим → обязателен Redeploy (сами не применяются).
3. Кэш SW: поднять версию `CACHE`, если пользователи должны срочно увидеть новое.

---

## 7. Справочник конфигурации

| Ключ | Значение |
|---|---|
| Hub URL | https://ip19760118-code.github.io/games/ |
| MAX webhook | https://tg-games-mu.vercel.app/max |
| VK webhook | https://vk-bot-omega.vercel.app/vk |
| VK Mini App | id 54850501, диплинк https://vk.com/app54850501 |
| VK group_id | 242534673 (owner_id = -242534673) |
| MAX bot | @se14729332_bot |
| Firebase | tg-games-69c06 (не трогать имя) |
| Env MAX | MAX_TOKEN, MAX_SECRET |
| Env VK | VK_TOKEN, VK_SECRET, VK_CONFIRM |
| GA | G-ZD8QE6XKTR |

Конец документа. Обновлять при каждой новой грабле — цена ошибки уже оплачена.