// Corkboard v1.6.2 app logic, copied from "corkboard v1.6.2.html" (lines 917-3125).
// Desktop changes are marked with "DESKTOP:" comments; everything else is unchanged.
(function(){
var board=document.getElementById('board'),fileEl=document.getElementById('file'),empty=document.getElementById('empty'),
    titleEl=document.getElementById('title'),startEl=document.getElementById('start'),fab=document.getElementById('fab'),
    addBtn=document.getElementById('addBtn'),noteBtn=document.getElementById('noteBtn');
var dir=null,photosDir=null,data={title:'Corkboard',sections:[],photos:[],notes:[],labels:[],stickers:[],templates:[],pins:[],yarns:[],cur:null,sound:true,volume:.8,theme:'classic',dangle:true,custom:{color:'#7d9a8c',texture:'cork',strength:50,text:'auto',tabs:'auto',buttons:'auto'},style:{frame:'#fffdf8',pin:'#d6264f',notes:'classic',font:'auto',label:'tape'},wallpaper:null},
    cards={},files={},urls={},topZ=1,st=null,sound=true,volume=.8,ac=null,master=null;

function toast(m){document.querySelectorAll('.toast').forEach(function(t){t.remove()});var n=document.createElement('div');n.className='toast';n.setAttribute('role','status');n.textContent=m;document.body.appendChild(n);setTimeout(function(){n.classList.add('out')},3000);setTimeout(function(){n.remove()},3350)}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}

// ---- sound effects (synthesised in the browser, no audio files needed) ----
var REV_SEED=7;
var sfx=(function(){
  // Gentle, "physical" sounds built from filtered noise + soft resonances, with a small room reverb.
  // No audio files needed.
  var nb=null,rv=null;
  function C(){
    if(!ac){try{
      ac=new(window.AudioContext||window.webkitAudioContext)();master=ac.createGain();master.gain.value=volume;
      // transparent below ~-4 dB, gently rounds off peaks if many sounds stack up at once
      var sh=ac.createWaveShaper(),cv=new Float32Array(2049);
      for(var q=0;q<cv.length;q++){var xx=q/1024-1,ax=Math.abs(xx);cv[q]=(xx<0?-1:1)*(ax<.6?ax:.6+.4*Math.tanh((ax-.6)/.4))}
      sh.curve=cv;master.connect(sh);sh.connect(ac.destination);
      var r=ac.sampleRate,len=Math.floor(r*2),b=ac.createBuffer(1,len,r),d=b.getChannelData(0);
      for(var i=0;i<len;i++)d[i]=Math.random()*2-1;nb=b;
      var il=Math.floor(r*.8),ir=ac.createBuffer(2,il,r);
      // the same small "room" every time (seeded), so sounds don't change from one visit to the next
      var sd=REV_SEED;function rnd0(){sd|=0;sd=sd+0x6D2B79F5|0;var z=Math.imul(sd^sd>>>15,1|sd);z=z+Math.imul(z^z>>>7,61|z)^z;return((z^z>>>14)>>>0)/4294967296}
      for(var c=0;c<2;c++){var x=ir.getChannelData(c);for(var j=0;j<il;j++)x[j]=(rnd0()*2-1)*Math.pow(1-j/il,3.4)}
      rv=ac.createConvolver();rv.buffer=ir;var wet=ac.createGain();wet.gain.value=.5;rv.connect(wet);wet.connect(master);
    }catch(e){ac=null}}
    if(ac&&ac.state==='suspended'&&ac.resume)ac.resume().catch(function(){});return ac;
  }
  function out(a,g,send){g.connect(master);if(send&&rv){var s=a.createGain();s.gain.value=send;g.connect(s);s.connect(rv)}}
  function env(g,n,at,d,v){g.gain.value=0;g.gain.setValueAtTime(0,0);g.gain.setValueAtTime(.0001,n);g.gain.exponentialRampToValueAtTime(Math.max(.0002,v),n+at);g.gain.exponentialRampToValueAtTime(.0001,n+at+d)}
  // filtered noise burst: o={type,f,f2,q,v,a,rev}
  function nz(t,d,o){
    var a=C();if(!a||!sound||!nb)return;var n=a.currentTime+t,at=o.a||.002,s=a.createBufferSource(),fl=a.createBiquadFilter(),g=a.createGain();
    s.buffer=nb;fl.type=o.type||'bandpass';fl.Q.value=o.q==null?.8:o.q;
    fl.frequency.setValueAtTime(o.f,n);if(o.f2)fl.frequency.exponentialRampToValueAtTime(o.f2,n+at+d);
    env(g,n,at,d,o.v);s.connect(fl);fl.connect(g);out(a,g,o.rev);
    s.start(n,Math.random()*(nb.duration-at-d-.1),at+d+.06);
  }
  // soft resonance: o={f,f2,type,v,a,rev}
  function osc(t,d,o){
    var a=C();if(!a||!sound)return;var n=a.currentTime+t,at=o.a||.003,s=a.createOscillator(),g=a.createGain();
    s.type=o.type||'sine';s.frequency.setValueAtTime(o.f,n);if(o.f2)s.frequency.exponentialRampToValueAtTime(o.f2,n+at+d);
    env(g,n,at,d,o.v);s.connect(g);out(a,g,o.rev);s.start(n);s.stop(n+at+d+.06);
  }
  // music-box / glass bell: inharmonic partials that ring out naturally
  function bell(t,f,v,d){
    [[1,1,1],[2.756,.42,.6],[5.404,.18,.35],[8.933,.07,.2]].forEach(function(p){
      if(f*p[0]<12000)osc(t,d*p[2],{f:f*p[0],v:v*p[1],a:.003,rev:.3});
    });
    nz(t,.012,{type:'highpass',f:5000,q:.5,v:v*.25});
  }
  function knock(t,f,v){osc(t,.07,{f:f,f2:f*.82,v:v,a:.002,rev:.15});nz(t,.035,{type:'lowpass',f:1400,f2:500,q:.5,v:v*.9,rev:.1})}
  var rnd=function(a,b){return a+Math.random()*(b-a)};
  return{
    // photo/note lands on the cork, then the pin presses in
    land:function(t){t=t||0;
      nz(t,.1,{type:'lowpass',f:1000,f2:260,q:.4,v:.5,a:.0015,rev:.08});
      osc(t,.13,{f:105,f2:62,v:.22,a:.002});
      nz(t+.04,.028,{type:'bandpass',f:3300,q:1.3,v:.16,rev:.12});
      osc(t+.04,.06,{f:2100,f2:1800,v:.018,rev:.2});
    },
    // picking a card up: a soft paper rustle
    lift:function(){nz(0,.11,{type:'highpass',f:2600,q:.4,v:.06,a:.025});nz(0,.08,{type:'bandpass',f:1300,f2:2700,q:.9,v:.06,a:.015})},
    // putting it down: a muffled paper pat
    set:function(){nz(0,.07,{type:'lowpass',f:1500,f2:480,q:.4,v:.34,a:.0015,rev:.06});osc(0,.08,{f:125,f2:82,v:.12})},
    // sticky note peeled off the pad and patted down
    pop:function(){nz(0,.13,{type:'bandpass',f:800,f2:4200,q:1.3,v:.15,a:.05});nz(.15,.05,{type:'lowpass',f:1800,f2:700,q:.4,v:.36,rev:.08})},
    // switching sections: a soft wooden click
    tab:function(){nz(0,.022,{type:'bandpass',f:2300,q:1.8,v:.24,rev:.12});osc(0,.045,{f:640,f2:560,type:'triangle',v:.05,rev:.15})},
    // toggles and small buttons: a gentle tactile tick
    blip:function(){nz(0,.016,{type:'bandpass',f:3400,q:1.4,v:.15,rev:.1});osc(0,.03,{f:1250,f2:1100,v:.035,rev:.12})},
    // "are you sure?": two soft knocks
    warn:function(){knock(0,250,.12);knock(.1,230,.1)},
    // paper crumpled and tossed
    trash:function(){var t=0;for(var i=0;i<20;i++){t+=rnd(.01,.03);nz(t,rnd(.01,.03),{type:'bandpass',f:rnd(1400,5200),q:1.4,v:rnd(.08,.2)*(1-i/24),rev:.06})}
      nz(.16,.3,{type:'bandpass',f:2000,f2:350,q:.7,v:.07,a:.07,rev:.2})},
    // label tape pulled off the roll (a quick sticky crackle), then smoothed down
    tape:function(){var t=0;for(var i=0;i<9;i++){t+=rnd(.012,.022);nz(t,rnd(.008,.016),{type:'bandpass',f:rnd(2600,5200),q:2,v:rnd(.03,.06),rev:.05})}
      nz(0,.2,{type:'bandpass',f:1800,f2:4200,q:1.1,v:.05,a:.05});nz(.25,.06,{type:'lowpass',f:1700,f2:600,q:.4,v:.3,rev:.08});osc(.25,.07,{f:120,f2:80,v:.08})},
    // sticker peeled off its backing sheet and pressed on with a thumb
    peel:function(t){t=t||0;var u=t;for(var i=0;i<14;i++){u+=rnd(.008,.016);nz(u,rnd(.006,.012),{type:'highpass',f:rnd(3000,6000),q:.8,v:rnd(.025,.05)*(1-i/18)})}
      nz(t+.02,.18,{type:'bandpass',f:3000,f2:1400,q:.9,v:.035,a:.04});nz(t+.26,.05,{type:'lowpass',f:1500,f2:500,q:.4,v:.28,rev:.06});osc(t+.26,.06,{f:130,f2:90,v:.08})},
    // putting something on the shelf: a soft wooden knock
    shelf:function(){osc(0,.09,{f:210,f2:130,v:.13});nz(0,.06,{type:'lowpass',f:900,f2:300,q:.6,v:.25,rev:.06});osc(.07,.06,{f:160,f2:110,v:.06})},
    // a page turning: a quick airy paper swish
    flip:function(){nz(0,.16,{type:'bandpass',f:900,f2:3200,q:.9,v:.07,a:.05,rev:.1});nz(.1,.05,{type:'highpass',f:3500,q:.6,v:.035,rev:.08})},
    // ticking off a to-do: a quick pencil check mark
    tick:function(){nz(0,.035,{type:'bandpass',f:3800,f2:2600,q:1.2,v:.09,a:.004,rev:.05});nz(.05,.07,{type:'bandpass',f:2400,f2:4200,q:1.1,v:.1,a:.006,rev:.05})},
    // a tiny glint for the shiny sticker finish
    glint:function(){bell(0,2349,.035,.7);bell(.07,3136,.025,.6)},
    chime:function(){[784,988,1175,1568].forEach(function(f,i){bell(i*.085,f,.065,1.5)})},
    chime2:function(){bell(0,880,.09,1.2);bell(.11,1319,.08,1.4)},
    sample:function(){bell(0,988,.1,1.1)},
    // perf: set the sound engine up ahead of time (the first sound otherwise builds its buffers mid-drag)
    warm:function(){C()}
  };
})();
function applyVolume(){if(ac&&master)master.gain.setTargetAtTime(volume,ac.currentTime,.01)}


// ---- remember the chosen folder (just a shortcut; everything lives in the folder) ----
function idb(){return new Promise(function(res){try{var r=indexedDB.open('cork-folder',1);r.onupgradeneeded=function(){r.result.createObjectStore('h')};r.onsuccess=function(){res(r.result)};r.onerror=function(){res(null)}}catch(e){res(null)}})}
// DESKTOP: the app keeps its recent boards in its own config (main process), not in IndexedDB
async function rememberHandle(h){if(window.corkNative){try{await window.corkNative.opened(window.__corkShim.rootOf(h))}catch(e){}return}var d=await idb();if(d)try{d.transaction('h','readwrite').objectStore('h').put(h,'dir')}catch(e){}}
async function recallHandle(){var d=await idb();if(!d)return null;return new Promise(function(res){try{var q=d.transaction('h').objectStore('h').get('dir');q.onsuccess=function(){res(q.result||null)};q.onerror=function(){res(null)}}catch(e){res(null)}})}

// ---- saving ----
function save(){clearTimeout(st);st=setTimeout(flush,300)}
async function flush(){
  try{var f=await dir.getFileHandle('board.json',{create:true}),w=await f.createWritable();await w.write(JSON.stringify(data,null,1));await w.close()}
  catch(e){toast('Couldn\u2019t save \u2014 is the folder still there?')}
}
function fit(){var h=200;for(var id in cards){var e=cards[id];h=Math.max(h,e.offsetTop+e.offsetHeight+60)}if(h>Z_ORG)h=Z_ORG+(h-Z_ORG)*ZM;board.style.minHeight=Math.max(window.innerHeight,h+120)+'px';if(typeof yarnFor==='function'&&ySvg)yarnFor(450)}
function sparkle(btn){sfx.chime();
  var tb=btn||addBtn;if(!tb.offsetParent)tb=document.getElementById('addMain');var r=tb.getBoundingClientRect(),s=['\u2726','\u2727','\u2736'];
  for(var i=0;i<9;i++){var h=document.createElement('div');h.className='spark';h.textContent=s[i%3];
    h.style.left=(r.left+r.width/2+Math.random()*90-45)+'px';h.style.top=r.top+'px';
    h.style.setProperty('--dx',(Math.random()*140-70)+'px');h.style.animationDelay=(i*90)+'ms';
    document.body.appendChild(h);(function(x){setTimeout(function(){x.remove()},2600)})(h)}
}

// ---- shared card behaviour ----
function place(el,p){
  var W=board.clientWidth;
  el.style.left=clampX(p.x*W)+'px';el.style.top=p.y+'px';
  el.style.setProperty('--r',p.rot+'deg');el.style.animationDelay=Math.min(Object.keys(cards).length*70,700)+'ms';
  el.style.zIndex=p.z||1;topZ=Math.max(topZ,p.z||1);if(p.sc&&p.sc!==1)el.style.setProperty('--sc',p.sc);
  if(p.hs&&p.hs!==1)el.style.setProperty('--hs',p.hs); // v1.7: longer or shorter
}
function armDel(btn,label,run){
  btn.addEventListener('click',function(e){
    e.stopPropagation();var old=btn.innerHTML;
    if(!btn.classList.contains('armed')){sfx.warn();btn.classList.add('armed');btn.textContent=label;setTimeout(function(){btn.classList.remove('armed');btn.innerHTML=old},2500);return}
    sfx.trash();run();
  });
}
function draggable(el,p,onTap,hk){
  var sx,sy,ox,oy,mv=false,downT=null;
  // polaroids (the ones with a pin) swing like a pendulum around the pin while held and after letting go
  var dg=0,vel=0,raf=0,lastT=0,px=0,ppx=0,svx=0,ph=0;
  function paint(){el.style.transform=dg===0?'':'translateY('+(-ph)+'px) rotate('+dg.toFixed(2)+'deg) translateY('+ph+'px)'}
  function tick(t){
    var dt=Math.min(.033,Math.max(.001,(t-lastT)/1000));lastT=t;
    var holding=el.classList.contains('drag');
    svx+=(((px-ppx)/dt)-svx)*.25;ppx=px;
    var lean=holding?Math.max(-30,Math.min(30,svx*.02)):0;
    vel+=(-80*(dg-lean)-6*vel)*dt;dg+=vel*dt;dg=Math.max(-45,Math.min(45,dg));
    // card buttons stay hidden until the swing has (nearly) stopped, so they never move under the pointer
    if(!holding&&Math.abs(dg)<.6&&Math.abs(vel)<6)el.classList.remove('swing');
    if(!holding&&Math.abs(dg)<.05&&Math.abs(vel)<.6){dg=0;vel=0;paint();raf=0;el.classList.remove('swing');return}
    paint();raf=requestAnimationFrame(tick);
  }
  function startSwing(e){
    if(!hasHoldPin(p)||!hasRealPin(p)||data.dangle===false)return; // v2.0: only while it still has a pin
    ph=el.offsetHeight/2;px=ppx=e.clientX;svx=0;
    vel+=(Math.random()<.5?-1:1)*(90+Math.random()*50);el.classList.add('swing');
    if(!raf){lastT=performance.now();raf=requestAnimationFrame(tick)}
  }
  var grp=[];
  el.addEventListener('pointerdown',function(e){
    if(e.target.closest('button,input,textarea,select')||e.target.isContentEditable)return;
    // Shift / Ctrl / Cmd + click picks several cards; dragging one of them then moves them all
    if(e.shiftKey||e.ctrlKey||e.metaKey){e.preventDefault();toggleSel(el);return}
    if(!sel.has(el))clearSel();
    grp=[];sel.forEach(function(o){if(o!==el&&o.isConnected&&o._p){o._p.z=++topZ;o.style.zIndex=o._p.z;grp.push([o,o.offsetLeft,o.offsetTop])}});
    downT=e.target;el.setPointerCapture(e.pointerId);sx=e.clientX;sy=e.clientY;ox=el.offsetLeft;oy=el.offsetTop;
    mv=false;sfx.lift();el.classList.add('drag');p.z=++topZ;el.style.zIndex=p.z;startSwing(e);
  });
  el.addEventListener('pointermove',function(e){
    if(!el.classList.contains('drag'))return;
    px=e.clientX;
    if(!mv&&Math.abs(e.clientX-sx)+Math.abs(e.clientY-sy)>5){mv=true;document.body.classList.add('cbdrag');if(hk&&hk.start)hk.start()}
    if(mv)shelfHot(e.clientX,e.clientY);
    var dx=(e.clientX-sx)/ZM,dy=(e.clientY-sy)/ZM;
    grp.forEach(function(g){g[0].style.left=(g[1]+dx)+'px';g[0].style.top=Math.max(0,g[2]+dy)+'px'});yarnSoon();
    el.style.left=clampX(ox+(e.clientX-sx)/ZM,60)+'px';yarnSoon();
    el.style.top=Math.max(0,oy+(e.clientY-sy)/ZM)+'px';
  });
  function end(e){if(!el.classList.contains('drag'))return;el.classList.remove('drag');
    var onShelf=mv&&e&&e.type==='pointerup'&&overShelf(e.clientX,e.clientY);document.body.classList.remove('cbdrag');shelfHot();
    if(!mv&&onTap&&e&&e.type==='pointerup'){onTap(downT);return}
    if(!mv)return;
    // dropped on the shelf: put this card (and any others she picked) on the shelf
    if(onShelf){toShelf([p].concat(grp.map(function(g){return g[0]._p})));grp=[];return}
    sfx.set();var W=board.clientWidth;p.x=el.offsetLeft/W;p.y=el.offsetTop;
    grp.forEach(function(g){g[0]._p.x=g[0].offsetLeft/W;g[0]._p.y=g[0].offsetTop});grp=[];
    save();fit();if(hk&&hk.drop)hk.drop()}
  el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
}
function resizable(el,p){
  var h=el.querySelector('.rz'),sx,sy,w0,h0,s0;
  h.addEventListener('pointerdown',function(e){
    e.stopPropagation();h.setPointerCapture(e.pointerId);sx=e.clientX;sy=e.clientY;w0=el.offsetWidth;h0=el.offsetHeight;s0=p.sc||1;el.classList.add('rsz');
  });
  h.addEventListener('pointermove',function(e){
    if(!el.classList.contains('rsz'))return;
    var d=((e.clientX-sx)+(e.clientY-sy)*(w0/h0))/2/ZM;yarnSoon();
    p.sc=Math.round(Math.max(.5,Math.min(4,s0*(w0+d)/w0))*100)/100;el.style.setProperty('--sc',p.sc);
  });
  function end(){if(!el.classList.contains('rsz'))return;el.classList.remove('rsz');sfx.set();save();fit()}
  h.addEventListener('pointerup',end);h.addEventListener('pointercancel',end);
  h.addEventListener('dblclick',function(e){e.stopPropagation();p.sc=1;el.style.removeProperty('--sc');sfx.blip();save();fit()});
}
function keepIn(el){var x=clampX(el.offsetLeft,el.offsetWidth+6);if(x!==el.offsetLeft)el.style.left=x+'px'}
function pinUp(el,p){layer.appendChild(el);cards[p.id]=el;el._p=p;keepIn(el);shown()}
function shown(){empty.style.display=Object.keys(cards).length?'none':''}
function bye(el,id,after){delete cards[id];el.classList.add('bye');yarnFor(450);setTimeout(function(){el.remove();if(after)after();shown();fit();yarnClean()},430)}

// ---- one icon set for every card button, so they all render the same everywhere ----
var IC=(function(){function sv(d){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+d+'</svg>'}
  return{x:sv('<path d="M7 7l10 10M17 7 7 17"/>'),crop:sv('<path d="M7 3v14h14M3 7h14v14"/>'),rz:sv('<path d="M20 7 7 20M20 12.5 12.5 20M20 18l-2 2"/>'),
    fx:sv('<circle cx="12" cy="12" r="7.5"/><path d="M12 4.5a7.5 7.5 0 0 0 0 15z" fill="currentColor"/>'),
    font:sv('<path d="M3 19 8.5 5h1L15 19M5.2 14.5h7.6"/><circle cx="18.6" cy="16.2" r="2.6"/><path d="M21.2 12.6V19"/>'),
    frame:sv('<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M8 6h8v8H8z"/>'),
    vplay:sv('<path d="M8 5.5v13l10.5-6.5z"/>'),
    vpause:sv('<path d="M8 5.5v13M16 5.5v13"/>'),
    vopt:sv('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>'),
    callook:sv('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2"/>'),
    tag:sv('<path d="M3.5 12 8 6.5h12.5v11H8z"/><circle cx="9.2" cy="12" r="1.3"/>'),
    shine:sv('<path d="M11 3.5l1.7 4.8 4.8 1.7-4.8 1.7L11 16.5l-1.7-4.8L4.5 10l4.8-1.7z"/><path d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'),
    cycle:sv('<path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5"/><path d="M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5"/>'),
    spread:sv('<rect x="2.5" y="7" width="7" height="10" rx="1"/><rect x="14.5" y="7" width="7" height="10" rx="1"/><path d="M12 9v6"/>'),
    move:sv('<path d="M12 3v18M3 12h18M12 3 9.5 5.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5"/>'),
    tpl:sv('<rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><path d="M17 14v6M14 17h6"/>'),
    link:sv('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>'),
    prev:sv('<path d="M14.5 6 8.5 12l6 6"/>'),next:sv('<path d="M9.5 6l6 6-6 6"/>'),
    rot:sv('<path d="M19.5 12.5a7.5 7.5 0 1 1-2.2-5.8"/><path d="M19.5 3.5v4.5H15"/>'),
    gather:sv('<rect x="6" y="9" width="12" height="11" rx="1.2"/><path d="M8.5 6h7M10.5 3h3"/>')}})();
// ---- photo files: polaroids/videos have one file, photobooth strips have four ----
function pFiles(p){return p.kind==='strip'?(p.files||[]):[p.file]}
function fileKey(p,i){return p.kind==='strip'?p.id+'#'+i:p.id}
function mediaUrl(k){if(urls[k])return urls[k];if(!files[k])return '';return(urls[k]=URL.createObjectURL(files[k]))}
// DESKTOP: a JPEG made from an iPhone HEIC photo keeps the original next to it (same name, .heic); it goes with the JPEG
function heicGone(n){if(window.corkNative&&/\.jpg$/i.test(n))['.heic','.heif'].forEach(function(x){photosDir.removeEntry(n.replace(/\.jpg$/i,x)).catch(function(){})})}
// a file is only deleted when nothing else uses it (the sticker library or another card)
function dropFiles(p){pFiles(p).forEach(function(n,i){if(n&&!fileUsed(n)){photosDir.removeEntry(n).catch(function(){});dropThumbs(n);heicGone(n)}delete files[fileKey(p,i)]})}
function dropUrls(p){pFiles(p).forEach(function(n,i){var k=fileKey(p,i);if(urls[k]){URL.revokeObjectURL(urls[k]);delete urls[k]}})}

// ---- v1.5.1: display copies. Cards show a smaller copy of each photo (made once, kept in thumbs/), never the full-size
// original, so big camera photos don't have to be decoded and filtered at full size on every frame. Originals stay untouched in photos/.
var TH_SM=640,TH_LG=1600,TH_WALL=2560,thDir=null,thMem={},thJobs={},thQ=[],thRun=0;
function thName(name,px){return String(name).replace(/[^\w.-]/g,'_')+'@'+px+'.webp'}
function thumbable(name,f){return !!f&&!/\.(gif|svg)$/i.test(name||'')&&!/gif|svg/.test(f.type||'')}
// a small queue, so many big photos never decode all at once
function thQueue(fn){return new Promise(function(res){thQ.push([fn,res]);thPump()})}
function thPump(){while(thRun<2&&thQ.length){var j=thQ.shift();thRun++;j[0]().then(j[1],function(){j[1](null)}).then(function(){thRun--;thPump()})}}
// DESKTOP: the whole job (decode, shrink, encode) runs in a worker; same output. Falls back to the code below.
var thW=null,thWid=0,thWcb={};
function thWorker(){
  if(thW===null){try{thW=new Worker('desktop/thumb-worker.js');
    thW.onmessage=function(e){var c=thWcb[e.data.id];delete thWcb[e.data.id];if(c)c(e.data)};
    thW.onerror=function(){thW=false;var cb=thWcb;thWcb={};for(var k in cb)cb[k]({err:'worker failed'})}}catch(e){thW=false}}
  return thW||null;
}
async function makeThumb(f,px){
  var w=window.corkNative&&thWorker();if(!w)return makeThumbMain(f,px);
  return new Promise(function(res,rej){var id=++thWid;thWcb[id]=function(d){if(d.err)rej(new Error(d.err));else res(d.blob)};w.postMessage({id:id,f:f,px:px})});
}
// decode (off the main thread), shrink to px wide, encode as WebP; null if the photo is already small
async function makeThumbMain(f,px){
  var b=await createImageBitmap(f);
  try{
    var long=Math.max(b.width,b.height);if(long<=px*1.15)return null;
    var sc=px/long,w=Math.max(1,Math.round(b.width*sc)),h=Math.max(1,Math.round(b.height*sc));
    var r=await createImageBitmap(b,{resizeWidth:w,resizeHeight:h,resizeQuality:'high'});
    var c=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):Object.assign(document.createElement('canvas'),{width:w,height:h});
    c.getContext('2d').drawImage(r,0,0);r.close&&r.close();
    return c.convertToBlob?await c.convertToBlob({type:'image/webp',quality:.86}):await new Promise(function(res){c.toBlob(res,'image/webp',.86)});
  }finally{b.close&&b.close()}
}
// URL of a display copy (px on the long edge), or null to mean "use the original"
function thumbOf(name,f,px){
  if(!thumbable(name,f))return Promise.resolve(null);
  var key=name+'@'+px;if(key in thMem)return Promise.resolve(thMem[key]);
  if(thJobs[key])return thJobs[key];
  return thJobs[key]=(async function(){
    try{if(thDir){var cf=await(await thDir.getFileHandle(thName(name,px))).getFile();if(cf.size)return thMem[key]=URL.createObjectURL(cf)}}catch(e){}
    var blob=await thQueue(function(){return makeThumb(f,px)});
    if(!blob)return thMem[key]=null;
    thMem[key]=URL.createObjectURL(blob);
    if(thDir)(async function(){try{var w=await(await thDir.getFileHandle(thName(name,px),{create:true})).createWritable();await w.write(blob);await w.close()}catch(e){}})();
    return thMem[key];
  })().catch(function(){return null}).finally(function(){delete thJobs[key]});
}
function dropThumbs(name){[TH_SM,TH_LG,TH_WALL].forEach(function(px){var k=name+'@'+px;if(thMem[k])URL.revokeObjectURL(thMem[k]);delete thMem[k];if(thDir)thDir.removeEntry(thName(name,px)).catch(function(){})})}
// show a card image from its display copy, picking a bigger copy if the card is made bigger
var thRO=window.ResizeObserver?new ResizeObserver(function(es){es.forEach(function(e){var im=e.target;if(im._th)im._th()})}):null;
function bindImg(im,key,name,srcAr){
  im.decoding='sync';var tier=0; // app fix: decode before drawing, so a redrawn card never flashes its placeholder
  function need(){var w=im.clientWidth||200,h=im.clientHeight||w,da=w/h,sa=srcAr||da;return Math.max(w,h)*Math.min(2.5,window.devicePixelRatio||1)*Math.max(1,sa>da?sa/da:da/sa)}
  function pick(){
    var n=need(),t=n>TH_LG*1.1?-1:n>TH_SM*1.1?TH_LG:TH_SM;
    if(tier===-1||(tier&&t!==-1&&t<=tier))return;tier=t;
    if(t===-1){im.src=mediaUrl(key);return}
    thumbOf(name,files[key],t).then(function(u){if(tier===t&&im.isConnected!==false)im.src=u||mediaUrl(key)});
  }
  im._th=function(){if(im.isConnected)pick()};pick();if(thRO)thRO.observe(im);
}
// a small preview URL for dialogs, the shelf and the sticker drawer
function smallUrl(key,name){return thumbOf(name,files[key],TH_SM).then(function(u){return u||mediaUrl(key)})}

