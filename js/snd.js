/* tg-games: единый модуль звуков и озвучки v1.0
   Файлы: tg-games/assets/snd/*.mp3 (имена в SND.FILES).
   Нет файла -> авто-фолбэк: эффект тишина/синтез (через fb), фраза -> speechSynthesis. */
var SND=(function(){
 var BASE='../assets/snd/';
 var vol=.7,muted=false,cache={},missing={};
 var FILES={shot:'shot.mp3',splash:'splash.mp3',hit:'hit.mp3',boom:'boom.mp3',place:'place.mp3',select:'select.mp3',invalid:'invalid.mp3',shuffle:'shuffle.mp3',win:'win.mp3',lose:'lose.mp3',
  v_new:'v_new.mp3',v_battle:'v_battle.mp3',v_win:'v_win.mp3',v_lose:'v_lose.mp3',v_sunk:'v_sunk.mp3',v_turn:'v_turn.mp3',v_hint:'v_hint.mp3',v_wait:'v_wait.mp3'};
 function get(k){if(!cache[k]){var a=new Audio(BASE+(FILES[k]||(k+'.mp3')));a.preload='auto';cache[k]=a}return cache[k]}
 function fire(k,vm,onErr){if(muted)return;var c=get(k).cloneNode(true);c.volume=Math.max(0,Math.min(1,vol*(vm||1)));
  c.addEventListener('error',function(){missing[k]=true;if(onErr)onErr()});
  var p=c.play();if(p&&p.catch)p.catch(function(){})}
 function tts(t){if(muted)return;try{if(!window.speechSynthesis)return;speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(t);u.lang='ru-RU';u.rate=1.05;u.volume=vol;speechSynthesis.speak(u)}catch(e){}}
 return{
  FILES:FILES,
  setVol:function(v){vol=v},
  setMuted:function(m){muted=!!m;if(m){try{speechSynthesis.cancel()}catch(e){}}},
  play:function(k,vm,fb){if(muted)return;if(missing[k]){if(fb)fb();return}fire(k,vm,function(){if(fb)fb()})},
  say:function(k,t){if(muted)return;if(missing[k]){tts(t);return}fire(k,1,function(){tts(t)})},
  tts:tts,
  preload:function(){for(var k in FILES)get(k)}
 };
})();