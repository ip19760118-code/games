/* tg-games: единый слой платформ v2.4 — Telegram / VK / MAX / web.
   v2.4: блокировка pull-to-refresh в MAX/VK (свайп вниз не обновляет страницу);
   улучшенный close() — корректный возврат в хаб из web/браузерной версии MAX.
   v2.3: честный детект клиента MAX по initData/UA/referrer. */
var Platform=(function(){
 var MAX_SDK_URL='https://st.max.ru/js/max-web-app.js';
 var VK_SDK_URL='https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js';
 var TG_SDK_URL='https://telegram.org/js/telegram-web-app.js';
 var MAX_DEEPLINK='https://max.ru/se14729332_bot';
 var name='web',user=null,backFn=null,inited=false;

 function qs(k){try{return new URLSearchParams(location.search).get(k)||''}catch(e){return ''}}
 function load(src){return new Promise(function(res){var s=document.createElement('script');s.src=src;s.onload=function(){res(true)};s.onerror=function(){res(false)};document.head.appendChild(s)})}
 function detect(){var p=(qs('plat')||'').toLowerCase();
  if(p==='tg'||p==='vk'||p==='max')return p;
  if(window.Telegram&&window.Telegram.WebApp)return 'tg';
  if(window.vkBridge)return 'vk';
  if(window.WebApp&&window.WebApp.version)return 'max';
  return 'web'}
 name=detect();

 /* ---------- service worker (кэш игр на github.io) ---------- */
 (function(){
  try{
   if(!('serviceWorker' in navigator))return;
   if(location.protocol!=='https:')return;
   if(location.host.indexOf('github.io')<0)return;
   var m=location.pathname.match(/^(.*\/games\/)/);
   if(!m)return;
   navigator.serviceWorker.register(m[1]+'sw.js',{scope:m[1]}).catch(function(){});
  }catch(e){}
 })();

 /* ---------- v2.4: настоящий ли клиент MAX? ---------- */
 function maxClientReal(){
  try{
   if(window.WebApp&&window.WebApp.initData&&String(window.WebApp.initData).length>10)return true;
  }catch(e){}
  try{
   if(/MaxApp|MAX\/|ru\.max/i.test(navigator.userAgent||''))return true;
  }catch(e){}
  try{
   if((document.referrer||'').indexOf('max.ru')>=0)return true;
  }catch(e){}
  return false;
 }
 function isMaxExternal(){ return name==='max' && !maxClientReal(); }

 function ensureSdk(cb){
  if(name==='tg'&&!window.Telegram)load(TG_SDK_URL).then(cb);
  else if(name==='vk'&&!window.vkBridge)load(VK_SDK_URL).then(cb);
  else if(name==='max'&&!window.WebApp)load(MAX_SDK_URL).then(cb);
  else cb(true)}

 function pickUser(){
  try{
   if(name==='tg'&&window.Telegram&&Telegram.WebApp&&Telegram.WebApp.initDataUnsafe&&Telegram.WebApp.initDataUnsafe.user){
    var u=Telegram.WebApp.initDataUnsafe.user;user={id:'tg'+u.id,name:u.first_name||'Игрок'};return}}catch(e){}
  if(name==='vk'&&window.vkBridge){try{vkBridge.send('VKWebAppGetUserInfo').then(function(d){user={id:'vk'+d.id,name:d.first_name||'Игрок'}}).catch(function(){})}catch(e){}}
  if(name==='max'&&window.WebApp&&maxClientReal()){try{
    var m=window.WebApp.initDataUnsafe&&window.WebApp.initDataUnsafe.user;
    if(m)user={id:'mx'+m.id,name:m.first_name||'Игрок'}
    }catch(e){}}
  if(!user)user={id:'g'+Math.floor(Math.random()*1e9),name:'Гость'}}

 /* ---------- v2.4: возврат в хаб (универсальный) ---------- */
 function hubBase(){
  try{
   /* пытаемся найти корень хаба: ищем в пути сегмент /games/ */
   var p=location.pathname;
   var i=p.indexOf('/games/');
   if(i>=0)return location.origin+p.substring(0,i+7); /* включая /games/ */
   /* fallback: на одну директорию вверх */
   var parts=p.split('/').filter(Boolean);
   if(parts.length>=2)parts.pop();
   return location.origin+'/'+parts.join('/')+'/';
  }catch(e){
   return location.origin+'/games/';
  }
 }
 function goToHub(){
  try{
   if(name==='max'&&maxClientReal()&&window.WebApp&&window.WebApp.close){window.WebApp.close();return}
   if(name==='tg'&&window.Telegram&&Telegram.WebApp){Telegram.WebApp.close();return}
   if(name==='vk'&&window.vkBridge){vkBridge.send('VKWebAppClose',{payload:'igrovoj-centr'}).catch(function(){});return}
   if(isMaxExternal()){backToMessenger();return}
   /* web / браузерная MAX / fallback */
   var url=hubBase()+'?plat='+name;
   if(location.href.replace(/\/$/,'')===url.replace(/\/$/,'')){
    /* уже в хабе — ничего не делаем */
    return;
   }
   location.href=url;
  }catch(e){
   try{history.back()}catch(e2){location.href='../?plat='+name}
  }
 }

 /* ---------- возврат в MAX из внешнего браузера ---------- */
 function backToMessenger(){
  try{ platToast('Возвращаем в MAX…'); }catch(e){}
  try{ window.close(); }catch(e){}
  setTimeout(function(){
   try{
    if(document.hidden)return;
    location.href=MAX_DEEPLINK;
   }catch(e){}
  },400);
 }
 /* перехват кликов по кнопкам/ссылкам со словом "меню" во внешнем MAX-браузере */
 document.addEventListener('click', function(ev){
  try{
   if(!isMaxExternal())return;
   var el=(ev.target&&ev.target.closest)?ev.target.closest('button,a'):null;
   if(!el)return;
   var txt=(el.textContent||'');
   if(txt.indexOf('меню')<0&&txt.indexOf('Меню')<0)return;
   ev.preventDefault();
   ev.stopPropagation();
   backToMessenger();
  }catch(e){}
 }, true);

 function init(o){o=o||{};if(inited)return;inited=true;

  /* ---------- v2.4: блокируем pull-to-refresh и overscroll в MAX/VK/web ---------- */
  try{
   document.documentElement.style.overscrollBehavior='none';
   document.documentElement.style.overscrollBehaviorY='none';
   document.body.style.overscrollBehavior='none';
   document.body.style.overscrollBehaviorY='none';
   /* предотвращаем pull-to-refresh на самом верху */
   var lastY=0;
   document.addEventListener('touchstart',function(e){
    if(e.touches.length===1)lastY=e.touches[0].clientY;
   },{passive:true});
   document.addEventListener('touchmove',function(e){
    if(window.scrollY===0&&e.touches.length===1){
     var dy=e.touches[0].clientY-lastY;
     if(dy>0){
      /* тянем вниз из самого верха — не даём браузеру обновлять страницу */
      /* но если внутри есть скроллируемый контейнер, он сам обработает */
      var el=e.target;
      var inScroller=false;
      while(el&&el!==document.body){
       var os=getComputedStyle(el).overflowY;
       if((os==='auto'||os==='scroll')&&el.scrollTop>0){inScroller=true;break}
       el=el.parentNode;
      }
      if(!inScroller)e.preventDefault();
     }
    }
   },{passive:false});
  }catch(e){}

  ensureSdk(function(){pickUser();
   try{
    if(name==='tg'){var t=Telegram.WebApp;t.ready();t.expand();
     if(t.setHeaderColor&&o.bg)t.setHeaderColor(o.bg);
     if(t.setBackgroundColor&&o.bg)t.setBackgroundColor(o.bg);
     if(t.disableVerticalSwipes)t.disableVerticalSwipes();
     if(o.back&&t.BackButton){backFn=o.back;t.BackButton.show();t.BackButton.onClick(o.back)}}
    else if(name==='vk'&&window.vkBridge){
     vkBridge.send('VKWebAppInit').catch(function(){});
     if(o.bg)vkBridge.send('VKWebAppSetViewSettings',{status_bar_style:'light',action_bar_color:o.bg,navigation_bar_color:o.bg}).catch(function(){});
     vkBridge.send('VKWebAppShowCloseButton').catch(function(){});
     vkBridge.send('VKWebAppEnableSwipeBack').catch(function(){});
     if(o.back){
      backFn=o.back;
      try{vkBridge.subscribe(function(e){
       if(e&&e.detail&&e.detail.type==='VKWebAppSwipeBack'){o.back()}
      })}catch(e){}}}
    else if(name==='max'&&maxClientReal()&&window.WebApp){
     try{if(window.WebApp.ready)window.WebApp.ready()}catch(e){}
     if(o.bg)try{window.WebApp.setHeaderColor&&window.WebApp.setHeaderColor(o.bg)}catch(e){}
     if(o.back){
      backFn=o.back;
      try{
       if(window.WebApp.BackButton){
        window.WebApp.BackButton.show();
        window.WebApp.BackButton.onClick(o.back)}
      }catch(e){}}}
    else if(o.back)backFn=o.back;
   }catch(e){}})}

 var toastEl=null,toastT=null;
 function platToast(msg){
  if(!toastEl){toastEl=document.createElement('div');toastEl.id='platToast';
   toastEl.style.cssText='position:fixed;top:calc(10px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);background:rgba(30,150,90,.95);color:#fff;font-weight:800;font-size:12px;padding:9px 18px;border-radius:24px;z-index:9999;pointer-events:none;opacity:0;transition:opacity .25s;max-width:90vw;text-align:center;font-family:system-ui,sans-serif';
   document.body.appendChild(toastEl)}
  toastEl.textContent=msg;toastEl.style.opacity='1';
  if(toastT)clearTimeout(toastT);
  toastT=setTimeout(function(){toastEl.style.opacity='0'},2600)}
 function copyText(t){try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t);return true}}catch(e){}return false}

 function share(url,text,opts){
  opts=opts||{};
  function onCopied(){copyText(text+'\n'+url);if(opts.onCopied)opts.onCopied();else platToast(opts.copiedToast||'Ссылка скопирована — отправьте её другу')}
  function messengerShare(){
   if(name==='tg'&&window.Telegram&&Telegram.WebApp){var tw=Telegram.WebApp;
    if(tw.switchInlineQuery){try{tw.switchInlineQuery(text+' '+url,['users','groups','channels']);return true}catch(e){}}
    if(tw.openTelegramLink){try{tw.openTelegramLink('https://t.me/share/url?url='+encodeURIComponent(url)+'&text='+encodeURIComponent(text));return true}catch(e){}}}
   if(name==='vk'&&window.vkBridge){try{vkBridge.send('VKWebAppShare',{link:url,text:text});return true}catch(e){}}
   if(name==='max'&&window.WebApp&&maxClientReal()){
    try{
     if(window.WebApp.shareMaxContent){window.WebApp.shareMaxContent({text:text+' '+url});return true}
     if(window.WebApp.shareContent){window.WebApp.shareContent({text:text,link:url});return true}
    }catch(e){}}
   return false}
  if(navigator.share){
   try{navigator.share({title:opts.title||document.title,text:text,url:url})
    .then(function(){if(opts.onShared)opts.onShared('native')})
    .catch(function(err){if(err&&err.name==='AbortError')return;if(!messengerShare())onCopied()});
    return}catch(e){}}
  if(!messengerShare())onCopied()}

 return{
  get name(){return name},
  init:init,
  user:function(){return user||{id:'g0',name:'Гость'}},
  maxClientReal:maxClientReal,
  isMaxExternal:isMaxExternal,
  backToMessenger:backToMessenger,
  goToHub:goToHub,
  hubBase:hubBase,
  haptic:function(t){try{
   if(name==='tg'&&window.Telegram&&Telegram.WebApp.HapticFeedback){var h=Telegram.WebApp.HapticFeedback;
    if(t==='success')h.notificationOccurred('success');else if(t==='error')h.notificationOccurred('error');else if(t==='warning')h.notificationOccurred('warning');else h.impactOccurred(t==='heavy'?'heavy':(t==='medium'?'medium':'light'));return}
   if(name==='vk'&&window.vkBridge){
    if(t==='success'||t==='error'||t==='warning'){vkBridge.send('VKWebAppTapticNotificationOccurred',{type:t}).catch(function(){})}
    else{vkBridge.send('VKWebAppTapticImpactOccurred',{style:t==='heavy'?'heavy':(t==='medium'?'medium':'light')}).catch(function(){})}
    return}
   if(name==='max'&&window.WebApp&&maxClientReal()&&window.WebApp.HapticFeedback){var hm=window.WebApp.HapticFeedback;
    if(t==='success')hm.notificationOccurred('success');else if(t==='error')hm.notificationOccurred('error');else if(t==='warning')hm.notificationOccurred('warning');else hm.impactOccurred(t==='heavy'?'heavy':(t==='medium'?'medium':'light'));return}
   if(navigator.vibrate)navigator.vibrate((t==='error'||t==='heavy')?60:20);}catch(e){}},
  share:share,
  toast:platToast,
  onBack:function(fn){backFn=fn;
   if(name==='tg')try{Telegram.WebApp.BackButton.show();Telegram.WebApp.BackButton.onClick(fn)}catch(e){}
   if(name==='vk'&&window.vkBridge)try{vkBridge.subscribe(function(e){if(e&&e.detail&&e.detail.type==='VKWebAppSwipeBack')fn()})}catch(e){}
   if(name==='max'&&window.WebApp&&maxClientReal()&&window.WebApp.BackButton)try{window.WebApp.BackButton.show();window.WebApp.BackButton.onClick(fn)}catch(e){}},
  fireBack:function(){if(backFn)backFn()},
  close:function(){try{
   if(name==='tg')Telegram.WebApp.close();
   else if(name==='vk'&&window.vkBridge)vkBridge.send('VKWebAppClose',{payload:'igrovoj-centr'}).catch(function(){});
   else if(name==='max'&&maxClientReal()&&window.WebApp&&window.WebApp.close)window.WebApp.close();
   else goToHub();
  }catch(e){try{history.back()}catch(e2){location.href='../?plat='+name}}},
  colors:function(bg){try{
   if(name==='tg'){Telegram.WebApp.setHeaderColor(bg);Telegram.WebApp.setBackgroundColor(bg)}
   else if(name==='vk'&&window.vkBridge)vkBridge.send('VKWebAppSetViewSettings',{status_bar_style:'light',action_bar_color:bg,navigation_bar_color:bg}).catch(function(){});
   else if(name==='max'&&window.WebApp&&maxClientReal()&&window.WebApp.setHeaderColor)window.WebApp.setHeaderColor(bg);}catch(e){}}
 };
})();