// ---- filters: stored as numbers in board.json, shown with CSS filters + overlay layers (originals untouched) ----
var FX_PRESETS=[
  {id:'none',name:'Original'},
  {id:'golden',name:'Golden',w:45,s:15,b:4},
  {id:'vivid',name:'Vivid',s:45,c:18},
  {id:'cool',name:'Cool',w:-45,b:3,c:4},
  {id:'film',name:'Faded film',fd:45,c:-10,s:-15,w:10,g:30},
  {id:'vintage',name:'Vintage',w:30,fd:30,s:-25,v:40,g:25},
  {id:'dreamy',name:'Dreamy',b:10,fd:25,s:-10,w:15,c:-15},
  {id:'bw',name:'B&W',mono:'bw',c:15},
  {id:'noir',name:'Noir',mono:'bw',c:45,b:-5,v:45,g:20},
  {id:'sepia',name:'Sepia',mono:'sepia',c:5,fd:10}
];
var FX_SL=[{k:'b',n:'Brightness',min:-100},{k:'c',n:'Contrast',min:-100},{k:'s',n:'Saturation',min:-100},{k:'w',n:'Warmth',min:-100},{k:'fd',n:'Fade',min:0},{k:'v',n:'Vignette',min:0},{k:'g',n:'Grain',min:0}];
function fxFrom(id){
  var P=FX_PRESETS.filter(function(x){return x.id===id})[0]||FX_PRESETS[0],f={p:P.id,mono:P.mono||''};
  FX_SL.forEach(function(S){f[S.k]=P[S.k]||0});return f;
}
function fxClean(f){
  if(!f||typeof f!=='object')return null;
  var o={p:typeof f.p==='string'?f.p.slice(0,20):'custom',mono:f.mono==='bw'||f.mono==='sepia'?f.mono:''},any=!!o.mono;
  FX_SL.forEach(function(S){var v=Math.round(+f[S.k]||0);v=Math.max(S.min,Math.min(100,v));o[S.k]=v;if(v)any=true});
  return any?o:null;
}
function fxCss(f){
  if(!f)return '';var b=f.b/100,c=f.c/100,s=f.s/100,fd=f.fd/100,a=[];
  if(f.mono==='bw')a.push('grayscale(1)');else if(f.mono==='sepia')a.push('sepia(.85)');
  a.push('brightness('+(1+b*.45+fd*.06).toFixed(3)+')');
  a.push('contrast('+Math.max(.2,1+c*.6-fd*.22).toFixed(3)+')');
  if(f.mono!=='bw')a.push('saturate('+Math.max(0,1+(s>0?s:s*.95)).toFixed(3)+')');
  return a.join(' ');
}
function fxLayers(){return '<i class="fxl w"></i><i class="fxl f"></i><i class="fxl v"></i><i class="fxl g"></i>'}
function applyFx(wrap,f){
  var m=wrap.querySelector('img,video');if(m)m.style.filter=fxCss(f);
  var L=wrap.querySelectorAll('.fxl');if(L.length<4)return;
  var w=f?f.w/100:0;
  L[0].style.background=w>=0?'#ff9636':'#3a86ff';L[0].style.opacity=(Math.abs(w)*.6).toFixed(3);
  L[1].style.opacity=f?(f.fd/100*.85).toFixed(3):0;L[2].style.opacity=f?(f.v/100).toFixed(3):0;L[3].style.opacity=f?(f.g/100*.55).toFixed(3):0;
}
function cardFx(el,p){el.querySelectorAll('.fxm').forEach(function(w){applyFx(w,p.f||null)})}
// a still frame of a video, used as the filter preview
function videoStill(url){return new Promise(function(res){
  var v=document.createElement('video'),done=false,t=setTimeout(function(){fin('')},4000);
  function fin(u){if(done)return;done=true;clearTimeout(t);v.removeAttribute('src');v.load();res(u)}
  v.muted=true;v.preload='auto';
  if(/^cork-file:/.test(url))v.crossOrigin='anonymous'; // DESKTOP: streamed videos need CORS so the still can be drawn
  v.onloadeddata=function(){try{v.currentTime=Math.min(.3,(v.duration||1)/2)}catch(e){fin('')}};
  v.onseeked=function(){try{var w=Math.min(480,v.videoWidth||480),h=Math.round(w*(v.videoHeight||270)/(v.videoWidth||480)),c=document.createElement('canvas');
    c.width=w;c.height=h;c.getContext('2d').drawImage(v,0,0,w,h);fin(c.toDataURL('image/jpeg',.85))}catch(e){fin('')}};
  v.onerror=function(){fin('')};v.src=url;
})}
var BLANK="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='120'%3E%3Crect width='160' height='120' fill='%23777'/%3E%3C/svg%3E";
var fxEl=document.getElementById('fx');
// o: {title, sub, srcs:[urls], strip, f, ok, onLive(f)} -> resolves to a clean filter (or null = none), or undefined if cancelled
function openFx(o){return new Promise(function(res){
  var prevF=document.activeElement,f=fxClean(o.f)||fxFrom('none'),srcs=o.srcs;
  function setSrc(im,u){im.decoding='async';if(u&&u.then){im.src=BLANK;u.then(function(x){im.src=x||BLANK})}else im.src=u||BLANK}
  document.getElementById('fxT').textContent=o.title||'Filters';
  if(o.sub)document.getElementById('fxSub').textContent=o.sub;
  document.getElementById('fxOk').textContent=o.ok||'Apply';
  var pv=document.getElementById('fxPv'),ps=document.getElementById('fxPs'),sl=document.getElementById('fxSl'),wraps=[],ins={},pbtn=[];
  pv.innerHTML='';pv.className='fxpv'+(o.strip?' st':'');
  srcs.slice(0,o.strip?4:1).forEach(function(u){var w=document.createElement('div');w.className='fxm';w.innerHTML='<img alt="">'+fxLayers();setSrc(w.querySelector('img'),u);pv.appendChild(w);wraps.push(w)});
  ps.innerHTML='';
  FX_PRESETS.forEach(function(P){
    var b=document.createElement('button');b.type='button';b.className='fxp';b.setAttribute('role','radio');
    var w=document.createElement('span');w.className='fxm';w.innerHTML='<img alt="">'+fxLayers();setSrc(w.querySelector('img'),srcs[0]);applyFx(w,fxClean(fxFrom(P.id)));
    var n=document.createElement('span');n.textContent=P.name;b.appendChild(w);b.appendChild(n);
    b.addEventListener('click',function(){f=fxFrom(P.id);sfx.blip();sync()});
    ps.appendChild(b);pbtn.push([P.id,b]);
  });
  sl.innerHTML='';
  FX_SL.forEach(function(S){
    var row=document.createElement('label');row.className='fxr';
    var nm=document.createElement('span');nm.textContent=S.n;
    var r=document.createElement('input');r.type='range';r.min=S.min;r.max=100;r.step=1;r.setAttribute('aria-label',S.n);
    var out=document.createElement('output');
    r.addEventListener('input',function(){f[S.k]=+r.value;show(S);live()});
    r.addEventListener('dblclick',function(){f[S.k]=0;r.value=0;show(S);live()});
    row.appendChild(nm);row.appendChild(r);row.appendChild(out);sl.appendChild(row);ins[S.k]={r:r,o:out};
  });
  function show(S){var v=f[S.k];ins[S.k].o.textContent=(S.min<0&&v>0?'+':'')+v}
  function live(){var c=fxClean(f);wraps.forEach(function(w){applyFx(w,c)});pbtn.forEach(function(x){var on=x[0]===(c?f.p:'none');x[1].classList.toggle('on',on);x[1].setAttribute('aria-checked',on?'true':'false')});if(o.onLive)o.onLive(c)}
  function sync(){FX_SL.forEach(function(S){ins[S.k].r.value=f[S.k];show(S)});live()}
  sync();
  var okB=document.getElementById('fxOk'),noB=document.getElementById('fxNo'),rsB=document.getElementById('fxReset'),downBg=false;
  function done(v){fxEl.style.display='none';if(prevF&&prevF.focus&&document.contains(prevF))prevF.focus({preventScroll:true});okB.onclick=noB.onclick=rsB.onclick=null;fxEl.removeEventListener('pointerdown',pd);fxEl.removeEventListener('click',ck);document.removeEventListener('keydown',k,true);res(v)}
  function pd(e){downBg=e.target===fxEl}
  function ck(e){if(e.target===fxEl&&downBg)done(undefined)}
  function k(e){if(e.key==='Escape'){e.stopPropagation();done(undefined)}}
  okB.onclick=function(){sfx.blip();done(fxClean(f))};
  noB.onclick=function(){done(undefined)};
  rsB.onclick=function(){f=fxFrom('none');sfx.blip();sync()};
  fxEl.addEventListener('pointerdown',pd);fxEl.addEventListener('click',ck);document.addEventListener('keydown',k,true);
  fxEl.style.display='flex';fxEl.firstElementChild.scrollTop=0;sfx.blip();okB.focus();
})}
// filter button on a card: live preview on the card itself, Cancel puts it back
async function editFx(el,p,srcs,strip){
  var before=p.f?JSON.parse(JSON.stringify(p.f)):null;
  var r=await openFx({title:'Filters',sub:'Your original stays untouched. Pick a look, then fine-tune it.',srcs:srcs,strip:strip,f:before,ok:'Apply',
    onLive:function(c){p.f=c;cardFx(el,p)}});
  p.f=r===undefined?before:r;if(!p.f)delete p.f;cardFx(el,p);if(r!==undefined)save();
}
var FX_BTN='<button class="cb fx" title="Filters" aria-label="Filters">'+IC.fx+'</button>';

// ---- photo shape: square polaroid crop or original ratio ----
function applyMode(el,img,p){
  var orig=p.mode==='original'&&p.ar,ar=orig?Math.max(.5,Math.min(2.2,p.ar)):1;
  img.style.aspectRatio=String(ar);img.parentNode.style.setProperty('--ar',String(ar));
  var f=ar>1?Math.min(1.35,Math.sqrt(ar)):1;
  if(f===1)el.style.removeProperty('--bw');else el.style.setProperty('--bw','calc(clamp(150px,40vw,220px) * '+f+')');
}
// ---- v1.1.6: frameless photos (no polaroid frame, just a shadow and a pin or two pieces of tape) ----
function applyFrame(el,p){
  var bare=!!p.bare,tape=bare&&p.hold==='tape',pin=el.querySelector(':scope>.pin');
  el.classList.toggle('bare',bare);
  if(!tape&&!pin){pin=document.createElement('div');pin.className='pin';el.insertBefore(pin,el.firstChild)}
  if(tape&&pin)pin.remove();
  var tp=el.querySelectorAll(':scope>.tape');
  if(tape&&!tp.length)['tl','tr'].forEach(function(c){var t=document.createElement('div');t.className='tape '+c;el.appendChild(t)});
  if(!tape)tp.forEach(function(t){t.remove()});
  var b=el.querySelector('.frm');if(b){var tt=!bare?'Polaroid frame (click for no frame)':tape?'No frame, taped (click for polaroid frame)':'No frame, pinned (click for tape)';b.title=tt;b.setAttribute('aria-label',tt)}
}
async function measure(f){try{var b=await createImageBitmap(f),r=b.width/b.height;if(b.close)b.close();return Math.round(r*1000)/1000}catch(e){return 1}}
var askEl=document.getElementById('ask');
function askMode(n){return new Promise(function(res){
  document.getElementById('askT').textContent=n===1?'How should this photo look?':'How should these '+n+' photos look?';
  var sb=document.getElementById('optStrip'),okStrip=n>0&&n%4===0;sb.disabled=!okStrip;
  document.getElementById('optStripN').textContent=okStrip?(n===4?'4 photos in one strip':(n/4)+' strips of 4'):'pick 4, 8, 12… photos';
  askEl.style.display='flex';var fo=askEl.querySelector('.opt:not(:disabled)');if(fo)fo.focus();
  function done(v){askEl.style.display='none';askEl.removeEventListener('click',h);document.removeEventListener('keydown',k);res(v)}
  function h(e){var o=e.target.closest('.opt');if(o){if(!o.disabled)done(o.dataset.m);return}if(e.target===askEl||e.target.id==='askNo')done(null)}
  function k(e){if(e.key==='Escape')done(null)}
  askEl.addEventListener('click',h);document.addEventListener('keydown',k);sfx.blip();
})}

// ---- videos: one cut-out piece of film strip ----
function isVid(f){return /^video\//.test(f.type)||/\.(mp4|m4v|mov|webm|ogv|mkv)$/i.test(f.name)}
function measureVideo(f){return new Promise(function(res){
  var v=document.createElement('video'),u=URL.createObjectURL(f),t=setTimeout(function(){fin()},4000);
  function fin(r){clearTimeout(t);URL.revokeObjectURL(u);v.removeAttribute('src');res(r||16/9)}
  v.preload='metadata';v.muted=true;
  v.onloadedmetadata=function(){fin(v.videoWidth&&v.videoHeight?Math.round(v.videoWidth/v.videoHeight*1000)/1000:16/9)};
  v.onerror=function(){fin()};v.src=u;
})}
var lb=document.getElementById('lb'),lbv=lb.querySelector('video');
var lbPrev=null;
function openLB(url,f){sfx.pop();lbPrev=document.activeElement;lbv.src=url;applyFx(lb.querySelector('.lbm'),f||null);lb.style.display='flex';document.getElementById('lbX').focus();lbv.play().catch(function(){})}
function closeLB(){lbv.pause();lbv.removeAttribute('src');lbv.load();lb.style.display='none';if(lbPrev&&document.contains(lbPrev))lbPrev.focus({preventScroll:true});lbPrev=null}
lb.addEventListener('click',function(e){if(e.target===lb||e.target.id==='lbX')closeLB()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&lb.style.display==='flex')closeLB()});
function renderVideo(p){
  var el=document.createElement('div');el.className='card film';el.tabIndex=0;place(el,p);
  el.style.setProperty('--far',Math.max(.75,Math.min(2,p.ar||1.78)));
  var url=mediaUrl(p.id);
  el.innerHTML=FX_BTN+'<button class="cb vplay" title="Play" aria-label="Play">'+IC.vplay+'</button><button class="cb vopt" title="Playback and sound" aria-label="Playback and sound">'+IC.vopt+'</button><button class="cb del" title="Remove" aria-label="Remove">'+IC.x+'</button><button class="cb rz" title="Drag to resize (double-click to reset)" aria-label="Resize">'+IC.rz+'</button><div class="holes"></div><div class="reel"><div class="frame fxm"><video muted loop playsinline preload="metadata" src="'+url+'#t=0.1"></video>'+fxLayers()+'<span class="play">▶</span><span class="dur"></span></div></div><input maxlength="40" placeholder="add a caption"><div class="holes"></div>';
  resizable(el,p);cardFx(el,p);
  var v=el.querySelector('video'),inp=el.querySelector('input');inp.value=p.caption||'';
  inp.addEventListener('input',function(){p.caption=inp.value;save()});
  v.addEventListener('loadedmetadata',function(){var t=Math.round(v.duration||0);el.querySelector('.dur').textContent=Math.floor(t/60)+':'+('0'+t%60).slice(-2)});
  v.addEventListener('error',function(){el.querySelector('.frame').classList.add('bad')});
  // v2.0: how it plays (Settings → Videos, or this video's own choice: p.play, p.snd): always, while pointed at, or only
  // when its play button is pressed; with or without sound
  var pb=el.querySelector('.vplay');
  function mode(){return VPLAY.indexOf(p.play)>=0?p.play:vidSet().play}
  function sound(){return typeof p.snd==='boolean'?p.snd:vidSet().sound}
  function playing(on){
    if(on){v.muted=!sound();v.play().then(function(){el.classList.add('playing')}).catch(function(){})}else{v.pause();el.classList.remove('playing')}
    var t=on?'Pause':'Play';pb.innerHTML=on?IC.vpause:IC.vplay;pb.title=t;pb.setAttribute('aria-label',t);
  }
  el._vapply=function(){playing(mode()==='always');el.dataset.vm=mode()};
  el.addEventListener('mouseenter',function(){if(mode()==='hover'&&!el.classList.contains('drag'))playing(true)});
  el.addEventListener('mouseleave',function(){if(mode()==='hover')playing(false)});
  pb.addEventListener('click',function(e){e.stopPropagation();playing(v.paused);sfx.blip()});
  el.querySelector('.vopt').addEventListener('click',function(e){e.stopPropagation();var b=this;openPop(b,function(box,close){
    function group(title,items,cur,pick){var h=document.createElement('h4');h.textContent=title;box.appendChild(h);
      items.forEach(function(it){var q=document.createElement('button');q.type='button';q.className='pi'+(it[0]===cur?' on':'');q.setAttribute('aria-pressed',it[0]===cur?'true':'false');
        var t=document.createElement('span');t.textContent=it[1];q.appendChild(t);q.addEventListener('click',function(){close();pick(it[0]);save();sfx.blip();el._vapply()});box.appendChild(q)})}
    group('Plays',[['',  'Same as Settings'],['always','Always'],['hover','When you point at it'],['click','Only when you press play']],VPLAY.indexOf(p.play)>=0?p.play:'',function(id){if(id)p.play=id;else delete p.play});
    group('Sound',[['','Same as Settings'],['on','On'],['off','Off']],typeof p.snd==='boolean'?(p.snd?'on':'off'):'',function(id){if(id)p.snd=id==='on';else delete p.snd});
  })});
  el.querySelector('.fx').addEventListener('click',async function(e){e.stopPropagation();v.pause();el.classList.remove('playing');editFx(el,p,[await videoStill(url)],false)});
  armDel(el.querySelector('.del'),'Remove?',function(){
    data.photos=data.photos.filter(function(q){return q.id!==p.id});
    dropFiles(p);save();bye(el,p.id,function(){dropUrls(p)});
  });
  draggable(el,p,function(){playing(false);openLB(url,p.f)});
  pinUp(el,p);el._vapply();
}
// v2.0: Settings → Videos (data.video: {play: 'always' | 'hover' | 'click', sound: true}; the defaults are left out)
var VPLAY=['always','hover','click'];
function vidSet(){var o=data.video||{};return{play:VPLAY.indexOf(o.play)>=0?o.play:'hover',sound:o.sound===true}}
function cleanVideo(){var o=vidSet(),c={};if(o.play!=='hover')c.play=o.play;if(o.sound)c.sound=true;if(Object.keys(c).length)data.video=c;else delete data.video;
  data.photos.forEach(function(p){if(p.kind!=='video')return;if(VPLAY.indexOf(p.play)<0)delete p.play;if(typeof p.snd!=='boolean')delete p.snd})}
function videosApply(){document.querySelectorAll('#layer .card.film').forEach(function(e){if(e._vapply)e._vapply()})}

// ---- photobooth strips: four photos stacked in one strip ----
function renderStrip(p){
  if(holdPin(p)){save();yarnFor(900)} // v2.0
  var el=document.createElement('div');el.className='card strip';el.tabIndex=0;place(el,p);
  var fr='';for(var i=0;i<4;i++)fr+='<div class="sf fxm"><img alt="" decoding="async">'+fxLayers()+'</div>';
  el.innerHTML='<div class="pin"></div><div class="ph"><div class="sframes">'+fr+'</div>'+FX_BTN+FONT_BTN+PILE_BTNS+'<button class="cb del" title="Remove" aria-label="Remove">'+IC.x+'</button><button class="cb rz" title="Drag to resize (double-click to reset)" aria-label="Resize">'+IC.rz+'</button></div><input class="cap" maxlength="40" placeholder="add a caption">';
  el.querySelectorAll('.sf img').forEach(function(im,i){bindImg(im,fileKey(p,i),p.files[i],4/3)});
  cardFx(el,p);resizable(el,p);
  var inp=el.querySelector('input');inp.value=p.caption||'';
  inp.addEventListener('input',function(){p.caption=inp.value;save()});
  el.querySelector('.fx').addEventListener('click',async function(e){e.stopPropagation();editFx(el,p,[0,1,2,3].map(function(i){return smallUrl(fileKey(p,i),p.files[i])}),true)});
  applyCardFont(el,p);el.querySelector('.font').addEventListener('click',function(e){e.stopPropagation();fontMenu(this,el,p,capFontFF())});
  armDel(el.querySelector('.del'),'Remove?',function(){
    var pid=p.pile;data.photos=data.photos.filter(function(q){return q.id!==p.id});
    dropFiles(p);save();bye(el,p.id,function(){dropUrls(p)});pileFix(pid);
  });
  draggable(el,p,null,stackCard(el,p));pinUp(el,p);idxState(el,p);
}

// ---- photos ----
function renderPhoto(p){if(p.kind==='doc')return renderDoc(p);if(p.kind==='video')return renderVideo(p);if(p.kind==='strip')return renderStrip(p);if(p.kind==='sticker')return renderSticker(p);
  if(holdPin(p)){save();yarnFor(900)} // v2.0
  var el=document.createElement('div');el.className='card';el.tabIndex=0;place(el,p);
  var url=mediaUrl(p.id);
  el.innerHTML='<div class="pin"></div><div class="ph fxm"><img alt="" decoding="async">'+fxLayers()+'<button class="cb ratio" title="Switch between square crop and original ratio" aria-label="Switch between square crop and original ratio">'+IC.crop+'</button><button class="cb frm" title="Frame" aria-label="Frame">'+IC.frame+'</button>'+FX_BTN+FONT_BTN+PILE_BTNS+'<button class="cb del" title="Remove" aria-label="Remove">'+IC.x+'</button><button class="cb rz" title="Drag to resize (double-click to reset)" aria-label="Resize">'+IC.rz+'</button></div><input class="cap" maxlength="40" placeholder="add a caption">';
  var inp=el.querySelector('input');inp.value=p.caption||'';
  var im=el.querySelector('img');bindImg(im,p.id,p.file,p.ar);applyMode(el,im,p);resizable(el,p);cardFx(el,p);applyFrame(el,p);applyCardFont(el,p);
  // frame button cycles: polaroid -> no frame with a pin -> no frame with tape -> polaroid
  el.querySelector('.frm').addEventListener('click',function(e){
    e.stopPropagation();
    if(!p.bare){p.bare=true;p.hold='pin';sfx.blip()}else if(p.hold!=='tape'){p.hold='tape';sfx.tape()}else{delete p.bare;delete p.hold;sfx.blip()}
    applyFrame(el,p);keepIn(el);save();fit();
  });
  el.querySelector('.font').addEventListener('click',function(e){e.stopPropagation();fontMenu(this,el,p,capFontFF())});
  el.querySelector('.ratio').addEventListener('click',async function(e){
    e.stopPropagation();if(!p.ar)p.ar=await measure(files[p.id]);
    p.mode=p.mode==='original'?'square':'original';applyMode(el,im,p);sfx.blip();save();fit();
  });
  el.querySelector('.fx').addEventListener('click',async function(e){e.stopPropagation();editFx(el,p,[smallUrl(p.id,p.file)],false)});
  inp.addEventListener('input',function(){p.caption=inp.value;save()});
  armDel(el.querySelector('.del'),'Remove?',function(){
    var pid=p.pile;data.photos=data.photos.filter(function(q){return q.id!==p.id});
    dropFiles(p);save();bye(el,p.id,function(){dropUrls(p)});pileFix(pid);
  });
  draggable(el,p,null,stackCard(el,p));pinUp(el,p);idxState(el,p);
}

// ---- v1.1.6: fonts for captions and labels (system fonts that ship with Windows and macOS; each style lists both) ----
var FONTS=[
  {id:'hand',name:'Handwritten',ff:'"Bradley Hand","Segoe Print","Noteworthy","Ink Free",cursive',z:1.04},
  {id:'type',name:'Typewriter',ff:'"American Typewriter","Courier New",Courier,monospace',z:1},
  {id:'sans',name:'Clean sans',ff:'"Avenir Next","Segoe UI","Helvetica Neue",Arial,sans-serif',z:1},
  {id:'serif',name:'Serif',ff:'Georgia,"Times New Roman",serif',z:1.02},
  {id:'marker',name:'Marker',ff:'"Marker Felt","Ink Free","Segoe Print",cursive',z:1.06}
];
var BODY_FF='"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
var FONT_BTN='<button class="cb font" title="Font" aria-label="Font">'+IC.font+'</button>';
function fontById(id){return FONTS.filter(function(F){return F.id===id})[0]||null}
function applyCardFont(el,p){var F=fontById(p.font);
  if(F){el.style.setProperty('--cf',F.ff);el.style.setProperty('--cfz',F.z)}else{el.style.removeProperty('--cf');el.style.removeProperty('--cfz')}}
// the font a caption uses when it has no font of its own (Settings > Cards)
function capFontFF(){var F=fontById(data.style&&data.style.font);return F?F.ff:BODY_FF}
function fontMenu(btn,el,p,deflt){
  menu(btn,'Font',[{id:'auto',label:'Default',ff:deflt}].concat(FONTS.map(function(F){return{id:F.id,label:F.name,ff:F.ff}})),p.font||'auto',function(id){
    if(id==='auto')delete p.font;else p.font=id;applyCardFont(el,p);sfx.blip();save();keepIn(el);fit();
  });
}

// ---- small pop-up menus that open from a card button ----
var popEl=null,popBtn=null,popOff=null,popSkip=null,popCb=null;
function closePop(){if(!popEl)return null;var b=popBtn,cb=popCb;popCb=null;popEl.remove();popEl=null;popBtn=null;if(popOff)popOff();popOff=null;if(cb)setTimeout(cb,0);return b}
function openPop(btn,build,onClose){
  if(popSkip===btn){popSkip=null;return}
  if(popEl)closePop();popCb=null;
  var p=document.createElement('div');p.className='pop';p.setAttribute('role','dialog');
  function close(){closePop();if(document.contains(btn))btn.focus({preventScroll:true})}
  build(p,close);document.body.appendChild(p);popEl=p;popBtn=btn;popCb=onClose||null;
  var r=btn.getBoundingClientRect(),w=p.offsetWidth,h=p.offsetHeight,vw=document.documentElement.clientWidth,vh=window.innerHeight;
  var x=Math.max(8,Math.min(r.left+r.width/2-w/2,vw-w-8)),y=r.bottom+8;if(y+h>vh-8)y=Math.max(8,r.top-h-8);
  p.style.left=x+'px';p.style.top=y+'px';
  function pd(e){if(p.contains(e.target))return;if(btn.contains(e.target)){popSkip=btn;setTimeout(function(){if(popSkip===btn)popSkip=null},600)}closePop()}
  function kd(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}}
  function fo(e){if(e.relatedTarget&&!p.contains(e.relatedTarget)&&e.relatedTarget!==btn)closePop()}
  function sc(){closePop()}
  document.addEventListener('pointerdown',pd,true);document.addEventListener('keydown',kd,true);p.addEventListener('focusout',fo);
  window.addEventListener('scroll',sc,{passive:true});window.addEventListener('resize',sc);
  popOff=function(){document.removeEventListener('pointerdown',pd,true);document.removeEventListener('keydown',kd,true);window.removeEventListener('scroll',sc);window.removeEventListener('resize',sc)};
  sfx.blip();var f=p.querySelector('.on')||p.querySelector('button,input');if(f)f.focus({preventScroll:true});
}
// items: [{id,label,ff (font preview),pv (class for a little preview swatch)}]
function menu(btn,title,items,cur,pick){openPop(btn,function(p,close){
  var h=document.createElement('h4');h.textContent=title;p.appendChild(h);
  items.forEach(function(it){
    var b=document.createElement('button');b.type='button';b.className='pi'+(it.id===cur?' on':'');b.setAttribute('aria-pressed',it.id===cur?'true':'false');
    if(it.pv){var s=document.createElement('span');s.className='lkpv '+it.pv;b.appendChild(s)}
    var t=document.createElement('span');t.textContent=it.label;if(it.ff){t.style.fontFamily=it.ff;t.style.fontSize='16px'}b.appendChild(t);
    b.addEventListener('click',function(){close();if(it.id!==cur)pick(it.id)});p.appendChild(b);
  });
})}

// ---- v1.1.6: labels (label-maker tape, washi tape or a handwritten tag), stored in data.labels ----
var LOOKS=[
  {id:'tape',name:'Label-maker tape',ph:'LABEL',cols:['#1f1f1f','#c8312f','#2456b5','#2c7a4b','#d0457f','#6a43b0','#1f7f86']},
  {id:'washi',name:'Washi tape',ph:'write a label…',cols:['#9fd8c4','#f4b3c6','#f2d77e','#a9c6ee','#c8b5ea','#e3c39b'],pats:['stripes','dots','grid','dots','stripes','plain']},
  {id:'tag',name:'Handwritten tag',ph:'write a label…',cols:['#d8bb8a','#f6ecd6','#fffdf8','#f3d3d8','#d4e2cf','#d6e3f2']}
];
var LABEL_MAX=40;
function lookOf(id){return LOOKS.filter(function(L){return L.id===id})[0]||LOOKS[0]}
function applyLook(el,l){
  var L=lookOf(l.look),i=Math.max(0,L.cols.indexOf(l.c));l.look=L.id;l.c=L.cols[i];
  el.classList.remove('lk-tape','lk-washi','lk-tag');el.classList.add('lk-'+L.id);
  el.style.setProperty('--lc',l.c);el.style.setProperty('--pal',l.c);el.dataset.pat=L.pats?L.pats[i]:'';
  el.querySelector('.ltx').dataset.ph=L.ph;
}
function labelFontFF(l){var F=fontById(data.style&&data.style.font);return F?F.ff:(l.look==='tape'?'"Arial Rounded MT Bold","Arial Black","Segoe UI Black",Arial,sans-serif':FONTS[0].ff)}
// ---- v1.3: links on words in notes and labels ----
// Text is saved as plain "text" (so older versions still show it) plus "rt": a list of pieces [{t:'words', u:'https://…'}].
// The board never stores raw HTML, only these pieces, and links are limited to web and email addresses.
function safeUrl(u){
  if(typeof u!=='string')return null;u=u.trim().slice(0,600);if(!u)return null;
  if(!/^[a-z][a-z0-9+.-]*:/i.test(u)){if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u))u='mailto:'+u;else if(/^(www\.)?[^\s/]+\.[^\s/]{2,}/i.test(u))u='https://'+u;else return null}
  try{var x=new URL(u);if(!/^(https?|mailto):$/.test(x.protocol))return null;return x.href}catch(e){return null}
}
// v1.7: a piece can also be bold (b) and/or italic (i); older versions just show the words
function rtAdd(out,t,u,f){if(!t)return;var b=!!(f&&f.b),i=!!(f&&f.i),l=out[out.length-1];if(l&&(l.u||'')===(u||'')&&!!l.b===b&&!!l.i===i)l.t+=t;else{var p={t:t};if(u)p.u=u;if(b)p.b=true;if(i)p.i=true;out.push(p)}}
function rtPlain(segs){return segs.map(function(s){return s.t}).join('')}
function rtClean(a,max){var out=[],n=0;(Array.isArray(a)?a:[]).forEach(function(s){if(!s||typeof s.t!=='string'||n>=max)return;var t=s.t.slice(0,max-n);n+=t.length;rtAdd(out,t,s.u?safeUrl(s.u):null,{b:s.b===true,i:s.i===true})});return out}
function rtOf(o,max){return Array.isArray(o.rt)?rtClean(o.rt,max):rtClean([{t:o.text||''}],max)}
function rtStore(o,segs){o.text=rtPlain(segs);if(segs.some(function(s){return s.u||s.b||s.i}))o.rt=segs.map(function(s){var p={t:s.t};if(s.u)p.u=s.u;if(s.b)p.b=true;if(s.i)p.i=true;return p});else delete o.rt}
function rtRender(el,segs){
  el.textContent='';
  segs.forEach(function(s){
    var host=el;if(s.u){host=document.createElement('a');host.href=s.u;host.target='_blank';host.rel='noopener noreferrer';el.appendChild(host)}
    if(s.b){var bb=document.createElement('b');host.appendChild(bb);host=bb}if(s.i){var ii=document.createElement('i');host.appendChild(ii);host=ii}
    s.t.split('\n').forEach(function(p,i){if(i)host.appendChild(document.createElement('br'));if(p)host.appendChild(document.createTextNode(p))});
  });
}
function rtRead(el){
  var out=[];
  (function walk(node,u,f){node.childNodes.forEach(function(c){
    if(c.nodeType===3){rtAdd(out,c.nodeValue.replace(/ /g,' '),u,f);return}
    if(c.nodeType!==1)return;var tg=c.tagName;
    if(tg==='BR'){rtAdd(out,'\n',u,f);return}
    if((tg==='DIV'||tg==='P')&&out.length&&!/\n$/.test(rtPlain(out)))rtAdd(out,'\n',u,f);
    // v1.7: bold / italic, from <b>/<strong>/<i>/<em> or an inline style
    var g={b:f.b,i:f.i},fw=c.style&&c.style.fontWeight,fs=c.style&&c.style.fontStyle;
    if(tg==='B'||tg==='STRONG'||fw==='bold'||+fw>=600)g.b=true;else if(fw==='normal'||(+fw&&+fw<600))g.b=false;
    if(tg==='I'||tg==='EM'||fs==='italic'||fs==='oblique')g.i=true;else if(fs==='normal')g.i=false;
    walk(c,tg==='A'?(safeUrl(c.getAttribute('href'))||u):u,g);
  })})(el,null,{b:false,i:false});
  // drop the stray line breaks the browser leaves at the end
  while(out.length&&/\n$/.test(out[out.length-1].t)){var l=out[out.length-1];l.t=l.t.replace(/\n+$/,'');if(!l.t)out.pop()}
  return out;
}
function linkHost(a){try{var x=new URL(a);return x.protocol==='mailto:'?x.pathname:x.hostname.replace(/^www\./,'')+(x.pathname.length>1?x.pathname:'')}catch(e){return a}}
// makes a contenteditable element behave like a plain-text box that can also hold links
function rtEditor(ed,max,multiline,onChange,rich){
  ed._rich=!!rich; // v1.7: sticky notes and index cards allow bold and italics (⌘B / ⌘I)
  ed.addEventListener('beforeinput',function(e){
    var t=e.inputType;
    if(rich&&(t==='formatBold'||t==='formatItalic'))return;
    if(/^format/.test(t)||t==='insertFromDrop'){e.preventDefault();return}
    if(t==='insertParagraph'||t==='insertLineBreak'){e.preventDefault();if(multiline&&rtPlain(rtRead(ed)).length<max)document.execCommand('insertLineBreak');return}
    if(t==='insertText'&&rtPlain(rtRead(ed)).length>=max&&getSelection().isCollapsed)e.preventDefault();
  });
  ed.addEventListener('paste',function(e){e.preventDefault();var t=((e.clipboardData||window.clipboardData).getData('text')||'');t=multiline?t.replace(/\r/g,''):t.replace(/\s+/g,' ');
    var room=max-rtPlain(rtRead(ed)).length+getSelection().toString().length;document.execCommand('insertText',false,t.slice(0,Math.max(0,room)))});
  ed.addEventListener('input',onChange);
  // clicking a link shows a small bubble to open, change or remove it
  ed.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a');if(a&&ed.contains(a)){e.preventDefault();linkBubble(a,ed,onChange)}});
}
function linkBubble(a,ed,onChange){openPop(a,function(box,close){
  var h=document.createElement('h4');h.textContent='Link';box.appendChild(h);
  var u=document.createElement('div');u.className='lku';u.textContent=linkHost(a.getAttribute('href'));u.title=a.getAttribute('href');box.appendChild(u);
  var row=document.createElement('div');row.className='lkb';
  [['Open ↗',function(){close();window.open(a.getAttribute('href'),'_blank','noopener')}],
   ['Edit',function(){close();var r=document.createRange();r.selectNodeContents(a);linkPop(ed.closest('.card').querySelector('.lnk')||a,r,a.getAttribute('href'),ed,onChange)}],
   ['Remove',function(){close();var r=document.createRange();r.selectNodeContents(a);setLink(ed,r,null,onChange)}]].forEach(function(x,i){
    var b=document.createElement('button');b.type='button';b.className='sbtn'+(i?' alt':'');b.textContent=x[0];b.addEventListener('click',x[1]);row.appendChild(b)});
  box.appendChild(row);
},ed._linkDone)}
function setLink(ed,range,url,onChange){
  if(ed.contentEditable!=='true')ed.contentEditable='true';
  ed.focus({preventScroll:true});var sel=getSelection();sel.removeAllRanges();sel.addRange(range);
  document.execCommand('unlink');if(url)document.execCommand('createLink',false,url);
  // keep the editor tidy: re-draw it from the saved pieces
  var segs=rtRead(ed);rtRender(ed,segs);sel.removeAllRanges();onChange();sfx.blip();
}
function linkPop(btn,range,cur,ed,onChange){openPop(btn,function(box,close){
  var h=document.createElement('h4');h.textContent=cur?'Change link':'Add a link';box.appendChild(h);
  var w=document.createElement('div');w.className='lkw';w.textContent='“'+range.toString().replace(/\s+/g,' ').slice(0,40)+'”';box.appendChild(w);
  var inp=document.createElement('input');inp.type='url';inp.className='lki';inp.placeholder='paste a web address';inp.value=cur||'';inp.setAttribute('aria-label','Web address');box.appendChild(inp);
  var row=document.createElement('div');row.className='lkb';
  var ok=document.createElement('button');ok.type='button';ok.className='sbtn';ok.textContent=cur?'Save':'Add link';
  function go(){var u=safeUrl(inp.value);if(!u){sfx.warn();inp.classList.add('bad');inp.focus();return}close();setLink(ed,range,u,onChange)}
  ok.addEventListener('click',go);inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();go()}});inp.addEventListener('input',function(){inp.classList.remove('bad')});
  row.appendChild(ok);
  if(cur){var rm=document.createElement('button');rm.type='button';rm.className='sbtn alt';rm.textContent='Remove link';rm.addEventListener('click',function(){close();setLink(ed,range,null,onChange)});row.appendChild(rm)}
  box.appendChild(row);setTimeout(function(){inp.focus();inp.select()},0);
},ed._linkDone)}
// the link button on a card: uses the words she selected (or the link the cursor is in)
function linkButton(btn,ed,onChange,wholeIfNone,startEdit){
  btn.addEventListener('pointerdown',function(e){e.preventDefault()});
  btn.addEventListener('mousedown',function(e){e.preventDefault()});
  btn.addEventListener('click',function(e){
    e.stopPropagation();var sel=getSelection(),r=sel.rangeCount?sel.getRangeAt(0):null;
    if(!r||!ed.contains(r.commonAncestorContainer))r=null;
    var a=r&&(r.startContainer.nodeType===1?r.startContainer:r.startContainer.parentNode).closest('a');if(a&&!ed.contains(a))a=null;
    if(a&&r.collapsed){r=document.createRange();r.selectNodeContents(a)}
    if(!r||r.collapsed){
      if(!wholeIfNone||!rtPlain(rtRead(ed)).trim()){sfx.warn();toast('Select some words first, then tap the link button');return}
      if(startEdit)startEdit();r=document.createRange();r.selectNodeContents(ed);
    }
    linkPop(btn,r.cloneRange(),a?a.getAttribute('href'):'',ed,onChange);
  });
}

