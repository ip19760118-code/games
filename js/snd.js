/* tg-games: единый модуль звуков и озвучки v2.0
   Файлы: tg-games/assets/snd/*.mp3 (имена в FILES).
   ok -> играет mp3; bad/загрузка -> мгновенная замена (синтез/TTS). Тишины не бывает. */
var SND=(function(){
 var BASE='../assets/snd/';
 var vol=.7,muted=false,cache={},state={};
 var FILES={shot:'shot.mp3',splash:'splash.mp3',hit:'hit.mp3',boom:'boom.mp3',place:'place.mp3',select:'select.mp3',invalid:'invalid.mp3',shuffle:'shuffle.mp3',win:'win.mp3',lose:'lose.mp3',
  v_new:'v_new.mp3',v_battle:'v_battle.mp3',v_win:'v_win.mp3',v_lose:'v_lose.mp3',v_sunk:'v_sunk.mp3',v_turn:'v_turn.mp3',v_hint:'v_hint.mp3',v_wait:'v_wait.mp3'};
 function src(k){return BASE+(FILES[k]||(k+'.mp3'))}
 function probe(){for(var k in FILES){(function(k){var a=new Audio(src(k));cache[k]=a;state[k]='load';
  var ok=function(){state[k]='ok'};
  a.addEventListener('canplay',ok);a.addEventListener('canplaythrough',ok);
  a.addEventListener('error',function(){state[k]='bad'});
  try{a.load()}catch(e){state[k]='bad'}})(k)}}
 function fire(k,vm){var c=cache[k].cloneNode(true);c.volume=Math.max(0,Math.min(1,vol*(vm||1)));var p=c.play();if(p&&p.catch)p.catch(function(){})}
 function tts(t){if(muted)return;try{if(!window.speechSynthesis)return;speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(t);u.lang='ru-RU';u.rate=1.05;u.volume=vol;speechSynthesis.speak(u)}catch(e){}}
 probe();
 return{
  FILES:FILES,
  setVol:function(v){vol=v},
  setMuted:function(m){muted=!!m;if(m){try{speechSynthesis.cancel()}catch(e){}}},
  play:function(k,vm,fb){if(muted)return;if(state[k]==='ok'){try{fire(k,vm)}catch(e){if(fb)fb()}}else{if(fb)fb()}},
  say:function(k,t){if(muted)return;if(state[k]==='ok'){try{fire(k,1)}catch(e){tts(t)}}else{tts(t)}},
  tts:tts,
  preload:function(){if(!cache[Object.keys(FILES)[0]])probe()},
  stat:function(){var o={};for(var k in state)o[k]=state[k];return o}
 };
})();