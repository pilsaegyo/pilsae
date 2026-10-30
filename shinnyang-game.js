/* 신냥이의 한 시간 v3 — full history.json-backed mini game, no remote services */
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
  const DECORS=[
    {id:'none',name:'기본 연습실',icon:'🏠',cost:0},
    {id:'flower',name:'작은 꽃 화분',icon:'🪴',cost:12},
    {id:'lamp',name:'별빛 스탠드',icon:'💡',cost:24},
    {id:'radio',name:'레트로 라디오',icon:'📻',cost:38},
    {id:'bear',name:'포근한 곰 인형',icon:'🧸',cost:56},
    {id:'mirror',name:'무대 미러볼',icon:'🪩',cost:78},
    {id:'piano',name:'꿈꾸는 피아노',icon:'🎹',cost:105}
  ];
  const ENCOUNTERS=[
    {title:'🎶 연습실 앞 길고양이',story:'작은 고양이가 창문 밖에서 노래를 듣고 있어!',choices:[{label:'함께 노래하기 · 실력 +5, 🪙 +3',v:5,c:3},{label:'간식 나눠주기 · 체력 +8, 🪙 +1',e:8,c:1}]},
    {title:'💌 비밀 응원 편지',story:'책상 위에 이름 없는 응원 편지가 놓여 있어.',choices:[{label:'큰 소리로 답장하기 · 인기 +9',f:9,c:1},{label:'소중하게 보관하기 · 별 +5, 🪙 +2',s:5,c:2}]},
    {title:'🌠 연습실의 별똥별',story:'창밖으로 작은 별 하나가 쏜살같이 지나가!',choices:[{label:'무대를 꿈꾸기 · 실력 +7',v:7,c:1},{label:'소원 빌기 · 별 +6',s:6,c:1}]},
    {title:'☔ 갑작스러운 소나기',story:'비가 내리기 시작했어. 오늘은 어떻게 할까?',choices:[{label:'빗소리에 화음 넣기 · 실력 +6',v:6,c:2},{label:'따뜻한 차 마시기 · 체력 +12',e:12,c:1}]},
    {title:'🎀 선물 상자의 리본',story:'예쁜 리본이 달린 상자가 도착했어!',choices:[{label:'상자를 열어보기 · 🪙 +7',c:7},{label:'나중을 위해 남기기 · 별 +8',s:8,c:1}]},
    {title:'📸 포토타임!',story:'연습실로 놀러온 친구가 기념사진을 찍자고 해!',choices:[{label:'귀여운 포즈 취하기 · 인기 +7',f:7,c:2},{label:'다 같이 춤추기 · 실력 +4, 인기 +3',v:4,f:3,c:2}]}
  ];
  const ACHIEVEMENTS=[
    {id:'first',icon:'🌟',title:'첫 한 시간',desc:'한 시간을 처음 완주',goal:s=>s.sessions>=1},
    {id:'memorize',icon:'🎵',title:'음정 천재',desc:'음정 기억 게임 성공 2회',goal:s=>s.songWins>=2},
    {id:'perform',icon:'🎤',title:'반짝이는 무대',desc:'무대 출연 3회',goal:s=>s.totalStages>=3},
    {id:'memories',icon:'📜',title:'추억 수집가',desc:'실제 연혁 카드 10장 수집',goal:s=>s.seen.length>=10},
    {id:'events',icon:'🎲',title:'운명의 선택',desc:'돌발 이벤트 4회 해결',goal:s=>s.totalEvents>=4},
    {id:'interior',icon:'🪴',title:'아늑한 연습실',desc:'방 소품 3개 구입',goal:s=>s.ownedDecor.length>=3},
    {id:'journey',icon:'🏆',title:'가수냥의 꿈',desc:'한 시간 5회 완주',goal:s=>s.sessions>=5}
  ];
  const VERIFICATION={pending:'독립 검증 전',partial:'일부 자료 확인',original_record:'원문 기록',date_uncertain:'날짜 불확실',announced:'사전 예고',source_unavailable:'원출처 확인 어려움',date_conflict:'날짜 자료 상충',on_hold:'확인 보류'};
  const clamp=(n,lo=0,hi=100)=>Math.max(lo,Math.min(hi,n));
  const initial=()=>({minute:0,energy:70,voice:20,fans:0,stars:0,sessions:0,scene:'idle',outfit:'ribbon',year:'all',seen:[],actions:[],finished:false,message:'오늘은 어떤 노래를 연습해볼까냥? ♡',notice:'행동을 고르면 게임 속 10분이 흘러가!',gift:null,coins:0,decor:'none',ownedDecor:[],badges:[],pendingEvent:null,totalStages:0,totalEvents:0,songWins:0});
  const safeInt=(x,max)=>Number.isFinite(Number(x))?clamp(Math.trunc(Number(x)),0,max):0;
  function load(){
    const s=initial();
    try{
      const v=JSON.parse(localStorage.getItem(STORE)||'null');
      if (!v||typeof v!=='object'||Array.isArray(v)) return s;
      const minute=Math.floor(safeInt(v.minute,60)/10)*10;
      return {...s,minute,energy:safeInt(v.energy,100),voice:safeInt(v.voice,100),fans:safeInt(v.fans,100),stars:safeInt(v.stars,999999),sessions:safeInt(v.sessions,999999),scene:['idle','sing','dance','stage','rest','snack','letter'].includes(v.scene)?v.scene:'idle',outfit:OUTFITS.some(o=>o.id===v.outfit)?v.outfit:'ribbon',year:/^\d{4}$/.test(v.year)?v.year:'all',seen:Array.isArray(v.seen)?[...new Set(v.seen.filter(x=>typeof x==='string'&&x.length<160))].slice(0,3000):[],actions:Array.isArray(v.actions)?v.actions.filter(x=>typeof x==='string').slice(0,6):[],finished:minute===60,message:typeof v.message==='string'?v.message.slice(0,120):s.message,notice:typeof v.notice==='string'?v.notice.slice(0,120):s.notice,gift:null,
        coins:safeInt(v.coins,999999),decor:DECORS.some(d=>d.id===v.decor)?v.decor:'none',
        ownedDecor:Array.isArray(v.ownedDecor)?[...new Set(v.ownedDecor.filter(id=>DECORS.some(d=>d.id===id&&id!=='none')))].slice(0,6):[],
        badges:Array.isArray(v.badges)?[...new Set(v.badges.filter(id=>ACHIEVEMENTS.some(a=>a.id===id)))]:[],
        pendingEvent:Number.isInteger(v.pendingEvent)&&v.pendingEvent>=0&&v.pendingEvent<ENCOUNTERS.length&&minute===30?v.pendingEvent:null,
        totalStages:safeInt(v.totalStages,999999),totalEvents:safeInt(v.totalEvents,999999),songWins:safeInt(v.songWins,999999)};
    }catch{return s;}
  }
  let state=load();
  let events=[], byYear=new Map(), current=null, ready=false, loadError=false, loading=false;
  let blink=false, blinkInterval=null, rhythmStart=0, rhythmFrame=null, challenge=false, reactionTimer=null, songTimer=null, songSequence=[],songPosition=0,songPhase='idle';
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
  function rewardAchievements(){
    const newly=ACHIEVEMENTS.filter(a=>!state.badges.includes(a.id)&&a.goal(state));
    if(newly.length){state.badges.push(...newly.map(a=>a.id));state.coins+=newly.length*8;state.notice+=' · 🏅 '+newly.map(a=>a.title).join(' · ')+' 달성! (+8 🪙씩)';}
  }
  function renderShop(){
    const host=$('snShop');host.replaceChildren();
    for(const item of DECORS){
      const owned=item.id==='none'||state.ownedDecor.includes(item.id);
      const selected=state.decor===item.id;
      const button=document.createElement('button');button.type='button';button.className='sn-shop-item';button.classList.toggle('selected',selected);
      button.setAttribute('aria-pressed',String(selected));button.disabled=selected||(!owned&&state.coins<item.cost);
      const em=document.createElement('span');em.className='sn-shop-emoji';em.textContent=item.icon;
      const title=document.createElement('b');title.textContent=item.name;
      const sub=document.createElement('small');sub.textContent=selected?'사용 중':owned?'꾸미기':item.cost+' 🪙';
      button.append(em,title,sub);
      button.addEventListener('click',()=>{
        if(!owned){if(state.coins<item.cost)return;state.coins-=item.cost;state.ownedDecor.push(item.id);state.notice='🧸 '+item.name+' 구입!';}
        else state.notice='🧸 '+item.name+' 배치 완료!';
        state.decor=item.id;rewardAchievements();save();render();pop();burst();sparkle('✦ ROOM UP!');
      });host.appendChild(button);
    }
    $('snDecorCount').textContent=state.ownedDecor.length+'/6';
    $('snShopCoins').textContent=state.coins+' 🪙';
  }
  function renderAchievements(){
    const host=$('snAchievements');host.replaceChildren();
    for(const a of ACHIEVEMENTS){
      const attained=state.badges.includes(a.id);
      const li=document.createElement('div');li.className='sn-badge';li.classList.toggle('won',attained);
      const emoji=document.createElement('span');emoji.textContent=attained?a.icon:'🔒';
      const info=document.createElement('div');const strong=document.createElement('strong');strong.textContent=a.title;
      const small=document.createElement('small');small.textContent=attained?'달성! +8 냥코인':a.desc;
      info.append(strong,small);li.append(emoji,info);host.appendChild(li);
    }
    $('snBadgeCount').textContent=state.badges.length+'/7';
    $('snAchievementCount').textContent=state.badges.length+'/7';
  }
  function renderEvent(){
    const pending=state.pendingEvent!==null;
    const box=$('snEvent');box.hidden=!pending;
    if(pending){
      const e=ENCOUNTERS[state.pendingEvent];$('snEventTitle').textContent=e.title;$('snEventStory').textContent=e.story;
      $('snEventA').textContent=e.choices[0].label;$('snEventB').textContent=e.choices[1].label;
    }
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
    $('snCoins').textContent=state.coins;
    $('snEventCount').textContent=state.totalEvents;
    const activeDecor=DECORS.find(d=>d.id===state.decor);
    $('snRoomDecor').textContent=activeDecor&&activeDecor.id!=='none'?activeDecor.icon:'';
    $('snRoomDecor').setAttribute('aria-label',activeDecor?.name||'기본 방');
    [...$('shinnyangProgress').children].forEach((node,i)=>node.classList.toggle('filled',i<ordinal()));
    $('snMissionTitle').textContent=m.label;
    $('snMissionCount').textContent=Math.min(missionCount(),m.count)+'/'+m.count;
    $('snMissionCount').classList.toggle('complete',missionCount()>=m.count);
    panel.querySelectorAll('[data-sn-act]').forEach(b=>{
      const kind=b.dataset.snAct;
      b.disabled=!ready||state.finished||challenge||songPhase!=='idle'||state.pendingEvent!==null||((kind==='sing'||kind==='dance')&&state.energy<14)||(kind==='stage'&&(state.energy<22||state.voice<25))||(kind==='letter'&&state.energy<5);
      if(kind==='stage') b.title=state.voice<25?'노래 실력 25 이상 필요':state.energy<22?'체력 22 이상 필요':'리듬 타이밍 미니게임';
    });
    $('shinnyangFinale').setAttribute('aria-hidden',String(!state.finished));
    $('shinnyangActions').hidden=state.finished||challenge||songPhase!=='idle'||state.pendingEvent!==null;
    $('snStageChallenge').hidden=!challenge;
    $('snSongChallenge').hidden=songPhase==='idle';
    $('snSongInput').querySelectorAll('button').forEach(b=>{b.disabled=songPhase!=='input';});
    renderEvent();
    if(state.finished){
      $('shinnyangEndTitle').textContent=state.fans>=65?'✦ 앙코르 요청이 쏟아진다냥!':state.fans>=30?'♡ 팬들의 박수를 받았어!':'✧ 오늘도 멋진 하루 완성!';
      $('shinnyangEndBody').textContent=`노래 실력 ${state.voice} · 인기 ${state.fans} · 추억 ${state.seen.length}장! 다른 시기에도 놀러 가자냥 ♡`;
    }
    renderOutfits();renderShop();renderAchievements();renderCollection();renderMoment();drawCat();
  }
  function pop(){const t=$('shinnyangToast');t.classList.remove('sn-pop');void t.offsetWidth;t.classList.add('sn-pop');}
  function sparkle(text){
    const host=$('snReaction');host.textContent=text;host.classList.remove('sn-reaction-on');void host.offsetWidth;host.classList.add('sn-reaction-on');
    if(reactionTimer)clearTimeout(reactionTimer);reactionTimer=setTimeout(()=>host.classList.remove('sn-reaction-on'),950);
  }
  function burst(){
    if(reduced.matches)return;
    const scene=$('shinnyangScene');
    for(let i=0;i<8;i++){
      const spark=document.createElement('span');spark.className='sn-burst';spark.textContent=['✦','♡','✧','♪'][i%4];
      spark.style.left=(18+i*9)+'%';spark.style.top=(45+(i%3)*7)+'%';
      spark.style.setProperty('--sn-x',((i%2?1:-1)*(25+i*5))+'px');
      spark.style.animationDelay=(i%4*75)+'ms';
      scene.appendChild(spark);setTimeout(()=>spark.remove(),1300);
    }
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
    state.coins=clamp(state.coins+(kind==='stage'?5:kind==='sing'?3:2),0,999999);
    if(kind==='stage')state.totalStages++;
    state.actions.push(kind);state.minute+=10;
    if(state.minute===30)state.pendingEvent=(state.sessions*5+Math.floor(state.stars/37))%ENCOUNTERS.length;
    if(state.minute%20===0)giftAlert(state.sessions*3+state.minute/20);
    if(state.minute===60){
      state.finished=true;state.sessions++;state.stars+=12;state.notice='🎉 1시간 완주! 별 +12';
      const m=MISSIONS[(state.sessions-1)%MISSIONS.length];
      if(state.actions.filter(x=>x===m.act).length>=m.count){state.stars+=20;state.notice+=' · 미션 성공! 별 +20';}
    }
    if(level()>oldLevel)state.notice+=' · '+LEVELS[level()].label+' 성장!';
    if(OUTFITS.filter(allowOutfit).length>oldOutfits)state.notice+=' · 새 의상 해금 🎀';
    rewardAchievements();
    challenge=false;save();render();pop();burst();sparkle(kind==='stage'?'✨ PERFECT ♫':newMemory?'✦ NEW MEMORY!':'♡ +'+a.s);
  }
  function resolveEvent(choiceIndex){
    if(state.pendingEvent===null)return;
    const choice=ENCOUNTERS[state.pendingEvent].choices[choiceIndex];if(!choice)return;
    state.energy=clamp(state.energy+(choice.e||0));state.voice=clamp(state.voice+(choice.v||0));
    state.fans=clamp(state.fans+(choice.f||0));state.stars+=choice.s||0;
    state.coins=clamp(state.coins+(choice.c||0),0,999999);state.totalEvents++;
    state.pendingEvent=null;state.notice='🎲 돌발 이벤트! '+choice.label.split(' · ')[0]+' 선택 완료';
    state.message='오늘은 예상하지 못한 일이 생겨서 더 즐거웠다냥 ♡';
    rewardAchievements();save();render();pop();burst();sparkle('✦ SURPRISE!');
  }
  function clearSong(){if(songTimer){clearTimeout(songTimer);songTimer=null;}songPhase='idle';songSequence=[];songPosition=0;}
  function startSong(){
    if(!ready||state.finished||state.pendingEvent!==null||songPhase!=='idle'||state.energy<14)return;
    songSequence=Array.from({length:3},(_,i)=>(state.sessions*7+Math.floor(state.minute/10)*3+i*i+i+1)%3);
    songPosition=0;songPhase='preview';
    $('snSongPattern').textContent=songSequence.map(i=>['♪','♫','♬'][i]).join('  ');
    $('snSongHint').textContent='이 음표 3개의 순서를 기억해봐!';
    render();
    songTimer=setTimeout(()=>{
      if(songPhase!=='preview')return;
      songPhase='input';$('snSongPattern').textContent='?  ?  ?';$('snSongHint').textContent='같은 순서대로 음표를 눌러줘!';
      render();$('snSongInput').querySelector('button')?.focus();songTimer=null;
    },reduced.matches?2600:1900);
  }
  function hitSong(note){
    if(songPhase!=='input')return;
    if(note===songSequence[songPosition]){
      songPosition++;
      $('snSongPattern').textContent=Array.from({length:3},(_,i)=>i<songPosition?'⭐':'?').join('  ');
      if(songPosition===3){state.songWins++;clearSong();apply('sing',8);state.voice=clamp(state.voice+8);state.coins+=4;state.notice+=' · 🎵 음정 기억 성공 +8 실력, +4 🪙';rewardAchievements();save();render();sparkle('🎵 PERFECT!');}
    }else{clearSong();apply('sing');state.notice+=' · 다음엔 음표를 기억해보자냥';save();render();}
  }
  function startRhythm(){
    if(!ready||state.finished||state.pendingEvent!==null||songPhase!=='idle'||state.energy<22||state.voice<25)return;
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
    const keep={stars:state.stars,sessions:state.sessions,seen:state.seen,year:state.year,outfit:state.outfit,coins:state.coins,decor:state.decor,ownedDecor:state.ownedDecor,badges:state.badges,totalStages:state.totalStages,totalEvents:state.totalEvents,songWins:state.songWins};
    state={...initial(),...keep,message:'새로운 한 시간, 신나게 놀아보자냥! ♪'};
    clearSong();$('snGift').hidden=true;save();render();panel.querySelector('[data-sn-act="sing"]')?.focus();
  }
  function setOpen(open){
    panel.hidden=!open;trigger.setAttribute('aria-expanded',String(open));trigger.setAttribute('aria-label',open?'신냥이 게임 닫기':'신냥이 게임 열기');
    if(open){if(!ready&&!loading)void loadHistory();render();$('shinnyangClose').focus();if(!blinkInterval&&!reduced.matches)blinkInterval=setInterval(()=>{if(!document.hidden){blink=!blink;drawCat();}},1500);}
    else{if(blinkInterval){clearInterval(blinkInterval);blinkInterval=null;}if(challenge){challenge=false;if(rhythmFrame)cancelAnimationFrame(rhythmFrame);rhythmFrame=null;}if(songPhase!=='idle')clearSong();trigger.focus();}
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
    if(state.badges.length>=4){px(6,8,3,3,'gold');px(41,10,2,2,'gold');}
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
    if(k==='stage')startRhythm();else if(k==='sing')startSong();else apply(k);
  }));
  $('snEventA').addEventListener('click',()=>resolveEvent(0));
  $('snEventB').addEventListener('click',()=>resolveEvent(1));
  $('snSongInput').querySelectorAll('[data-sn-note]').forEach(b=>b.addEventListener('click',()=>hitSong(Number(b.dataset.snNote))));
  $('snSongSkip').addEventListener('click',()=>{if(songPhase!=='idle'){clearSong();apply('sing');}});
  $('snRhythmTap').addEventListener('click',()=>resolveRhythm(false));
  $('snRhythmSkip').addEventListener('click',()=>resolveRhythm(true));
  $('shinnyangAgain').addEventListener('click',newHour);
  $('snGiftClose').addEventListener('click',()=>$('snGift').hidden=true);
  $('snEra').addEventListener('change',ev=>{state.year=ev.target.value;save();renderMoment();});
  $('shinnyangReset').addEventListener('click',()=>{if(!window.confirm('신냥이의 별과 추억을 모두 처음부터 다시 시작할까냥?'))return;state=initial();clearSong();challenge=false;if(rhythmFrame)cancelAnimationFrame(rhythmFrame);rhythmFrame=null;$('snGift').hidden=true;if(ready)$('snEra').value='all';save();render();});
  document.addEventListener('keydown',ev=>{if(!panel.hidden&&ev.key==='Escape'){if(challenge){challenge=false;if(rhythmFrame)cancelAnimationFrame(rhythmFrame);rhythmFrame=null;render();}else if(songPhase!=='idle'){clearSong();render();}else setOpen(false);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&rhythmFrame){cancelAnimationFrame(rhythmFrame);rhythmFrame=null;if(challenge){challenge=false;render();}if(songPhase!=='idle'){clearSong();render();}}});
  render();
  // Lazy-load in the archive so the game does not trigger a second 4MB fetch before the stamp is clicked.
  // The public game page opens immediately, archive page retains stamp-triggered popup.
  if(document.body.classList.contains('shinnyang-page'))setOpen(true);
})();