function renderLabel(l){
  var el=document.createElement('div');el.className='card label';el.tabIndex=0;place(el,l);
  el.innerHTML='<div class="lbar"><button class="cb look" title="Label style" aria-label="Label style">'+IC.tag+'</button><button class="cb dot" title="Change colour" aria-label="Change colour"></button>'+FONT_BTN+'<button class="cb lnk" title="Link the selected words (or the whole label)" aria-label="Add a link">'+IC.link+'</button><button class="cb rz" title="Drag to resize (double-click to reset)" aria-label="Resize">'+IC.rz+'</button><button class="cb del" title="Remove" aria-label="Remove">'+IC.x+'</button></div><i class="str"></i><div class="lbx"><span class="ltx" spellcheck="false" role="textbox" aria-label="Label text"></span></div>';
  var tx=el.querySelector('.ltx');rtRender(tx,rtOf(l,LABEL_MAX));applyLook(el,l);applyCardFont(el,l);resizable(el,l);
  function changed(){rtStore(l,rtRead(tx));save()}
  // tap (or Enter) to write on it; drag anywhere to move it; tap a linked word to open its link
  function edit(){
    if(tx.isContentEditable)return;tx.contentEditable='true';
    tx.focus({preventScroll:true});var r=document.createRange();r.selectNodeContents(tx);r.collapse(false);var sel=getSelection();sel.removeAllRanges();sel.addRange(r);
  }
  el._edit=edit;
  function finish(){
    if(!tx.isContentEditable)return;tx.contentEditable='false';var segs=rtRead(tx);segs.forEach(function(s){s.t=s.t.replace(/\s+/g,' ')});
    if(segs.length){segs[0].t=segs[0].t.replace(/^ /,'');var z=segs[segs.length-1];z.t=z.t.replace(/ $/,'')}segs=rtClean(segs,LABEL_MAX);
    rtRender(tx,segs);rtStore(l,segs);save();keepIn(el);fit();
  }
  tx.addEventListener('blur',function(){if(popEl)return;finish()}); // (not while she's typing a link)
  tx._linkDone=function(){if(document.activeElement!==tx)finish()};
  tx.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key==='Escape'){e.preventDefault();e.stopPropagation();tx.blur();el.focus({preventScroll:true})}});
  rtEditor(tx,LABEL_MAX,false,changed);
  // app fix: keep the label's buttons on screen: below the label when the section tabs would cover them,
  // and nudged sideways at the edges of the window
  function fitBar(){var bar=el.querySelector('.lbar');el.classList.remove('lbdn');bar.style.marginLeft='';
    if(bar.getBoundingClientRect().top<document.getElementById('lfab').getBoundingClientRect().bottom+4)el.classList.add('lbdn'); // v1.8: under the top toolbars
    var r=bar.getBoundingClientRect(),vw=document.documentElement.clientWidth,dx=r.left<6?6-r.left:r.right>vw-6?vw-6-r.right:0;
    if(dx)bar.style.marginLeft=(dx/ZM).toFixed(1)+'px'}
  el.addEventListener('pointerenter',fitBar);el.addEventListener('focusin',fitBar);
  linkButton(el.querySelector('.lnk'),tx,changed,true,edit);
  el.addEventListener('keydown',function(e){if(e.target===el&&e.key==='Enter'){e.preventDefault();edit()}});
  el.querySelector('.look').addEventListener('click',function(e){e.stopPropagation();
    menu(this,'Label style',LOOKS.map(function(L){return{id:L.id,label:L.name,pv:'lk-'+L.id}}),l.look,function(id){
      var i=Math.max(0,lookOf(l.look).cols.indexOf(l.c)),L=lookOf(id);l.look=id;l.c=L.cols[i%L.cols.length];applyLook(el,l);sfx.tape();save();keepIn(el);fit();
    });
  });
  el.querySelector('.dot').addEventListener('click',function(e){e.stopPropagation();sfx.blip();var C=lookOf(l.look).cols;l.c=C[(C.indexOf(l.c)+1)%C.length];applyLook(el,l);save()});
  el.querySelector('.font').addEventListener('click',function(e){e.stopPropagation();fontMenu(this,el,l,labelFontFF(l))});
  armDel(el.querySelector('.del'),'Remove?',function(){
    data.labels=data.labels.filter(function(q){return q.id!==l.id});save();bye(el,l.id);
  });
  draggable(el,l,function(t){var a=t&&t.closest&&t.closest('a');if(a&&tx.contains(a)&&!tx.isContentEditable)linkBubble(a,tx,changed);else edit()});pinUp(el,l);
  return el;
}
document.getElementById('labelBtn').addEventListener('click',function(){
  var L=lookOf(data.style.label),sp=slot(),l=Object.assign({id:'l'+uid(),s:data.cur,text:'',look:L.id,c:L.cols[Math.floor(Math.random()*L.cols.length)]},sp);
  l.rot=Math.round(l.rot*5)/10;
  data.labels.push(l);var el=renderLabel(l);sfx.tape();save();fit();
  setTimeout(function(){if(document.contains(el))el._edit()},450);
});

// ---- v1.1.6: stickers (transparent PNG/WebP/GIF, no frame) with non-destructive finishes ----
function cleanFin(f){if(!f||typeof f!=='object')return null;var o={};if(f.sh==='gloss'||f.sh==='matte')o.sh=f.sh;if(f.b)o.b=true;if(f.w)o.w=true;return Object.keys(o).length?o:null}
function applyFin(el,p){
  var f=p.fin||{},img=el.querySelector('.stk img'),wrap=el.querySelector('.stk'),c=[],u=[];
  if(f.w)c.push('saturate(.72) contrast(.88) brightness(1.06) sepia(.14)');
  if(f.sh==='gloss')c.push('saturate(1.12) contrast(1.05)');else if(f.sh==='matte')c.push('saturate(.88) contrast(.92) brightness(1.03)');
  if(f.b)u.push('url(#cbB)');if(f.w)u.push('url(#cbW)');if(f.sh==='gloss')u.push('url(#cbG)');else if(f.sh==='matte')u.push('url(#cbM)');
  img.style.filter=c.join(' ');wrap.style.filter=u.join(' ');
}
function finPop(btn,el,p){openPop(btn,function(box){
  var f=p.fin||{};
  function upd(){p.fin=cleanFin(f);if(!p.fin)delete p.fin;applyFin(el,p);save()}
  var h=document.createElement('h4');h.textContent='Sticker finish';box.appendChild(h);
  var seg=document.createElement('div');seg.className='seg';seg.setAttribute('role','radiogroup');seg.setAttribute('aria-label','Surface');
  [['','Plain'],['gloss','Shiny'],['matte','Matte']].forEach(function(x){
    var b=document.createElement('button');b.type='button';b.textContent=x[1];b.setAttribute('role','radio');
    function mark(){var on=(f.sh||'')===x[0];b.className=on?'on':'';b.setAttribute('aria-checked',on?'true':'false')}
    b._mark=mark;mark();
    b.addEventListener('click',function(){if((f.sh||'')===x[0])return;f.sh=x[0];upd();if(x[0]==='gloss')sfx.glint();else sfx.blip();seg.querySelectorAll('button').forEach(function(q){q._mark()})});
    seg.appendChild(b);
  });
  box.appendChild(seg);
  [['b','White border'],['w','Worn down']].forEach(function(x){
    var r=document.createElement('label');r.className='trow';var t=document.createElement('span');t.textContent=x[1];
    var c=document.createElement('input');c.type='checkbox';c.className='sw';c.checked=!!f[x[0]];
    c.addEventListener('change',function(){f[x[0]]=c.checked;upd();sfx.blip()});
    r.appendChild(t);r.appendChild(c);box.appendChild(r);
  });
  var hn=document.createElement('div');hn.className='phint';hn.textContent='Your original sticker file stays untouched.';box.appendChild(hn);
})}
function rotatable(el,p){
  var h=el.querySelector('.rot'),cx,cy,a0,r0,on=false;
  function ang(e){return Math.atan2(e.clientY-cy,e.clientX-cx)*180/Math.PI}
  h.addEventListener('pointerdown',function(e){
    e.stopPropagation();h.setPointerCapture(e.pointerId);var b=el.getBoundingClientRect();cx=b.left+b.width/2;cy=b.top+b.height/2;a0=ang(e);r0=p.rot||0;on=true;
    // v1.7: the card shows its tilt only once the handle moves, so a double-click (straighten) stays on the handle
  });
  h.addEventListener('pointermove',function(e){
    if(!on)return;if(!el.classList.contains('rotg')){if(Math.abs(ang(e)-a0)<1.5)return;el.classList.add('rotg')}var r=r0+ang(e)-a0;r=((r%360)+540)%360-180;if(Math.abs(r)<3)r=0;
    p.rot=Math.round(r*10)/10;el.style.setProperty('--r',p.rot+'deg');
  });
  function end(){if(!on)return;on=false;el.classList.remove('rotg');sfx.set();save();fit()}
  h.addEventListener('pointerup',end);h.addEventListener('pointercancel',end);
  h.addEventListener('dblclick',function(e){e.stopPropagation();p.rot=0;el.style.setProperty('--r','0deg');sfx.blip();save()});
}
// v1.7: drag the bottom edge to make a note, to-do list, index card or calendar longer or shorter (stored as hs, a height
// factor); part is the piece that stretches (the whole card, or a calendar's grid of days); double-click resets
var RZE='<i class="rze" title="Drag to make it longer or shorter (double-click to reset)" aria-hidden="true"></i>';
var ROT_BTN='<button class="cb rot" title="Drag to tilt (double-click to straighten)" aria-label="Tilt">'+IC.rot+'</button>';
function stretchable(el,p,part,min,max){
  var h=el.querySelector('.rze'),sy,h0,hs0,on=false;
  h.addEventListener('pointerdown',function(e){if(e.button)return;e.stopPropagation();e.preventDefault();h.setPointerCapture(e.pointerId);
    var pe=part?el.querySelector(part):el;sy=e.clientY;h0=Math.max(20,pe.offsetHeight);hs0=p.hs||1;on=true;el.classList.add('rszh');sfx.lift()});
  h.addEventListener('pointermove',function(e){if(!on)return;var dy=(e.clientY-sy)/ZM;
    p.hs=Math.round(Math.max(min,Math.min(max,hs0*(h0+dy)/h0))*100)/100;el.style.setProperty('--hs',p.hs);yarnSoon()});
  function end(){if(!on)return;on=false;el.classList.remove('rszh');if(Math.abs(p.hs-1)<.03){delete p.hs;el.style.removeProperty('--hs')}sfx.set();save();fit()}
  h.addEventListener('pointerup',end);h.addEventListener('pointercancel',end);
  h.addEventListener('dblclick',function(e){e.stopPropagation();delete p.hs;el.style.removeProperty('--hs');sfx.blip();save();fit()});
}
function renderSticker(p){
  var el=document.createElement('div');el.className='card sticker';el.tabIndex=0;place(el,p);
  var ar=Math.max(.3,Math.min(3.5,p.ar||1));el.style.setProperty('--ar',ar);
  var f=Math.max(.75,Math.min(1.35,Math.sqrt(ar)));if(f!==1)el.style.setProperty('--bw','calc(clamp(120px,32vw,180px) * '+f.toFixed(3)+')');
  el.innerHTML='<div class="stk"><img alt="" decoding="async"></div><button class="cb fin" title="Sticker finish" aria-label="Sticker finish">'+IC.shine+'</button><button class="cb del" title="Remove" aria-label="Remove">'+IC.x+'</button><button class="cb rot" title="Drag to rotate (double-click to straighten)" aria-label="Rotate">'+IC.rot+'</button><button class="cb rz" title="Drag to resize (double-click to reset)" aria-label="Resize">'+IC.rz+'</button>';
  bindImg(el.querySelector('.stk img'),p.id,p.file,p.ar);applyFin(el,p);resizable(el,p);rotatable(el,p);
  el.querySelector('.fin').addEventListener('click',function(e){e.stopPropagation();finPop(this,el,p)});
  armDel(el.querySelector('.del'),'Remove?',function(){
    data.photos=data.photos.filter(function(q){return q.id!==p.id});
    dropFiles(p);save();bye(el,p.id,function(){dropUrls(p)});
  });
  draggable(el,p);pinUp(el,p);
}
// ---- v1.3: sticker library: every uploaded sticker stays in data.stickers [{file,ar}] so it can be reused in any section ----
var libFiles={},libUrls={};
function inLib(name){return data.stickers.some(function(x){return x.file===name})}
function fileUsed(name){return inLib(name)||(data.templates||[]).some(function(t){return t.items.some(function(it){return it.k==='sticker'&&it.o.file===name})})||data.photos.some(function(q){return pFiles(q).indexOf(name)>=0})||(data.wallpaper&&data.wallpaper.file===name)}
function libUrl(name){if(libUrls[name])return libUrls[name];if(!libFiles[name])return '';return(libUrls[name]=URL.createObjectURL(libFiles[name]))}
function placeSticker(x,delay){
  var p=Object.assign({id:'k'+uid(),file:x.file,s:data.cur,kind:'sticker',ar:x.ar||1},slot());
  files[p.id]=libFiles[x.file];data.photos.push(p);renderPhoto(p);sfx.peel(delay!=null?delay:(parseFloat(cards[p.id].style.animationDelay)||0)/1000+.15);save();fit();return p;
}
function stickerDrawer(){openPop(document.getElementById('addMain'),function(box,close){
  box.classList.add('stkpop');
  var h=document.createElement('h4');h.textContent='Your stickers';box.appendChild(h);
  var g=document.createElement('div');g.className='stg';box.appendChild(g);
  function build(){
    g.innerHTML='';
    if(!data.stickers.length){var e=document.createElement('p');e.className='phint';e.textContent='Stickers you upload are kept here, so you can stick them in any section without finding the files again.';g.appendChild(e);return}
    data.stickers.slice().reverse().forEach(function(x){
      var w=document.createElement('div');w.className='stw';
      var b=document.createElement('button');b.type='button';b.className='sti';b.title='Stick it on the board';b.setAttribute('aria-label','Add this sticker to the board');
      var im=document.createElement('img');im.alt='';im.decoding='async';thumbOf(x.file,libFiles[x.file],TH_SM).then(function(u){im.src=u||libUrl(x.file)});b.appendChild(im);
      b.addEventListener('click',function(){placeSticker(x,0);sparkle(stkBtn)});
      var rm=document.createElement('button');rm.type='button';rm.className='stx';rm.textContent='×';rm.title='Remove from your stickers';rm.setAttribute('aria-label','Remove from your stickers');
      rm.addEventListener('click',function(e){e.stopPropagation();
        if(!rm.classList.contains('armed')){sfx.warn();rm.classList.add('armed');rm.textContent='Remove?';setTimeout(function(){if(rm.isConnected){rm.classList.remove('armed');rm.textContent='×'}},2500);return}
        sfx.trash();data.stickers=data.stickers.filter(function(q){return q!==x});
        if(!fileUsed(x.file)){photosDir.removeEntry(x.file).catch(function(){});if(libUrls[x.file]){URL.revokeObjectURL(libUrls[x.file]);delete libUrls[x.file]}delete libFiles[x.file]}
        save();build();
      });
      w.appendChild(b);w.appendChild(rm);g.appendChild(w);
    });
  }
  build();
  var hn=document.createElement('p');hn.className='phint';hn.textContent='Tap a sticker to add it. Removing one here doesn’t take it off the board.';box.appendChild(hn);
  var up=document.createElement('button');up.type='button';up.className='sbtn';up.textContent='Upload new stickers…';
  up.addEventListener('click',function(){close();stkFileEl.click()});box.appendChild(up);
})}

// does the image have any see-through pixels? (only used to show a friendly hint)
async function hasAlpha(f){try{var b=await createImageBitmap(f),w=Math.max(1,Math.min(64,b.width)),h=Math.max(1,Math.round(w*b.height/b.width)),c=document.createElement('canvas');c.width=w;c.height=h;
  var x=c.getContext('2d');x.drawImage(b,0,0,w,h);if(b.close)b.close();var d=x.getImageData(0,0,w,h).data;for(var i=3;i<d.length;i+=4)if(d[i]<245)return true;return false}catch(e){return true}}
var stkFileEl=document.getElementById('stkFile'),stkBtn=document.getElementById('stkBtn');
stkBtn.addEventListener('click',function(){if(data.stickers.length)stickerDrawer();else stkFileEl.click()});
stkFileEl.addEventListener('change',function(){var l=Array.prototype.slice.call(stkFileEl.files);stkFileEl.value='';addStickers(l)});
async function addStickers(list){
  var ok=0,bad=0,skip=0,opaque=0;
  for(var f of list){
    if(!/^image\/(png|webp|gif)$/.test(f.type)&&!/\.(png|webp|gif)$/i.test(f.name)){skip++;continue}
    try{
      if(!await hasAlpha(f))opaque++;
      var name=await storeFile(f,'sticker-'),x={file:name,ar:await measure(f)};
      libFiles[name]=f;data.stickers.push(x);placeSticker(x);ok++;
    }catch(e){bad++}
  }
  save();fit();if(ok)sparkle(stkBtn);
  if(bad)toast(bad+' sticker(s) couldn’t be saved');
  else if(skip)toast('Stickers need to be PNG, WebP or GIF files'+(ok?' — skipped '+skip:''));
  else if(opaque)toast(opaque===1&&ok===1?'That image has no transparent background, so it shows as a rectangle':opaque+' of these have no transparent background');
}

// ---- v1.2 documents: PDFs shown with the bundled PDF.js (Mozilla, Apache 2.0), stapled as a stack of pages ----
// PDF.js is stored gzipped in this file and only unpacked the first time a document is shown.
var pdfLib=null,pdfDocs={};
async function gzUrl(id){
  var b=atob(document.getElementById(id).textContent.trim()),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);
  var s=new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'));
  return URL.createObjectURL(new Blob([await new Response(s).arrayBuffer()],{type:'text/javascript'}));
}
// DESKTOP: pdf.js 6.2.108 is bundled as files (vendor/pdfjs) and runs in a real worker
var PDFJS_BASE=new URL('vendor/pdfjs/',location.href).href;
function pdfjs(){
  if(!pdfLib){pdfLib=(async function(){var L=await import(PDFJS_BASE+'pdf.min.mjs');L.GlobalWorkerOptions.workerSrc=PDFJS_BASE+'pdf.worker.min.mjs';return L})();pdfLib.catch(function(){pdfLib=null})}
  return pdfLib;
}
async function openPdf(f){var L=await pdfjs();return await L.getDocument({data:new Uint8Array(await f.arrayBuffer()),isEvalSupported:false,verbosity:0,
  wasmUrl:PDFJS_BASE+'wasm/',cMapUrl:PDFJS_BASE+'cmaps/',cMapPacked:true,standardFontDataUrl:PDFJS_BASE+'standard_fonts/'}).promise}
function pdfDoc(p){
  if(!pdfDocs[p.id]){pdfDocs[p.id]=openPdf(files[p.id]);pdfDocs[p.id].catch(function(){delete pdfDocs[p.id]})}
  return pdfDocs[p.id];
}
function closePdf(d){try{var t=d&&(d.loadingTask||d);if(t&&t.destroy)t.destroy()}catch(e){}}
function dropDoc(id){var d=pdfDocs[id];delete pdfDocs[id];if(d)d.then(closePdf).catch(function(){})}
// renders page i (0-based) to a new canvas cssW pixels wide (sharp on high-DPI screens)
async function pageCanvas(p,i,cssW){
  var d=await pdfDoc(p),pg=await d.getPage(i+1),v1=pg.getViewport({scale:1}),dpr=Math.min(2.5,window.devicePixelRatio||1);
  var v=pg.getViewport({scale:Math.max(.2,cssW*dpr/v1.width)}),c=document.createElement('canvas');c.width=Math.round(v.width);c.height=Math.round(v.height);
  var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
  await pg.render({canvasContext:x,viewport:v,canvas:c}).promise;return c;
}
function copyTo(dst,src){dst.width=src.width;dst.height=src.height;dst.getContext('2d').drawImage(src,0,0)}
function isPdf(f){return f.type==='application/pdf'||/\.pdf$/i.test(f.name)}
function isWord(f){return /\.(docx?|docm|dotx|odt|rtf|pages)$/i.test(f.name)||/wordprocessingml|msword|opendocument\.text|rtf/.test(f.type)}
var WORD_MSG='Word files need saving as a PDF first: in Word choose File → Save As → PDF, then add the PDF';

function renderDoc(p){
  var el=document.createElement('div');el.className='card doc';el.tabIndex=0;place(el,p);
  el.style.setProperty('--par',Math.max(.35,Math.min(2.5,p.ar||.707)));el.dataset.n=Math.min(3,p.n||1);
  if((p.ar||.707)>1)el.style.setProperty('--bw','calc(clamp(150px,38vw,210px) * 1.3)');
  el.innerHTML='<div class="dk"><i class="sh s2"></i><i class="sh s1"></i><div class="pg ld"><canvas></canvas></div><i class="stp"></i></div><span class="pgn"></span>'+
    '<button class="cb prv" title="Previous page" aria-label="Previous page">'+IC.prev+'</button><button class="cb nxt" title="Next page" aria-label="Next page">'+IC.next+'</button>'+
    '<button class="cb del" title="Remove" aria-label="Remove">'+IC.x+'</button><button class="cb rz" title="Drag to resize (double-click to reset)" aria-label="Resize">'+IC.rz+'</button>';
  var pgEl=el.querySelector('.pg'),cv=pgEl.querySelector('canvas'),pgn=el.querySelector('.pgn'),busy=false,drawnW=0;
  function counter(){var n=p.n||1;pgn.textContent=(p.pg+1)+' / '+n;pgn.hidden=n<2;
    el.querySelector('.prv').disabled=p.pg<=0;el.querySelector('.nxt').disabled=p.pg>=n-1}
  async function draw(){var w=pgEl.clientWidth||200;try{var c=await pageCanvas(p,p.pg,w);copyTo(cv,c);drawnW=w;pgEl.classList.remove('ld','bad')}catch(e){pgEl.classList.remove('ld');pgEl.classList.add('bad')}}
  // flip on the card: the top page peels back over the staple (next) or settles back down (previous)
  async function flip(dir){
    var n=p.n||1,ni=p.pg+dir;if(busy||ni<0||ni>=n)return;busy=true;sfx.flip();
    try{
      var nc=await pageCanvas(p,ni,pgEl.clientWidth||200),ov=document.createElement('canvas');
      if(dir>0){copyTo(ov,cv);copyTo(cv,nc)}else copyTo(ov,nc);
      ov.className=dir>0?'peel':'peel back';pgEl.appendChild(ov);
      p.pg=ni;counter();save();
      await new Promise(function(r){ov.addEventListener('animationend',r,{once:true});setTimeout(r,700)});
      if(dir<0)copyTo(cv,nc);ov.remove();
    }catch(e){}
    busy=false;
  }
  el._flip=flip;el._draw=draw;
  el.querySelector('.prv').addEventListener('click',function(e){e.stopPropagation();flip(-1)});
  el.querySelector('.nxt').addEventListener('click',function(e){e.stopPropagation();flip(1)});
  el.addEventListener('keydown',function(e){if(e.target!==el)return;if(e.key==='ArrowRight'){e.preventDefault();flip(1)}else if(e.key==='ArrowLeft'){e.preventDefault();flip(-1)}else if(e.key==='Enter'){e.preventDefault();openReader(p,el)}});
  armDel(el.querySelector('.del'),'Remove?',function(){
    data.photos=data.photos.filter(function(q){return q.id!==p.id});
    dropDoc(p.id);dropFiles(p);save();bye(el,p.id,function(){dropUrls(p)});
  });
  resizable(el,p);draggable(el,p,function(){openReader(p,el)});pinUp(el,p);counter();draw();
  // after resizing, redraw the page so it stays sharp
  if(window.ResizeObserver){var rt=0;new ResizeObserver(function(){clearTimeout(rt);rt=setTimeout(function(){if(el.isConnected&&Math.abs(pgEl.clientWidth-drawnW)>8&&!busy)draw()},250)}).observe(pgEl)}
}

// ---- large reader with a page turn ----
var rdEl=document.getElementById('rd'),rdP=rdEl.querySelector('.rdp'),rdC=rdP.querySelector('canvas'),rdN=rdEl.querySelector('.rdc'),rdDoc=null,rdCard=null,rdBusy=false,rdPrev=null;
function rdSize(){var ar=rdDoc.ar||.707,W=window.innerWidth*.9,H=window.innerHeight*.84,w=Math.min(W,H*ar);rdP.style.width=Math.round(w)+'px';rdP.style.height=Math.round(w/ar)+'px';return w}
function rdCount(){var n=rdDoc.n||1;rdN.textContent='Page '+(rdDoc.pg+1)+' of '+n;rdEl.querySelector('.rdn.prv').disabled=rdDoc.pg<=0;rdEl.querySelector('.rdn.nxt').disabled=rdDoc.pg>=n-1}
async function rdDraw(){var p=rdDoc;try{var c=await pageCanvas(p,p.pg,rdSize());if(rdDoc===p){copyTo(rdC,c);rdP.classList.remove('ld','bad')}}catch(e){rdP.classList.remove('ld');rdP.classList.add('bad')}}
function openReader(p,card){
  rdPrev=document.activeElement;rdDoc=p;rdCard=card;rdBusy=false;sfx.pop();
  rdC.width=rdC.height=1;rdP.classList.add('ld');rdP.classList.remove('bad');rdSize();rdCount();
  rdEl.style.display='flex';document.getElementById('rdX').focus();rdDraw();
}
function closeReader(){
  if(rdEl.style.display!=='flex')return;rdEl.style.display='none';
  rdP.querySelectorAll('.turn').forEach(function(t){t.remove()});
  if(rdCard&&rdCard.isConnected&&rdCard._draw){rdCard._draw();rdCard.querySelector('.pgn').textContent=(rdDoc.pg+1)+' / '+(rdDoc.n||1);rdCard.querySelector('.prv').disabled=rdDoc.pg<=0;rdCard.querySelector('.nxt').disabled=rdDoc.pg>=(rdDoc.n||1)-1}
  if(rdPrev&&document.contains(rdPrev))rdPrev.focus({preventScroll:true});rdDoc=rdCard=rdPrev=null;
}
// next: the current page turns over to the left like a book; previous: the earlier page turns back in
async function rdFlip(dir){
  var p=rdDoc;if(!p||rdBusy)return;var n=p.n||1,ni=p.pg+dir;if(ni<0||ni>=n)return;rdBusy=true;sfx.flip();
  try{
    var nc=await pageCanvas(p,ni,rdSize()),w=document.createElement('div'),oc=document.createElement('canvas');
    if(dir>0){copyTo(oc,rdC);copyTo(rdC,nc)}else copyTo(oc,nc);
    w.className='turn'+(dir<0?' back':'');w.appendChild(oc);rdP.appendChild(w);
    p.pg=ni;rdCount();save();
    await new Promise(function(r){w.addEventListener('animationend',r,{once:true});setTimeout(r,900)});
    if(dir<0)copyTo(rdC,nc);w.remove();
  }catch(e){}
  rdBusy=false;
}
rdEl.querySelector('.rdn.prv').addEventListener('click',function(){rdFlip(-1)});
rdEl.querySelector('.rdn.nxt').addEventListener('click',function(){rdFlip(1)});
rdEl.addEventListener('click',function(e){if(e.target===rdEl||e.target.closest('#rdX'))closeReader()});
document.addEventListener('keydown',function(e){
  if(rdEl.style.display!=='flex')return;
  if(e.key==='Escape'){e.stopPropagation();closeReader()}else if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();rdFlip(1)}else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();rdFlip(-1)}
});
// swipe left/right on the page to turn it (phones and tablets)
(function(){var sx=null,sy=0;
  rdP.addEventListener('pointerdown',function(e){sx=e.clientX;sy=e.clientY});
  rdP.addEventListener('pointerup',function(e){if(sx===null)return;var dx=e.clientX-sx,dy=e.clientY-sy;sx=null;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5)rdFlip(dx<0?1:-1);else if(Math.abs(dx)<6&&Math.abs(dy)<6){var b=rdP.getBoundingClientRect();rdFlip(e.clientX>b.left+b.width/2?1:-1)}});
  rdP.addEventListener('pointercancel',function(){sx=null});
})();
var rdRs=0;window.addEventListener('resize',function(){if(rdEl.style.display!=='flex')return;clearTimeout(rdRs);rdRs=setTimeout(rdDraw,150)});

async function addDocs(list){
  var ok=0,bad=0,pw=0;
  for(var f of list){
    var n=1,ar=.707;
    try{var d=await openPdf(f);n=d.numPages;var v=(await d.getPage(1)).getViewport({scale:1});ar=Math.round(v.width/v.height*1000)/1000;closePdf(d)}
    catch(e){if(e&&e.name==='PasswordException')pw++;else bad++;continue}
    try{
      var name=await storeFile(f,'doc-'),p=Object.assign({id:name,file:name,s:data.cur,kind:'doc',n:n,pg:0,ar:ar},slot());
      files[p.id]=f;data.photos.push(p);renderPhoto(p);sfx.land((parseFloat(cards[p.id].style.animationDelay)||0)/1000+.38);ok++;
    }catch(e){bad++}
  }
  save();fit();if(ok)sparkle(addBtn);
  if(pw)toast(pw===1?'That PDF is password-protected — save a copy without a password first':pw+' PDFs are password-protected');
  else if(bad)toast(bad===1?'Couldn’t open that PDF':bad+' PDFs couldn’t be opened');
  return ok;
}

