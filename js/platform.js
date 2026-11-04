/* tg-games: единый слой платформ v3.3 — TG / VK / MAX / web / PC / Android.
   v3.3: downloadAsset: ПК-оболочка → AppBridge.downloadFile (нативно, без браузера);
         TG/VK/MAX WebApp → БЕЗ попытки fetch (она падала по CORS и давала ложный тост
         «загрузка не удалась»): mobile пробуем navigator.share({files}), desktop — сразу
         честный переход в браузер; web-браузер → fetch+blob+<a download>; Android → DownloadManager.
   v3.1: desktop-web шеринг в буфер; v3.0: shareGame/gameDeepLink/бренд-строка. */
var Platform=(function(){
 var MAX_SDK_URL='https://st.max.ru/js/max-web-app.js';
 var VK_SDK_URL='https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js';
 var TG_SDK_URL='https://telegram.org/js/telegram-web-app.js';
 var MAX_DEEPLINK='https://max.ru/se14729332_bot';
 var MAX_NAV_MODE='external';
 var CANONICAL_ORIGIN='https://ip19760118-code.github.io/games';
 var BRAND_LINE='\n🎮 Игровой центр — классика и новинки, онлайн и офлайн';
 var name='web',user=null,backFn=null,inited=false;

 function qs(k){try{return new URLSearchParams(location.search).get(k)||''}catch(e){return ''}}
 function load(src){return new Promise(function(res){var s=document.createElement('script');s.src=src;s.onload=function(){res(true)};s.onerror=function(){res(false)};document.head.appendChild(s)})}
 function detect(){var p=(qs('plat')||'').toLowerCase();
  if(p==='tg'||p==='vk'||p==='max'||p==='pc'||p==='android')return p;
  var bp=(window.AppBridge&&window.AppBridge.platform)?String(window.AppBridge.platform):'';
  if(bp==='pc'||bp==='android')return bp;
  if(window.Telegram&&window.Telegram.WebApp)return 'tg';
  if(window.vkBridge)return 'vk';
  if(window.WebApp&&window.WebApp.version)return 'max';
  return 'web'}
 name=detect();

 (function(){
  try{
   if(!('serviceWorker' in navigator))return;
   if(window.AppBridge)return;
   if(location.protocol!=='https:')return;
   if(location.host.indexOf('github.io')<0)return;
   var m=location.pathname.match(/^(.*\/games\/)/);
   if(!m)return;
   navigator.serviceWorker.register(m[1]+'sw.js',{scope:m[1]}).catch(function(){});
  }catch(e){}
 })();

 function maxClientReal(){
  try{ if(window.WebApp&&window.WebApp.initData&&String(window.WebApp.initData).length>10)return true; }catch(e){}
  try{ if(/MaxApp|MAX\/|ru\.max/i.test(navigator.userAgent||''))return true; }catch(e){}
  try{ if((document.referrer||'').indexOf('max.ru')>=0)return true; }catch(e){}
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
   if((name==='pc'||name==='android')&&window.AppBridge&&AppBridge.getProfile){AppBridge.getProfile().then(function(p){if(p&&p.name)user={id:name,name:p.name};}).catch(function(){});return}}catch(e){}
  try{
   if(name==='tg'&&window.Telegram&&Telegram.WebApp&&Telegram.WebApp.initDataUnsafe&&Telegram.WebApp.initDataUnsafe.user){
    var u=Telegram.WebApp.initDataUnsafe.user;user={id:'tg'+u.id,name:u.first_name||'Игрок'};return}}catch(e){}
  if(name==='vk'&&window.vkBridge){try{vkBridge.send('VKWebAppGetUserInfo').then(function(d){user={id:'vk'+d.id,name:d.first_name||'Игрок'}}).catch(function(){})}catch(e){}}
  if(name==='max'&&window.WebApp&&maxClientReal()){try{
    var m=window.WebApp.initDataUnsafe&&window.WebApp.initDataUnsafe.user;
    if(m)user={id:'mx'+m.id,name:m.first_name||'Игрок'}
    }catch(e){}}
  if(!user)user={id:'g'+Math.floor(Math.random()*1e9),name:'Гость'}}

 function canonicalUrl(){
  try{
   if(name==='pc'||name==='android'){
    var p=location.pathname||'/';
    if(p.slice(-10)==='index.html')p=p.slice(0,p.length-10);
    if(p.charAt(p.length-1)!=='/')p+='/';
    if(p==='/')return CANONICAL_ORIGIN+'/';
    return CANONICAL_ORIGIN+p;
   }
   return location.origin+location.pathname;
  }catch(e){return location.href}
 }

 function gameDeepLink(key){ return CANONICAL_ORIGIN+'/?game='+key; }

 function hubBase(){
  try{
   if(location.protocol==='app:')return location.origin+'/';
   var p=location.pathname;
   var i=p.indexOf('/games/');
   if(i>=0)return location.origin+p.substring(0,i+7);
   var parts=p.split('/').filter(Boolean);
   if(parts.length>=2)parts.pop();
   return location.origin+'/'+parts.join('/')+'/';
  }catch(e){
   return location.origin+'/games/';
  }
 }
 function goToHub(){
  try{
   if(isMaxExternal()){backToMessenger();return}
   if(name==='max'&&maxClientReal()){
    if(MAX_NAV_MODE==='container'){
     var u0=hubBase()+'?plat=max';
     try{
      var cur=new URL(location.href);var tgt=new URL(u0);
      if(cur.pathname!==tgt.pathname){location.href=u0;return}
     }catch(e){location.href=u0;return}
     return;
    }
    if(window.WebApp&&window.WebApp.close){window.WebApp.close();return}
   }
   var url=hubBase()+'?plat='+name;
   if(location.href.replace(/\/$/,'')===url.replace(/\/$/,'')){return}
   location.href=url;
  }catch(e){
   try{history.back()}catch(e2){location.href='../?plat='+name}
  }
 }

 function backToMessenger(){
  try{ platToast('Возвращаем в MAX…'); }catch(e){}
  try{ window.close(); }catch(e){}
  setTimeout(function(){ try{ if(document.hidden)return; location.href=MAX_DEEPLINK; }catch(e){} },400);
 }
 document.addEventListener('click', function(ev){
  try{
   if(!isMaxExternal())return;
   var el=(ev.target&&ev.target.closest)?ev.target.closest('button,a'):null;
   if(!el)return;
   var txt=(el.textContent||'');
   if(txt.indexOf('меню')<0&&txt.indexOf('Меню')<0)return;
   ev.preventDefault();ev.stopPropagation();backToMessenger();
  }catch(e){}
 }, true);

 var toastEl=null,toastT=null;
 function platToast(msg,ms){
  if(!toastEl){toastEl=document.createElement('div');toastEl.id='platToast';
   toastEl.style.cssText='position:fixed;top:calc(10px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);background:rgba(30,150,90,.95);color:#fff;font-weight:800;font-size:12px;padding:9px 18px;border-radius:24px;z-index:9999;pointer-events:none;opacity:0;transition:opacity .25s;max-width:90vw;text-align:center;font-family:system-ui,sans-serif';
   document.body.appendChild(toastEl)}
  toastEl.textContent=msg;toastEl.style.opacity='1';
  if(toastT)clearTimeout(toastT);
  toastT=setTimeout(function(){toastEl.style.opacity='0'},ms||2600)}
 function copyText(t){try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t);return true}}catch(e){}return false}

 function showUpdateWarnings(){
  try{
   if((name!=='pc'&&name!=='android')||!window.AppBridge||!AppBridge.getUpdateWarnings)return;
   if(sessionStorage.getItem('shell_upd_warn_shown'))return;
   AppBridge.getUpdateWarnings().then(function(list){
    if(!list||!list.length)return;
    sessionStorage.setItem('shell_upd_warn_shown','1');
    var parts=(location.pathname||'').split('/').filter(Boolean);
    var isHub=(parts.length===1&&parts[0]==='index.html')||parts.length===0;
    var gameId=parts.length>1?parts[0]:null;
    for(var i=0;i<list.length;i++){
     var w=list[i];
     if(w.type==='hub'&&isHub){platToast('Обновите приложение',3000);return;}
     if(w.type==='game'&&gameId===w.id){
      platToast(w.online?'Обновите игру до новой версии, без обновления онлайн версия игры может не работать':'Обновите игру до новой версии',3000);
      return;
     }
    }
   }).catch(function(){});
  }catch(e){}
 }

 function init(o){o=o||{};if(inited)return;inited=true;
  try{
   document.documentElement.style.overscrollBehavior='none';
   document.documentElement.style.overscrollBehaviorY='none';
   document.body.style.overscrollBehavior='none';
   document.body.style.overscrollBehaviorY='none';
   var lastY=0;
   document.addEventListener('touchstart',function(e){if(e.touches.length===1)lastY=e.touches[0].clientY;},{passive:true});
   document.addEventListener('touchmove',function(e){
    if(window.scrollY===0&&e.touches.length===1){
     var dy=e.touches[0].clientY-lastY;
     if(dy>0){
      var el=e.target;var inScroller=false;
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
    if(name==='pc'){
     if(o.back){backFn=o.back;try{window.AppBridge.onBack(o.back)}catch(e){}}
     try{window.AppBridge.onToast&&window.AppBridge.onToast(function(m){platToast(m,3000)});}catch(e){}
     showUpdateWarnings();
    }
    else if(name==='android'){
     if(o.back){backFn=o.back;window.__androidBack=o.back;}
     showUpdateWarnings();
    }
    else if(name==='tg'){var t=Telegram.WebApp;t.ready();t.expand();
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
      try{ if(window.WebApp.BackButton){window.WebApp.BackButton.show();window.WebApp.BackButton.onClick(o.back)} }catch(e){}}}
    else if(o.back)backFn=o.back;
   }catch(e){}})}

 function withBrand(text,opts){
  opts=opts||{};
  var extra='';
  if(opts.game)extra+='\n👉 Сыграть сейчас: '+gameDeepLink(opts.game);
  if(opts.game||opts.brand)extra+=BRAND_LINE;
  return String(text==null?'':text)+extra;
 }

 function share(url,text,opts){
  opts=opts||{};
  text=withBrand(text,opts);
  function onCopied(){copyText(text+'\n'+url);if(opts.onCopied)opts.onCopied();else platToast(opts.copiedToast||'Ссылка скопирована — отправьте её другу')}
  function messengerShare(){
   if(name==='android'&&window.AppBridge&&window.AppBridge.share){try{window.AppBridge.share(text,url);return true}catch(e){}}
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
  var coarse=false;
  try{ coarse=!!(window.matchMedia&&window.matchMedia('(pointer: coarse)').matches); }catch(e){}
  if(navigator.share&&(name!=='web'||coarse)){
   try{navigator.share({title:opts.title||document.title,text:text,url:url})
    .then(function(){if(opts.onShared)opts.onShared('native')})
    .catch(function(err){if(err&&err.name==='AbortError')return;if(!messengerShare())onCopied()});
    return}catch(e){}}
  if(!messengerShare())onCopied()}

 function shareGame(key,text,opts){
  opts=opts||{};
  opts.game=key;
  return share(gameDeepLink(key),text,opts);
 }

 /* v3.3: каскадное скачивание ассетов по средам */
 function downloadAsset(url,fileName,opts){
  opts=opts||{};
  var shareText=opts.shareText||('📥 '+fileName);
  var shareTitle=opts.shareTitle||fileName;
  var isMobile=/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent||'');
  function saveViaAnchor(blob){
   try{
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=fileName;
    a.style.display='none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){
     try{document.body.removeChild(a);}catch(e){}
     try{URL.revokeObjectURL(a.href);}catch(e){}
    },5000);
    platToast('Загрузка запущена — проверь папку «Загрузки»');
   }catch(e){openBrowser();}
  }
  function openBrowser(){
   platToast('Открываем в браузере для скачивания…');
   try{ window.open(url,'_blank','noopener'); }catch(e){ location.href=url; }
  }
  function tryShareFile(blob){
   try{
    var file=new File([blob],fileName,{type:blob.type||'application/octet-stream'});
    if(navigator.canShare&&typeof navigator.canShare==='function'&&navigator.canShare({files:[file]})){
     navigator.share({files:[file],title:shareTitle,text:shareText}).catch(function(){});
     return true;
    }
   }catch(e){}
   return false;
  }
  function fetchBlob(onOk){
   platToast('Начинаю загрузку '+fileName+'…');
   fetch(url,{cache:'no-store'})
    .then(function(r){ if(!r.ok)throw new Error('HTTP '+r.status); return r.blob(); })
    .then(onOk)
    .catch(function(err){
     console.warn('[Platform] fetch failed:',err);
     openBrowser();
    });
  }
  /* 1) Android: нативный DownloadManager */
  if(name==='android'&&window.AppBridge&&typeof AppBridge.downloadFile==='function'){
   platToast('Начинаю загрузку '+fileName+'…');
   try{ AppBridge.downloadFile(url,fileName); }catch(e){ openBrowser(); }
   return;
  }
  /* 2) ПК-оболочка 0.3.4+: нативно через main-процесс */
  if(name==='pc'&&window.AppBridge&&typeof AppBridge.downloadFile==='function'){
   platToast('Начинаю загрузку '+fileName+'…');
   try{
    AppBridge.downloadFile(url,fileName).catch(function(err){
     console.warn('[PC] downloadFile failed:',err);
     try{ AppBridge.openExternal(url); }catch(e){ openBrowser(); }
    });
   }catch(e){ openBrowser(); }
   return;
  }
  /* 3) TG/VK/MAX WebApp: fetch по CORS падает — не пытаемся, уходим честно */
  if(name==='tg'||name==='vk'||name==='max'){
   if(isMobile){ fetchBlob(function(blob){ if(!tryShareFile(blob)) openBrowser(); }); }
   else{ openBrowser(); }
   return;
  }
  /* 4) Обычный web-браузер: fetch+blob */
  if(name==='web'&&!window.AppBridge){
   fetchBlob(function(blob){ if(!tryShareFile(blob)) saveViaAnchor(blob); });
   return;
  }
  openBrowser();
 }

 return{
  get name(){return name},
  init:init,
  user:function(){return user||{id:'g0',name:'Гость'}},
  maxClientReal:maxClientReal,
  isMaxExternal:isMaxExternal,
  maxNavMode:function(){return MAX_NAV_MODE},
  canonicalUrl:canonicalUrl,
  backToMessenger:backToMessenger,
  goToHub:goToHub,
  hubBase:hubBase,
  gameDeepLink:gameDeepLink,
  shareGame:shareGame,
  downloadAsset:downloadAsset,
  haptic:function(t){
   if(name==='pc')return;
   try{
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
   if(name==='pc')try{window.AppBridge.onBack(fn)}catch(e){}
   if(name==='android'){window.__androidBack=fn;}
   if(name==='tg')try{Telegram.WebApp.BackButton.show();Telegram.WebApp.BackButton.onClick(fn)}catch(e){}
   if(name==='vk'&&window.vkBridge)try{vkBridge.subscribe(function(e){if(e&&e.detail&&e.detail.type==='VKWebAppSwipeBack')fn()})}catch(e){}
   if(name==='max'&&window.WebApp&&maxClientReal()&&window.WebApp.BackButton)try{window.WebApp.BackButton.show();window.WebApp.BackButton.onClick(fn)}catch(e){}},
  fireBack:function(){if(backFn)backFn()},
  close:function(){try{
   if(name==='pc'){try{window.AppBridge.quit();return}catch(e){window.close();return}}
   if(name==='android'){try{window.AppBridge.quit();return}catch(e){return}}
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