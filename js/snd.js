/* tg-games: модуль звуков и озвучки v3.1
   v3.1: голос и эффекты разделены. setVoice() глушит ТОЛЬКО речь (say/tts),
   play() (эффекты) от флага голоса не зависит. muted = общий мастер-мьют (не используется тумблером).
   mp3 декодируются в WebAudio-буферы (assets/snd); нет файла/WebAudio -> мгновенная замена (синтез/TTS). */
var SND=(function(){
 var BASE='../assets/snd/',TRIM=.55;
 var vol=.7,muted=false,voice=true,AC=null,buf={},elc={},state={};
 var FILES={shot:'shot.mp3',splash:'splash.mp3',hit:'hit.mp3',boom:'boom.mp3',place:'place.mp3',select:'select.mp3',invalid:'invalid.mp3',shuffle:'shuffle.mp3',win:'win.mp3',lose:'lose.mp3',
  v_new:'v_new.mp3',v_battle:'v_battle.mp3',v_win:'v_win.mp3',v_lose:'v_lose.mp3',v_sunk:'v_sunk.mp3',v_turn:'v_turn.mp3',v_hint:'v_hint.mp3',v_wait:'v_wait.mp3'};
 function src(k){return BASE+(FILES[k]||(k+'.mp3'))}
 function ctx(){if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){AC=null}}if(AC&&AC.state==='suspended'){try{AC.resume()}catch(e){}}return AC}
 function probe(){for(var k in FILES){(function(k){state[k]='load';
  function bad(){state[k]='bad'}
  try{
   if(!window.fetch)throw 0;
   fetch(src(k)).then(function(r){if(!r.ok)throw 0;return r.arrayBuffer()}).then(function(ab){var ac=ctx();if(!ac||!ac.decodeAudioData)throw 0;
    return new Promise(function(res,rej){try{var p=ac.decodeAudioData(ab,function(b){res(b)},function(){rej()});if(p&&p.then)p.then(res,rej)}catch(e){rej()}})}).then(function(b){buf[k]=b;state[k]='ok'}).catch(bad);
  }catch(e){bad()}
 })(k)}}
 function fireBuf(k,vm){var ac=ctx();if(!ac||!buf[k])return false;try{var s=ac.createBufferSource();s.buffer=buf[k];var g=ac.createGain();g.gain.value=Math.max(0,Math.min(1,vol*TRIM*(vm||1)));s.connect(g);g.connect(ac.destination);s.start();return true}catch(e){return false}}
 function fireEl(k,vm,fb){try{if(!elc[k])elc[k]=new Audio(src(k));var c=elc[k].cloneNode(true);c.volume=Math.max(0,Math.min(1,vol*TRIM*(vm||1)));var p=c.play();
  if(p&&p.catch){p.catch(function(){if(fb)fb()})}else if(fb){fb()}
  return true}catch(e){return false}}
 function tts(t){if(muted)return;try{if(!window.speechSynthesis)return;speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(t);u.lang='ru-RU';u.rate=1.05;u.volume=Math.max(0,Math.min(1,vol));speechSynthesis.speak(u)}catch(e){}}
 function unlock(){ctx()}
 document.addEventListener('pointerdown',unlock,true);
 document.addEventListener('click',unlock,true);
 probe();
 return{FILES:FILES,
  setVol:function(v){vol=v},
  setMuted:function(m){muted=!!m;if(m){try{speechSynthesis.cancel()}catch(e){}}},
  /* v3.1: только речь */
  setVoice:function(v){voice=!!v;if(!voice){try{speechSynthesis.cancel()}catch(e){}}},
  play:function(k,vm,fb){if(muted)return;
   if(state[k]==='ok'){if(!fireBuf(k,vm)){if(!fireEl(k,vm,fb)){if(fb)fb()}}}
   else{if(fb)fb()}},
  say:function(k,t){if(muted||!voice)return;
   if(state[k]==='ok'){if(!fireBuf(k,1)){fireEl(k,1,function(){tts(t)})}}
   else{tts(t)}},
  tts:tts,
  preload:function(){if(!Object.keys(state).length)probe()},
  stat:function(){var o={};for(var k in state)o[k]=state[k];return o}};
})();