// ---- v1.3: wall calendar (kept with the notes as kind:'cal'; days: {'2026-11-14':{t:'text',e:'emoji',m:true}}) ----
var CAL_COLS=['#c8312f','#2456b5','#2c7a4b','#d0457f','#6a43b0','#d9822b','#35312c'];
var CAL_EMO=['','❤️','🎂','🎉','✈️','⭐','🌸','🍽️','📌'];
function pad2(n){return(n<10?'0':'')+n}
function ymNow(){var d=new Date();return d.getFullYear()+'-'+pad2(d.getMonth()+1)}
function weekStart(){try{var L=new Intl.Locale(navigator.language||'en'),w=L.getWeekInfo?L.getWeekInfo():L.weekInfo;if(w&&w.firstDay)return w.firstDay%7}catch(e){}return 1}
function renderCal(c){
  if(holdPin(c)){save();yarnFor(900)} // v2.0
  var el=document.createElement('div');el.className='card cal';el.tabIndex=0;place(el,c);
  el.innerHTML='<div class="pin"></div><div class="calh"><button class="calnav prv">‹</button><div class="calm" aria-live="polite"></div><button class="calnav nxt">›</button></div>'+
    '<div class="calw" aria-hidden="true"></div><div class="calg"></div><ul class="call"></ul>'+
    '<button class="cb dot" title="Change colour" aria-label="Change colour"></button><button class="cb clook" title="Calendar look" aria-label="Calendar look">'+IC.callook+'</button><button class="cb del" title="Remove" aria-label="Remove">'+IC.x+'</button>'+RZ_BTN;
  var mEl=el.querySelector('.calm'),gEl=el.querySelector('.calg'),lEl=el.querySelector('.call'),ws=weekStart();
  function colour(){el.style.setProperty('--cc',c.c);el.style.setProperty('--pal',c.c)}
  var wd=el.querySelector('.calw');for(var i=0;i<7;i++){var d=new Date(2024,0,7+((ws+i)%7)),sp=document.createElement('span');sp.textContent=d.toLocaleDateString(undefined,{weekday:'narrow'});wd.appendChild(sp)}
  // v2.0: looks (c.look): month (default), wide (landscape month), mini (small month, numbers only), week (7 days with
  // what's on), day (tear-off: one big date). Week and day pages remember where they are (c.dy, YYYY-MM-DD).
  function look(){return CAL_LOOKS.some(function(x){return x.id===c.look})?c.look:'month'}
  function dayOf(){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(c.dy||'');return m?new Date(+m[1],+m[2]-1,+m[3]):new Date()}
  function keyOf(d){return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())}
  function todayKey(){return keyOf(new Date())}
  function navLabels(){var L=look(),u=L==='week'?'week':L==='day'?'day':'month';
    [['prv','Previous '+u],['nxt','Next '+u]].forEach(function(x){var b=el.querySelector('.calnav.'+x[0]);b.title=x[1];b.setAttribute('aria-label',x[1])})}
  function lookClass(){var L=look();CAL_LOOKS.forEach(function(x){el.classList.toggle('cl-'+x.id,x.id===L)});navLabels()}
  function dayBtn(d,cls){
    var key=keyOf(d),e=c.days[key],b=document.createElement('button');b.type='button';
    b.className=cls+(key===todayKey()?' today':'')+(e&&e.m?' circ':'')+(e?' has':'');
    var lab=d.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'});
    b.setAttribute('aria-label',lab+(e&&e.t?': '+e.t:''));if(e&&e.t)b.title=e.t;
    b.addEventListener('click',function(ev){ev.stopPropagation();dayPop(b,key,lab)});
    return{b:b,e:e,key:key,lab:lab};
  }
  function drawWeek(){
    var d0=dayOf();d0.setDate(d0.getDate()-((d0.getDay()-ws+7)%7));var d6=new Date(d0);d6.setDate(d0.getDate()+6);
    mEl.textContent=d0.toLocaleDateString(undefined,{day:'numeric',month:'short'})+' \u2013 '+d6.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
    gEl.innerHTML='';lEl.innerHTML='';lEl.hidden=true;
    for(var i=0;i<7;i++){var d=new Date(d0);d.setDate(d0.getDate()+i);var x=dayBtn(d,'calwd');
      var h=document.createElement('span');h.className='cwh';h.textContent=d.toLocaleDateString(undefined,{weekday:'short'});
      var n=document.createElement('b');n.textContent=d.getDate();var t=document.createElement('span');t.className='cwt';t.textContent=(x.e&&x.e.e?x.e.e+' ':'')+(x.e&&x.e.t||'');
      x.b.appendChild(h);x.b.appendChild(n);x.b.appendChild(t);gEl.appendChild(x.b)}
    fit();
  }
  function drawDay(){
    var d=dayOf();mEl.textContent=d.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    gEl.innerHTML='';lEl.innerHTML='';lEl.hidden=true;var x=dayBtn(d,'calpage');
    var wk=document.createElement('span');wk.className='cpw';wk.textContent=d.toLocaleDateString(undefined,{weekday:'long'});
    var n=document.createElement('b');n.className='cpn';n.textContent=d.getDate();
    var t=document.createElement('span');t.className='cpt';t.textContent=x.e&&(x.e.t||x.e.e)?((x.e.e?x.e.e+' ':'')+(x.e.t||'')):'tap to write';if(!(x.e&&(x.e.t||x.e.e)))t.classList.add('cpe');
    x.b.appendChild(wk);x.b.appendChild(n);x.b.appendChild(t);gEl.appendChild(x.b);
    fit();
  }
  function draw(){
    lookClass();if(look()==='week')return drawWeek();if(look()==='day')return drawDay();
    var mini=look()==='mini';
    var y=+c.ym.slice(0,4),m=+c.ym.slice(5,7)-1,first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),lead=(first.getDay()-ws+7)%7,now=new Date(),
        today=now.getFullYear()+'-'+pad2(now.getMonth()+1)+'-'+pad2(now.getDate());
    mEl.textContent=first.toLocaleDateString(undefined,{month:mini?'short':'long',year:'numeric'});
    gEl.innerHTML='';lEl.innerHTML='';var list=[];
    for(var i=0;i<lead;i++)gEl.appendChild(document.createElement('span'));
    for(var dd=1;dd<=days;dd++){(function(dd){
      var key=c.ym+'-'+pad2(dd),e=c.days[key],b=document.createElement('button');b.type='button';
      b.className='cald'+(key===today?' today':'')+(e&&e.m?' circ':'')+(e?' has':'');
      var lab=new Date(y,m,dd).toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'});
      b.setAttribute('aria-label',lab+(e&&e.t?': '+e.t:''));if(e&&e.t)b.title=e.t;
      var n=document.createElement('span');n.textContent=dd;b.appendChild(n);
      if(e&&e.e&&!mini){var em=document.createElement('span');em.className='ce';em.textContent=e.e;b.appendChild(em)}
      else if(e&&(e.t||e.e)){var dt=document.createElement('i');dt.className='cdot';b.appendChild(dt)}
      b.addEventListener('click',function(ev){ev.stopPropagation();dayPop(b,key,lab)});
      gEl.appendChild(b);if(e&&(e.t||e.e))list.push([dd,e]);
    })(dd)}
    list.slice(0,5).forEach(function(x){var li=document.createElement('li');var b=document.createElement('b');b.textContent=x[0];li.appendChild(b);li.appendChild(document.createTextNode(' '+(x[1].e?x[1].e+' ':'')+(x[1].t||'')));lEl.appendChild(li)});
    if(list.length>5){var li=document.createElement('li');li.className='more';li.textContent='+ '+(list.length-5)+' more';lEl.appendChild(li)}
    lEl.hidden=!list.length||mini;fit();
  }
  function dayPop(b,key,lab){openPop(b,function(box,close){
    var e=Object.assign({t:'',e:'',m:false},c.days[key]||{});
    function upd(){if(e.t.trim()||e.e||e.m)c.days[key]={t:e.t.trim().slice(0,40),e:e.e,m:!!e.m};else delete c.days[key];save();draw()}
    var h=document.createElement('h4');h.textContent=lab;box.appendChild(h);
    var inp=document.createElement('input');inp.type='text';inp.className='lki';inp.maxLength=40;inp.placeholder='what’s happening?';inp.value=e.t;inp.setAttribute('aria-label','What’s happening on '+lab);
    inp.addEventListener('input',function(){e.t=inp.value;upd()});inp.addEventListener('keydown',function(ev){if(ev.key==='Enter'){ev.preventDefault();close()}});box.appendChild(inp);
    var row=document.createElement('div');row.className='cale';row.setAttribute('role','radiogroup');row.setAttribute('aria-label','Sticker for the day');
    CAL_EMO.forEach(function(x){var q=document.createElement('button');q.type='button';q.textContent=x||'–';q.setAttribute('role','radio');q.setAttribute('aria-label',x||'None');
      function mark(){var on=e.e===x;q.className=on?'on':'';q.setAttribute('aria-checked',on?'true':'false')}q._m=mark;mark();
      q.addEventListener('click',function(){e.e=x;upd();sfx.blip();row.querySelectorAll('button').forEach(function(z){z._m()})});row.appendChild(q)});
    box.appendChild(row);
    var tr=document.createElement('label');tr.className='trow';var tt=document.createElement('span');tt.textContent='Circle this day';var sw=document.createElement('input');sw.type='checkbox';sw.className='sw';sw.checked=e.m;
    sw.addEventListener('change',function(){e.m=sw.checked;upd();if(e.m)sfx.tick();else sfx.blip()});tr.appendChild(tt);tr.appendChild(sw);box.appendChild(tr);
    setTimeout(function(){inp.focus()},0);
  })}
  function month(dir){
    var L=look();if(L==='week'||L==='day'){var d=dayOf();d.setDate(d.getDate()+dir*(L==='week'?7:1));c.dy=keyOf(d);
      if(L==='day'){el.classList.remove('tear','untear');void el.offsetWidth;el.classList.add(dir>0?'tear':'untear')}sfx.flip();save();draw();return}
    var y=+c.ym.slice(0,4),m=+c.ym.slice(5,7)-1+dir,d2=new Date(y,m,1);c.ym=d2.getFullYear()+'-'+pad2(d2.getMonth()+1);sfx.flip();save();draw()}
  el.querySelector('.calnav.prv').addEventListener('click',function(e){e.stopPropagation();month(-1)});
  el.querySelector('.calnav.nxt').addEventListener('click',function(e){e.stopPropagation();month(1)});
  // double-click the month name to jump back to this month
  // app fix: pressing the card captures the pointer (to drag it), so the double-click arrives at the card, not the
  // month name; listen on the card and check that the double-click was on the month name
  el.addEventListener('dblclick',function(e){var r=mEl.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return;
    e.stopPropagation();if(c.ym!==ymNow()||c.dy){c.ym=ymNow();delete c.dy;sfx.flip();save();draw()}});
  el.querySelector('.clook').addEventListener('click',function(e){e.stopPropagation();
    menu(this,'Calendar look',CAL_LOOKS.map(function(x){return{id:x.id,label:x.name}}),look(),function(id){if(id==='month')delete c.look;else c.look=id;sfx.blip();draw();
      // a wider look shouldn't hang off the edge of the board
      var W=board.clientWidth;if(el.offsetLeft+el.offsetWidth>W-8){c.x=Math.max(0,W-8-el.offsetWidth)/W;setPos(el,c)}keepIn(el);save();yarnFor(500)})});
  el.querySelector('.dot').addEventListener('click',function(e){e.stopPropagation();sfx.blip();c.c=CAL_COLS[(CAL_COLS.indexOf(c.c)+1)%CAL_COLS.length];colour();save()});
  armDel(el.querySelector('.del'),'Remove?',function(){data.notes=data.notes.filter(function(q){return q.id!==c.id});save();bye(el,c.id)});
  colour();draw();resizable(el,c);draggable(el,c);pinUp(el,c); // v2.0: no longer stretched; pick a look instead
  return el;
}
var CAL_LOOKS=[{id:'month',name:'Month'},{id:'wide',name:'Wide month'},{id:'mini',name:'Mini month'},{id:'week',name:'Week'},{id:'day',name:'Tear-off day'}];
function cleanCal(n){
  if(n.look!=null&&!CAL_LOOKS.some(function(x){return x.id===n.look&&x.id!=='month'}))delete n.look;
  if(n.dy!=null&&!/^\d{4}-\d{2}-\d{2}$/.test(n.dy))delete n.dy;
  delete n.hs; // v2.0: calendars aren't stretched any more
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(n.ym||''))n.ym=ymNow();if(CAL_COLS.indexOf(n.c)<0)n.c=CAL_COLS[0];
  var d={};if(n.days&&typeof n.days==='object')Object.keys(n.days).forEach(function(k){var e=n.days[k];if(!/^\d{4}-\d{2}-\d{2}$/.test(k)||!e||typeof e!=='object')return;
    var o={t:typeof e.t==='string'?e.t.slice(0,40):'',e:CAL_EMO.indexOf(e.e)>=0?e.e:'',m:!!e.m};if(o.t||o.e||o.m)d[k]=o});n.days=d;delete n.text;
}

function cleanNote(n){
  if(n.kind==='cal')cleanCal(n);
  else if(n.kind==='idx'){rtStore(n,rtOf(n,IDX_MAX));if(IDX_COLS.indexOf(n.c)<0)n.c=IDX_COLS[0]}
  else if(n.kind==='todo'){n.items=(Array.isArray(n.items)?n.items:[]).filter(function(it){return it&&typeof it==='object'}).slice(0,TODO_MAX).map(function(it){var o={t:typeof it.t==='string'?it.t.replace(/\n/g,' ').slice(0,TODO_LEN):'',d:!!it.d};if(Array.isArray(it.rt))tdStore(o,rtClean(it.rt,TODO_LEN));return o});if(!n.items.length)n.items=[{t:'',d:false}]}
  else{delete n.kind;rtStore(n,rtOf(n,NOTE_MAX))}
  if(n.sc!=null){var z=+n.sc;if(isFinite(z)&&z!==1)n.sc=Math.max(.5,Math.min(4,z));else delete n.sc}
  // v1.7: own font, length (hs), stack state
  if(n.font&&!fontById(n.font))delete n.font;
  if(n.hs!=null){var hz=+n.hs;if(isFinite(hz)&&Math.abs(hz-1)>.01)n.hs=Math.round(Math.max(.5,Math.min(3,hz))*100)/100;else delete n.hs}
  if(!stackable(n)||typeof n.pile!=='string'||!n.pile){delete n.pile;delete n.po;delete n.fan}else{n.po=isFinite(+n.po)?+n.po:0;if(n.fan!==true)delete n.fan}
}
// ---- v1.4: index cards (kept with the notes as kind:'idx'); drop one onto another to pile them up (pile:'p…', po: order) ----
var IDX_COLS=['#fffefa','#fdf3c7','#fbe1e6','#e2eefc','#e3f3e6','#efe6fb'],IDX_MAX=300;
// v1.7: stacks of sticky notes, to-do lists and index cards, mixed. pile:'p…' (the group), po (order in it),
// fan:true (spread out to look at; the group is kept and can be stacked again)
// v2.0: polaroids and photobooth strips stack too (with each other and with notes). Photos are told apart by their file.
function stackable(n){return !!n&&(n.file||n.files?(!n.kind||n.kind==='photo'||n.kind==='strip'):(!n.kind||n.kind==='todo'||n.kind==='idx'))}
function stackItems(){return data.notes.concat(data.photos)}
function pileOf(pid){return stackItems().filter(function(n){return stackable(n)&&n.pile===pid&&n.s===data.cur}).sort(function(a,b){return a.po-b.po})}
function jit(id,r){var h=0;for(var i=0;i<id.length;i++)h=(h*31+id.charCodeAt(i))|0;return((h%1000)/1000)*r}
function setPos(el,n){var W=board.clientWidth;el.style.left=clampX(n.x*W)+'px';el.style.top=n.y+'px';el.style.setProperty('--r',n.rot+'deg');el.style.zIndex=n.z}
function idxState(el,n){
  var m=n.pile?pileOf(n.pile):[],grp=m.length>1,fan=grp&&!!n.fan,top=grp&&!fan&&m[m.length-1]===n;
  el.classList.toggle('inpile',grp&&!fan);el.classList.toggle('ptop',top);el.classList.toggle('fan',fan);
  var c=el.querySelector('.pcount');if(c)c.textContent=m.length+' cards';
  var b=el.querySelector('.pspread');if(b){b.innerHTML=fan?IC.gather:IC.spread;var t=fan?'Stack these again (or unstack for good)':'Spread the stack out (or unstack for good)';b.title=t;b.setAttribute('aria-label',t)}
}
// after a card leaves or is removed: a group of one is no group; a spread-out group stays where it is; a stack is tidied
function pileFix(pid){
  if(!pid)return;var m=pileOf(pid);
  if(m.length<2){m.forEach(function(n){delete n.pile;delete n.po;delete n.fan;if(cards[n.id])idxState(cards[n.id],n)});save();return}
  if(m.some(function(n){return n.fan})){m.forEach(function(n,i){n.po=i;n.fan=true;if(cards[n.id])idxState(cards[n.id],n)});save();return}
  layoutPile(pid);
}
// lay a pile out as a neat stack: each card a few pixels down-right of the one below, slightly askew
function layoutPile(pid){
  if(!pid)return;var m=pileOf(pid);
  if(m.length<2){m.forEach(function(n){delete n.pile;delete n.po;delete n.fan;if(cards[n.id])idxState(cards[n.id],n)});return}
  var b=m[0],W=board.clientWidth;
  m.forEach(function(n,i){n.po=i;delete n.fan;var k=Math.min(i,6);
    if(i){n.x=b.x+k*4/W;n.y=b.y+k*4;n.rot=Math.round((b.rot+jit(n.id,5)-2.5)*10)/10}
    n.z=++topZ;var el=cards[n.id];if(el){el.classList.add('snap');setPos(el,n);setTimeout(function(){el.classList.remove('snap')},320);idxState(el,n)}
  });
  save();yarnFor(400);
}
// lay the cards out side by side from where the stack is; keep:true keeps them as a group (spread out to look at)
function spreadPile(pid,keep){
  var m=pileOf(pid);if(!m.length)return;var W=board.clientWidth,w=18,h=18,b=m[0];
  m.forEach(function(q){var c=cards[q.id];if(c){w=Math.max(w,c.offsetWidth+18);h=Math.max(h,c.offsetHeight+18)}});
  var x0=b.x*W,per=Math.max(1,Math.floor((W-x0-10)/w));sfx.flip();
  m.forEach(function(q,i){if(keep){q.fan=true;q.po=i}else{delete q.pile;delete q.po;delete q.fan}
    q.x=(x0+(i%per)*w)/W;q.y=b.y+Math.floor(i/per)*h;q.rot=Math.round((jit(q.id,6)-3)*10)/10;q.z=++topZ;
    var c=cards[q.id];if(c){c.classList.add('snap');setPos(c,q);idxState(c,q);setTimeout(function(){c.classList.remove('snap')},320)}});
  save();fit();yarnFor(500);
}
function gatherPile(pid){var m=pileOf(pid);m.forEach(function(q){delete q.fan});sfx.pop();layoutPile(pid);fit()}
// unstack for good: a stack is spread out first; a spread-out group just stops being a group (pins stay on their own cards)
function unstackPile(pid){
  var m=pileOf(pid);if(!m.length)return;
  if(m.some(function(q){return q.fan})){m.forEach(function(q){delete q.pile;delete q.po;delete q.fan;var c=cards[q.id];if(c)idxState(c,q)});sfx.blip();save();yarnFor(400)}
  else spreadPile(pid,false);
}
// the stack controls on a card (next card, spread / stack again / unstack, move the whole stack); returns the drag hooks
function stackCard(el,n){
  el.querySelector('.pflip').addEventListener('click',function(e){e.stopPropagation();if(!n.pile||n.fan)return;
    var m=pileOf(n.pile);if(m.length<2)return;sfx.flip();el.classList.add('tuck');
    setTimeout(function(){el.classList.remove('tuck');var b=m[0];n.po=-1;n.x=b.x;n.y=b.y;n.rot=b.rot;layoutPile(n.pile)},260);
  });
  el.querySelector('.pspread').addEventListener('click',function(e){e.stopPropagation();if(!n.pile)return;var fan=!!n.fan,pid=n.pile;
    menu(this,'Stack',[{id:fan?'gather':'spread',label:fan?'Stack again':'Spread out to look'},{id:'unstack',label:'Unstack for good'}],null,function(id){
      if(id==='spread')spreadPile(pid,true);else if(id==='gather')gatherPile(pid);else unstackPile(pid);
    });
  });
  // move the whole stack by its grip
  (function(){var g=el.querySelector('.pmove'),sx,sy,st=null;
    g.addEventListener('pointerdown',function(e){e.stopPropagation();if(!n.pile)return;g.setPointerCapture(e.pointerId);sx=e.clientX;sy=e.clientY;
      st=pileOf(n.pile).map(function(q){var c=cards[q.id];if(c)c.classList.add('pdrag');return[q,c,c?c.offsetLeft:0,c?c.offsetTop:0]});sfx.lift()});
    g.addEventListener('pointermove',function(e){if(!st)return;var dx=(e.clientX-sx)/ZM,dy=(e.clientY-sy)/ZM;
      st.forEach(function(s){if(s[1]){s[1].style.left=(s[2]+dx)+'px';s[1].style.top=Math.max(0,s[3]+dy)+'px'}});yarnSoon()});
    function end(){if(!st)return;var W=board.clientWidth;st.forEach(function(s){if(s[1]){s[1].classList.remove('pdrag');s[0].x=s[1].offsetLeft/W;s[0].y=s[1].offsetTop}});st=null;sfx.set();save();fit()}
    g.addEventListener('pointerup',end);g.addEventListener('pointercancel',end);
  })();
  return{
    // pulling a card off a stack takes it out of the stack (in a spread-out group it just moves, and stays in the group)
    start:function(){if(n.pile&&!n.fan){var pid=n.pile;delete n.pile;delete n.po;idxState(el,n);pileFix(pid)}},
    // dropping it onto another sticky note, to-do list or index card stacks it on top
    drop:function(){
      if(n.fan)return;
      var r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,best=null;
      stackItems().forEach(function(q){if(q===n||!stackable(q)||q.fan||q.s!==data.cur)return;var c=cards[q.id];if(!c)return;var b=c.getBoundingClientRect();
        if(cx>b.left&&cx<b.right&&cy>b.top&&cy<b.bottom&&(!best||q.z>best.z))best=q});
      if(!best)return;
      if(!best.pile){best.pile='p'+uid();best.po=0}
      n.pile=best.pile;n.po=1e9;sfx.pop();
      // cards of the same kind share the bottom card's size
      var bot=pileOf(best.pile)[0];if((bot.kind||'')===(n.kind||'')&&(bot.sc||1)!==(n.sc||1)){if(bot.sc)n.sc=bot.sc;else delete n.sc;el.style.setProperty('--sc',n.sc||1)}
      layoutPile(n.pile);fit();
    }
  };
}
var PILE_BTNS='<button class="cb pflip pt" title="Next card (puts this one at the bottom)" aria-label="Next card in the stack">'+IC.cycle+'</button>'+
  '<button class="cb pspread pt" title="Spread the stack out (or unstack for good)" aria-label="Spread the stack out">'+IC.spread+'</button>'+
  '<button class="cb pmove pt" title="Drag to move the whole stack" aria-label="Move the whole stack">'+IC.move+'</button><span class="pcount"></span>';
function renderIdx(n){
  var el=document.createElement('div');el.className='card idx';el.tabIndex=-1;place(el,n);el.style.setProperty('--ic',n.c);
  el.innerHTML='<button class="cb dot" title="Change colour" aria-label="Change colour"></button>'+FONT_BTN+
    PILE_BTNS+
    '<button class="cb del" title="Remove" aria-label="Remove">'+IC.x+'</button>'+
    '<button class="cb lnk" title="Link the selected words" aria-label="Add a link">'+IC.link+'</button>'+
    ROT_BTN+RZ_BTN+RZE+
    '<div class="ixe" contenteditable="true" spellcheck="false" role="textbox" aria-multiline="true" aria-label="Index card" data-ph="write on the card…"></div>';
  var ed=el.querySelector('.ixe');rtRender(ed,rtOf(n,IDX_MAX));
  function changed(){rtStore(n,rtRead(ed));save()}
  rtEditor(ed,IDX_MAX,true,changed,true);linkButton(el.querySelector('.lnk'),ed,changed,false);
  ed.addEventListener('blur',function(){if(popEl)return;rtRender(ed,rtOf(n,IDX_MAX))});
  el.querySelector('.dot').addEventListener('click',function(e){e.stopPropagation();sfx.blip();n.c=IDX_COLS[(IDX_COLS.indexOf(n.c)+1)%IDX_COLS.length];el.style.setProperty('--ic',n.c);save()});
  // v1.7: a font of its own (the default is Settings → Cards → caption & label font)
  applyCardFont(el,n);el.querySelector('.font').addEventListener('click',function(e){e.stopPropagation();fontMenu(this,el,n,capFontFF())});
  armDel(el.querySelector('.del'),'Remove?',function(){var pid=n.pile;
    data.notes=data.notes.filter(function(q){return q.id!==n.id});save();bye(el,n.id);pileFix(pid)});
  resizable(el,n);rotatable(el,n);stretchable(el,n,null,.5,3);
  draggable(el,n,null,stackCard(el,n));
  pinUp(el,n);idxState(el,n);
  return el;
}

// ---- sticky notes (v1.1.7: resizable, and a to-do list kind: kind:'todo' with items [{t,d}]) ----
var RZ_BTN='<button class="cb rz" title="Drag to resize (double-click to reset)" aria-label="Resize">'+IC.rz+'</button>';
function noteCommon(el,n){
  // v1.7: a font of its own (the default is the board's body font)
  applyCardFont(el,n);el.querySelector('.font').addEventListener('click',function(e){e.stopPropagation();fontMenu(this,el,n,BODY_FF)});
  el.querySelector('.dot').addEventListener('click',function(e){e.stopPropagation();sfx.blip();var NC=noteColours();n.c=NC[(NC.indexOf(n.c)+1)%NC.length];el.style.setProperty('--nc',n.c);save()});
  armDel(el.querySelector('.del'),'Remove?',function(){var pid=n.pile;
    data.notes=data.notes.filter(function(q){return q.id!==n.id});save();bye(el,n.id);pileFix(pid);
  });
  resizable(el,n);rotatable(el,n);stretchable(el,n,null,.5,3);draggable(el,n,null,stackCard(el,n));pinUp(el,n);idxState(el,n);
}
function renderNote(n){
  if(n.kind==='todo')return renderTodo(n);
  if(n.kind==='idx')return renderIdx(n);
  if(n.kind==='cal')return renderCal(n);
  var el=document.createElement('div');el.className='card note';place(el,n);el.style.setProperty('--nc',n.c);
  el.innerHTML='<div class="tape"></div><button class="cb dot" title="Change colour" aria-label="Change colour"></button>'+FONT_BTN+PILE_BTNS+'<button class="cb del" title="Remove" aria-label="Remove">'+IC.x+'</button><button class="cb lnk" title="Link the selected words" aria-label="Add a link">'+IC.link+'</button>'+ROT_BTN+RZ_BTN+RZE+'<div class="nte" contenteditable="true" spellcheck="false" role="textbox" aria-multiline="true" aria-label="Note" data-ph="write a note\u2026"></div>';
  var ed=el.querySelector('.nte');rtRender(ed,rtOf(n,NOTE_MAX));
  function changed(){rtStore(n,rtRead(ed));save()}
  rtEditor(ed,NOTE_MAX,true,changed,true);linkButton(el.querySelector('.lnk'),ed,changed,false);
  ed.addEventListener('blur',function(){if(popEl)return;rtRender(ed,rtOf(n,NOTE_MAX))});
  noteCommon(el,n);
}
var TODO_MAX=60,TODO_LEN=300,NOTE_MAX=1000; // v1.7: longer notes and to-do lists (were 30 items × 120, notes 160)
// v2.0: to-do items are rich text too (bold / italics), one line each: {t, d, rt?} like a note's text/rt
function tdRt(it){return Array.isArray(it.rt)?rtClean(it.rt,TODO_LEN):rtClean([{t:it.t||''}],TODO_LEN)}
function tdStore(it,segs){segs=segs.map(function(q){var p={t:q.t.replace(/\n/g,' ')};if(q.u)p.u=q.u;if(q.b)p.b=true;if(q.i)p.i=true;return p});it.t=rtPlain(segs);
  if(segs.some(function(q){return q.u||q.b||q.i}))it.rt=segs;else delete it.rt}
// where the caret is in a contenteditable, as text offsets ({a: start, b: end}), or null when it's not in there
function edSel(ed){var g=getSelection();if(!g.rangeCount)return null;var r=g.getRangeAt(0);if(!ed.contains(r.startContainer)||!ed.contains(r.endContainer))return null;
  var q=document.createRange();q.selectNodeContents(ed);q.setEnd(r.startContainer,r.startOffset);var a=q.toString().length;q.setEnd(r.endContainer,r.endOffset);return{a:a,b:q.toString().length}}
