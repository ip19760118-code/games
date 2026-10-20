/* tg-games · js/platform.js v1.0
   Единый слой платформ: Telegram / VK / MAX / web.
   Игры и хаб вызывают только Platform.* — код не знает, где запущен.

   API:
     Platform.init({ bg, back }) — инициализация, подгрузка SDK, навешивание BackButton
     Platform.name              — 'tg' | 'vk' | 'max' | 'web'
     Platform.user()            — { id, name }
     Platform.haptic(type)      — 'light'|'medium'|'heavy'|'success'|'error'|'warning'
     Platform.share(url, text)  — нативный шеринг мессенджера
     Platform.close()           — закрыть мини-апп
     Platform.colors(bg)        — перекрасить шапку/фон (TG/VK)
     Platform.onBack(fn)        — подписаться на системную кнопку Назад
*/

var Platform = (function () {
  /* =========================================================
     КОНСТАНТЫ: URL SDK (VK и MAX).
     MAX SDK: впиши актуальный URL из docs.max.ru после регистрации.
     Пока пусто — MAX работает в web-режиме (игры играбельны, без хаптик).
     ========================================================= */
  var VK_SDK_URL = 'https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js';
  var MAX_SDK_URL = '';  // ← ВПИШИ сюда URL SDK MAX, например: 'https://...max-sdk.js'

  var name = 'web';
  var user = null;
  var backFn = null;

  /* ---------- утилиты ---------- */
  function qs(k) {
    try { return new URLSearchParams(location.search).get(k) || ''; }
    catch (e) { return ''; }
  }
  function load(src) {
    return new Promise(function (res) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { res(true); };
      s.onerror = function () { res(false); };
      document.head.appendChild(s);
    });
  }

  /* ---------- определение платформы ----------
     Приоритет:
       1) явный ?plat=tg|vk|max в URL (ставит хаб/бот)
       2) детект по наличию глобальных SDK-объектов
       3) web */
  function detect() {
    var p = (qs('plat') || '').toLowerCase();
    if (p === 'tg' || p === 'vk' || p === 'max') return p;
    if (window.Telegram && window.Telegram.WebApp) return 'tg';
    if (window.vkBridge) return 'vk';
    if (window.maxApi || window.maxBridge) return 'max';
    return 'web';
  }
  name = detect();

  /* ---------- ленивая загрузка SDK ---------- */
  function ensureSdk(cb) {
    if (name === 'tg' && !window.Telegram) {
      load('https://telegram.org/js/telegram-web-app.js').then(cb);
    } else if (name === 'vk' && !window.vkBridge) {
      load(VK_SDK_URL).then(cb);
    } else if (name === 'max' && MAX_SDK_URL && !window.maxApi) {
      load(MAX_SDK_URL).then(cb);
    } else {
      cb(true);
    }
  }

  /* ---------- получение пользователя ---------- */
  function pickUser() {
    /* TG: initDataUnsafe.user */
    try {
      if (name === 'tg' && window.Telegram && Telegram.WebApp
          && Telegram.WebApp.initDataUnsafe && Telegram.WebApp.initDataUnsafe.user) {
        var u = Telegram.WebApp.initDataUnsafe.user;
        user = { id: 'tg' + u.id, name: u.first_name || 'Игрок' };
        return;
      }
    } catch (e) {}

    /* VK: VKWebAppGetUserInfo (async) */
    if (name === 'vk' && window.vkBridge) {
      try {
        vkBridge.send('VKWebAppGetUserInfo').then(function (d) {
          user = { id: 'vk' + d.id, name: d.first_name || 'Игрок' };
        }).catch(function () {});
      } catch (e) {}
    }

    /* MAX: getUserInfo (async) */
    if (name === 'max' && window.maxApi && maxApi.getUserInfo) {
      try {
        maxApi.getUserInfo().then(function (d) {
          user = { id: 'mx' + (d.userId || d.id), name: d.name || d.first_name || 'Игрок' };
        }).catch(function () {});
      } catch (e) {}
    }

    /* Fallback: гость */
    if (!user) user = { id: 'g' + Math.floor(Math.random() * 1e9), name: 'Гость' };
  }

  /* ---------- инициализация ----------
     options: { bg: '#color', back: function } */
  var inited = false;
  function init(o) {
    o = o || {};
    if (inited) return;
    inited = true;

    ensureSdk(function () {
      pickUser();
      try {
        /* === TELEGRAM === */
        if (name === 'tg') {
          var t = Telegram.WebApp;
          t.ready();
          t.expand();
          if (t.setHeaderColor && o.bg) t.setHeaderColor(o.bg);
          if (t.setBackgroundColor && o.bg) t.setBackgroundColor(o.bg);
          if (t.disableVerticalSwipes) t.disableVerticalSwipes();
          if (o.back && t.BackButton) {
            backFn = o.back;
            t.BackButton.show();
            t.BackButton.onClick(o.back);
          }
        }
        /* === VK === */
        else if (name === 'vk' && window.vkBridge) {
          vkBridge.send('VKWebAppInit').catch(function () {});
          if (o.bg) {
            vkBridge.send('VKWebAppSetViewSettings', {
              status_bar_style: 'light',
              action_bar_color: o.bg,
              navigation_bar_color: o.bg
            }).catch(function () {});
          }
          vkBridge.send('VKWebAppShowCloseButton').catch(function () {});
          if (o.back) backFn = o.back;
        }
        /* === MAX === */
        else if (name === 'max' && window.maxApi) {
          try { if (maxApi.init) maxApi.init(); } catch (e) {}
          if (o.back) backFn = o.back;
        }
        /* === WEB === */
        else {
          if (o.back) backFn = o.back;
        }
      } catch (e) {
        console.warn('Platform.init error:', e);
      }
    });
  }

  /* ---------- публичный API ---------- */
  return {
    get name() { return name; },

    init: init,

    user: function () {
      return user || { id: 'g0', name: 'Гость' };
    },

    haptic: function (t) {
      try {
        /* TG */
        if (name === 'tg' && window.Telegram && Telegram.WebApp.HapticFeedback) {
          var h = Telegram.WebApp.HapticFeedback;
          if (t === 'success') h.notificationOccurred('success');
          else if (t === 'error') h.notificationOccurred('error');
          else if (t === 'warning') h.notificationOccurred('warning');
          else h.impactOccurred(t === 'heavy' ? 'heavy' : (t === 'medium' ? 'medium' : 'light'));
          return;
        }
        /* VK */
        if (name === 'vk' && window.vkBridge) {
          var style = (t === 'error' || t === 'heavy') ? 'heavy'
                    : (t === 'warning' || t === 'medium') ? 'medium' : 'light';
          vkBridge.send('VKWebAppTapticImpactOccurred', { style: style }).catch(function () {});
          return;
        }
        /* MAX */
        if (name === 'max' && window.maxApi && maxApi.haptic) {
          maxApi.haptic((t === 'error' || t === 'heavy') ? 'heavy' : 'light');
          return;
        }
        /* web fallback: вибро через navigator */
        if (navigator.vibrate) {
          navigator.vibrate((t === 'error' || t === 'heavy') ? 60 : 20);
        }
      } catch (e) {}
    },

    share: function (url, text) {
      try {
        /* TG */
        if (name === 'tg' && window.Telegram && Telegram.WebApp) {
          Telegram.WebApp.openTelegramLink(
            'https://t.me/share/url?url=' + encodeURIComponent(url) +
            '&text=' + encodeURIComponent(text)
          );
          return;
        }
        /* VK */
        if (name === 'vk' && window.vkBridge) {
          vkBridge.send('VKWebAppShare', { link: url }).catch(function () {});
          return;
        }
        /* MAX */
        if (name === 'max' && window.maxApi && maxApi.share) {
          maxApi.share({ url: url, text: text });
          return;
        }
        /* web: Web Share API, иначе clipboard */
        if (navigator.share) {
          navigator.share({ url: url, text: text }).catch(function () {});
          return;
        }
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url + (text ? ' ' + text : ''));
        }
      } catch (e) {}
    },

    onBack: function (fn) {
      backFn = fn;
      if (name === 'tg') {
        try {
          Telegram.WebApp.BackButton.show();
          Telegram.WebApp.BackButton.onClick(fn);
        } catch (e) {}
      }
    },

    fireBack: function () {
      if (backFn) backFn();
    },

    close: function () {
      try {
        if (name === 'tg') Telegram.WebApp.close();
        else if (name === 'vk' && window.vkBridge) vkBridge.send('VKWebAppClose').catch(function () {});
        else if (name === 'max' && window.maxApi && maxApi.close) maxApi.close();
        else history.back();
      } catch (e) { history.back(); }
    },

    colors: function (bg) {
      try {
        if (name === 'tg') {
          Telegram.WebApp.setHeaderColor(bg);
          Telegram.WebApp.setBackgroundColor(bg);
        } else if (name === 'vk' && window.vkBridge) {
          vkBridge.send('VKWebAppSetViewSettings', {
            status_bar_style: 'light',
            action_bar_color: bg,
            navigation_bar_color: bg
          }).catch(function () {});
        }
      } catch (e) {}
    }
  };
})();