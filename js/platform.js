/* tg-games: единый слой платформ v1.1 — Telegram / VK / MAX / web.
   v1.1: умный шеринг: системный лист (Web Share API) -> нативный лист мессенджера
   (TG switchInlineQuery / t.me/share, VK Share, MAX share) -> буфер обмена + тост. */
var Platform=(function(){
 var MAX_SDK_URL=''; /* ← впиши URL SDK MAX из docs dev.max.ru после регистрации */
 var VK_SDK_URL='https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js';
 var name='web',user=null,backFn=null,inited=false;
 function qs(k){try{return new URLSearchParams(location.search).get(k)||''}catch(e){return ''}}
 function load(src){return new Promise(function(res){var s=document.createElement('script');s.src=src;s.onload=function(){res(true)};s.onerror=function(){res(false)};document.head.appendChild(s)})}
 function detect(){var p=(qs('plat')||'').toLowerCase();
  if(p==='tg'||p==='vk'||p==='max')return p;
  if(window.Telegram&&window.Telegram.WebApp)return 'tg';
  if(window.vkBridge)return 'vk';
  if(window.maxApi||window.maxBridge)return 'max';
  return 'web'}
 name=detect();
 function ensureSdk(cb){
  if(name==='tg'&&!window.Telegram)load('https://telegram.org/js/telegram-web-app.js').then(cb);
  else if(name==='vk'&&!window.vkBridge)load(VK_SDK_URL).then(cb);
  else if(name==='max'&&MAX_SDK_URL&&!window.maxApi)load(MAX_SDK_URL).then(cb);
  else cb(true)}
 function pickUser(){
  try{if(name==='tg'&&window.Telegram&&Telegram.WebApp&&Telegram.WebApp.initDataUnsafe&&Telegram.WebApp.initDataUnsafe.user){var u=Telegram.WebApp.initDataUnsafe.user;user={id:'tg'+u.id,name:u.first_name||'Игрок'};return}}catch(e){}
  if(name==='vk'&&window.vkBridge){try{vkBridge.send('VKWebAppGetUserInfo').then(function(d){user={id:'vk'+d.id,name:d.first_name||'Игрок'}}).catch(function(){})}catch(e){}}
  if(name==='max'&&window.maxApi&&maxApi.getUserInfo){try{maxApi.getUserInfo().then(function(d){user={id:'mx'+(d.userId||d.id),name:d.name||d.first_name||'Игрок'}}).catch(function(){})}catch(e){}}
  if(!user)user={id:'g'+Math.floor(Math.random()*1e9),name:'Гость'}}
 function init(o){o=o||{};if(inited)return;inited=true;
  ensureSdk(function(){pickUser();
   try{
    if(name==='tg'){var t=Telegram.WebApp;t.ready();t.expand();if(t.setHeaderColor&&o.bg)t.setHeaderColor(o.bg);if(t.setBackgroundColor&&o.bg)t.setBackgroundColor(o.bg);if(t.disableVerticalSwipes)t.disableVerticalSwipes();
     if(o.back&&t.BackButton){backFn=o.back;t.BackButton.show();t.BackButton.onClick(o.back)}}
    else if(name==='vk'&&window.vkBridge){vkBridge.send('VKWebAppInit').catch(function(){});
     if(o.bg)vkBridge.send('VKWebAppSetViewSettings',{status_bar_style:'light',action_bar_color:o.bg,navigation_bar_color:o.bg}).catch(function(){});
     vkBridge.send('VKWebAppShowCloseButton').catch(function(){});
     if(o.back)backFn=o.back}
    else if(name==='max'&&window.maxApi){try{if(maxApi.init)maxApi.init()}catch(e){}if(o.back)backFn=o.back}
    else if(o.back)backFn=o.back;
   }catch(e){}})}
 /* ---------- встроенный тост для фолбэка шаринга ---------- */
 var toastEl=null,toastT=null;
 function platToast(msg){
  if(!toastEl){toastEl=document.createElement('div');toastEl.id='platToast';
   toastEl.style.cssText='position:fixed;top:calc(10px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);background:rgba(30,150,90,.95);color:#fff;font-weight:800;font-size:12px;padding:9px 18px;border-radius:24px;z-index:9999;pointer-events:none;opacity:0;transition:opacity .25s;max-width:90vw;text-align:center;font-family:system-ui,sans-serif';
   document.body.appendChild(toastEl)}
  toastEl.textContent=msg;toastEl.style.opacity='1';
  if(toastT)clearTimeout(toastT);
  toastT=setTimeout(function(){toastEl.style.opacity='0'},2600)}
 function copyText(t){try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t);return true}}catch(e){}return false}
 /* ---------- УМНЫЙ ШЕРИНГ ---------- */
 function share(url,text,opts){
  opts=opts||{};
  function onCopied(){copyText(text+'\n'+url);if(opts.onCopied)opts.onCopied();else platToast(opts.copiedToast||'Ссылка скопирована — отправьте её другу')}
  function messengerShare(){
   if(name==='tg'&&window.Telegram&&Telegram.WebApp){var tw=Telegram.WebApp;
    if(tw.switchInlineQuery){try{tw.switchInlineQuery(text+' '+url,['users','groups','channels']);return true}catch(e){}}
    if(tw.openTelegramLink){try{tw.openTelegramLink('https://t.me/share/url?url='+encodeURIComponent(url)+'&text='+encodeURIComponent(text));return true}catch(e){}}}
   if(name==='vk'&&window.vkBridge){try{vkBridge.send('VKWebAppShare',{link:url});return true}catch(e){}}
   if(name==='max'&&window.maxApi&&window.maxApi.share){try{maxApi.share({url:url,text:text});return true}catch(e){}}
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
  haptic:function(t){try{
   if(name==='tg'&&window.Telegram&&Telegram.WebApp.HapticFeedback){var h=Telegram.WebApp.HapticFeedback;
    if(t==='success')h.notificationOccurred('success');else if(t==='error')h.notificationOccurred('error');else if(t==='warning')h.notificationOccurred('warning');else h.impactOccurred(t==='heavy'?'heavy':(t==='medium'?'medium':'light'));return}
   if(name==='vk'&&window.vkBridge){vkBridge.send('VKWebAppTapticImpactOccurred',{style:(t==='error'||t==='heavy')?'heavy':((t==='warning'||t==='medium')?'medium':'light')}).catch(function(){});return}
   if(name==='max'&&window.maxApi&&maxApi.haptic){maxApi.haptic((t==='error'||t==='heavy')?'heavy':'light');return}
   if(navigator.vibrate)navigator.vibrate((t==='error'||t==='heavy')?60:20);}catch(e){}},
  share:share,
  toast:platToast,
  onBack:function(fn){backFn=fn;if(name==='tg')try{Telegram.WebApp.BackButton.show();Telegram.WebApp.BackButton.onClick(fn)}catch(e){}},
  fireBack:function(){if(backFn)backFn()},
  close:function(){try{
   if(name==='tg')Telegram.WebApp.close();
   else if(name==='vk'&&window.vkBridge)vkBridge.send('VKWebAppClose').catch(function(){});
   else if(name==='max'&&window.maxApi&&maxApi.close)maxApi.close();
   else history.back()}catch(e){history.back()}},
  colors:function(bg){try{
   if(name==='tg'){Telegram.WebApp.setHeaderColor(bg);Telegram.WebApp.setBackgroundColor(bg)}
   else if(name==='vk'&&window.vkBridge)vkBridge.send('VKWebAppSetViewSettings',{status_bar_style:'light',action_bar_color:bg,navigation_bar_color:bg}).catch(function(){});}catch(e){}}
 };
})();