function edCaret(ed,atStart){var r=document.createRange();r.selectNodeContents(ed);r.collapse(!!atStart);var g=getSelection();g.removeAllRanges();g.addRange(r)}
function renderTodo(n){
  var el=document.createElement('div');el.className='card note todo';place(el,n);el.style.setProperty('--nc',n.c);
  el.innerHTML='<div class="tape"></div><button class="cb dot" title="Change colour" aria-label="Change colour"></button>'+FONT_BTN+PILE_BTNS+'<button class="cb del" title="Remove" aria-label="Remove">'+IC.x+'</button>'+ROT_BTN+RZ_BTN+RZE+'<div class="tdl" role="list"></div><button class="tdadd" type="button">+ add item</button>';
  var list=el.querySelector('.tdl'),addB=el.querySelector('.tdadd');
  function focusItem(i,atStart){var t=list.querySelectorAll('.tdt')[i];if(!t)return;t.focus({preventScroll:true});edCaret(t,atStart)}
  function add(at){if(n.items.length>=TODO_MAX){sfx.warn();toast('A list can hold '+TODO_MAX+' items');return false}n.items.splice(at,0,{t:'',d:false});build();save();fit();return true}
  function remove(it){var i=n.items.indexOf(it);if(i<0)return 0;if(n.items.length===1){it.t='';it.d=false}else n.items.splice(i,1);build();save();fit();return i}
  // v1.7: select all. ⌘A selects the item's text; pressing it again (or on an empty item) selects the whole list. Then ⌘C copies
  // every item (one per line), ⌘X cuts them, Delete clears the list, typing or pasting replaces it. Esc, a click or the arrows leave it.
  var allSel=false;
  function selAll(on){allSel=on;list.classList.toggle('tdall',on);if(on)sfx.blip()}
  function allText(){return n.items.map(function(it){return it.t}).join('\n')}
  function replaceAll(lines){n.items=lines.slice(0,TODO_MAX).map(function(t){return{t:t.replace(/\s+/g,' ').slice(0,TODO_LEN),d:false}});if(!n.items.length)n.items=[{t:'',d:false}];selAll(false);build();save();fit();focusItem(n.items.length-1)}
  list.addEventListener('copy',function(e){if(!allSel)return;e.preventDefault();e.clipboardData.setData('text/plain',allText())});
  list.addEventListener('cut',function(e){if(!allSel)return;e.preventDefault();e.clipboardData.setData('text/plain',allText());sfx.trash();replaceAll([''])});
  list.addEventListener('paste',function(e){if(!allSel)return;e.preventDefault();e.stopPropagation();var t=(e.clipboardData.getData('text')||'').replace(/\r/g,'');replaceAll(t.split('\n').filter(function(l,i,a){return l.trim()||a.length===1}))},true);
  list.addEventListener('beforeinput',function(e){if(!allSel)return;e.preventDefault();if(e.inputType==='insertText'&&e.data)replaceAll([e.data]);else if(/^delete/.test(e.inputType)){sfx.trash();replaceAll([''])}},true);
  list.addEventListener('pointerdown',function(){if(allSel)selAll(false)},true);
  list.addEventListener('focusout',function(){setTimeout(function(){if(allSel&&!list.contains(document.activeElement))selAll(false)},0)});
  list.addEventListener('keydown',function(e){
    if((e.metaKey||e.ctrlKey)&&!e.shiftKey&&!e.altKey&&e.key.toLowerCase()==='a'){var ta=e.target;if(!ta.classList||!ta.classList.contains('tdt'))return;
      if(allSel){e.preventDefault();return}
      var q=edSel(ta),L=ta.textContent.length;if(!L||(q&&q.a===0&&q.b===L)){e.preventDefault();e.stopPropagation();selAll(true)}return}
    if(!allSel)return;
    if(e.key==='Backspace'||e.key==='Delete'){e.preventDefault();e.stopPropagation();sfx.trash();replaceAll([''])}
    else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();selAll(false)}
    else if(/^Arrow|^Tab$|^Home$|^End$/.test(e.key))selAll(false);
    else if(e.key==='Enter'){e.preventDefault();e.stopPropagation()}
  },true);
  function build(){
    list.innerHTML='';
    n.items.forEach(function(it){
      var r=document.createElement('div');r.className='tdr'+(it.d?' done':'');r.setAttribute('role','listitem');
      var cb=document.createElement('input');cb.type='checkbox';cb.className='tdc';cb.checked=!!it.d;cb.setAttribute('aria-label','Done');
      var ta=document.createElement('div');ta.className='tdt';ta.contentEditable='true';ta.spellcheck=spellOn();ta.setAttribute('role','textbox');ta.setAttribute('aria-label','To-do item');ta.dataset.ph='to do\u2026';
      rtRender(ta,tdRt(it));
      rtEditor(ta,TODO_LEN,false,function(){tdStore(it,rtRead(ta));save();fit()},true);
      ta.addEventListener('blur',function(){if(!popEl)rtRender(ta,tdRt(it))});
      var x=document.createElement('button');x.type='button';x.className='tdx';x.textContent='×';x.title='Remove item';x.setAttribute('aria-label','Remove item');
      cb.addEventListener('change',function(){it.d=cb.checked;r.classList.toggle('done',it.d);if(it.d)sfx.tick();else sfx.blip();save()});
      ta.addEventListener('keydown',function(e){
        var i=n.items.indexOf(it),q=edSel(ta)||{a:0,b:0},L=ta.textContent.length;
        if(e.key==='Enter'){e.preventDefault();if(add(i+1))focusItem(i+1)}
        else if(e.key==='Backspace'&&!L&&n.items.length>1){e.preventDefault();remove(it);focusItem(Math.max(0,i-1))}
        else if(e.key==='ArrowUp'&&q.a===0&&q.b===0&&i>0){e.preventDefault();focusItem(i-1)}
        else if(e.key==='ArrowDown'&&q.a===L&&q.b===L&&i<n.items.length-1){e.preventDefault();focusItem(i+1,true)}
      });
      x.addEventListener('click',function(e){e.stopPropagation();sfx.blip();var i=remove(it);focusItem(Math.min(i,n.items.length-1))});
      r.appendChild(cb);r.appendChild(ta);r.appendChild(x);list.appendChild(r);
    });
  }
  addB.addEventListener('click',function(e){e.stopPropagation();if(add(n.items.length)){sfx.blip();focusItem(n.items.length-1)}});
  build();noteCommon(el,n);
  return el;
}
function slot(){
  var W=board.clientWidth,cols=Math.max(2,Math.floor(W/230)),cw=W/cols,x=0,y=170,
      R=Object.keys(cards).map(function(k){var e=cards[k];return[e.offsetLeft,e.offsetTop,e.offsetWidth,e.offsetHeight]});
  for(var k=0;k<600;k++){
    var c=k%cols,r=Math.floor(k/cols),w=Math.min(cw*.9,230),h=250,hit=false;
    x=PAN+c*cw+cw*(.05+Math.random()*.08);y=170+r*270+Math.random()*24;
    for(var i=0;i<R.length&&!hit;i++){var b=R[i];hit=Math.min(x+w,b[0]+b[2])-Math.max(x,b[0])>Math.min(24,b[2]/2)&&Math.min(y+h,b[1]+b[3])-Math.max(y,b[1])>Math.min(24,b[3]/2)}
    if(!hit)break;
  }
  return{x:x/W,y:Math.round(y),rot:Math.round((Math.random()*14-7)*10)/10,z:++topZ};
}
// "+ Note" offers a sticky note or a to-do list
noteBtn.addEventListener('click',function(){
  menu(noteBtn,'Add a note',[{id:'note',label:'Sticky note',pv:'nkpv'},{id:'todo',label:'To-do list',pv:'nkpv td'},{id:'cal',label:'Calendar',pv:'nkpv cal'}],null,addNote);
});
function addNote(kind){{
    var NC=noteColours(),n=Object.assign({id:'n'+uid(),s:data.cur,c:NC[Math.floor(Math.random()*NC.length)]},kind==='todo'?{kind:'todo',items:[{t:'',d:false}]}:kind==='cal'?{kind:'cal',c:CAL_COLS[0],ym:ymNow(),days:{}}:{text:''},slot());
    if(kind==='cal')n.rot=Math.round(n.rot*4)/10;
    data.notes.push(n);renderNote(n);sfx.pop();sfx.land(.4);save();fit();
    var ta=cards[n.id].querySelector('textarea,.nte,.tdt');if(ta)setTimeout(function(){ta.focus({preventScroll:true})},350);
  }
}

// ---- sections ----
// v1.8: sections can sit inside other sections, any depth deep (sections[].parent = the id of the section it's in).
// The list stays flat: siblings keep their order in it. sections[].fold = its sub-sections are tucked away in the sidebar.
function secById(id){for(var i=0;i<data.sections.length;i++)if(data.sections[i].id===id)return data.sections[i];return null}
function secKids(pid){return data.sections.filter(function(s){return (s.parent||null)===(pid||null)})}
function secPathOf(sc){var out=[],seen={};while(sc&&!seen[sc.id]){seen[sc.id]=1;out.unshift(sc);sc=sc.parent?secById(sc.parent):null}return out}
function secTree(id){var out=[id];for(var i=0;i<out.length;i++)secKids(out[i]).forEach(function(k){out.push(k.id)});return out} // a section and everything inside it
function secOrder(){var out=[];(function walk(pid,d){secKids(pid).forEach(function(s){out.push({sc:s,d:d});walk(s.id,d+1)})})(null,0);return out}
// parents that don't exist, or that loop back round, are dropped (the section moves to the top level)
function cleanSecTree(){
  var ids={};data.sections.forEach(function(s){ids[s.id]=1});
  data.sections.forEach(function(s){if('parent' in s&&(typeof s.parent!=='string'||!ids[s.parent]||s.parent===s.id))delete s.parent;if(s.fold!==true)delete s.fold});
  data.sections.forEach(function(s){var seen={},p=s;while(p&&p.parent){if(seen[p.id]){delete p.parent;break}seen[p.id]=1;p=secById(p.parent)}});
}
function goSection(id){if(data.cur!==id&&secById(id)){sfx.tab();data.cur=id;save();renderSection()}}
function renderSection(){
  secPathOf(curSection()).slice(0,-1).forEach(function(s){delete s.fold}); // v1.8: going to a section shows where it is in the sidebar
  if(typeof setPan==='function'&&PAN)setPan(0);closePop();if(sel)clearSel();Object.keys(cards).forEach(function(k){cards[k].remove()});cards={};
  data.photos.filter(function(p){return p.s===data.cur}).forEach(renderPhoto);
  data.notes.filter(function(n){return n.s===data.cur}).forEach(renderNote);
  data.labels.filter(function(l){return l.s===data.cur}).forEach(renderLabel);
  shown();if(typeof yarnFor==='function')yarnFor(600);renderTabs();fit();
  if(dir)applyTheme(curTheme()); // v1.7: the section's own theme, if it has one
}
function deleteSection(id){
  var gone={},sc=secById(id),par=sc&&sc.parent;secTree(id).forEach(function(k){gone[k]=1}); // v1.8: its sub-sections go too
  if(data.sections.every(function(s){return gone[s.id]}))return; // there's always at least one section
  var ph=data.photos.filter(function(p){return gone[p.s]});
  data.photos=data.photos.filter(function(p){return !gone[p.s]});
  ph.forEach(function(p){dropFiles(p);dropUrls(p)});
  data.notes=data.notes.filter(function(n){return !gone[n.s]});
  data.labels=data.labels.filter(function(l){return !gone[l.s]});
  // v1.6.3 fix: also drop pins stuck in this section's cards, and any yarn tied to a removed pin
  var live={};data.photos.concat(data.notes,data.labels).forEach(function(o){live[o.id]=1});
  data.pins=data.pins.filter(function(p){return p.card?!!live[p.card]:!gone[p.s]});
  var pk={};data.pins.forEach(function(p){pk[p.id]=1});data.yarns=data.yarns.filter(function(y){return pk[y.a]&&pk[y.b]});yarnFor(100);
  data.sections=data.sections.filter(function(s){return !gone[s.id]});
  var wasCur=!!gone[data.cur];if(wasCur)data.cur=par&&secById(par)?par:secOrder()[0].sc.id;
  save();if(wasCur)renderSection();else renderTabs();
  if(setEl.style.display==='flex')renderSecList();
}
function delLabel(id){var n=secTree(id).length-1;return n?'Delete it and '+plural(n,'sub-section','sub-sections')+'?':'Delete section & its contents?'}
function canDelete(id){var t=secTree(id);return data.sections.some(function(s){return t.indexOf(s.id)<0})}
// move a section: before or after another one, or inside it (at the end, or 'first')
function moveSection(id,tid,w){
  var sc=secById(id),t=tid?secById(tid):null,a=data.sections;if(!sc||(t&&secTree(id).indexOf(tid)>=0))return;
  a.splice(a.indexOf(sc),1);
  if(!t){delete sc.parent;a.push(sc)}
  else if(w==='into'||w==='first'){sc.parent=t.id;delete t.fold;var ks=secKids(t.id);if(w==='first'&&ks.length)a.splice(a.indexOf(ks[0]),0,sc);else a.push(sc)}
  else{if(t.parent)sc.parent=t.parent;else delete sc.parent;a.splice(a.indexOf(t)+(w==='after'?1:0),0,sc)}
  sfx.blip();save();renderTabs();if(setEl.style.display==='flex')renderSecList();
  if(dir)applyTheme(curTheme()); // a theme can come from the section it's in
}

// ---- v1.8: the sections sidebar (slides in from the left over the board) ----
var sbEl=document.getElementById('sb'),sbTree=document.getElementById('sbTree'),sbBtn=document.getElementById('sbBtn'),sbOpen=false,secDrag=null;
var SVG_CAR='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',SVG_PLUS='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',SVG_PEN='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>';
function secCount(id){var n=0;[data.photos,data.notes,data.labels].forEach(function(l){l.forEach(function(o){if(o.s===id)n++})});return n}
function setSidebar(o){
  if(o&&!dir)return;o=!!o;if(o===sbOpen)return;
  sbOpen=o;sbEl.classList.toggle('open',o);sbEl.setAttribute('aria-hidden',o?'false':'true');sbBtn.setAttribute('aria-expanded',o?'true':'false');document.body.classList.toggle('sbopen',o);
  if(o){closePop();sfx.blip();renderTabs();var f=sbTree.querySelector('.sbr.on .sbgo');if(f)setTimeout(function(){f.focus({preventScroll:true});f.scrollIntoView({block:'nearest'})},40)}
  else if(sbEl.contains(document.activeElement))sbBtn.focus({preventScroll:true});
}
function focusRow(id){var g=sbTree.querySelector('.sbr[data-id="'+CSS.escape(id)+'"] .sbgo');if(g)g.focus({preventScroll:true});return g}
function clearDrop(){sbTree.querySelectorAll('.dbefore,.dafter,.dinto').forEach(function(r){r.classList.remove('dbefore','dafter','dinto')});sbTree.querySelectorAll('.sbr').forEach(function(r){r._w=null});sbTree.classList.remove('dend')}
function renderTabs(){
  setTimeout(function(){if(layer){zOrg();fit()}},0);
  var cur=curSection(),path=secPathOf(cur);
  document.getElementById('sbCur').textContent=cur?cur.name:'';
  if(document.activeElement!==titleEl)titleEl.textContent=cur?cur.name:'';
  document.getElementById('secPath').textContent=path.length>1?'in '+path.slice(0,-1).map(function(s){return s.name}).join('  ›  '):'';
  sbTree.innerHTML='';var hideKids={};
  secOrder().forEach(function(o){
    var sc=o.sc;if(sc.parent&&hideKids[sc.parent]){hideKids[sc.id]=1;return}
    if(sc.fold)hideKids[sc.id]=1;
    sbTree.appendChild(secRow(sc,o.d));
  });
}
function secRow(sc,d){
  var kids=secKids(sc.id).length,on=sc.id===data.cur;
  var r=document.createElement('div');r.className='sbr'+(on?' on':'');r.style.setProperty('--d',d);r.dataset.id=sc.id;r.draggable=true;
  r.setAttribute('role','treeitem');r.setAttribute('aria-level',String(d+1));r.setAttribute('aria-selected',on?'true':'false');if(kids)r.setAttribute('aria-expanded',sc.fold?'false':'true');
  if(kids){var c=document.createElement('button');c.className='sbcar'+(sc.fold?'':' open');c.tabIndex=-1;c.title=sc.fold?'Show what’s inside':'Tuck away what’s inside';c.setAttribute('aria-label',c.title);c.innerHTML=SVG_CAR;
    c.addEventListener('click',function(e){e.stopPropagation();if(sc.fold)delete sc.fold;else sc.fold=true;sfx.blip();save();renderTabs();focusRow(sc.id)});r.appendChild(c)}
  else{var sp=document.createElement('span');sp.className='sbsp';r.appendChild(sp)}
  var go=document.createElement('button');go.className='sbgo';if(on)go.setAttribute('aria-current','true');go.title=sc.name;
  var nm=document.createElement('span');nm.className='sbn';nm.textContent=sc.name;
  var n=secCount(sc.id),ct=document.createElement('span');ct.className='sbc';ct.textContent=n?String(n):'';
  go.appendChild(nm);go.appendChild(ct);
  go.addEventListener('click',function(){goSection(sc.id);setSidebar(false)});
  go.addEventListener('dblclick',function(e){e.preventDefault();secRename(sc,go)});
  r.appendChild(go);
  var act=document.createElement('span');act.className='sbact';
  function ab(cls,title,html,fn){var b=document.createElement('button');b.className=cls;b.title=title;b.setAttribute('aria-label',title);b.innerHTML=html;if(fn)b.addEventListener('click',function(e){e.stopPropagation();fn()});act.appendChild(b);return b}
  ab('sbadd','Add a section inside “'+sc.name+'”',SVG_PLUS,function(){openTemplates(sc.id)});
  ab('sbren','Rename',SVG_PEN,function(){secRename(sc,go,true)});
  if(canDelete(sc.id)){var x=ab('sbdel','Delete “'+sc.name+'”','×');armDel(x,delLabel(sc.id),function(){deleteSection(sc.id)})}
  r.appendChild(act);
  // drag to move it: near a row's top or bottom edge = before or after it, over the middle = inside it
  r.addEventListener('dragstart',function(e){if(!r.draggable){e.preventDefault();return}secDrag=sc.id;r.classList.add('dragging');e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/x-cork-section',sc.id)}catch(_){}});
  r.addEventListener('dragend',function(){secDrag=null;clearDrop();r.classList.remove('dragging')});
  r.addEventListener('dragover',function(e){
    if(!secDrag||secTree(secDrag).indexOf(sc.id)>=0)return;
    e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';
    var b=r.getBoundingClientRect(),f=(e.clientY-b.top)/b.height,w=f<.28?'before':f>.72?'after':'into';
    if(r._w!==w){clearDrop();r._w=w;r.classList.add('d'+w)}
  });
  r.addEventListener('drop',function(e){
    if(!secDrag)return;e.preventDefault();e.stopPropagation();var w=r._w,id=secDrag;clearDrop();if(!w)return;
    if(w==='after'&&secKids(sc.id).length&&!sc.fold)w='first'; // the line shows above its first sub-section
    moveSection(id,sc.id,w);
  });
  return r;
}
function secRename(sc,go,keys){
  var r=go.parentNode;r.draggable=false;
  var i=document.createElement('input');i.className='sbin';i.value=sc.name;i.maxLength=24;i.setAttribute('aria-label','Section name');go.replaceWith(i);i.focus();i.select();
  var done=false;function fin(k){if(done)return;done=true;sc.name=i.value.trim()||sc.name;save();renderTabs();if(setEl.style.display==='flex')renderSecList();if(k&&sbOpen)focusRow(sc.id)}
  i.addEventListener('blur',function(){fin(false)});
  i.addEventListener('keydown',function(e){e.stopPropagation();if(e.key==='Enter'){e.preventDefault();fin(true)}if(e.key==='Escape'){e.preventDefault();i.value=sc.name;fin(true)}});
  i.addEventListener('dblclick',function(e){e.stopPropagation()});
}
// dropping below the last row: back to the top level, at the end
sbTree.addEventListener('dragover',function(e){if(!secDrag)return;e.preventDefault();e.dataTransfer.dropEffect='move';if(!sbTree.classList.contains('dend')){clearDrop();sbTree.classList.add('dend')}});
sbTree.addEventListener('dragleave',function(e){if(!sbTree.contains(e.relatedTarget))clearDrop()});
sbTree.addEventListener('drop',function(e){if(!secDrag)return;e.preventDefault();var id=secDrag;clearDrop();moveSection(id,null)});
// keys: up/down between sections, right/left open and close, F2 renames
sbTree.addEventListener('keydown',function(e){
  var go=e.target.closest&&e.target.closest('.sbgo');if(!go)return;
  var rows=[].slice.call(sbTree.querySelectorAll('.sbr')),r=go.parentNode,i=rows.indexOf(r),sc=secById(r.dataset.id);if(!sc)return;
  var kids=secKids(sc.id).length;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();var nx=rows[i+(e.key==='ArrowDown'?1:-1)];if(nx)nx.querySelector('.sbgo').focus()}
  else if(e.key==='ArrowRight'&&kids){e.preventDefault();if(sc.fold){delete sc.fold;save();renderTabs();focusRow(sc.id)}else if(rows[i+1])rows[i+1].querySelector('.sbgo').focus()}
  else if(e.key==='ArrowLeft'){e.preventDefault();if(kids&&!sc.fold){sc.fold=true;save();renderTabs();focusRow(sc.id)}else if(sc.parent)focusRow(sc.parent)}
  else if(e.key==='F2'){e.preventDefault();secRename(sc,go,true)}
});
sbBtn.addEventListener('click',function(){setSidebar(!sbOpen)});
document.getElementById('sbX').addEventListener('click',function(){setSidebar(false)});
document.getElementById('sbNew').addEventListener('click',function(){openTemplates(null)});
// click anywhere else (or Escape) and it slides away
document.addEventListener('pointerdown',function(e){if(sbOpen&&!sbEl.contains(e.target)&&!sbBtn.contains(e.target))setSidebar(false)},true);
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&sbOpen&&!document.querySelector('.pop')&&!(e.target.classList&&e.target.classList.contains('sbin'))){e.stopPropagation();setSidebar(false)}},true);

// ---- add photos, videos and photobooth strips (originals are copied into <folder>/photos) ----
var stripFileEl=document.getElementById('stripFile');
addBtn.addEventListener('click',function(){fileEl.click()});
document.getElementById('stripBtn').addEventListener('click',function(){stripFileEl.click()});
fileEl.addEventListener('change',function(){var l=Array.prototype.slice.call(fileEl.files);fileEl.value='';addFiles(l,false)});
stripFileEl.addEventListener('change',function(){var l=Array.prototype.slice.call(stripFileEl.files);stripFileEl.value='';addFiles(l,true)});
async function storeFile(f,prefix){
  var ext=(f.name.match(/\.[a-z0-9]+$/i)||[isVid(f)?'.mp4':'.jpg'])[0].toLowerCase(),name=(prefix||'')+uid()+ext;
  var fh=await photosDir.getFileHandle(name,{create:true}),w=await fh.createWritable();await w.write(f);await w.close();
  // DESKTOP: keep the untouched iPhone original next to the JPEG made from it (photos only; not the wallpaper)
  if(f._heic&&!prefix){try{var oh=await photosDir.getFileHandle(name.replace(/\.[^.]+$/,'')+f._heicExt,{create:true}),ow=await oh.createWritable();await ow.write(f._heic);await ow.close()}catch(e){}}
  return name;
}
async function addFiles(list,stripOnly){
  if(window.__cork&&window.__cork.heic)list=await window.__cork.heic(list); // DESKTOP: iPhone HEIC photos become JPEGs first
  // v1.2: PDFs become stapled documents; Word files get a hint to save as PDF first
  if(!stripOnly){
    var docs=list.filter(isPdf),wd=list.filter(function(f){return !isPdf(f)&&isWord(f)});list=list.filter(function(f){return !isPdf(f)&&!isWord(f)});
    if(docs.length)await addDocs(docs);
    if(wd.length){sfx.warn();toast(WORD_MSG)}
  }
  if(!list.length)return;
  var imgs=list.filter(function(f){return !isVid(f)}),vids=stripOnly?[]:list.filter(isVid),mode='square',fx=null;
  if(stripOnly){
    if(!imgs.length)return;
    if(imgs.length%4){sfx.warn();toast('A photobooth strip needs 4 photos (or 8, 12…) — you picked '+imgs.length);return}
    mode='strip';
  }else if(imgs.length){mode=await askMode(imgs.length);if(!mode)return}
  var bare=mode==='bare';if(bare)mode='original';
  if(imgs.length){
    var pre=imgs.slice(0,mode==='strip'?4:1).map(function(f){return thQueue(function(){return makeThumb(f,TH_SM)}).then(function(b){return URL.createObjectURL(b||f)},function(){return URL.createObjectURL(f)})}),n=imgs.length;
    var title=mode==='strip'?(n===4?'Add a filter to this strip?':'Add a filter to these '+(n/4)+' strips?'):(n===1?'Add a filter?':'Add a filter to these '+n+' photos?');
    var r=await openFx({title:title,sub:'Your originals stay untouched. You can change this later with the filter button (half-circle icon) on the card.',srcs:pre,strip:mode==='strip',f:null,ok:mode==='strip'?'Add strip'+(n>4?'s':''):'Add photo'+(n>1?'s':'')});
    Promise.all(pre).then(function(us){us.forEach(function(u){URL.revokeObjectURL(u)})});
    if(r===undefined)return;fx=r;
  }
  var ok=0,bad=0;
  function landed(p){sfx.land((parseFloat(cards[p.id].style.animationDelay)||0)/1000+.38);ok++}
  if(mode==='strip'){
    for(var i=0;i<imgs.length;i+=4){
      try{
        var grp=imgs.slice(i,i+4),names=[];for(var g of grp)names.push(await storeFile(g));
        var p=Object.assign({id:'b'+uid(),kind:'strip',files:names,s:data.cur,caption:''},slot());if(fx)p.f=fx;
        grp.forEach(function(f,k){files[p.id+'#'+k]=f});data.photos.push(p);renderPhoto(p);landed(p);
      }catch(e){bad+=4}
    }
  }else{
    for(var f of imgs){
      try{var name=await storeFile(f),p2=Object.assign({id:name,file:name,s:data.cur,caption:'',mode:mode,kind:'photo',ar:await measure(f)},slot());if(fx)p2.f=fx;if(bare){p2.bare=true;p2.hold='pin'}
        files[p2.id]=f;data.photos.push(p2);renderPhoto(p2);landed(p2)}catch(e){bad++}
    }
  }
  for(var v of vids){
    try{var vn=await storeFile(v),p3=Object.assign({id:vn,file:vn,s:data.cur,caption:'',mode:'square',kind:'video',ar:await measureVideo(v)},slot());
      files[p3.id]=v;data.photos.push(p3);renderPhoto(p3);landed(p3)}catch(e){bad++}
  }
  save();fit();if(ok)sparkle(stripOnly?document.getElementById('stripBtn'):addBtn);if(bad)toast(bad+' photo(s) couldn’t be saved');
}

// ---- settings panel ----
var VERSION='v2.0.0';
var gearBtn=document.getElementById('gear'),setEl=document.getElementById('set'),setMain=document.getElementById('setMain'),setStore=document.getElementById('setStore'),
    sndOn=document.getElementById('sndOn'),volEl=document.getElementById('vol'),volN=document.getElementById('volN'),secList=document.getElementById('secList');
document.getElementById('about').textContent='About · Corkboard '+VERSION;
// pv = small preview of each theme's texture for the theme picker
var THEMES=[
  {id:'classic',name:'Classic cork',bg:'#c8945a',pv:'radial-gradient(rgba(90,55,25,.45) 1px,transparent 1.6px) 0 0/7px 7px,radial-gradient(rgba(255,230,180,.35) 1px,transparent 1.8px) 3px 5px/11px 11px,#c8945a'},
  {id:'chalkboard',name:'Chalkboard',bg:'#2f3d37',pv:'radial-gradient(rgba(255,255,255,.08) 1px,transparent 1.6px) 0 0/9px 9px,#2f3d37'},
  {id:'midnight',name:'Midnight',bg:'#1b2340',pv:'radial-gradient(rgba(190,205,255,.3) 1px,transparent 1.5px) 0 0/13px 13px,#1b2340'},
  {id:'linen',name:'Linen',bg:'#eee7da',pv:'repeating-linear-gradient(0deg,rgba(120,100,70,.1) 0 1px,transparent 1px 4px),repeating-linear-gradient(90deg,rgba(120,100,70,.1) 0 1px,transparent 1px 4px),#eee7da'},
  {id:'blush',name:'Blush',bg:'#e8b4bd',pv:'radial-gradient(rgba(255,255,255,.45) 1.5px,transparent 2px) 0 0/12px 12px,#e8b4bd'},
  {id:'walnut',name:'Walnut',bg:'#6e4528',pv:'repeating-linear-gradient(90deg,rgba(25,12,4,.35) 0 2px,transparent 2px 46px),repeating-linear-gradient(91deg,rgba(25,12,4,.15) 0 1px,transparent 1px 6px),#6e4528'},
  {id:'kraft',name:'Kraft paper',bg:'#c9a87c',pv:'radial-gradient(rgba(90,60,25,.35) .8px,transparent 1.3px) 0 0/5px 5px,radial-gradient(rgba(255,245,220,.4) .8px,transparent 1.4px) 2px 4px/9px 9px,#c9a87c'},
  {id:'felt',name:'Sage felt',bg:'#6d8c75',pv:'radial-gradient(rgba(0,0,0,.12) .8px,transparent 1.2px) 0 0/3px 3px,radial-gradient(rgba(255,255,255,.1) .8px,transparent 1.2px) 1px 2px/4px 4px,#6d8c75'},
  {id:'lavender',name:'Lavender',bg:'#cdc2e8',pv:'radial-gradient(rgba(255,255,255,.55) 1.5px,transparent 2px) 0 0/12px 12px,#cdc2e8'},
  {id:'ocean',name:'Ocean',bg:'#1d4d5c',pv:'radial-gradient(circle at 50% 120%,transparent 58%,rgba(160,230,240,.14) 60%,transparent 63%) 0 0/24px 12px,#1d4d5c'},
  {id:'custom',name:'Custom',bg:'#7d9a8c'}
];
var TEXTURES=[{id:'cork',name:'Cork'},{id:'dots',name:'Dots'},{id:'weave',name:'Weave'},{id:'grid',name:'Grid'},{id:'stripes',name:'Stripes'},{id:'felt',name:'Felt'},{id:'wood',name:'Wood'},{id:'plain',name:'Plain'}];
var THEME_VARS=['--body-bg','--bg-color','--bg-image','--bg-size','--bg-pos','--vig','--h1','--h1-sh','--muted','--empty-sh','--tab-bg','--tab-bg-h','--tab-ink','--tab-line','--tab-on-bg','--tab-on-ink','--gear-bg','--gear-bg-h','--gear-ink','--btn','--btn-ink'];
var HEX=/^#[0-9a-f]{6}$/i;
function hexOr(v,d){return HEX.test(v||'')?v.toLowerCase():d}
function autoOr(v){return v==='auto'||!HEX.test(v||'')?'auto':v.toLowerCase()}
function rgbOf(h){return[1,3,5].map(function(i){return parseInt(h.slice(i,i+2),16)})}
function lum(h){var c=rgbOf(h);return(.299*c[0]+.587*c[1]+.114*c[2])/255}
function rgba(h,a){return 'rgba('+rgbOf(h).join(',')+','+a+')'}
function cleanCustom(c){
  c=c&&typeof c==='object'?c:{};
  var st=Math.round(+c.strength);
  return{color:hexOr(c.color,'#7d9a8c'),texture:TEXTURES.some(function(t){return t.id===c.texture})?c.texture:'cork',
         strength:isFinite(st)?Math.max(0,Math.min(100,st)):50,text:autoOr(c.text),tabs:autoOr(c.tabs),buttons:autoOr(c.buttons)};
}
// custom theme: background colour + texture (with strength); text, tab and button colours are automatic unless picked
function customVars(c){
  var rgb=rgbOf(c.color),light=lum(c.color)>=.66,k=c.strength/50;
  function dk(t){return rgb.map(function(v){return Math.round(v*(1-t))}).join(',')}
  function a(x){return Math.min(1,x*k).toFixed(3)}
  var tex={
    cork:['radial-gradient(rgba(0,0,0,'+a(.28)+') 1px,transparent 1.6px),radial-gradient(rgba(255,255,255,'+a(.22)+') 1px,transparent 1.8px),radial-gradient(rgba(0,0,0,'+a(.18)+') 1.5px,transparent 2px)','7px 7px,11px 11px,17px 17px','0 0,3px 5px,8px 2px'],
    dots:['radial-gradient(rgba(255,255,255,'+a(.3)+') 1.5px,transparent 2px),radial-gradient(rgba(0,0,0,'+a(.1)+') 1px,transparent 1.6px)','18px 18px,11px 11px','0 0,5px 7px'],
    weave:['repeating-linear-gradient(0deg,rgba(0,0,0,'+a(.06)+') 0 1px,transparent 1px 4px),repeating-linear-gradient(90deg,rgba(0,0,0,'+a(.06)+') 0 1px,transparent 1px 4px)','auto,auto','0 0,0 0'],
    grid:['linear-gradient(rgba(0,0,0,'+a(.1)+') 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,'+a(.1)+') 1px,transparent 1px)','26px 26px,26px 26px','-1px -1px,-1px -1px'],
    stripes:['repeating-linear-gradient(45deg,rgba(255,255,255,'+a(.09)+') 0 12px,transparent 12px 24px)','auto','0 0'],
    felt:['url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'160\' height=\'160\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'.95\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\''+a(.22)+'\'/%3E%3C/svg%3E")','160px 160px','0 0'],
    wood:['repeating-linear-gradient(90deg,rgba(0,0,0,'+a(.3)+') 0 2px,transparent 2px 190px),repeating-linear-gradient(91deg,rgba(0,0,0,'+a(.12)+') 0 1px,transparent 1px 7px,rgba(255,255,255,'+a(.05)+') 7px 9px,transparent 9px 17px),repeating-linear-gradient(89.4deg,rgba(0,0,0,'+a(.09)+') 0 3px,transparent 3px 29px)','auto,auto,auto','0 0,0 0,0 0'],
    plain:['none','auto','0 0']
  }[c.texture];
  var v={'--body-bg':'rgb('+dk(.4)+')','--bg-color':c.color,'--bg-image':tex[0],'--bg-size':tex[1],'--bg-pos':tex[2],'--vig':'rgba('+dk(.6)+',.55)'};
  if(light){
    Object.assign(v,{'--h1':'#2f2a25','--h1-sh':'0 1px 0 rgba(255,255,255,.45)','--muted':'#4a443c','--empty-sh':'none',
      '--tab-bg':'rgba(0,0,0,.12)','--tab-bg-h':'rgba(0,0,0,.2)','--tab-ink':'#2f2a25','--tab-line':'rgba(0,0,0,.4)','--tab-on-bg':'#35312c','--tab-on-ink':'#fbf6ec',
      '--gear-bg':'rgba(0,0,0,.14)','--gear-bg-h':'rgba(0,0,0,.26)','--gear-ink':'#2f2a25'});
  }else{
    Object.assign(v,{'--h1':'#fdfaf3','--h1-sh':'0 2px 6px rgba(0,0,0,.45)','--muted':'#f1ece2','--empty-sh':'0 2px 4px rgba(0,0,0,.4)',
      '--tab-bg':'rgba(0,0,0,.3)','--tab-bg-h':'rgba(0,0,0,.45)','--tab-ink':'#fdf8ee','--tab-line':'rgba(255,255,255,.6)','--tab-on-bg':'#fff8ec','--tab-on-ink':'#35312c',
      '--gear-bg':'rgba(0,0,0,.3)','--gear-bg-h':'rgba(0,0,0,.5)','--gear-ink':'#fdf8ee'});
  }
  if(c.text!=='auto'){var tl=lum(c.text)>=.6;Object.assign(v,{'--h1':c.text,'--muted':c.text,'--h1-sh':tl?'0 2px 6px rgba(0,0,0,.45)':'0 1px 0 rgba(255,255,255,.45)','--empty-sh':tl?'0 2px 4px rgba(0,0,0,.4)':'none'})}
  if(c.tabs!=='auto'){var ink=lum(c.tabs)>=.6?'#2a2622':'#fdf8ee';
    Object.assign(v,{'--tab-bg':rgba(c.tabs,.82),'--tab-bg-h':c.tabs,'--tab-ink':ink,'--tab-line':ink==='#2a2622'?'rgba(0,0,0,.45)':'rgba(255,255,255,.65)','--tab-on-bg':ink,'--tab-on-ink':c.tabs})}
  if(c.buttons!=='auto')Object.assign(v,{'--btn':c.buttons,'--btn-ink':lum(c.buttons)>=.6?'#2a2622':'#fbf6ec'});
  return v;
}
// what "auto" currently resolves to, so the colour pickers start from something sensible
function customAuto(key){var v=customVars(Object.assign({},data.custom,{text:'auto',tabs:'auto',buttons:'auto'}));
  var m={text:v['--h1'],tabs:lum(data.custom.color)>=.66?'#d9d3c8':'#5b4a3a',buttons:'#3b3631'}[key];return HEX.test(m)?m:'#3b3631'}
