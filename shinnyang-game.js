/* 신냥이의 한 시간 v2 — full history.json-backed mini game, no remote services */
(() => {
  'use strict';
  const trigger = document.getElementById('shinnyangTrigger');
  const panel = document.getElementById('shinnyangGame');
  if (!trigger || !panel) return;
  const $ = id => document.getElementById(id);
  const STORE = 'pilsae:shinnyang:prototype:v1'; // previous test save is migrated
  const OUTFITS = [
    {id:'ribbon', name:'복숭아 리본', min:0, icon:'🎀'},
    {id:'scarf', name:'보랏빛 스카프', min:35, icon:'🧣'},
    {id:'headphones', name:'연습실 헤드폰', min:85, icon:'🎧'},
    {id:'jacket', name:'반짝 무대복', min:165, icon:'✨'},
    {id:'crown', name:'별빛 왕관', min:290, icon:'👑'}
  ];
  const LEVELS=[{min:0,label:'LEVEL 1 · 꼬마냥'},{min:45,label:'LEVEL 2 · 데뷔냥'},{min:130,label:'LEVEL 3 · 무대냥'},{min:260,label:'LEVEL 4 · 스타냥'}];
  const MISSIONS=[{act:'sing',count:2,label:'노래 연습 2번 하기'},{act:'stage',count:1,label:'무대에 1번 올라가기'},{act:'dance',count:2,label:'댄스 연습 2번 하기'},{act:'letter',count:2,label:'팬레터 2통 읽기'},{act:'snack',count:2,label:'간식 2번 먹기'}];
  const GIFTS=[['🎁','팬들의 작은 선물','예쁜 스티커를 받았어!',7],['💎','반짝이는 별조각','별빛이 반짝! 별이 늘었어.',9],['🍮','푸딩 도착!','달콤한 푸딩에 체력이 조금 회복됐어.',0],['📻','레트로 라디오','연습실에 음악이 흘러나와 ♪',6],['💐','응원의 꽃다발','팬들의 마음이 전해졌어 ♡',8]];
  const VERIFICATION={pending:'독립 검증 전',partial:'일부 자료 확인',original_record:'원문 기록',date_uncertain:'날짜 불확실',announced:'사전 예고',source_unavailable:'원출처 확인 어려움',date_conflict:'날짜 자료 상충',on_hold:'확인 보류'};
  const clamp=(n,lo=0,hi=100)=>Math.max(lo,Math.min(hi,n));
  const initial=()=>({minute:0,energy:70,voice:20,fans:0,stars:0,sessions:0,scene:'idle',outfit:'ribbon',year:'all',seen:[],actions:[],finished:false,message:'오늘은 어떤 노래를 연습해볼까냥? ♡',notice:'행동을 고르면 게임 속 10분이 흘러가!',gift:null});
  const safeInt=(x,max)=>Number.isFinite(Number(x))?clamp(Math.trunc(Number(x)),0,max):0;
  function load(){
    const s=initial();
    try{
      const v=JSON.parse(localStorage.getItem(STORE)||'null');
      if (!v||typeof v!=='object'||Array.isArray(v)) return s;
      const minute=Math.floor(safeInt(v.minute,60)/10)*10;
      return {...s,minute,energy:safeInt(v.energy,100),voice:safeInt(v.voice,100),fans:safeInt(v.fans,100),stars:safeInt(v.stars,999999),sessions:safeInt(v.sessions,999999),scene:['idle','sing','dance','stage','rest','snack','letter'].includes(v.scene)?v.scene:'idle',outfit:OUTFITS.some(o=>o.id===v.outfit)?v.outfit:'ribbon',year:/^\d{4}$/.test(v.year)?v.year:'all',seen:Array.isArray(v.seen)?[...new Set(v.seen.filter(x=>typeof x==='string'&&x.length<160))].slice(0,3000):[],actions:Array.isArray(v.actions)?v.actions.filter(x=>typeof x==='string').slice(0,6):[],finished:minute===60,message:typeof v.message==='string'?v.message.slice(0,120):s.message,notice:typeof v.notice==='string'?v.notice.slice(0,120):s.notice,gift:null};
    }catch{return s;}
  }
  let state=load();
  let events=[], byYear=new Map(), current=null, ready=false, loadError=false, loading=false;
  let blink=false, blinkInterval=null, rhythmStart=0, rhythmFrame=null, challenge=false, reactionTimer=null;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  function save(){try{localStorage.setItem(STORE,JSON.stringify({...state,gift:null}));}catch{}}
  function level(){for(let i=LEVELS.length-1;i>=0;i--)if(state.stars>=LEVELS[i].min)return i;return 0;}
  function allowOutfit(item){return state.stars>=item.min;}
  function activeOutfit(){const o=OUTFITS.find(x=>x.id===state.outfit);return o&&allowOutfit(o)?o:OUTFITS[0];}
  const ordinal=()=>state.minute/10;
  function mission(){return MISSIONS[state.sessions%MISSIONS.length];}
  function missionCount(){return state.actions.filter(a=>a===mission().act).length;}
  function historyDate(e){const d=String(e.date||'');return e.precision==='year'?d.slice(0,4)+'년 (월·일 미상)':e.precision==='month'?d.slice(0,4)+'.'+d.slice(5,7)+' (일 미상)':d.replace(/-/g,'.');}
  function chooseMoment(){
    const pool=state.year==='all'?events:(byYear.get(state.year)||[]);
    if (!pool.length)return null;
    // Deterministic non-repeating step within each session, jump across full archive in all-years mode.
    const n=state.year==='all'?(state.sessions*157 + ordinal()*419):(state.sessions*17 + ordinal()*7);
    return pool[n%pool.length];
  }
  function renderMoment(){
    current=ready?chooseMoment():null;
    if(!current){$('shinnyangMomentDate').textContent=loadError?'자료를 읽을 수 없어':'연혁을 불러오는 중...';$('shinnyangMomentTitle').textContent=loadError?'네트워크 상태를 확인하고 페이지를 새로고침해 줘.':'2,657건의 활동 기록을 준비하고 있어.';$('snMomentStatus').textContent='';$('shinnyangMomentSource').hidden=true;return;}
    $('shinnyangMomentDate').textContent=historyDate(current)+' · '+String(current.category||'기타');
    $('shinnyangMomentTitle').textContent=String(current.title||'활동 기록');
    $('snMomentStatus').textContent='검증 상태: '+(VERIFICATION[current.verificationDisplayCode]||'확인 범위 미표기');
    const url=[current.verificationUrl,current.sourceUrl].find(u=>typeof u==='string'&&/^https?:\/\//i.test(u));
    const a=$('shinnyangMomentSource');if(url){a.href=url;a.hidden=false;}else{a.removeAttribute('href');a.hidden=true;}
  }
  function renderOutfits(){
    const host=$('snOutfits'); host.replaceChildren();
    for(const o of OUTFITS){
      const button=document.createElement('button');button.type='button';button.className='sn-outfit';button.disabled=!allowOutfit(o);button.classList.toggle('chosen',activeOutfit().id===o.id);
      button.textContent=o.icon+' '+o.name+(allowOutfit(o)?'':' · '+o.min+'별');
      button.setAttribute('aria-pressed',String(activeOutfit().id===o.id));
      button.addEventListener('click',()=>{state.outfit=o.id;state.notice='🎀 '+o.name+' 착용 완료!';save();render();pop();});host.appendChild(button);
    }
    $('snOutfitCount').textContent=OUTFITS.filter(allowOutfit).length+'/'+OUTFITS.length;
  }
  function renderCollection(){
    const c=$('snCollection');c.replaceChildren();
    const existing=new Map(events.map(e=>[String(e.id),e]));
    const seen=state.seen.map(id=>existing.get(id)).filter(Boolean);
    $('snCollectionCount').textContent=seen.length+'장';
    $('snCollectionPreview').textContent=seen.length?`기록 ${seen.length.toLocaleString('ko-KR')}장을 모았어! 최근 수집한 추억`:'연혁 카드를 하나씩 만나며 추억을 모아봐!';
    for(const e of seen.slice(-4).reverse()){
      const p=document.createElement('p');p.className='sn-collected-card';p.textContent=historyDate(e)+' · '+e.title;c.appendChild(p);
    }
  }
  function render(){
    const m=mission();
    $('shinnyangRank').textContent=LEVELS[level()].label;
    $('shinnyangClock').textContent=(state.minute===60?'01:00':'00:'+String(state.minute).padStart(2,'0'))+' / 01:00';
    $('shinnyangScene').dataset.scene=state.scene;
    const stage=state.scene==='stage',rest=state.scene==='rest',snack=state.scene==='snack',dance=state.scene==='dance',letter=state.scene==='letter';
    $('shinnyangSceneTag').textContent=stage?'✦ 반짝이는 무대':rest?'☾ 포근한 침실':snack?'🍰 간식 타임':dance?'🪩 춤 연습실':letter?'💌 팬레터 시간':'♪ 아늑한 연습실';
    $('snPropLeft').textContent=stage?'🎸':rest?'🛏️':snack?'🍮':letter?'✉️':dance?'🪩':'🎹';
    $('snPropRight').textContent=stage?'🌟':rest?'🌙':snack?'🫖':letter?'💐':dance?'🎶':'🧸';
    $('shinnyangDialogue').textContent=state.message;
    $('shinnyangToast').textContent=state.notice;
    $('snEnergy').textContent=state.energy;$('snVoice').textContent=state.voice;$('snFans').textContent=state.fans;
    for(const [id,n] of [['snEnergyBar',state.energy],['snVoiceBar',state.voice],['snFansBar',state.fans]])$(id).style.width=n+'%';
    $('shinnyangStars').textContent=state.stars.toLocaleString('ko-KR')+' 별 · '+state.sessions+'회 완주';
    [...$('shinnyangProgress').children].forEach((node,i)=>node.classList.toggle('filled',i<ordinal()));
    $('snMissionTitle').textContent=m.label;
    $('snMissionCount').textContent=Math.min(missionCount(),m.count)+'/'+m.count;
    $('snMissionCount').classList.toggle('complete',missionCount()>=m.count);
    panel.querySelectorAll('[data-sn-act]').forEach(b=>{
      const kind=b.dataset.snAct;
      b.disabled=!ready||state.finished||challenge||((kind==='sing'||kind==='dance')&&state.energy<14)||(kind==='stage'&&(state.energy<22||state.voice<25))||(kind==='letter'&&state.energy<5);
      if(kind==='stage') b.title=state.voice<25?'노래 실력 25 이상 필요':state.energy<22?'체력 22 이상 필요':'리듬 타이밍 미니게임';
    });
    $('shinnyangFinale').setAttribute('aria-hidden',String(!state.finished));
    $('shinnyangActions').hidden=state.finished||challenge;
    $('snStageChallenge').hidden=!challenge;
    if(state.finished){
      $('shinnyangEndTitle').textContent=state.fans>=65?'✦ 앙코르 요청이 쏟아진다냥!':state.fans>=30?'♡ 팬들의 박수를 받았어!':'✧ 오늘도 멋진 하루 완성!';
      $('shinnyangEndBody').textContent=`노래 실력 ${state.voice} · 인기 ${state.fans} · 추억 ${state.seen.length}장! 다른 시기에도 놀러 가자냥 ♡`;
    }
    renderOutfits();renderCollection();renderMoment();drawCat();
  }
  function pop(){const t=$('shinnyangToast');t.classList.remove('sn-pop');void t.offsetWidth;t.classList.add('sn-pop');}
  function sparkle(text){
    const host=$('snReaction');host.textContent=text;host.classList.remove('sn-reaction-on');void host.offsetWidth;host.classList.add('sn-reaction-on');
    if(reactionTimer)clearTimeout(reactionTimer);reactionTimer=setTimeout(()=>host.classList.remove('sn-reaction-on'),950);
  }
  function giftAlert(idx){
    const [icon,name,desc,stars]=GIFTS[idx%GIFTS.length];
    state.stars+=stars;
    if(idx%GIFTS.length===2)state.energy=clamp(state.energy+8);
    const wrap=$('snGift');$('snGiftEmoji').textContent=icon;$('snGiftTitle').textContent=name;$('snGiftText').textContent=desc+(stars?' · 별 +'+stars:' · 체력 +8');
    wrap.hidden=false;wrap.classList.remove('sn-gift-in');void wrap.offsetWidth;wrap.classList.add('sn-gift-in');
  }
  function collectMoment(){if(current&&!state.seen.includes(String(current.id))){state.seen.push(String(current.id));return true;}return false;}
  function apply(kind,bonus=0){
    if(!ready||state.finished||state.minute>=60)return;
    const oldLevel=level();const oldOutfits=OUTFITS.filter(allowOutfit).length;
    const newMemory=collectMoment();
    const actions={
      sing:{e:-14,v:18,f:2,s:9,scene:'sing',speech:'냐옹~ ♫ 높은 음도 잘 올라간다냥!',label:'노래 연습'},
      dance:{e:-14,v:9,f:7,s:9,scene:'dance',speech:'하나 둘 셋! 발바닥 스텝 성공 ✦',label:'댄스 연습'},
      stage:{e:-22,v:-2,f:20+bonus,s:15+bonus,scene:'stage',speech:bonus>=14?'퍼펙트 무대! 앙코르다냥!! ✨':'무대 위에서 반짝반짝 노래해 ♪',label:'무대 출연'},
      snack:{e:19,v:0,f:1,s:4,scene:'snack',speech:'딸기 케이크 너무 맛있다냥~ 🍰',label:'간식 시간'},
      rest:{e:28,v:0,f:0,s:3,scene:'rest',speech:'폭신한 담요 속에서 코오... ☾',label:'꿀잠'},
      letter:{e:-5,v:0,f:12,s:8,scene:'letter',speech:'팬레터를 읽으니 마음이 몽글몽글해 ♡',label:'팬레터'}
    };
    const a=actions[kind];if(!a)return;
    state.energy=clamp(state.energy+a.e);state.voice=clamp(state.voice+a.v);state.fans=clamp(state.fans+a.f);state.stars+=a.s;
    state.scene=a.scene;state.message=a.speech;state.notice='✦ '+a.label+' · 별 +'+a.s+(newMemory?' · 새로운 연혁 카드 수집!':'');
    state.actions.push(kind);state.minute+=10;
    if(state.minute%20===0)giftAlert(state.sessions*3+state.minute/20);
    if(state.minute===60){
      state.finished=true;state.sessions++;state.stars+=12;state.notice='🎉 1시간 완주! 별 +12';
      const m=MISSIONS[(state.sessions-1)%MISSIONS.length];
      if(state.actions.filter(x=>x===m.act).length>=m.count){state.stars+=20;state.notice+=' · 미션 성공! 별 +20';}
    }
    if(level()>oldLevel)state.notice+=' · '+LEVELS[level()].label+' 성장!';
    if(OUTFITS.filter(allowOutfit).length>oldOutfits)state.notice+=' · 새 의상 해금 🎀';
    challenge=false;save();render();pop();sparkle(kind==='stage'?'✨ PERFECT ♫':newMemory?'✦ NEW MEMORY!':'♡ +'+a.s);
  }
  function startRhythm(){
    if(!ready||state.finished||state.energy<22||state.voice<25)return;
    challenge=true;rhythmStart=performance.now();render();
    const pointer=$('snRhythmPointer');
    const frame=()=>{
      if(!challenge)return;
      const t=(performance.now()-rhythmStart)/1300;
      const fraction=1-Math.abs((t%2)-1);
      pointer.style.left=(5+90*fraction)+'%';
      rhythmFrame=requestAnimationFrame(frame);
    };
    if(!reduced.matches)rhythmFrame=requestAnimationFrame(frame);
    else pointer.style.left='50%';
    $('snRhythmTap').focus();
  }
  function resolveRhythm(skip){
    if(!challenge)return;
    if(rhythmFrame)cancelAnimationFrame(rhythmFrame);rhythmFrame=null;
    let bonus=0;
    if(!skip){if(reduced.matches){bonus=15;}else{const t=(performance.now()-rhythmStart)/1300;const f=1-Math.abs((t%2)-1);const distance=Math.abs(f-.5);bonus=distance<=.1?15:distance<=.23?8:2;}}
    apply('stage',bonus);
  }
  function newHour(){
    const keep={stars:state.stars,sessions:state.sessions,seen:state.seen,year:state.year,outfit:state.outfit};
    state={...initial(),...keep,message:'새로운 한 시간, 신나게 놀아보자냥! ♪'};
    $('snGift').hidden=true;save();render();panel.querySelector('[data-sn-act="sing"]')?.focus();
  }
  function setOpen(open){
    panel.hidden=!open;trigger.setAttribute('aria-expanded',String(open));trigger.setAttribute('aria-label',open?'신냥이 게임 닫기':'신냥이 게임 열기');
    if(open){if(!ready&&!loading)void loadHistory();render();$('shinnyangClose').focus();if(!blinkInterval&&!reduced.matches)blinkInterval=setInterval(()=>{if(!document.hidden){blink=!blink;drawCat();}},1500);}
    else{if(blinkInterval){clearInterval(blinkInterval);blinkInterval=null;}if(challenge){challenge=false;if(rhythmFrame)cancelAnimationFrame(rhythmFrame);rhythmFrame=null;}trigger.focus();}
  }
  function drawCat(){
    const canvas=$('shinnyangSprite');const ctx=canvas.getContext('2d');if(!ctx)return;
    ctx.clearRect(0,0,48,48);ctx.imageSmoothingEnabled=false;
    const c={edge:'#765c7e',fur:'#fff3e9',shade:'#ead5d6',inner:'#f5bacb',blush:'#eea3b8',eye:'#514657',bow:'#dca5ca',lilac:'#b7a0de',gold:'#f6ce79',white:'#fffdf5',grey:'#9b89aa',coral:'#e49eb6',blue:'#9cc5e4'};
    const px=(x,y,w,h,col)=>{ctx.fillStyle=c[col]||col;ctx.fillRect(x,y,w,h);};
    // tail swish, body and paws
    px(34,30,5,4,'edge');px(38,26,3,5,'edge');px(39,23,3,4,'edge');px(36,30,2,2,'fur');px(40,24,1,2,'fur');
    px(15,28,20,11,'edge');px(16,29,18,9,'fur');px(16,37,5,5,'edge');px(29,37,5,5,'edge');px(17,37,4,4,'fur');px(30,37,4,4,'fur');
    const outfit=activeOutfit().id;
    if(outfit==='scarf'){px(19,30,13,3,'lilac');px(23,33,4,7,'lilac');px(24,35,2,3,'white');}
    if(outfit==='jacket'){px(16,32,5,7,'lilac');px(29,32,5,7,'lilac');px(23,33,4,6,'gold');px(16,34,2,2,'white');px(32,34,2,2,'white');}
    // ears
    px(12,9,6,12,'edge');px(13,6,4,13,'edge');px(14,10,3,7,'inner');
    px(32,9,6,12,'edge');px(33,6,4,13,'edge');px(33,10,3,7,'inner');
    // round cat head
    px(16,12,18,2,'edge');px(12,14,26,4,'edge');px(10,17,30,13,'edge');px(13,30,24,3,'edge');px(16,33,18,2,'edge');
    px(16,14,18,3,'fur');px(13,17,24,3,'fur');px(11,20,28,10,'fur');px(14,30,22,2,'fur');px(17,32,16,2,'fur');
    px(12,25,6,3,'shade');px(33,25,6,3,'shade');px(13,25,4,2,'blush');px(34,25,4,2,'blush');
    const sleeping=state.scene==='rest';
    if(sleeping||blink){px(17,23,5,1,'eye');px(29,23,5,1,'eye');}
    else{px(19,21,3,4,'eye');px(29,21,3,4,'eye');px(19,21,1,1,'white');px(29,21,1,1,'white');}
    px(24,25,3,2,'coral');
    if(['sing','dance','stage'].includes(state.scene)){px(24,28,3,3,'eye');px(25,30,1,1,'blush');}
    else{px(22,29,2,1,'eye');px(28,29,2,1,'eye');}
    px(14,34,4,4,'edge');px(15,35,3,2,'fur');px(33,34,4,4,'edge');px(34,35,3,2,'fur');
    if(outfit==='headphones'){px(12,13,2,13,'lilac');px(37,13,2,13,'lilac');px(14,9,23,3,'lilac');px(11,20,4,8,'grey');px(37,20,4,8,'grey');}
    else if(outfit==='crown'){px(18,6,15,4,'gold');px(19,3,3,4,'gold');px(24,2,3,5,'gold');px(30,3,3,4,'gold');px(24,7,3,2,'coral');}
    else if(outfit==='ribbon'){px(18,34,5,4,'bow');px(27,34,5,4,'bow');px(23,35,4,3,'gold');}
    if(state.scene==='stage'){px(37,19,5,6,'edge');px(38,20,3,4,'grey');px(39,25,1,11,'edge');px(37,36,5,2,'grey');}
    if(state.scene==='snack'){px(38,34,7,4,'gold');px(39,32,6,2,'inner');}
    if(state.scene==='letter'){px(37,34,8,6,'white');px(38,35,6,2,'coral');}
    if(state.scene==='rest'){px(38,14,2,2,'lilac');px(40,11,3,2,'lilac');}
    canvas.setAttribute('aria-label',`${LEVELS[level()].label}, ${activeOutfit().name}을 착용한 ${sleeping?'잠든':'활동하는'} 도트 고양이 신냥이`);
  }
  async function loadHistory(){
    if(ready||loading)return;loading=true;
    try{
      let body;
      if(window.SHINNYANG_OFFLINE_HISTORY)body=window.SHINNYANG_OFFLINE_HISTORY;
      else{
        const res=await fetch('./shinnyang-history.json',{credentials:'same-origin',cache:'no-store'});
        if(!res.ok)throw new Error('HTTP '+res.status);
        body=await res.json();
      }
      if(!body||!Array.isArray(body.events)||body.events.length<1)throw new Error('events missing');
      events=body.events.filter(e=>e&&typeof e.id==='string'&&typeof e.title==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(e.date));
      if(!events.length)throw new Error('no events');
      byYear=new Map();for(const e of events){const y=e.date.slice(0,4)==='1997'?'1998':e.date.slice(0,4);if(!byYear.has(y))byYear.set(y,[]);byYear.get(y).push(e);}
      const select=$('snEra');select.replaceChildren(new Option('전 시기 랜덤 여행','all'));
      for(const y of [...byYear.keys()].sort()){select.add(new Option(y==='1998'?'1998년 (1997 준비 자료 포함) · '+byYear.get(y).length+'건':y+'년 · '+byYear.get(y).length+'건',y));}
      if(state.year!=='all'&&!byYear.has(state.year))state.year='all';select.value=state.year;
      ready=true;loadError=false;
      $('snDataCount').textContent=events.length.toLocaleString('ko-KR')+'건 연결';
      $('snTicker').textContent=[...events.filter((e,i)=>i%177===0)].slice(0,16).map(e=>'✦ '+historyDate(e)+' '+e.title).join('　　　');
      if(state.minute===0)state.notice='✧ 실제 연혁 '+events.length.toLocaleString('ko-KR')+'건 연결 완료!';
      render();
    }catch(err){
      console.warn('[shinnyang] history load failed:',err?.message||String(err));ready=false;loadError=true;
      state.notice='연혁 자료를 읽지 못했어. 새로고침해 줘.';render();
    }finally{loading=false;}
  }
  trigger.addEventListener('click',()=>setOpen(panel.hidden));
  $('shinnyangClose').addEventListener('click',()=>setOpen(false));
  panel.querySelectorAll('[data-sn-act]').forEach(button=>button.addEventListener('click',()=>{
    const k=button.dataset.snAct;
    if(k==='stage')startRhythm();else apply(k);
  }));
  $('snRhythmTap').addEventListener('click',()=>resolveRhythm(false));
  $('snRhythmSkip').addEventListener('click',()=>resolveRhythm(true));
  $('shinnyangAgain').addEventListener('click',newHour);
  $('snGiftClose').addEventListener('click',()=>$('snGift').hidden=true);
  $('snEra').addEventListener('change',ev=>{state.year=ev.target.value;save();renderMoment();});
  $('shinnyangReset').addEventListener('click',()=>{if(!window.confirm('신냥이의 별과 추억을 모두 처음부터 다시 시작할까냥?'))return;state=initial();challenge=false;if(rhythmFrame)cancelAnimationFrame(rhythmFrame);rhythmFrame=null;$('snGift').hidden=true;if(ready)$('snEra').value='all';save();render();});
  document.addEventListener('keydown',ev=>{if(!panel.hidden&&ev.key==='Escape'){if(challenge){challenge=false;if(rhythmFrame)cancelAnimationFrame(rhythmFrame);rhythmFrame=null;render();}else setOpen(false);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&rhythmFrame){cancelAnimationFrame(rhythmFrame);rhythmFrame=null;if(challenge){challenge=false;render();}}});
  render();
  // Lazy-load in the archive so the game does not trigger a second 4MB fetch before the stamp is clicked.
  // The public game page opens immediately, archive page retains stamp-triggered popup.
  if(document.body.classList.contains('shinnyang-page'))setOpen(true);
})();