var wallUrl='';
// v1.7: a section can have a theme of its own (sections[].theme); otherwise it uses the board's (data.theme)
function curSection(){return data.sections.filter(function(s){return s.id===data.cur})[0]||null}
// v1.8: a section without one uses the theme of the section it sits in (and so on up)
function themeOwner(){var p=secPathOf(curSection());for(var i=p.length-1;i>=0;i--){var t=p[i].theme;if(t&&THEMES.some(function(x){return x.id===t}))return p[i]}return null}
function curTheme(){var o=themeOwner();return o?o.theme:data.theme}
function applyTheme(id){
  var r=document.documentElement,s=r.style;
  r.setAttribute('data-theme',id);
  THEME_VARS.forEach(function(k){s.removeProperty(k)});
  if(id==='custom'){var o=customVars(data.custom);for(var k in o)s.setProperty(k,o[k])}
  // a wallpaper photo sits over any theme; text and tabs switch to light-on-dark so they stay readable
  var w=!!(data.wallpaper&&wallUrl);r.classList.toggle('has-wall',w);
  if(w){s.setProperty('--wall','url("'+wallUrl+'")');s.setProperty('--wall-dim',String(Math.max(0,Math.min(80,data.wallpaper.dim))/100));
    var wv={'--h1':'#ffffff','--h1-sh':'0 2px 10px rgba(0,0,0,.6)','--muted':'#ffffff','--empty-sh':'0 2px 6px rgba(0,0,0,.6)','--tab-bg':'rgba(20,15,10,.5)','--tab-bg-h':'rgba(20,15,10,.7)','--tab-ink':'#ffffff','--tab-line':'rgba(255,255,255,.7)','--tab-on-bg':'#ffffff','--tab-on-ink':'#2a2622'};
    for(var q in wv)s.setProperty(q,wv[q]);
  }else{s.removeProperty('--wall');s.removeProperty('--wall-dim')}
}
function paintCustomSwatch(sw){
  sw=sw||document.querySelector('#thmList .thm[data-id="custom"] .tsw');if(!sw)return;var v=customVars(data.custom);
  sw.style.background='none';sw.style.backgroundColor=v['--bg-color'];sw.style.backgroundImage=v['--bg-image'];sw.style.backgroundSize=v['--bg-size'];sw.style.backgroundPosition=v['--bg-pos'];
}
function renderThemes(){
  var box=document.getElementById('thmList');box.innerHTML='';
  // v1.7: "Different theme for this section"
  var sc=curSection(),own=!!(sc&&sc.theme),ow=themeOwner(),sb=document.getElementById('secThm');
  if(sb&&sc){sb.innerHTML='';var lb=document.createElement('label');lb.className='trow';var tx=document.createElement('span');tx.textContent='Different theme for \u201c'+sc.name+'\u201d';
    var sw=document.createElement('input');sw.type='checkbox';sw.className='sw';sw.checked=own;
    sw.addEventListener('change',function(){if(sw.checked)sc.theme=curTheme();else delete sc.theme;applyTheme(curTheme());save();sfx.blip();renderThemes()});
    lb.appendChild(tx);lb.appendChild(sw);sb.appendChild(lb);
    var hn=document.createElement('p');hn.className='shint2';hn.textContent=own?'The theme you pick applies to this section'+(secKids(sc.id).length?' and the sections inside it.':' only.'):ow?'The theme you pick applies to \u201c'+ow.name+'\u201d and the sections inside it.':'The theme you pick applies to the whole board.';sb.appendChild(hn)}
  THEMES.forEach(function(t){
    var on=t.id===curTheme(),b=document.createElement('button');
    b.className='thm'+(on?' on':'');b.dataset.id=t.id;b.setAttribute('role','radio');b.setAttribute('aria-checked',on?'true':'false');
    var sw=document.createElement('span');sw.className='tsw';if(t.id==='custom')paintCustomSwatch(sw);else sw.style.background=t.pv||t.bg;sw.appendChild(document.createElement('i'));
    var nm=document.createElement('span');nm.textContent=t.name;
    b.appendChild(sw);b.appendChild(nm);
    b.addEventListener('click',function(){
      if(curTheme()===t.id)return;
      if(own)sc.theme=t.id;else if(ow)ow.theme=t.id;else data.theme=t.id;applyTheme(curTheme());save();sfx.blip();renderThemes();
    });
    box.appendChild(b);
  });
  renderCustom();renderWall();
}
function crow(label){var r=document.createElement('div');r.className='crow';var l=document.createElement('span');l.textContent=label;r.appendChild(l);return r}
function renderCustom(){
  var cb=document.getElementById('custBox');cb.innerHTML='';cb.hidden=curTheme()!=='custom';
  if(curTheme()!=='custom')return;
  function upd(){applyTheme('custom');save();paintCustomSwatch()}
  var r1=crow('Background colour');
  var ci=document.createElement('input');ci.type='color';ci.value=data.custom.color;ci.setAttribute('aria-label','Background colour');
  ci.addEventListener('input',function(){
    data.custom.color=ci.value.toLowerCase();upd();
    paintCustomSwatch();
  });
  ci.addEventListener('change',function(){sfx.blip()});
  r1.appendChild(ci);cb.appendChild(r1);
  var r2=crow('Texture');
  var seg=document.createElement('div');seg.className='seg';seg.setAttribute('role','radiogroup');seg.setAttribute('aria-label','Texture');
  TEXTURES.forEach(function(t){
    var on=t.id===data.custom.texture,b=document.createElement('button');
    b.textContent=t.name;b.className=on?'on':'';b.setAttribute('role','radio');b.setAttribute('aria-checked',on?'true':'false');
    b.addEventListener('click',function(){
      if(data.custom.texture===t.id)return;
      data.custom.texture=t.id;upd();sfx.blip();renderCustom();
    });
    seg.appendChild(b);
  });
  r2.appendChild(seg);cb.appendChild(r2);
  if(data.custom.texture!=='plain'){
    var r3=crow('Texture strength'),rg=document.createElement('input');rg.type='range';rg.min=0;rg.max=100;rg.value=data.custom.strength;rg.setAttribute('aria-label','Texture strength');
    rg.addEventListener('input',function(){data.custom.strength=+rg.value;upd()});rg.addEventListener('change',function(){sfx.blip()});
    r3.appendChild(rg);cb.appendChild(r3);
  }
  [['text','Text colour'],['tabs','Section tabs'],['buttons','Buttons']].forEach(function(x){
    var key=x[0],r=crow(x[1]),wrap=document.createElement('div');wrap.className='cpick';
    var au=document.createElement('button');au.textContent='Auto';au.className=data.custom[key]==='auto'?'on':'';au.title='Pick automatically for good contrast';
    var c=document.createElement('input');c.type='color';c.setAttribute('aria-label',x[1]+' colour');
    c.value=data.custom[key]==='auto'?customAuto(key):data.custom[key];
    c.addEventListener('input',function(){data.custom[key]=c.value.toLowerCase();au.className='';upd()});
    c.addEventListener('change',function(){sfx.blip()});
    au.addEventListener('click',function(){if(data.custom[key]==='auto')return;data.custom[key]='auto';upd();sfx.blip();renderCustom()});
    wrap.appendChild(au);wrap.appendChild(c);r.appendChild(wrap);cb.appendChild(r);
  });
}
// ---- wallpaper: one of her photos as the board background (copied into <folder>/photos) ----
var wallFileEl=document.getElementById('wallFile');
function renderWall(){
  var box=document.getElementById('wallBox');box.innerHTML='';
  var th=document.createElement('span');th.className='wt';if(wallUrl&&data.wallpaper)th.style.backgroundImage='url("'+wallUrl+'")';
  var lb2=document.createElement('span');lb2.className='wl';lb2.textContent=data.wallpaper&&wallUrl?'Wallpaper photo':'Use a photo as wallpaper';
  var pick=document.createElement('button');pick.className='sbtn alt';pick.textContent=data.wallpaper&&wallUrl?'Change…':'Choose photo…';
  pick.addEventListener('click',function(){wallFileEl.click()});
  box.appendChild(th);box.appendChild(lb2);box.appendChild(pick);
  if(data.wallpaper&&wallUrl){
    var rm=document.createElement('button');rm.className='sbtn alt';rm.textContent='Remove';
    rm.addEventListener('click',function(){photosDir.removeEntry(data.wallpaper.file).catch(function(){});dropThumbs(data.wallpaper.file);data.wallpaper=null;setWallUrl(null);applyTheme(curTheme());save();sfx.blip();renderWall()});
    box.appendChild(rm);
    var hn=document.createElement('div');hn.className='whint';hn.textContent='Covers the theme background. Text and section tabs switch to white so they stay readable.';box.appendChild(hn);
    var vr=document.createElement('div');vr.className='vrow';
    var lab=document.createElement('span');lab.textContent='Dim';
    var rg=document.createElement('input');rg.type='range';rg.min=0;rg.max=80;rg.value=data.wallpaper.dim;rg.setAttribute('aria-label','Dim wallpaper');
    var o=document.createElement('output');o.textContent=data.wallpaper.dim+'%';
    rg.addEventListener('input',function(){data.wallpaper.dim=+rg.value;o.textContent=rg.value+'%';applyTheme(curTheme());save()});
    rg.addEventListener('change',function(){sfx.blip()});
    vr.appendChild(lab);vr.appendChild(rg);vr.appendChild(o);box.appendChild(vr);
  }
}
var wallOwn=false,wallTok=0;
function setWallUrl(f,name){
  if(wallUrl&&wallOwn)URL.revokeObjectURL(wallUrl);wallUrl='';wallOwn=false;var tok=++wallTok;if(!f)return;
  // the wallpaper uses a screen-sized copy (made once), not the full-size photo
  thumbOf(name||f.name,f,TH_WALL).then(function(u){if(tok!==wallTok)return;if(u)wallUrl=u;else{wallUrl=URL.createObjectURL(f);wallOwn=true}
    applyTheme(curTheme());if(setEl.style.display==='flex'&&typeof renderWall==='function')renderWall()});
}
wallFileEl.addEventListener('change',async function(){
  var f=wallFileEl.files[0];wallFileEl.value='';if(!f)return;
  if(window.__cork&&window.__cork.heic)f=(await window.__cork.heic([f]))[0];if(!f)return; // DESKTOP
  try{
    var name=await storeFile(f,'wallpaper-'),old=data.wallpaper&&data.wallpaper.file;
    if(old)photosDir.removeEntry(old).catch(function(){});
    data.wallpaper={file:name,dim:data.wallpaper?data.wallpaper.dim:20};setWallUrl(f,name);applyTheme(curTheme());save();sfx.chime2();renderWall();
  }catch(e){toast('Couldn’t save that photo')}
});
// ---- card style: polaroid frame, pin and sticky-note colours ----
var FRAMES=[['#fffdf8','Classic white'],['#ffffff','Bright white'],['#f4e9d3','Cream'],['#d9c09a','Kraft'],['#f6dfe3','Blush'],['#dcefe4','Mint'],['#dde8f5','Sky'],['#232120','Black']];
var PINS=[['#d6264f','Red'],['#e0a526','Gold'],['#2f6fd6','Blue'],['#2e9e6a','Green'],['#8a4fd6','Purple'],['#f4f1ea','Pearl'],['#2b2b2b','Black']];
var PALETTES=[
  {id:'classic',name:'Classic',c:['#fff2a8','#ffd9e0','#cdeed6','#d3e4ff']},
  {id:'pastel',name:'Pastel',c:['#fdf3c7','#f9e0ec','#e3f1e8','#e6e3f7']},
  {id:'bright',name:'Bright',c:['#ffe44d','#ff9ec1','#8ee6a8','#7fc8ff']},
  {id:'earthy',name:'Earthy',c:['#f1dfb5','#e9c6ae','#cfd8b8','#d6cbb9']},
  {id:'sunset',name:'Sunset',c:['#ffd27a','#ffb199','#f6a5c0','#c7b3f0']}
];
function cleanStyle(s){s=s&&typeof s==='object'?s:{};
  return{frame:hexOr(s.frame,'#fffdf8'),pin:hexOr(s.pin,'#d6264f'),notes:PALETTES.some(function(p){return p.id===s.notes})?s.notes:'classic',
    font:fontById(s.font)?s.font:'auto',label:LOOKS.some(function(L){return L.id===s.label})?s.label:'tape'}}
function noteColours(){var st=data.style||{};return(PALETTES.filter(function(p){return p.id===st.notes})[0]||PALETTES[0]).c}
function applyStyle(){
  var s=document.documentElement.style,st=data.style,dark=lum(st.frame)<.5,c=noteColours();
  s.setProperty('--card-frame',st.frame);s.setProperty('--card-ink',dark?'#f3ede2':'#35312c');s.setProperty('--card-ph',dark?'rgba(243,237,226,.45)':'#b9aa98');
  var F=fontById(st.font);if(F){s.setProperty('--gf',F.ff);s.setProperty('--gfz',F.z)}else{s.removeProperty('--gf');s.removeProperty('--gfz')}
  s.setProperty('--pin',st.pin);s.setProperty('--pal','conic-gradient('+c[0]+' 0 25%,'+c[1]+' 0 50%,'+c[2]+' 0 75%,'+c[3]+' 0)');
}
function renderStyle(){
  var box=document.getElementById('styleBox');box.innerHTML='';
  function swatches(label,list,key){
    var l=document.createElement('div');l.className='stl';l.textContent=label;box.appendChild(l);
    var row=document.createElement('div');row.className='swr';row.setAttribute('role','radiogroup');row.setAttribute('aria-label',label);
    var known=false;
    list.forEach(function(x){var on=data.style[key]===x[0];if(on)known=true;
      var b=document.createElement('button');b.className='swb'+(on?' on':'');b.style.background=x[0];b.title=x[1];b.setAttribute('aria-label',x[1]);b.setAttribute('role','radio');b.setAttribute('aria-checked',on?'true':'false');
      b.addEventListener('click',function(){data.style[key]=x[0];applyStyle();save();sfx.blip();renderStyle()});row.appendChild(b)});
    var c=document.createElement('input');c.type='color';c.value=data.style[key];c.title='Any colour';c.setAttribute('aria-label',label+': any colour');if(!known)c.className='on';
    c.addEventListener('input',function(){data.style[key]=c.value.toLowerCase();applyStyle();save();row.querySelectorAll('.swb').forEach(function(b){b.classList.remove('on')});c.className='on'});
    c.addEventListener('change',function(){sfx.blip()});
    row.appendChild(c);box.appendChild(row);
  }
  swatches('Polaroid & strip frame',FRAMES,'frame');
  swatches('Colour of new photo pins',PINS,'pin');
  var l=document.createElement('div');l.className='stl';l.textContent='Sticky note colours (for new notes and the colour dot)';box.appendChild(l);
  var row=document.createElement('div');row.className='swr';row.setAttribute('role','radiogroup');row.setAttribute('aria-label','Sticky note colours');
  PALETTES.forEach(function(p){var on=data.style.notes===p.id,b=document.createElement('button');b.className='palb'+(on?' on':'');b.setAttribute('role','radio');b.setAttribute('aria-checked',on?'true':'false');
    var sp=document.createElement('span');p.c.forEach(function(c){var i=document.createElement('i');i.style.background=c;sp.appendChild(i)});
    var t=document.createElement('b');t.textContent=p.name;t.style.fontWeight='600';b.appendChild(sp);b.appendChild(t);
    b.addEventListener('click',function(){data.style.notes=p.id;applyStyle();save();sfx.blip();renderStyle()});row.appendChild(b)});
  box.appendChild(row);
  // v1.1.6: default font + look for new labels
  function segRow(label,items,key){
    var t=document.createElement('div');t.className='stl';t.textContent=label;box.appendChild(t);
    var sg=document.createElement('div');sg.className='seg l';sg.setAttribute('role','radiogroup');sg.setAttribute('aria-label',label);
    items.forEach(function(it){var on=data.style[key]===it.id,b=document.createElement('button');b.textContent=it.name;b.className=on?'on':'';
      b.setAttribute('role','radio');b.setAttribute('aria-checked',on?'true':'false');if(it.ff){b.style.fontFamily=it.ff;b.style.fontSize='13px'}
      b.addEventListener('click',function(){if(data.style[key]===it.id)return;data.style[key]=it.id;applyStyle();save();sfx.blip();renderStyle()});sg.appendChild(b)});
    box.appendChild(sg);
  }
  segRow('Caption & label font (cards can pick their own)',[{id:'auto',name:'Default'}].concat(FONTS),'font');
  segRow('Look for new labels',LOOKS.map(function(L){return{id:L.id,name:L.name}}),'label');
}
function plural(n,one,many){return n+' '+(n===1?one:many)}
function showView(v){setMain.hidden=v!=='main';setStore.hidden=v!=='store';setEl.firstElementChild.scrollTop=0}
// settings are split into four tabs; the last one used is remembered while the page is open
var setPane='general',stabs=document.getElementById('stabs');
function showPane(id,focus){
  setPane=id;
  stabs.querySelectorAll('[role=tab]').forEach(function(b){var on=b.dataset.pane===id;b.setAttribute('aria-selected',on?'true':'false');b.tabIndex=on?0:-1;if(on&&focus)b.focus()});
  document.querySelectorAll('#setMain .spane').forEach(function(p){p.hidden=p.id!=='pn-'+id});
  setEl.firstElementChild.scrollTop=0;
}
stabs.addEventListener('click',function(e){var b=e.target.closest('[role=tab]');if(b&&b.dataset.pane!==setPane){sfx.tab();showPane(b.dataset.pane)}});
stabs.addEventListener('keydown',function(e){
  var ids=['general','theme','cards','board'],i=ids.indexOf(setPane);
  if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();sfx.tab();showPane(ids[(i+(e.key==='ArrowRight'?1:ids.length-1))%ids.length],true)}
});
showPane('general');
function openSettings(){
  if(!dir)return;
  sndOn.checked=sound;dangleOn.checked=data.dangle!==false;hoverOn.checked=data.hover!==false;spellBox.checked=spellOn();vidPlay.value=vidSet().play;vidSnd.checked=vidSet().sound;volEl.value=Math.round(volume*100);volN.textContent=Math.round(volume*100)+'%';
  renderThemes();renderStyle();renderSecList();showView('main');setEl.style.display='flex';sfx.blip();document.getElementById('setX').focus();
}
function closeSettings(){if(setEl.style.display!=='flex')return;setEl.style.display='none';gearBtn.focus()}
gearBtn.addEventListener('click',openSettings);
document.getElementById('setX').addEventListener('click',closeSettings);
var downOnBg=false;
setEl.addEventListener('pointerdown',function(e){downOnBg=e.target===setEl});
setEl.addEventListener('click',function(e){if(e.target===setEl&&downOnBg)closeSettings()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&setEl.style.display==='flex')closeSettings()});

// sound: on/off + volume (volume scales the master gain)
var dangleOn=document.getElementById('dangleOn');
dangleOn.addEventListener('change',function(){data.dangle=dangleOn.checked;save();sfx.blip()});
// v2.0: hover movement (data.hover === false: cards stay still under the pointer) and spelling (data.spell === false: off)
var hoverOn=document.getElementById('hoverOn'),spellBox=document.getElementById('spellOn');
function applyHover(){document.documentElement.classList.toggle('nohov',data.hover===false)}
function spellOn(){return data.spell!==false}
var SPELL_SEL='.nte,.ixe,.tdt,.ltx,input.cap,.film input,#title';
function applySpell(root){var on=spellOn();(root||document).querySelectorAll(SPELL_SEL).forEach(function(e){e.spellcheck=on})}
var vidPlay=document.getElementById('vidPlay'),vidSnd=document.getElementById('vidSnd');
function vidChange(){data.video={play:vidPlay.value,sound:vidSnd.checked};cleanVideo();save();sfx.blip();videosApply()}
vidPlay.addEventListener('change',vidChange);vidSnd.addEventListener('change',vidChange);
hoverOn.addEventListener('change',function(){if(hoverOn.checked)delete data.hover;else data.hover=false;applyHover();save();sfx.blip()});
spellBox.addEventListener('change',function(){if(spellBox.checked)delete data.spell;else data.spell=false;applySpell();save();sfx.blip()});
// new cards get the spelling setting as they arrive
new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeType===1)applySpell(n)})})}).observe(document.getElementById('layer'),{childList:true,subtree:true});
sndOn.addEventListener('change',function(){sound=sndOn.checked;data.sound=sound;save();if(sound)sfx.blip()});
volEl.addEventListener('input',function(){
  if(!sound){sound=true;data.sound=true;sndOn.checked=true}
  volume=Math.max(0,Math.min(1,volEl.value/100));data.volume=volume;applyVolume();volN.textContent=Math.round(volume*100)+'%';save();
});
volEl.addEventListener('change',function(){sfx.sample()});

// sections list
function renderSecList(){
  secList.innerHTML='';
  secOrder().forEach(function(o){var sc=o.sc; // v1.8: in sidebar order, sub-sections indented
    var ph=0,sp=0,vd=0,sk=0,dc=0,n=data.notes.filter(function(q){return q.s===sc.id&&!q.kind}).length,cl=data.notes.filter(function(q){return q.s===sc.id&&q.kind==='cal'}).length,ix=data.notes.filter(function(q){return q.s===sc.id&&q.kind==='idx'}).length,td=data.notes.filter(function(q){return q.s===sc.id&&q.kind==='todo'}).length,lb=data.labels.filter(function(q){return q.s===sc.id}).length;data.photos.forEach(function(p){if(p.s!==sc.id)return;if(p.kind==='video')vd++;else if(p.kind==='strip')sp++;else if(p.kind==='sticker')sk++;else if(p.kind==='doc')dc++;else ph++});
    var row=document.createElement('div');row.className='srow'+(sc.id===data.cur?' on':'');if(o.d)row.style.marginLeft=Math.min(o.d,6)*18+'px';
    var go=document.createElement('button');go.className='sgo';go.title='Go to this section';
    if(sc.id===data.cur)go.setAttribute('aria-current','true');
    var nm=document.createElement('span');nm.className='snm';nm.textContent=sc.name;
    var ct=document.createElement('span');ct.className='sct';var parts=[];if(ph)parts.push(plural(ph,'photo','photos'));if(sp)parts.push(plural(sp,'strip','strips'));if(vd)parts.push(plural(vd,'video','videos'));if(n)parts.push(plural(n,'note','notes'));if(td)parts.push(plural(td,'to-do list','to-do lists'));if(cl)parts.push(plural(cl,'calendar','calendars'));if(ix)parts.push(plural(ix,'index card','index cards'));if(lb)parts.push(plural(lb,'label','labels'));if(sk)parts.push(plural(sk,'sticker','stickers'));if(dc)parts.push(plural(dc,'document','documents'));ct.textContent=parts.length?parts.join(' \u00b7 '):'Empty';
    go.appendChild(nm);go.appendChild(ct);
    go.addEventListener('click',function(){
      if(data.cur!==sc.id){sfx.tab();data.cur=sc.id;save();renderSection()}
      closeSettings();
    });
    row.appendChild(go);
    var rn=document.createElement('button');rn.className='rbtn';rn.textContent='\u270e';rn.title='Rename';rn.setAttribute('aria-label','Rename '+sc.name);
    rn.addEventListener('click',function(){rowRename(sc,go)});
    row.appendChild(rn);
    if(canDelete(sc.id)){
      var x=document.createElement('button');x.className='rbtn x';x.textContent='\u00d7';x.title='Delete this section';x.setAttribute('aria-label','Delete '+sc.name);
      row.appendChild(x);
      armDel(x,delLabel(sc.id),function(){deleteSection(sc.id)});
    }
    secList.appendChild(row);
  });
}
function rowRename(sc,go){
  var i=document.createElement('input');i.className='sin';i.value=sc.name;i.maxLength=24;i.setAttribute('aria-label','Section name');
  go.replaceWith(i);i.focus();i.select();
  var done=false;function fin(){if(done)return;done=true;sc.name=i.value.trim()||sc.name;save();renderTabs();renderSecList()}
  i.addEventListener('blur',fin);
  i.addEventListener('keydown',function(e){
    if(e.key==='Enter')fin();
    if(e.key==='Escape'){e.stopPropagation();i.value=sc.name;fin()}
  });
}

// "where is everything stored" view (a web page can't open the file explorer or read the full path)
document.getElementById('showFolder').addEventListener('click',function(){
  var name=dir?dir.name:'',ph=0,vd=0;
  var sp=0,sk=0,dc=0;data.photos.forEach(function(p){if(p.kind==='video')vd++;else if(p.kind==='strip')sp++;else if(p.kind==='sticker')sk++;else if(p.kind==='doc')dc++;else ph++});
  document.getElementById('stName').textContent=name+'/';
  document.getElementById('stCount').textContent=plural(ph,'photo','photos')+', '+plural(vd,'video','videos')+(sp?', '+plural(sp,'photobooth strip','photobooth strips'):'')+(sk?', '+plural(sk,'sticker','stickers'):'')+(dc?', '+plural(dc,'PDF document','PDF documents'):'')+(data.wallpaper?' plus your wallpaper photo':'')+' stored in photos/, plus '+plural(data.notes.length,'sticky note','sticky notes')+' (including to-do lists, calendars and index cards) and '+plural(data.labels.length,'label','labels')+' saved in board.json.';
  document.getElementById('stWin').textContent='Windows: open File Explorer (Win+E), click \u201cThis PC\u201d and type \u201c'+name+'\u201d in the search box.';
  document.getElementById('stMac').textContent='Mac: press \u2318+Space, type \u201c'+name+'\u201d, then press \u2318+Return to reveal it in Finder.';
  // DESKTOP: the app can show the full path and open the folder in Finder / Explorer
  if(window.corkNative){var fm=window.corkNative.platform==='darwin'?'Finder':'File Explorer';
    document.getElementById('stLead').textContent='Your board lives in this folder on your computer. Everything is saved inside it.';
    document.getElementById('stInfo').textContent='Open it in '+fm+' to see your files. If you choose a different folder, the board switches to it.';
    document.getElementById('stTip').hidden=true;document.getElementById('stPicker').textContent='Show in '+fm;
    window.corkNative.rootPath(window.__corkShim.rootOf(dir)).then(function(p){document.getElementById('stName').textContent=p}).catch(function(){});
  }
  sfx.tab();showView('store');
});
document.getElementById('stBack').addEventListener('click',function(){sfx.tab();showView('main')});
document.getElementById('stChoose').addEventListener('click',pick);
document.getElementById('stPicker').addEventListener('click',async function(){
  if(window.corkNative){sfx.blip();window.corkNative.reveal(window.__corkShim.rootOf(dir)).catch(function(){toast('Couldn’t open the folder')});return} // DESKTOP
  var h;
  try{
    try{h=await window.showDirectoryPicker({startIn:dir,mode:'readwrite'})}
    catch(e){if(e&&e.name==='AbortError')return;h=await window.showDirectoryPicker({mode:'readwrite'})}
  }catch(e){return}
  try{if(dir&&await h.isSameEntry(dir)){toast('That\u2019s the folder your board already uses');return}}catch(e){}
  mount(h);
});

// v2.0: the big title is the name of the section you're in; typing in it renames the section (data.title is kept, unused)
var TITLE_MAX=24;
function titleName(){var t=titleEl.textContent.replace(/\s+/g,' ').trim();return t.slice(0,TITLE_MAX)}
titleEl.addEventListener('input',function(){var sc=curSection(),t=titleName();if(sc&&t){sc.name=t;save();document.getElementById('sbCur').textContent=t}});
titleEl.addEventListener('blur',function(){var sc=curSection();if(!sc)return;var t=titleName();if(t)sc.name=t;titleEl.textContent=sc.name;save();renderTabs();if(setEl.style.display==='flex')renderSecList()});
// pasting into the title keeps it plain text on one line, and the name stays a sensible length
titleEl.addEventListener('paste',function(e){e.preventDefault();var t=(e.clipboardData||window.clipboardData).getData('text')||'';document.execCommand('insertText',false,t.replace(/\s+/g,' ').slice(0,Math.max(0,TITLE_MAX-titleEl.textContent.length+getSelection().toString().length)))});
titleEl.addEventListener('beforeinput',function(e){if(e.inputType==='insertText'&&titleEl.textContent.length>=TITLE_MAX&&window.getSelection().isCollapsed)e.preventDefault()});
titleEl.addEventListener('keydown',function(e){if(e.key==='Escape'){var sc=curSection();if(sc)titleEl.textContent=sc.name;titleEl.blur()}});
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden'&&dir){clearTimeout(st);flush()}});
titleEl.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();titleEl.blur()}});

// ---- v1.4: zoom out (never further in than 100%). The cards sit in #layer, which is scaled from just under the tabs. ----
var ZM=1,Z_MIN=.35,Z_ORG=150,layer=document.getElementById('layer'),zmOut=document.getElementById('zmOut'),zmIn=document.getElementById('zmIn'),zmN=document.getElementById('zmN');
// zoom from just below the section tabs (they can wrap onto several rows on a phone)
function zOrg(){var h=document.querySelector('header');Z_ORG=Math.max(150,(h?h.offsetHeight:0)+12);layer.style.transformOrigin='50% '+Z_ORG+'px';return Z_ORG}
function setZoom(z,clientY){
  zOrg();z=Math.max(Z_MIN,Math.min(1,Math.round(z*100)/100));if(z===ZM)return;
  var py=clientY==null?null:clientY+window.scrollY,ly=py==null?0:Z_ORG+(py-Z_ORG)/ZM;
  ZM=z;applyView();zmN.textContent=Math.round(z*100)+'%';zmIn.disabled=z>=1;zmOut.disabled=z<=Z_MIN;
  data.zoom=z;fit();yarnFor(400);if(py!=null&&py>Z_ORG)window.scrollBy(0,Z_ORG+(ly-Z_ORG)*z-py);
  if(dir)save();
}
var Z_STEPS=[1,.85,.7,.55,.45,.35];
zmOut.addEventListener('click',function(){sfx.blip();setZoom(Z_STEPS.filter(function(s){return s<ZM-.001})[0]||Z_MIN)});
zmIn.addEventListener('click',function(){sfx.blip();setZoom(Z_STEPS.slice().reverse().filter(function(s){return s>ZM+.001})[0]||1)});
zmN.addEventListener('click',function(){if(ZM<1){sfx.blip();setZoom(1)}});
// Ctrl + mouse wheel, and trackpad pinch (which Chrome reports as Ctrl + wheel)
window.addEventListener('wheel',function(e){
  if(!(e.ctrlKey||e.metaKey)||!dir)return;if(e.target.closest&&e.target.closest('#set,#fx,#ask,#tpl,#rd,#lb,.pop'))return;
  e.preventDefault();setZoom(ZM*Math.exp(-e.deltaY*(e.deltaMode===1?.05:.0025)),e.clientY);
},{passive:false});
// two-finger pinch on the board (touch screens)
(function(){var pts={},d0=0,z0=1;
  function dist(){var k=Object.keys(pts);if(k.length<2)return 0;var a=pts[k[0]],b=pts[k[1]];return Math.hypot(a.x-b.x,a.y-b.y)}
  board.addEventListener('pointerdown',function(e){if(e.pointerType!=='touch'||(e.target.closest&&e.target.closest('.card')))return;pts[e.pointerId]={x:e.clientX,y:e.clientY};if(Object.keys(pts).length===2){d0=dist();z0=ZM}});
  board.addEventListener('pointermove',function(e){if(!pts[e.pointerId])return;pts[e.pointerId]={x:e.clientX,y:e.clientY};if(Object.keys(pts).length===2&&d0>0){var k=Object.keys(pts);setZoom(z0*dist()/d0,(pts[k[0]].y+pts[k[1]].y)/2)}});
  function up(e){delete pts[e.pointerId];if(Object.keys(pts).length<2)d0=0}
  board.addEventListener('pointerup',up);board.addEventListener('pointercancel',up);
})();

// ---- v1.4: templates for new sections: built-in layouts plus her own (data.templates [{id,name,items:[{k,o}]}]) ----
function T_L(text,look,c,x,y,rot){return{k:'label',o:{text:text,look:look,c:c,x:x,y:y,rot:rot}}}
function T_N(o){return{k:'note',o:o}}
function T_I(text,c,x,y,rot,pile,po){var o={kind:'idx',text:text,c:c,x:x,y:y,rot:rot};if(pile){o.pile=pile;o.po=po}return T_N(o)}
function T_D(items,c,x,y,rot){return T_N({kind:'todo',c:c,x:x,y:y,rot:rot,items:items.map(function(t){return{t:t,d:false}})})}
var TEMPLATES=[
  {id:'blank',name:'Blank',emoji:'✨',desc:'An empty section',items:[]},
  {id:'trip',name:'Trip',emoji:'✈️',desc:'Packing list, calendar, places to see, travel cards',items:[
    T_L('OUR TRIP','tape','#2456b5',.04,180,-2),T_N({kind:'cal',c:'#2456b5',x:.03,y:240,rot:-1.5,days:{}}),
    T_D(['Passports','Chargers','Sunscreen','Camera','Tickets'],'#cdeed6',.3,200,2),
    T_N({text:'Places we want to see:\n• \n• \n• ',c:'#fff2a8',x:.52,y:215,rot:-3}),
    T_I('Flights ✈️\n','#e2eefc',.72,205,1,'t1',0),T_I('Hotel 🏨\n','#fffefa',.72,205,1,'t1',1),T_I('Budget 💶\n','#fdf3c7',.72,205,1,'t1',2),
    T_L('memories from the trip','washi','#a9c6ee',.32,520,-1.5)]},
  {id:'bday',name:'Birthday',emoji:'🎂',desc:'Party to-dos, wish list, calendar',items:[
    T_L('Happy birthday! 🎂','washi','#f4b3c6',.05,180,-2),
    T_D(['Order the cake','Book a table','Wrap the present','Write a card','Invite friends'],'#ffd9e0',.06,240,2),
    T_N({text:'Wish list ✨\n• \n• ',c:'#fff2a8',x:.3,y:215,rot:-2.5}),
    T_N({kind:'cal',c:'#d0457f',x:.52,y:200,rot:1.5,days:{}}),
    T_L('party plans','tag','#f3d3d8',.3,450,3)]},
  {id:'dates',name:'Date ideas',emoji:'❤️',desc:'A pile of date-night idea cards to flip through',items:[
    T_L('Date night ideas ❤️','tag','#f3d3d8',.05,180,-2)].concat(
    ['Picnic at sunset 🧺','Cook something new together 🍝','Stargazing night ✨','Movie marathon & blankets 🎬','Museum or gallery day 🖼️','Breakfast in bed ☕'].map(function(t,i){return T_I(t,IDX_COLS[i%IDX_COLS.length],.06,250,-1.5,'d1',i)}),[
    T_L('done together ✓','washi','#9fd8c4',.4,190,1.5),T_D(['',''],'#cdeed6',.4,240,-2),
    T_N({text:'More ideas…',c:'#d3e4ff',x:.65,y:220,rot:2.5})])},
  {id:'year',name:'Our year',emoji:'🗓️',desc:'Calendar, goals and a pile of highlights',items:[
    T_L('OUR YEAR','tape','#c8312f',.04,180,-1.5),T_N({kind:'cal',c:'#c8312f',x:.03,y:240,rot:-1,days:{}}),
    T_D(['Take a trip together','Learn something new','Try 10 new restaurants','Make a photo book'],'#fff2a8',.3,210,2),
    T_I('Highlights ✨\n','#fffefa',.52,215,-2,'y1',0),T_I('\n','#fdf3c7',.52,215,-2,'y1',1),
    T_L('favourite memories','washi','#c8b5ea',.74,195,2),T_N({text:'',c:'#ffd9e0',x:.74,y:250,rot:-2})]},
  {id:'week',name:'Week planner',emoji:'📝',desc:'An index card for each day, plus groceries',items:[
    T_L('THIS WEEK','tape','#2c7a4b',.04,180,-1.5)].concat(
    ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(function(d,i){return T_I(d+'\n',IDX_COLS[i%IDX_COLS.length],.03+(i%4)*.235,235+Math.floor(i/4)*190,(jit(d,4)-2))}),[
    T_D(['','',''],'#cdeed6',.74,440,2),T_L('groceries','washi','#9fd8c4',.75,405,-2)])}
];
function cleanItem(it){
  if(!it||typeof it!=='object'||!it.o||typeof it.o!=='object')return null;var o=JSON.parse(JSON.stringify(it.o));
  if(it.k==='label'){var L=lookOf(o.look);o.look=L.id;if(L.cols.indexOf(o.c)<0)o.c=L.cols[0];rtStore(o,rtOf(o,LABEL_MAX));if(!fontById(o.font))delete o.font}
  else if(it.k==='note'){cleanNote(o)}
  else if(it.k==='sticker'){if(typeof o.file!=='string')return null;o.kind='sticker';o.fin=cleanFin(o.fin);if(!o.fin)delete o.fin}
  else return null;
  o.x=isFinite(+o.x)?+o.x:.1;o.y=isFinite(+o.y)?+o.y:200;o.rot=isFinite(+o.rot)?+o.rot:0;delete o.id;delete o.s;delete o.z;
  return{k:it.k,o:o};
}
function captureSection(sid){
  var items=[],strip=function(o){var c=JSON.parse(JSON.stringify(o));delete c.id;delete c.s;delete c.z;return c};
  data.labels.forEach(function(l){if(l.s===sid)items.push({k:'label',o:strip(l)})});
  data.notes.forEach(function(n){if(n.s===sid)items.push({k:'note',o:strip(n)})});
  data.photos.forEach(function(p){if(p.s===sid&&p.kind==='sticker')items.push({k:'sticker',o:strip(p)})});
  return items;
}
function instantiate(items,sid){
  // on a phone the tabs can take several rows, so start the layout below them
  var pm={},dy=Math.max(0,zOrg()-165);
  items.map(cleanItem).forEach(function(it){
    if(!it)return;var o=it.o;o.s=sid;o.z=++topZ;o.y+=dy;
    if(o.pile)o.pile=pm[o.pile]||(pm[o.pile]='p'+uid());delete o.pn; // (a new card gets its own pin)
    if(it.k==='label'){o.id='l'+uid();data.labels.push(o)}
    else if(it.k==='note'){o.id='n'+uid();if(o.kind==='cal')o.ym=ymNow();data.notes.push(o)}
    else if(it.k==='sticker'){if(!libFiles[o.file])return;o.id='k'+uid();files[o.id]=libFiles[o.file];data.photos.push(o)}
  });
}
var tplEl=document.getElementById('tpl'),tplPick='blank',tplNamed=false,tplParent=null;
function openTemplates(pid){
  if(!dir)return;closePop();setSidebar(false);tplPick='blank';tplNamed=false;var nm=document.getElementById('tplName');nm.value='';nm.placeholder='New section';
  // v1.8: from a section's + in the sidebar, the new one goes inside it
  var ps=typeof pid==='string'?secById(pid):null;tplParent=ps?ps.id:null;
  document.getElementById('tplT').textContent=ps?'New section inside \u201c'+ps.name+'\u201d':'New section';
  renderTpl();tplEl.style.display='flex';sfx.blip();setTimeout(function(){nm.focus()},30);
}
function closeTpl(){tplEl.style.display='none'}
function tplTile(t,mine){
  var w=document.createElement('div');w.className='tplw';
  var b=document.createElement('button');b.type='button';b.className='tplt'+(tplPick===t.id?' on':'');b.setAttribute('role','radio');b.setAttribute('aria-checked',tplPick===t.id?'true':'false');
  var em=document.createElement('span');em.className='tple';em.textContent=mine?'📌':t.emoji;
  var n=document.createElement('b');n.textContent=t.name;var d=document.createElement('small');d.textContent=mine?(t.items.length+' item'+(t.items.length===1?'':'s')):t.desc;
  b.appendChild(em);b.appendChild(n);b.appendChild(d);
  b.addEventListener('click',function(){tplPick=t.id;sfx.blip();var nm=document.getElementById('tplName');if(!tplNamed)nm.placeholder=t.id==='blank'?'New section':t.name;renderTpl()});
  b.addEventListener('dblclick',function(){tplPick=t.id;create()});
  w.appendChild(b);
  if(mine){
    var rn=document.createElement('button');rn.type='button';rn.className='tplx rn';rn.textContent='✎';rn.title='Rename';rn.setAttribute('aria-label','Rename '+t.name);
    rn.addEventListener('click',function(){var i=document.createElement('input');i.className='sin tplri';i.maxLength=30;i.value=t.name;n.replaceWith(i);i.focus();i.select();
      var done=false;function fin(){if(done)return;done=true;t.name=i.value.trim()||t.name;save();renderTpl()}
      i.addEventListener('blur',fin);i.addEventListener('keydown',function(e){e.stopPropagation();if(e.key==='Enter')fin();if(e.key==='Escape'){i.value=t.name;fin()}});i.addEventListener('click',function(e){e.stopPropagation()})});
    var x=document.createElement('button');x.type='button';x.className='tplx';x.textContent='×';x.title='Delete this template';x.setAttribute('aria-label','Delete '+t.name);
    x.addEventListener('click',function(){
      if(!x.classList.contains('armed')){sfx.warn();x.classList.add('armed');x.textContent='Delete?';setTimeout(function(){if(x.isConnected){x.classList.remove('armed');x.textContent='×'}},2500);return}
      sfx.trash();data.templates=data.templates.filter(function(q){return q!==t});if(tplPick===t.id)tplPick='blank';save();renderTpl();
    });
    w.appendChild(rn);w.appendChild(x);
  }
  return w;
}
function renderTpl(){
  var g=document.getElementById('tplG');g.innerHTML='';TEMPLATES.forEach(function(t){g.appendChild(tplTile(t,false))});
  var m=document.getElementById('tplM');m.innerHTML='';
  if(data.templates.length)data.templates.forEach(function(t){m.appendChild(tplTile(t,true))});
  else{var p=document.createElement('p');p.className='tplh';p.textContent='Make any section into a template: its notes, to-do lists, calendars, index cards, labels and stickers are copied (photos aren’t).';m.appendChild(p)}
  var cs=data.sections.filter(function(s){return s.id===data.cur})[0];
  document.getElementById('tplSave').textContent='Save “'+(cs?cs.name:'this section')+'” as a template';
}
function create(){
  var t=TEMPLATES.concat(data.templates).filter(function(x){return x.id===tplPick})[0]||TEMPLATES[0],nm=document.getElementById('tplName');
  var name=(nm.value.trim()||(t.id==='blank'?'New section':t.name)).slice(0,24),sc={id:'s'+uid(),name:name};
  var ps=tplParent&&secById(tplParent);if(ps)sc.parent=ps.id; // v1.8
  data.sections.push(sc);data.cur=sc.id;instantiate(t.items,sc.id);closeTpl();sfx.chime2();save();renderSection();
}
document.getElementById('tplName').addEventListener('input',function(){tplNamed=!!this.value.trim()});
document.getElementById('tplName').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();create()}});
document.getElementById('tplOk').addEventListener('click',create);
document.getElementById('tplNo').addEventListener('click',closeTpl);
document.getElementById('tplSave').addEventListener('click',function(){
  var items=captureSection(data.cur);if(!items.length){sfx.warn();toast('This section has nothing to copy yet (photos aren’t copied into templates)');return}
  var cs=data.sections.filter(function(s){return s.id===data.cur})[0],t={id:'u'+uid(),name:(cs?cs.name:'My template').slice(0,30),items:items};
  data.templates.push(t);tplPick=t.id;save();sfx.chime2();renderTpl();toast('Saved as a template — tap ✎ to rename it');
});
(function(){var down=false;tplEl.addEventListener('pointerdown',function(e){down=e.target===tplEl});tplEl.addEventListener('click',function(e){if(e.target===tplEl&&down)closeTpl()})})();
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&tplEl.style.display==='flex')closeTpl()});
document.getElementById('tplBtn').addEventListener('click',function(){closeSettings();setTimeout(function(){openTemplates(null)},60)});
document.getElementById('cardBtn').addEventListener('click',function(){
  var n=Object.assign({id:'n'+uid(),s:data.cur,kind:'idx',text:'',c:IDX_COLS[0]},slot());n.rot=Math.round(n.rot*4)/10;
  data.notes.push(n);renderNote(n);sfx.pop();sfx.land(.4);save();fit();
  setTimeout(function(){var e=cards[n.id]&&cards[n.id].querySelector('.ixe');if(e)e.focus({preventScroll:true})},350);
});

// ---- v1.5: the shelf. Items on it keep all their data but have s:'shelf' instead of a section id. ----
var shTipped=false,SHELF='shelf',shelfEl=document.getElementById('shelf'),shBtn=document.getElementById('shBtn'),shG=document.getElementById('shG'),shN=document.getElementById('shN'),shOpen=false;
// selecting several cards: Shift / Ctrl / Cmd + click
var sel=new Set();
function toggleSel(el){if(sel.has(el)){sel.delete(el);el.classList.remove('sel')}else{sel.add(el);el.classList.add('sel')}sfx.blip();selHint()}
function clearSel(){sel.forEach(function(el){el.classList.remove('sel')});sel.clear();selHint()}
function selHint(){var n=0;sel.forEach(function(el){if(el.isConnected)n++});document.body.classList.toggle('hassel',n>0)}
board.addEventListener('pointerdown',function(e){if(sel.size&&!(e.target.closest&&e.target.closest('.card'))&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey)clearSel()});
function groupOf(o){return data.photos.indexOf(o)>=0?'photo':data.notes.indexOf(o)>=0?'note':'label'}
function shelfItems(){var a=[];data.photos.concat(data.notes,data.labels).forEach(function(o){if(o.s===SHELF)a.push(o)});return a.sort(function(x,y){return(x.sh||0)-(y.sh||0)})}
function overShelf(x,y){if(shelfEl.style.display==='none')return false;var r=[shBtn.getBoundingClientRect()];if(shelfEl.classList.contains('open'))r.push(document.getElementById('shTray').getBoundingClientRect());
  return r.some(function(b){return b.width&&x>=b.left-12&&x<=b.right+12&&y>=b.top-12&&y<=b.bottom+12})}
function shelfHot(x,y){shelfEl.classList.toggle('hot',x!=null&&overShelf(x,y))}
function toShelf(list){
  var b=shBtn.getBoundingClientRect(),tx=b.left+b.width/2,ty=b.top+b.height/2,piles={},n=Date.now();
  list.forEach(function(o,i){
    if(o.pile){piles[o.pile]=1;delete o.pile;delete o.po;delete o.fan}
    o.s=SHELF;o.sh=n+i;var el=cards[o.id];
    if(el){delete cards[o.id];sel.delete(el);var r=el.getBoundingClientRect();
      el.classList.remove('drag','sel');el.style.transition='transform .38s cubic-bezier(.5,0,.8,.5),opacity .38s';el.style.pointerEvents='none';
      el.style.transform='translate('+((tx-r.left-r.width/2)/ZM)+'px,'+((ty-r.top-r.height/2)/ZM)+'px) scale(.12)';el.style.opacity='0';
      setTimeout(function(){el.remove();shown();fit()},400);
      el.querySelectorAll('video').forEach(function(v){try{v.pause()}catch(e){}});
    }
  });
  Object.keys(piles).forEach(pileFix);selHint();
  sfx.shelf();save();renderShelf();shelfEl.classList.remove('bump');void shelfEl.offsetWidth;shelfEl.classList.add('bump');
  if(!shTipped){shTipped=true;toast(list.length===1?'On the shelf — open another section and drag it out':list.length+' things on the shelf — open another section and drag them out')}
}
// take an item off the shelf into the current section, at the drop point (or the next free spot)
function unshelve(o,cx,cy){
  if(o.s!==SHELF)return;o.s=data.cur;o.z=++topZ;delete o.sh;
  // tapped out (no drop point): put it in the middle of what she's looking at, slightly scattered
  if(cx==null){cx=window.innerWidth/2+(Math.random()-.5)*240;cy=Math.max(Z_ORG+60,window.innerHeight*.42)+(Math.random()-.5)*120}
  var br=board.getBoundingClientRect(),W=board.clientWidth,lx=W/2+PAN+((cx-br.left)-W/2)/ZM,ly=Z_ORG+((cy-br.top)-Z_ORG)/ZM;
  o.x=clampX(lx-90,180)/W;o.y=Math.max(Z_ORG,ly-50);
  var g=groupOf(o);if(g==='photo')renderPhoto(o);else if(g==='note')renderNote(o);else renderLabel(o);
  sfx.land(.05);save();fit();renderShelf();
}
function shelfThumb(o){
  var t=document.createElement('div');t.className='shi';t.tabIndex=0;t.setAttribute('role','button');
  var k=o.kind||'',g=groupOf(o),name;
  function img(src,cls){var i=document.createElement('img');i.alt='';i.decoding='async';if(src&&src.then)src.then(function(u){i.src=u});else i.src=src;if(cls)i.className=cls;i.draggable=false;t.appendChild(i);return i}
  function txt(s,cls){var d=document.createElement('div');d.className=cls;d.textContent=s;t.appendChild(d);return d}
  if(g==='photo'){
    if(k==='video'){var v=document.createElement('video');v.muted=true;v.preload='metadata';v.src=mediaUrl(o.id);t.appendChild(v);txt('▶','shbadge');t.classList.add('pf');name='Video'}
    else if(k==='strip'){img(smallUrl(fileKey(o,0),o.files[0]));t.classList.add('pf','st');name='Photobooth strip'}
    else if(k==='sticker'){img(smallUrl(o.id,o.file));t.classList.add('sk');name='Sticker'}
    else if(k==='doc'){t.classList.add('dc');name='PDF document';var c=document.createElement('canvas');t.appendChild(c);pageCanvas(o,o.pg||0,70).then(function(x){copyTo(c,x)}).catch(function(){})}
    else{img(smallUrl(o.id,o.file));t.classList.add(o.bare?'bare':'pf');name='Photo'+(o.caption?': '+o.caption:'')}
  }else if(g==='note'){
    if(k==='cal'){t.classList.add('cl');t.style.setProperty('--cc',o.c);var y=+o.ym.slice(0,4),m=+o.ym.slice(5,7)-1;txt(new Date(y,m,1).toLocaleDateString(undefined,{month:'short'}),'clh');txt(String(y),'clt');name='Calendar'}
    else if(k==='todo'){t.classList.add('nt');t.style.background=o.c;txt('☑ '+((o.items[0]&&o.items[0].t)||'to-do'),'ntt');name='To-do list'}
    else if(k==='idx'){t.classList.add('ix');t.style.backgroundColor=o.c;txt(o.text||'index card','ntt');name='Index card'}
    else{t.classList.add('nt');t.style.background=o.c;txt(o.text||'note','ntt');name='Sticky note'}
  }else{t.classList.add('lb','lk-'+o.look);t.style.setProperty('--lc',o.c);txt(o.text||'label','lbt');name='Label'+(o.text?': '+o.text:'')}
  t.title=name+' — drag onto the board, or tap to put it here';t.setAttribute('aria-label',name+'. Press Enter to put it in this section');
  // drag out of the shelf (a little ghost follows the pointer), or tap to drop it into this section
  var sx,sy,gh=null,down=false;
  t.addEventListener('pointerdown',function(e){if(e.button)return;down=true;sx=e.clientX;sy=e.clientY;t.setPointerCapture(e.pointerId);e.preventDefault()});
  t.addEventListener('pointermove',function(e){
    if(!down)return;
    if(!gh&&Math.abs(e.clientX-sx)+Math.abs(e.clientY-sy)>6){gh=t.cloneNode(true);gh.className=t.className+' ghost';gh.style.left=e.clientX+'px';gh.style.top=e.clientY+'px';var c1=t.querySelector('canvas'),c2=gh.querySelector('canvas');if(c1&&c2)copyTo(c2,c1);document.body.appendChild(gh);t.classList.add('out');sfx.lift();document.body.classList.add('shdrag')}
    if(gh){gh.style.left=e.clientX+'px';gh.style.top=e.clientY+'px';shelfHot(e.clientX,e.clientY)}
  });
  function up(e){
    if(!down)return;down=false;shelfHot();document.body.classList.remove('shdrag');
    if(!gh){if(e.type==='pointerup')unshelve(o);return}
    gh.remove();gh=null;t.classList.remove('out');
    if(e.type==='pointerup'&&!overShelf(e.clientX,e.clientY))unshelve(o,e.clientX,e.clientY);
  }
  t.addEventListener('pointerup',up);t.addEventListener('pointercancel',up);
  t.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();unshelve(o)}});
  return t;
}
function renderShelf(){
  var items=shelfItems();shN.textContent=items.length;shN.hidden=!items.length;shG.innerHTML='';
  shelfEl.classList.toggle('shempty',!items.length);
  items.forEach(function(o){shG.appendChild(shelfThumb(o))});
  document.getElementById('shAll').hidden=items.length<2;
}
function setShelf(open){shOpen=open;shelfEl.classList.toggle('open',open);shBtn.setAttribute('aria-expanded',open?'true':'false')}
shBtn.addEventListener('click',function(){sfx.blip();setShelf(!shOpen)});
document.getElementById('shAll').addEventListener('click',function(){
  var b=this;if(b.disabled)return;b.disabled=true;var items=shelfItems(),i=0;
  items.forEach(function(o,k){var cx=window.innerWidth/2+((k%4)-1.5)*200,cy=Math.max(Z_ORG+60,window.innerHeight*.3)+Math.floor(k/4)*170;setTimeout(function(){unshelve(o,cx,cy)},i++*90)});
  setTimeout(function(){b.disabled=false},i*90+200);
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){if(sel.size)clearSel();if(shOpen&&!document.querySelector('#set[style*="flex"],.pop'))setShelf(false)}});


// ---- v1.6.2: the "+ Add" menu (bottom right) ----
(function(){
  var am=document.getElementById('addMain');
  function ic(d){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+d+'</svg>'}
  var ITEMS=[
    {l:'Photos, videos & PDFs',h:'from your computer',i:ic('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/>'),go:function(){addBtn.click()}},
    {l:'Photobooth strip',h:'pick 4 photos',i:ic('<rect x="7" y="2.5" width="10" height="19" rx="1.5"/><path d="M7 7.3h10M7 12h10M7 16.7h10"/>'),go:function(){document.getElementById('stripBtn').click()}},
    {sep:1},
    {l:'Sticky note',i:ic('<path d="M4 4h16v10l-6 6H4z"/><path d="M14 20v-6h6"/>'),go:function(){addNote('note')}},
    {l:'To-do list',i:ic('<rect x="4" y="4.5" width="5" height="5" rx="1"/><path d="m5.3 7 1.2 1.2 2-2.2M12 7h8M4 15h5v5H4zM12 17.5h8"/>'),go:function(){addNote('todo')}},
    {l:'Calendar',i:ic('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),go:function(){addNote('cal')}},
    {l:'Index card',i:ic('<rect x="2.5" y="6" width="19" height="12" rx="1.5"/><path d="M2.5 9.5h19M6 13h12M6 15.5h8"/>'),go:function(){document.getElementById('cardBtn').click()}},
    {l:'Label',i:IC.tag,go:function(){document.getElementById('labelBtn').click()}},
    {l:'Sticker',h:'your stickers, or upload new',i:IC.shine,go:function(){stkBtn.click()}}
  ];
  am.addEventListener('click',function(){
    openPop(am,function(box,close){
      box.classList.add('addpop');box.setAttribute('role','menu');
      ITEMS.forEach(function(it){
        if(it.sep){var hr=document.createElement('i');hr.className='asep';box.appendChild(hr);return}
        var b=document.createElement('button');b.type='button';b.className='pi ai';b.setAttribute('role','menuitem');
        b.innerHTML='<span class="aic">'+it.i+'</span><span class="atx"><b></b>'+(it.h?'<small></small>':'')+'</span>';
        b.querySelector('b').textContent=it.l;if(it.h)b.querySelector('small').textContent=it.h;
        b.addEventListener('click',function(){close();it.go()});box.appendChild(b);
      });
      // arrow keys move through the menu
      box.addEventListener('keydown',function(e){var a=[].slice.call(box.querySelectorAll('.ai')),i=a.indexOf(document.activeElement);
        if(e.key==='ArrowDown'){e.preventDefault();a[(i+1)%a.length].focus()}else if(e.key==='ArrowUp'){e.preventDefault();a[(i-1+a.length)%a.length].focus()}});
      am.setAttribute('aria-expanded','true');am.classList.add('open');
    },function(){am.setAttribute('aria-expanded','false');am.classList.remove('open')});
  });
})();
// ---- v1.6.1: sideways scrolling across the extra-wide board (PAN = how far the view centre is from the normal centre, in board pixels) ----
var PAN=0,panAnim=0,hbarEl=document.getElementById('hbar'),hbarT=hbarEl.querySelector('i'),hbarTimer=0;
function panMax(){return Math.max(0,board.clientWidth/2*(1/Z_MIN-1/ZM))}
function applyView(){
  PAN=Math.max(-panMax(),Math.min(panMax(),PAN));
  layer.style.transform=(ZM<1||PAN)?'translateX('+(-PAN*ZM).toFixed(1)+'px) scale('+ZM+')':'';
  if(typeof yarnSoon==='function')yarnSoon();hbar();
}
function setPan(p,smooth){
  cancelAnimationFrame(panAnim);
  if(!smooth){PAN=p;layer.classList.add('panning');applyView();clearTimeout(setPan.t);setPan.t=setTimeout(function(){layer.classList.remove('panning')},120);return}
  var from=PAN,to=Math.max(-panMax(),Math.min(panMax(),p)),t0=performance.now();layer.classList.add('panning');
  (function step(t){var k=Math.min(1,(t-t0)/380),e=1-Math.pow(1-k,3);PAN=from+(to-from)*e;applyView();if(k<1)panAnim=requestAnimationFrame(step);else layer.classList.remove('panning')})(t0);
}
// the thin scrollbar along the bottom
function hbar(){
  var mx=panMax();if(mx<1){hbarEl.classList.remove('on');hbarEl.hidden=true;return}hbarEl.hidden=false;
  var tot=2*mx+board.clientWidth/ZM,vis=board.clientWidth/ZM,f=vis/tot;hbarT.style.width=(f*100)+'%';hbarT.style.left=((PAN+mx)/tot*100)+'%';
  hbarEl.classList.add('on');clearTimeout(hbarTimer);hbarTimer=setTimeout(function(){if(!hbarEl.matches(':hover')&&!hbarEl.classList.contains('drag'))hbarEl.classList.remove('on')},1400);
}
(function(){var sx=null,p0=0;
  hbarT.addEventListener('pointerdown',function(e){e.preventDefault();hbarT.setPointerCapture(e.pointerId);sx=e.clientX;p0=PAN;hbarEl.classList.add('drag')});
  hbarT.addEventListener('pointermove',function(e){if(sx===null)return;var mx=panMax(),tot=2*mx+board.clientWidth/ZM;setPan(p0+(e.clientX-sx)/hbarEl.clientWidth*tot)});
  function up(){sx=null;hbarEl.classList.remove('drag');hbar()}hbarT.addEventListener('pointerup',up);hbarT.addEventListener('pointercancel',up);
  hbarEl.addEventListener('pointerdown',function(e){if(e.target!==hbarEl)return;var r=hbarEl.getBoundingClientRect(),mx=panMax(),tot=2*mx+board.clientWidth/ZM;setPan(((e.clientX-r.left)/r.width)*tot-mx-board.clientWidth/ZM/2,true)});
})();
// trackpad sideways swipe, or Shift + mouse wheel
window.addEventListener('wheel',function(e){
  if(!dir||e.ctrlKey||e.metaKey)return;if(e.target.closest&&e.target.closest('#set,#fx,#ask,#tpl,#rd,#lb,.pop,.shtray,#start'))return;
  var dx=e.shiftKey&&!e.deltaX?e.deltaY:(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:0);if(!dx)return;
  if(panMax()<1)return;e.preventDefault();setPan(PAN+dx*(e.deltaMode===1?16:1)/ZM);
},{passive:false});
// drag empty board space (mouse), or swipe sideways with one finger (touch)
(function(){var on=null,sx=0,sy=0,p0=0,moved=false;
  board.addEventListener('pointerdown',function(e){
    if(e.button||on!==null||panMax()<1)return;var t=e.target;
    if(t.closest&&t.closest('.card,header,.edge,input,button,textarea,[contenteditable="true"]'))return;
    on=e.pointerId;sx=e.clientX;sy=e.clientY;p0=PAN;moved=false;
  });
  window.addEventListener('pointermove',function(e){
    if(e.pointerId!==on)return;var dx=e.clientX-sx,dy=e.clientY-sy;
    if(!moved){if(Math.abs(dx)<6)return;if(e.pointerType==='touch'&&Math.abs(dy)>Math.abs(dx)){on=null;return}moved=true;document.body.classList.add('panning')}
    setPan(p0-dx/ZM);
  });
  function up(e){if(e.pointerId!==on)return;on=null;document.body.classList.remove('panning')}
  window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);
  // a second finger means pinch-zoom, not panning
  board.addEventListener('pointerdown',function(e){if(e.pointerType==='touch'&&on!==null&&e.pointerId!==on){on=null;document.body.classList.remove('panning')}},true);
})();
window.addEventListener('resize',function(){applyView()});

// ---- v1.6: a bigger board. Cards can sit in the space beside the screen that appears when zoomed out. ----
function xMargin(){return(1/Z_MIN-1)/2*board.clientWidth}
function clampX(px,w){var W=board.clientWidth,m=xMargin();return Math.max(-m,Math.min(px,W+m-(w||120)))}
// little "‹ 2 more" badges at the screen edges when things are off to the side
var edgeL=document.getElementById('edgeL'),edgeR=document.getElementById('edgeR');
var edgesT=0;
function edges(){
  if(!edgeL)return;
  // perf: while a card is being dragged, recount a few times a second rather than measuring every card every frame
  var now=performance.now();if(document.body.classList.contains('cbdrag')&&now-edgesT<150)return;edgesT=now;var l=0,r=0,vw=document.documentElement.clientWidth;
  for(var k in cards){var b=cards[k].getBoundingClientRect();if(b.right<8)l++;else if(b.left>vw-8)r++}
  edgeL.hidden=!l;edgeR.hidden=!r;edgeL.querySelector('b').textContent=l;edgeR.querySelector('b').textContent=r;
}
function zoomToFit(){
  var W=board.clientWidth,mn=0,mx=W;for(var k in cards){var e=cards[k];mn=Math.min(mn,e.offsetLeft);mx=Math.max(mx,e.offsetLeft+e.offsetWidth)}
  var half=Math.max(W/2-mn,mx-W/2)+24;sfx.blip();setZoom(Math.floor(Math.min(1,(W/2)/half)*20)/20);
}
function panToSide(dir2){
  var W=board.clientWidth,half=W/(2*ZM),mn=Infinity,mx=-Infinity,vw=document.documentElement.clientWidth;
  for(var k in cards){var e=cards[k],b=e.getBoundingClientRect();if(dir2<0&&b.right<8)mn=Math.min(mn,e.offsetLeft);if(dir2>0&&b.left>vw-8)mx=Math.max(mx,e.offsetLeft+e.offsetWidth)}
  sfx.blip();if(dir2<0&&mn<Infinity)setPan(mn-30-W/2+half,true);else if(dir2>0&&mx>-Infinity)setPan(mx+30-W/2-half,true);
}
edgeL.addEventListener('click',function(){panToSide(-1)});edgeR.addEventListener('click',function(){panToSide(1)});
edgeL.addEventListener('dblclick',zoomToFit);edgeR.addEventListener('dblclick',zoomToFit);

// v2.0: polaroids, no-frame pinned photos, photobooth strips and calendars no longer have a pin drawn on them. Each gets a
// real pin instead (the same spot, top middle), made once per card (o.pn), that can be moved, recoloured, removed or tied.
// fx = where along the card's width (0–1); ox/oy stay for versions before 2.0. Moving the pin replaces fx with ox.
function hasHoldPin(o){if(!o)return false;if(o.kind==='cal'||o.kind==='strip')return true;return !!(o.file&&(!o.kind||o.kind==='photo')&&!(o.bare&&o.hold==='tape'))}
function holdPin(o){if(!o||o.pn||!hasHoldPin(o))return false;o.pn=1;data.pins.push({id:'q'+uid(),c:(data.style&&data.style.pin)||'#d6264f',card:o.id,fx:.5,ox:110,oy:0});return true}
function holdPins(){var n=0;data.photos.concat(data.notes).forEach(function(o){if(holdPin(o))n++});return n}
function hasRealPin(o){return !!o&&data.pins.some(function(q){return q.card===o.id})}
// ---- v1.6: pins and yarn. data.pins: {id,c, s,x,y} on the board, or {id,c, card,ox,oy} stuck in a card (moves with it).
// data.yarns: {id,a,b,c} ties pin a to pin b. Drawn in one overlay above everything except the dialogs. ----
var YARN_COLS=['#d6264f','#2f6fd6','#2c9a5a','#f2c230','#ff8fb1','#8a4fd6','#e07b2a','#f7f3ea','#2a2622'];
var ySvg=document.getElementById('yarn'),yG=ySvg.querySelector('.yg'),pG=ySvg.querySelector('.pg2'),tmpL=ySvg.querySelector('.ytmp'),yEls={},pEls={},yMode=false,yCol=YARN_COLS[0];
var yBtn=document.getElementById('yarnBtn'),yTools=document.getElementById('ytools');
// perf: while the yarn is redrawn the board's position is measured once (yBR), not once per pin
var yBR=null;
function sx2(lx){var br=yBR||board.getBoundingClientRect(),W=board.clientWidth;return br.left+W/2+(lx-W/2-PAN)*ZM}
function sy2(ly){var br=yBR||board.getBoundingClientRect();return br.top+Z_ORG+(ly-Z_ORG)*ZM}
function toLogical(cx,cy){var br=board.getBoundingClientRect(),W=board.clientWidth;return{x:W/2+PAN+((cx-br.left)-W/2)/ZM,y:Z_ORG+((cy-br.top)-Z_ORG)/ZM}}
function pinPos(p){
  if(p.card){var el=cards[p.card];if(!el||el.classList.contains('bye'))return null;return{x:sx2(el.offsetLeft+(p.fx!=null?p.fx*el.offsetWidth:p.ox)),y:sy2(el.offsetTop+p.oy)}}
  if(p.s!==data.cur)return null;return{x:sx2(p.x*board.clientWidth),y:sy2(p.y)};
}
var SVGNS='http://www.w3.org/2000/svg';
function sEl(tag,attrs,parent){var e=document.createElementNS(SVGNS,tag);for(var k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e}
function shade(hex,f){var n=parseInt(hex.slice(1),16),r=n>>16,g=n>>8&255,b=n&255;function m(v){return Math.round(f>0?v+(255-v)*f:v*(1+f))}return'rgb('+m(r)+','+m(g)+','+m(b)+')'}
// a soft sag, as if the yarn hangs a little between its pins
function yPath(a,b){var dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),sag=Math.min(46,d*.09)*Math.max(.5,ZM);return'M'+a.x.toFixed(1)+' '+a.y.toFixed(1)+' Q'+((a.x+b.x)/2).toFixed(1)+' '+((a.y+b.y)/2+sag).toFixed(1)+' '+b.x.toFixed(1)+' '+b.y.toFixed(1)}
function yarnDraw(){
  if(!dir)return;var pos={},seen={},w=Math.max(1.6,2.6*Math.max(.55,ZM));
  if(!data.pins.length&&!Object.keys(pEls).length)return; // perf: nothing to draw
  var stackHide={};
  yBR=board.getBoundingClientRect();try{data.pins.forEach(function(p){var q=pinPos(p);if(q)pos[p.id]=q});stackPins(pos,stackHide)}finally{yBR=null}
  data.yarns.forEach(function(y){
    var a=pos[y.a],b=pos[y.b],g=yEls[y.id];if(!a||!b){if(g)g.style.display='none';return}
    if(!g){g=yEls[y.id]=sEl('g',{class:'yn'},yG);sEl('path',{class:'ysh'},g);sEl('path',{class:'ym'},g);sEl('path',{class:'ytx'},g);var h=sEl('path',{class:'yhit'},g);
      h.addEventListener('pointerdown',function(e){e.stopPropagation();e.preventDefault()});h.addEventListener('click',function(e){e.stopPropagation();yarnPop(g,y)})}
    g.style.display='';seen[y.id]=1;var d=yPath(a,b),ps=g.childNodes;
    ps[0].setAttribute('d',d);ps[0].setAttribute('stroke-width',w+1.4);ps[1].setAttribute('d',d);ps[1].setAttribute('stroke',y.c);ps[1].setAttribute('stroke-width',w);
    ps[2].setAttribute('d',d);ps[2].setAttribute('stroke',shade(y.c,y.c==='#2a2622'?.35:-.28));ps[2].setAttribute('stroke-width',Math.max(.8,w*.38));ps[3].setAttribute('d',d);
  });
  for(var k in yEls)if(!seen[k]&&!data.yarns.some(function(y){return y.id===k})){yEls[k].remove();delete yEls[k]}
  var r=Math.max(5,8*Math.max(.6,ZM));
  data.pins.forEach(function(p){
    var q=pos[p.id],g=pEls[p.id];if(!q||stackHide[p.id]){if(g)g.style.display='none';return}
    if(!g){g=pEls[p.id]=sEl('g',{class:'ypin',tabindex:'0',role:'button','aria-label':'Pin'},pG);sEl('ellipse',{class:'psh'},g);sEl('circle',{class:'phd'},g);sEl('circle',{class:'phl'},g);pinEvents(g,p)}
    g.style.display='';var c=g.childNodes;
    c[0].setAttribute('cx',q.x+r*.35);c[0].setAttribute('cy',q.y+r*.55);c[0].setAttribute('rx',r*.95);c[0].setAttribute('ry',r*.7);
    c[1].setAttribute('cx',q.x);c[1].setAttribute('cy',q.y);c[1].setAttribute('r',r);c[1].setAttribute('fill',p.c);c[1].setAttribute('stroke',shade(p.c,-.35));
    c[2].setAttribute('cx',q.x-r*.32);c[2].setAttribute('cy',q.y-r*.34);c[2].setAttribute('r',r*.34);
  });
  for(var k2 in pEls)if(!data.pins.some(function(p){return p.id===k2})){pEls[k2].remove();delete pEls[k2]}
}
// v1.7: while cards are stacked (not spread out), all the pins stuck in them show as one pin on the top card, and their
// yarn meets there: the top card's own pin if it has one, otherwise the first pin, placed on the top card. When the stack
// is spread out or unstacked, each pin is back on its own card (pins are never moved in board.json).
function stackPins(pos,hide){
  var g={};
  data.pins.forEach(function(p){if(!p.card||!pos[p.id])return;var el=cards[p.card],n=el&&el._p;if(!n||!n.pile||n.fan||!stackable(n))return;(g[n.pile]=g[n.pile]||[]).push(p)});
  for(var pid in g){
    var m=pileOf(pid);if(m.length<2)continue;var top=m[m.length-1],tel=cards[top.id];if(!tel)continue;
    var ps=g[pid],rep=ps.filter(function(p){return p.card===top.id})[0]||ps[0];
    var rp=rep.card===top.id?pos[rep.id]:{x:sx2(tel.offsetLeft+(rep.fx!=null?rep.fx*tel.offsetWidth:rep.ox)),y:sy2(tel.offsetTop+rep.oy)};
    ps.forEach(function(p){pos[p.id]=rp;if(p!==rep)hide[p.id]=1});
  }
}
var yRaf=0,yUntil=0;
function yarnSoon(){if(!yRaf)yRaf=requestAnimationFrame(function(){yRaf=0;yarnDraw();edges();if(performance.now()<yUntil)yarnSoon()})}
// keep redrawing for a moment (cards settling, zoom easing)
function yarnFor(ms){yUntil=Math.max(yUntil,performance.now()+ms);yarnSoon()}
window.addEventListener('scroll',yarnSoon,{passive:true});window.addEventListener('resize',function(){yarnFor(300)});
// pins stuck in cards that no longer exist go too, with their yarn
function yarnClean(){
  var ids={};data.photos.concat(data.notes,data.labels).forEach(function(o){ids[o.id]=1});
  var before=data.pins.length;data.pins=data.pins.filter(function(p){return !p.card||ids[p.card]});
  if(data.pins.length!==before){var pids={};data.pins.forEach(function(p){pids[p.id]=1});data.yarns=data.yarns.filter(function(y){return pids[y.a]&&pids[y.b]});save()}
  yarnFor(500);
}
// v2.0: while a card is hovered, its buttons show through the pins and yarn: those spots are cut out of the yarn layer
// (a clip-path, so the cut-out parts can't be clicked either and the button underneath gets the click)
var yCutP=document.querySelector('#ycut path'),yCutEl=null,yCutT=0;
function yCut(el){
  yCutEl=el;var W=innerWidth,H=innerHeight,d='M-10 -10H'+(W+10)+'V'+(H+10)+'H-10Z';
  if(el&&!yMode&&!el.classList.contains('drag'))el.querySelectorAll('.cb,.rze,.tdx,.tdadd,.calnav').forEach(function(b){
    var r=b.getBoundingClientRect();if(!r.width||getComputedStyle(b).display==='none')return;var x=r.left-4,y=r.top-4,w=r.width+8,h=r.height+8;
    d+='M'+x+' '+y+'h'+w+'v'+h+'h'+(-w)+'Z'});
  yCutP.setAttribute('d',d);
}
yCut(null);
layer.addEventListener('pointerover',function(e){var c=e.target.closest&&e.target.closest('.card');if(c===yCutEl)return;yCut(c);clearTimeout(yCutT);if(c)yCutT=setTimeout(function(){if(yCutEl===c)yCut(c)},260)}); // again once the hover lift has settled
layer.addEventListener('pointerleave',function(){yCut(null)});
window.addEventListener('pointermove',function(){if(yCutEl&&yCutEl.classList.contains('drag'))yCut(null)},{passive:true}); // the card is being moved: nothing to cut out
window.addEventListener('resize',function(){yCut(yCutEl)});
function cardAt(cx,cy){var a=document.elementsFromPoint(cx,cy);for(var i=0;i<a.length;i++){var c=a[i].closest&&a[i].closest('#layer .card');if(c&&c._p&&!c.classList.contains('bye'))return c}return null}
// where a pin goes: stuck in the card under the point, or on the board itself
function pinAt(p,cx,cy){
  var L=toLogical(cx,cy),c=cardAt(cx,cy);delete p.card;delete p.ox;delete p.oy;delete p.fx;delete p.s;delete p.x;delete p.y;
  if(c){p.card=c._p.id;p.ox=Math.round(L.x-c.offsetLeft);p.oy=Math.round(L.y-c.offsetTop)}
  else{var W=board.clientWidth;p.s=data.cur;p.x=clampX(L.x,0)/W;p.y=Math.max(Z_ORG-40,Math.round(L.y))}
}
function addPin(cx,cy){var p={id:'q'+uid(),c:yCol};pinAt(p,cx,cy);data.pins.push(p);sfx.pop();save();yarnDraw();return p}
function pinUnder(cx,cy,not){var best=null,bd=18;data.pins.forEach(function(p){if(p===not)return;var q=pinPos(p);if(!q)return;var d=Math.hypot(q.x-cx,q.y-cy);if(d<bd){bd=d;best=p}});return best}
function tie(a,b){
  if(!a||!b||a===b)return;if(data.yarns.some(function(y){return(y.a===a.id&&y.b===b.id)||(y.a===b.id&&y.b===a.id)}))return;
  data.yarns.push({id:'y'+uid(),a:a.id,b:b.id,c:yCol});sfx.tape();save();yarnDraw();
}
function pinEvents(g,p){
  var sx,sy,mv=false,on=false;
  g.addEventListener('pointerdown',function(e){if(e.button)return;e.stopPropagation();e.preventDefault();g.setPointerCapture(e.pointerId);sx=e.clientX;sy=e.clientY;mv=false;on=true;if(!yMode)sfx.lift()});
  g.addEventListener('pointermove',function(e){
    if(!on)return;if(!mv&&Math.hypot(e.clientX-sx,e.clientY-sy)>5){mv=true;document.body.classList.add('ydrag')}
    if(!mv)return;
    if(yMode){var q=pinPos(p);tmpL.style.display='';tmpL.setAttribute('d',yPath(q,{x:e.clientX,y:e.clientY}));tmpL.setAttribute('stroke',yCol)}
    else{pinAt(p,e.clientX,e.clientY);yarnSoon()}
  });
  function up(e){
    if(!on)return;on=false;document.body.classList.remove('ydrag');tmpL.style.display='none';
    if(!mv){if(e.type==='pointerup')pinPop(g,p);return}
    if(yMode){if(e.type!=='pointerup')return;var t=pinUnder(e.clientX,e.clientY,p);if(!t&&overUI(e.clientX,e.clientY))return;tie(p,t||addPin(e.clientX,e.clientY))}
    else{pinAt(p,e.clientX,e.clientY);sfx.set();save();yarnDraw()}
  }
  g.addEventListener('pointerup',up);g.addEventListener('pointercancel',up);
  g.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();pinPop(g,p)}else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();removePin(p)}});
}
function removePin(p){data.pins=data.pins.filter(function(q){return q!==p});data.yarns=data.yarns.filter(function(y){return y.a!==p.id&&y.b!==p.id});sfx.trash();save();yarnDraw()}
function swatchRow(box,cur,pick){
  var row=document.createElement('div');row.className='yswr';
  YARN_COLS.forEach(function(c){var b=document.createElement('button');b.type='button';b.className='ysw'+(c===cur?' on':'');b.style.background=c;b.setAttribute('aria-label','Colour '+c);
    b.addEventListener('click',function(){row.querySelectorAll('.ysw').forEach(function(x){x.classList.remove('on')});b.classList.add('on');pick(c)});row.appendChild(b)});
  box.appendChild(row);return row;
}
function pinPop(g,p){openPop(g.childNodes[1],function(box,close){
  var h=document.createElement('h4');h.textContent='Pin';box.appendChild(h);
  swatchRow(box,p.c,function(c){p.c=c;sfx.blip();save();yarnDraw()});
  var n=data.yarns.filter(function(y){return y.a===p.id||y.b===p.id}).length;
  var hn=document.createElement('p');hn.className='phint';hn.textContent=yMode?'Drag from this pin to another to tie yarn.':(n?n+' yarn'+(n>1?'s':'')+' tied here. ':'')+'Drag to move it. Turn on Yarn to tie it to another pin.';box.appendChild(hn);
  var row=document.createElement('div');row.className='lkb';var rm=document.createElement('button');rm.type='button';rm.className='sbtn alt';rm.textContent=n?'Remove pin & its yarn':'Remove pin';
  rm.addEventListener('click',function(){close();removePin(p)});row.appendChild(rm);box.appendChild(row);
})}
function yarnPop(g,y){openPop(g.childNodes[3],function(box,close){
  var h=document.createElement('h4');h.textContent='Yarn';box.appendChild(h);
  swatchRow(box,y.c,function(c){y.c=c;yCol=c;data.yarnCol=c;sfx.blip();save();yarnDraw();ySync()});
  var row=document.createElement('div');row.className='lkb';var rm=document.createElement('button');rm.type='button';rm.className='sbtn alt';rm.textContent='Cut this yarn';
  rm.addEventListener('click',function(){close();data.yarns=data.yarns.filter(function(q){return q!==y});sfx.trash();save();yarnDraw()});row.appendChild(rm);box.appendChild(row);
})}
// yarn tool: tap the board or a card to put in a pin; drag from a pin to tie yarn
function overUI(x,y){var t=document.elementFromPoint(x,y);return !!(t&&t.closest&&t.closest('#sb,#sbBtn,header,.fab,.lfab,.shelf,.pop,#ytools,.edge,#set,#tpl,#fx,#ask,#rd,#lb,#start'))}
function setYarnMode(on){yMode=on;document.body.classList.toggle('ymode',on);yBtn.classList.toggle('on',on);yBtn.setAttribute('aria-pressed',on?'true':'false');yTools.hidden=!on;if(on){clearSel();closePop();ySync()}sfx.blip()}
function ySync(){var r=yTools.querySelector('.yswr');if(r)r.remove();swatchRow(yTools.querySelector('.ytc'),yCol,function(c){yCol=c;data.yarnCol=c;save()})}
yBtn.addEventListener('click',function(){setYarnMode(!yMode)});
document.getElementById('yDone').addEventListener('click',function(){setYarnMode(false)});
// remove every pin (and its yarn) in the section she's looking at; tap twice to be sure
(function(){var b=document.getElementById('yClear'),tm=0;
  function here(){return data.pins.filter(function(p){return p.card?!!cards[p.card]:p.s===data.cur})}
  b.addEventListener('click',function(){
    var ps=here();if(!ps.length){sfx.warn();toast('There are no pins or yarn in this section');return}
    if(!b.classList.contains('armed')){sfx.warn();b.classList.add('armed');b.textContent='Remove '+ps.length+' pin'+(ps.length>1?'s':'')+' & yarn?';clearTimeout(tm);tm=setTimeout(reset,3000);return}
    reset();var ids={};ps.forEach(function(p){ids[p.id]=1});
    data.pins=data.pins.filter(function(p){return !ids[p.id]});data.yarns=data.yarns.filter(function(y){return !ids[y.a]&&!ids[y.b]});
    sfx.trash();save();yarnDraw();toast('Removed '+ps.length+' pin'+(ps.length>1?'s':'')+' and their yarn');
  });
  function reset(){clearTimeout(tm);b.classList.remove('armed');b.textContent='Remove all'}
  yBtn.addEventListener('click',reset);
})();
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&yMode&&!document.querySelector('.pop'))setYarnMode(false)});
document.addEventListener('pointerdown',function(e){
  if(!yMode||e.button)return;var t=e.target;
  if(t.closest&&(t.closest('#yarn .ypin,#yarn .yhit')||overUI(e.clientX,e.clientY)))return;
  if(!t.closest||!t.closest('#board'))return;
  e.preventDefault();e.stopPropagation();addPin(e.clientX,e.clientY);
},true);

// ---- open a folder ----
function resetState(){
  Object.keys(cards).forEach(function(k){cards[k].remove()});cards={};
  Object.keys(pdfDocs).forEach(dropDoc);closeReader();closePop();
  Object.keys(libUrls).forEach(function(k){try{URL.revokeObjectURL(libUrls[k])}catch(e){}});libUrls={};libFiles={};
  Object.keys(urls).forEach(function(k){try{URL.revokeObjectURL(urls[k])}catch(e){}});urls={};files={};topZ=1;
  data={title:'Corkboard',sections:[],photos:[],notes:[],labels:[],stickers:[],templates:[],pins:[],yarns:[],cur:null,sound:sound,volume:volume,theme:data.theme||'classic',dangle:data.dangle,custom:data.custom,style:data.style,wallpaper:null};
  if(typeof setYarnMode==='function'&&yMode)setYarnMode(false);Object.keys(yEls).forEach(function(k){yEls[k].remove()});yEls={};Object.keys(pEls).forEach(function(k){pEls[k].remove()});pEls={};
  setWallUrl(null);Object.keys(thMem).forEach(function(k){if(thMem[k])URL.revokeObjectURL(thMem[k])});thMem={};thDir=null;
}
async function mount(h){
  try{
    if(await h.requestPermission({mode:'readwrite'})!=='granted'){toast('Folder access was not allowed');return}
    var pd=await h.getDirectoryHandle('photos',{create:true});
    try{thDir=await h.getDirectoryHandle('thumbs',{create:true})}catch(e){thDir=null}
    // switching from an already-open board: save it first, then start clean
    if(dir){clearTimeout(st);await flush();resetState()}
    dir=h;photosDir=pd;
    try{var bf=await dir.getFileHandle('board.json');data=JSON.parse(await(await bf.getFile()).text())}catch(e){}
    // upgrade boards saved by older versions (no sections / notes / volume yet)
    if(!data.photos)data.photos=[];if(!data.notes)data.notes=[];
    if(!data.sections||!data.sections.length)data.sections=[{id:'s1',name:'Our memories'}];
    cleanSecTree(); // v1.8
    data.photos.forEach(function(p){if(!p.s)p.s=data.sections[0].id});
    if(!data.sections.some(function(s){return s.id===data.cur}))data.cur=data.sections[0].id;
    titleEl.textContent='';
    var keep=[];
    for(var p of data.photos){
      if(p.f)p.f=fxClean(p.f);if(!p.f)delete p.f;
      if(p.kind==='strip'){
        // a strip is kept as long as one of its photos is still there (missing frames show as dark)
        if(!Array.isArray(p.files)||!p.id)continue;p.files=p.files.slice(0,4);var any=false;
        for(var i=0;i<p.files.length;i++){try{files[p.id+'#'+i]=await(await photosDir.getFileHandle(p.files[i])).getFile();any=true}catch(e){}}
        if(any)keep.push(p);continue;
      }
      // DESKTOP: videos stream from disk instead of being read in when the board opens (mediaUrl uses urls[] first)
      if(window.corkNative&&p.kind==='video'){try{await photosDir.getFileHandle(p.file);urls[p.id]=window.__corkShim.urlFor(photosDir,p.file);keep.push(p)}catch(e){}continue}
      try{files[p.id]=await(await photosDir.getFileHandle(p.file)).getFile();keep.push(p)}catch(e){}
    }
    data.photos=keep;
    // v1.3 sticker library (older boards: every sticker already on the board joins the library)
    var lib=[];(Array.isArray(data.stickers)?data.stickers:[]).concat(data.photos.filter(function(p){return p.kind==='sticker'}).map(function(p){return{file:p.file,ar:p.ar}})).forEach(function(x){
      if(x&&typeof x.file==='string'&&!lib.some(function(q){return q.file===x.file}))lib.push({file:x.file,ar:isFinite(+x.ar)&&+x.ar>0?+x.ar:1})});
    data.stickers=[];for(var x of lib){try{libFiles[x.file]=await(await photosDir.getFileHandle(x.file)).getFile();data.stickers.push(x)}catch(e){}}
    // v1.1.7: to-do lists and resized notes
    data.notes.forEach(cleanNote);
    // v1.6 pins and yarn
    var hexC=function(c){return YARN_COLS.indexOf(c)>=0?c:YARN_COLS[0]};
    data.pins=(Array.isArray(data.pins)?data.pins:[]).filter(function(p){return p&&typeof p.id==='string'}).map(function(p){var o={id:p.id,c:hexC(p.c)};
      if(typeof p.card==='string'){o.card=p.card;o.ox=+p.ox||0;o.oy=+p.oy||0;if(typeof p.fx==='number'&&p.fx>=0&&p.fx<=1)o.fx=p.fx}else{var sids=data.sections.map(function(q){return q.id});o.s=sids.indexOf(p.s)>=0?p.s:sids[0];o.x=isFinite(+p.x)?+p.x:.5;o.y=isFinite(+p.y)?+p.y:300}return o});
    if(holdPins())save(); // v2.0: drawn card pins become real pins, once
    var pidOk={};data.pins.forEach(function(p){pidOk[p.id]=1});
    data.yarns=(Array.isArray(data.yarns)?data.yarns:[]).filter(function(y){return y&&pidOk[y.a]&&pidOk[y.b]&&y.a!==y.b}).map(function(y){return{id:typeof y.id==='string'?y.id:'y'+uid(),a:y.a,b:y.b,c:hexC(y.c)}});
    yCol=hexC(data.yarnCol);
    data.templates=(Array.isArray(data.templates)?data.templates:[]).filter(function(t){return t&&typeof t==='object'&&Array.isArray(t.items)}).map(function(t){
      return{id:typeof t.id==='string'?t.id:'u'+uid(),name:typeof t.name==='string'&&t.name.trim()?t.name.slice(0,30):'My template',items:t.items.map(cleanItem).filter(Boolean)}});
    // v1.1.6 fields: frameless photos, fonts, sticker finishes and labels (all optional, with safe defaults)
    data.photos.forEach(function(p){
      if(p.bare){p.bare=true;if(p.hold!=='tape')p.hold='pin'}else{delete p.bare;delete p.hold}
      if(p.font&&!fontById(p.font))delete p.font;
      if(p.kind==='doc'){p.n=Math.max(1,Math.round(+p.n)||1);p.pg=Math.max(0,Math.min(p.n-1,Math.round(+p.pg)||0));if(!(+p.ar>0))p.ar=.707}
      if(p.kind==='sticker'){p.fin=cleanFin(p.fin);if(!p.fin)delete p.fin;if(!isFinite(+p.rot))p.rot=0}
    });
    var secIds=data.sections.map(function(s){return s.id});
    data.labels=(Array.isArray(data.labels)?data.labels:[]).filter(function(l){return l&&typeof l==='object'&&typeof l.id==='string'}).map(function(l){
      var L=lookOf(l.look),o={id:l.id,s:secIds.indexOf(l.s)>=0||l.s===SHELF?l.s:secIds[0],sh:l.sh,text:typeof l.text==='string'?l.text.slice(0,LABEL_MAX):'',look:L.id,c:L.cols.indexOf(l.c)>=0?l.c:L.cols[0],
        x:isFinite(+l.x)?+l.x:.1,y:isFinite(+l.y)?+l.y:170,rot:isFinite(+l.rot)?+l.rot:0,z:isFinite(+l.z)?+l.z:1};
      if(isFinite(+l.sc)&&+l.sc!==1)o.sc=Math.max(.5,Math.min(4,+l.sc));if(fontById(l.font))o.font=l.font;rtStore(o,rtOf(l,LABEL_MAX));return o;
    });
    if(data.wallpaper&&typeof data.wallpaper==='object'&&typeof data.wallpaper.file==='string'){
      var wd=Math.round(+data.wallpaper.dim);data.wallpaper={file:data.wallpaper.file,dim:isFinite(wd)?Math.max(0,Math.min(80,wd)):20};
      try{setWallUrl(await(await photosDir.getFileHandle(data.wallpaper.file)).getFile(),data.wallpaper.file)}catch(e){data.wallpaper=null}
    }else data.wallpaper=null;
    sound=data.sound!==false;data.sound=sound;
    volume=(typeof data.volume==='number'&&isFinite(data.volume))?Math.max(0,Math.min(1,data.volume)):.8;data.volume=volume;applyVolume();
    cleanVideo();if(data.hover!==false)delete data.hover;if(data.spell!==false)delete data.spell;applyHover();applySpell(); // v2.0
    data.dangle=data.dangle!==false;delete data.keys;data.style=cleanStyle(data.style);applyStyle();data.custom=cleanCustom(data.custom);data.theme=THEMES.some(function(t){return t.id===data.theme})?data.theme:'classic';data.sections.forEach(function(sc){if(sc.theme&&!THEMES.some(function(t){return t.id===sc.theme}))delete sc.theme});applyTheme(curTheme());
    var zz=+data.zoom;ZM=1;setZoom(isFinite(zz)?zz:1);if(ZM===1)delete data.zoom;
    // v2.0: the same layout on any screen: the board's layout width (bw) is set once, and the window scales to fit it
    if(!(typeof data.bw==='number'&&data.bw>=600&&data.bw<=4000))delete data.bw;
    if(window.corkNative&&window.corkNative.boardWidth){try{var bw=await window.corkNative.boardWidth(data.bw||null);if(bw&&data.bw!==bw){data.bw=bw;save()}}catch(e){}
      await new Promise(function(r){requestAnimationFrame(function(){requestAnimationFrame(r)})})} // the page has its new size before cards are placed
    gearBtn.style.display='inline-flex';document.getElementById('lfab').style.display='';sbBtn.style.display='';setSidebar(false);shelfEl.style.display='';renderShelf();ySvg.style.display='';yarnClean();fab.style.display='';startEl.remove();closeSettings();renderSection();rememberHandle(h);
  }catch(e){toast('Couldn\u2019t open that folder')}
}
function button(label,alt,fn){var b=document.createElement('button');b.className='btn'+(alt?' alt':'');b.textContent=label;b.addEventListener('click',fn);document.getElementById('btns').appendChild(b)}
async function pick(){
  try{
    var h=await window.showDirectoryPicker({id:'corkboard',mode:'readwrite'});
    try{if(dir&&await h.isSameEntry(dir)){toast('That\u2019s already the open folder');return}}catch(e){}
    mount(h);
  }catch(e){}
}

(async function(){
  // DESKTOP: open the last board straight away, or on first launch the board the app made for itself (no folder to
  // choose); the start screen only shows if her chosen board folder has gone missing
  if(window.corkNative){
    startEl.style.visibility='hidden';
    var last=null;try{last=await window.corkNative.lastBoard()}catch(e){}
    if(last&&last.missing){var mm=document.getElementById('msg');mm.textContent='I couldn’t find your board folder ('+last.missing+'). If you moved or renamed it, choose it again below.'}
    button('Choose a folder',false,pick);
    if(last&&last.root)await mount(window.__corkShim.handleFor(last));
    startEl.style.visibility='';
    return;
  }
  if(!window.showDirectoryPicker){
    var m=document.getElementById('msg');m.className='warn';
    m.textContent='This needs Chrome, Edge or another Chromium browser on a computer so it can save into a folder. Please open this file there.';return;
  }
  var h=await recallHandle();
  if(h)button('Open my board',false,function(){mount(h)});
  button(h?'Choose a different folder':'Choose a folder',!!h,pick);
})();
// keep keyboard focus inside whichever dialog is open
document.addEventListener('keydown',function(e){
  if(e.key!=='Tab')return;
  var m=[tplEl,rdEl,lb,fxEl,askEl,setEl].filter(function(x){return getComputedStyle(x).display!=='none'})[0];if(!m)return;
  var f=Array.prototype.filter.call(m.querySelectorAll('button,input,textarea,select,video[controls],[tabindex]:not([tabindex="-1"])'),function(el){return !el.disabled&&el.offsetParent!==null&&getComputedStyle(el).visibility!=='hidden'});
  if(!f.length)return;var a=f[0],z=f[f.length-1];
  if(!m.contains(document.activeElement)){e.preventDefault();a.focus();return}
  if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}
});
var rsT=0;
window.addEventListener('resize',function(){clearTimeout(rsT);rsT=setTimeout(function(){
  var W=board.clientWidth;for(var k in cards){var e=cards[k],q=e._p;if(!q||e.classList.contains('drag'))continue;e.style.left=clampX(q.x*W)+'px';keepIn(e)}fit();
},120)});
// DESKTOP: hooks for the desktop bridge (menus, recent boards, drag and drop from the OS, saving before the window closes)
if(window.corkNative)window.__cork={
  flush:function(){if(!dir)return Promise.resolve();clearTimeout(st);return flush()},
  pick:pick,
  mount:mount,
  addFiles:function(list){if(!dir)return;return addFiles(list,false)},
  toast:toast,
  warn:function(){sfx.warn()},
  hasBoard:function(){return !!dir},
  sections:function(){setSidebar(!sbOpen)},
  warmSound:function(){try{sfx.warm()}catch(e){}}
};
})();
