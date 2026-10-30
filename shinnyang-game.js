/* 신냥이 v4.3 엔딩 도트 — 자율 생활·실제 기록 에피소드·다중 엔딩, full history.json-backed; no remote services */
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
    {id:'crown', name:'별빛 왕관', min:290, icon:'👑'},
    {id:'glasses', name:'레트로 선글라스', min:400, icon:'🕶️'},
    {id:'beret', name:'작곡가 베레모', min:520, icon:'🧑‍🎨'}
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
    {id:'piano',name:'꿈꾸는 피아노',icon:'🎹',cost:105},
    {id:'vinyl',name:'반짝 LP 레코드',icon:'💿',cost:125},
    {id:'stars',name:'작은 별 조명',icon:'🌟',cost:145}
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
    {id:'first',icon:'🌟',title:'첫 한 시간',desc:'함께한 첫 한 시간',goal:s=>s.sessions>=1},
    {id:'memorize',icon:'🎵',title:'음정 천재',desc:'음정 기억 게임 성공 2회',goal:s=>s.songWins>=2},
    {id:'perform',icon:'🎤',title:'반짝이는 무대',desc:'무대 출연 3회',goal:s=>s.totalStages>=3},
    {id:'memories',icon:'📜',title:'추억 수집가',desc:'실제 연혁 카드 10장 수집',goal:s=>s.seen.length>=10},
    {id:'events',icon:'🎲',title:'운명의 선택',desc:'돌발 이벤트 4회 해결',goal:s=>s.totalEvents>=4},
    {id:'interior',icon:'🪴',title:'아늑한 연습실',desc:'방 소품 3개 구입',goal:s=>s.ownedDecor.length>=3},
    {id:'journey',icon:'🏆',title:'가수냥의 꿈',desc:'함께한 시간 5시간',goal:s=>s.sessions>=5}
  ];
  // 커리어는 실제 연예인의 경력을 재현하는 것이 아닌 창작 게임의 성장 목표이다.
  const CAREERS=[
    {icon:'🎼',title:'작은 연습실에서 시작',desc:'목소리를 가다듬고 연습 습관 만들기',goals:[['voice',45,'가창력 45'],['sing',2,'노래 연습 2회']]},
    {icon:'🎀',title:'첫 데뷔 무대를 준비해!',desc:'안무와 라이브를 준비해 첫 무대에 서기',goals:[['voice',60,'가창력 60'],['dance',2,'댄스 연습 2회'],['stage',1,'무대 경험 1회']]},
    {icon:'🎤',title:'음악방송의 반짝이는 별',desc:'더 많은 팬과 다양한 무대에서 만나기',goals:[['fans',45,'인기도 45'],['stage',3,'무대 누적 3회'],['seen',3,'연혁 카드 3장']]},
    {icon:'🌟',title:'나만의 첫 콘서트',desc:'큰 무대를 완성하고 스타냥이 되기',goals:[['voice',85,'가창력 85'],['fans',75,'인기도 75'],['stage',6,'무대 누적 6회']]}
  ];
  // 사용자가 선택한 6종 원본 엔딩 카드 PNG를 연결한다.
  // 한글 표시 영역은 웹폰트 HTML 요소로 덮어 그림 속 글자가 잘못 보이지 않게 한다.
  const ENDING_CARD_IMAGES={"waa": "./ending-card-waa.png?v=20261030-v4-9-3-six-endings-complete", "may": "./ending-card-may.png?v=20261030-v4-9-3-six-endings-complete", "ggong": "./ending-card-ggong.png?v=20261030-v4-9-3-six-endings-complete", "pink": "./ending-card-pink.png?v=20261030-v4-9-3-six-endings-complete", "ttung": "./ending-card-ttung.png?v=20261030-v4-9-3-six-endings-complete", "hong": "./ending-card-hong.png?v=20261030-v4-9-3-six-endings-complete"};
  const ENDING_NOTES={"waa":"까칠한 듯 다정한 무대냥! 오늘도 반짝이는 무대에서 만나자 ♡","may":"하얀 옷과 검은 머리, 〈같은 생각〉이 떠오르는 설레는 순간 ♡","ggong":"갈색 꽁지머리가 살랑살랑! 오늘도 사랑을 듬뿍 받았다냥 ♡","pink":"연분홍 머리와 통통 튀는 무대! 오늘도 신나는 하루였다냥 ♡","ttung":"안경을 고쳐 쓰고 간식을 냠냠. 포근한 추억이 쌓였어 ♡","hong":"풋풋한 흑발 홍합셩, 〈천일유혼〉을 떠올리는 오늘의 기억 ♡"};
  const ENDING_CARD_QUOTES={"waa":"수많은 시간 속에서,\n항상 내 곁에 있어줘서 고마워.\n— 신냥이 —","may":"같은 생각, 그 마음이\n지금까지도 나를 노래하게 해.\n— 신냥이 —","ggong":"오늘도 나를 사랑해 줘서\n정말 고맙다냥 ♡\n— 신냥이 —","pink":"오늘도 함께라서\n정말 신나는 하루다냥!\n— 신냥이 —","ttung":"맛있는 것도, 좋은 시간도\n함께해 줘서 고마워.\n— 신냥이 —","hong":"그때도 지금도,\n같은 자리에서 함께하자.\n— 신냥이 —"};
  const ENDINGS=[
    {id:'waa',icon:'✦',title:'와아셩',subtitle:'까칠한 카리스마의 무대냥',desc:'금발과 까만 정장, 반짝이는 목걸이. 씩씩한 무대를 오래 준비한 신냥이에게 어울리는 엔딩이야.'},
    {id:'may',icon:'♫',title:'오월지련셩',subtitle:'하얀 옷을 입은 첫 솔로의 설렘냥',desc:'검은 머리와 새하얀 의상. 멜로디를 오래 연습하며 부드러운 노래를 사랑하게 된 신냥이의 엔딩이야.'},
    {id:'ggong',icon:'♡',title:'꽁지셩',subtitle:'갈색 꽁지머리의 사랑스러운 냥',desc:'갈색 꽁지머리가 살랑살랑! 팬레터와 다정한 교류를 즐긴 신냥이의 사랑스러운 엔딩이야.'},
    {id:'pink',icon:'✿',title:'핑크셩',subtitle:'연분홍 머리의 발랄한 무대냥',desc:'연분홍 머리와 핑크 의상으로 무대 위를 통통! 춤과 깜짝 이벤트를 즐긴 신냥이의 엔딩이야.'},
    {id:'ttung',icon:'☆',title:'뚱토리셩',subtitle:'볼살 빵빵 뿔테안경 냥',desc:'빵빵한 볼살과 까만 뿔테안경! 방도 꾸미고 간식도 함께 먹으며 아늑한 시간을 보낸 신냥이의 엔딩이야.'},
    {id:'hong',icon:'✧',title:'홍합셩',subtitle:'풋풋한 이미지의 천일유혼 흑발냥',desc:'긴 앞머리가 자연스럽게 갈라지는 흑발과 풋풋한 분위기. 천일유혼의 추억을 담은 홍합셩 엔딩이야.'}
  ];
  const LEGACY_ENDING_NAMES={vocal:'싱어송냥',stage:'라이브 스타냥',fan:'다정냥',memory:'기록냥',all:'만능 엔터냥'};
  // 모든 대사는 창작 게임용이다. 실제 인물의 발언을 재현한 것이 아니다.
  const FAN_LINES={
    sing:['〈같은 생각〉을 흥얼거리니 마음이 몽글몽글하다냥 ♫','오늘은 셩수니에게 들려줄 멜로디를 연습할래!','노래 부를 때는 눈을 꼭 감아버린다냥~'],
    dance:['하나 둘, 에릭이랑 민우도 이 스텝을 봐줄까냥?','전진이랑 앤디에게 댄스를 보여주고 싶다냥!','와아셩처럼 멋있게! 그런데 발바닥이 미끄럽다냥...'],
    stage:['신화 무대를 떠올리면 심장이 두근두근한다냥!','동완이랑 멤버들도 객석에 있을까냥?','핑크셩처럼 통통 뛰는 무대도 해볼래!'],
    snack:['오늘은 뚱토리셩처럼 볼이 빵빵해졌다냥~','간식 먹고 나면 다시 연습할 거다냥, 진짜야!','맛있는 간식은 같이 먹어야 더 좋다냥 ♡'],
    rest:['꽁지머리 묶고 낮잠 자면 삐죽할까냥?','잠깐만 쉬었다가 〈같은 생각〉 다시 연습할래.','꿈속에선 신화 멤버들이 다 모였어냥!'],
    letter:['셩수니가 보낸 응원은 소중한 보물이다냥 ♡','어미새처럼 챙겨주는 팬들 덕에 든든하다냥.','오늘 받은 편지, 다음 무대까지 꼭 기억할래!']
  };
  function fanDialogue(kind){const a=FAN_LINES[kind];return a?a[(state.careerCounts[kind]||0)%a.length]:'';}
  const EPISODES={
    stage:{icon:'🎤',name:'공연 스케줄',text:'실제 기록을 참고해 가상의 무대를 준비해 보자냥!',choices:[['무대 집중 연습','stage',4,5],['새로운 편곡 상상하기','vocal',5,4]]},
    radio:{icon:'📻',name:'라디오 스케줄',text:'마이크 앞에서 어떤 이야기로 마음을 전할까?',choices:[['팬들에게 인사하기','fan',5,4],['다른 멜로디 떠올리기','vocal',5,4]]},
    fan:{icon:'💌',name:'팬과의 만남',text:'작은 선물을 준비해 신냥이의 마음을 전해봐!',choices:[['팬레터에 답장하기','fan',5,4],['추억 카드 정리하기','memory',5,4]]},
    release:{icon:'💿',name:'음반·발매 스케줄',text:'창작 게임 속 앨범의 콘셉트를 정해 보자냥!',choices:[['음악 작업에 집중하기','vocal',5,4],['무대 콘셉트 기획하기','stage',5,4]]},
    variety:{icon:'📺',name:'방송 스케줄',text:'카메라 앞에서 신냥이의 매력을 보여줄 차례!',choices:[['씩씩하게 출연하기','stage',5,4],['재미있는 추억 남기기','memory',5,4]]},
    archive:{icon:'📜',name:'기록 탐험',text:'그 시절의 활동 기록을 살펴보고 오늘의 추억을 만들어봐!',choices:[['활동 자료 꼼꼼히 보기','memory',5,4],['팬과 기록 나누기','fan',5,4]]}
  };
  function episodeType(e){const c=String(e?.category||'');if(/라디오/.test(c))return 'radio';if(/팬|사인회/.test(c))return 'fan';if(/음반|발매|녹음/.test(c))return 'release';if(/음악방송|공연|콘서트|시상식|쇼케이스|무대/.test(c))return 'stage';if(/예능|방송|드라마|시트콤|촬영|V LIVE|영상/.test(c))return 'variety';return 'archive';}
  const DAY_ACTIONS=18; // 하루에 3시간의 게임 시간. 60분마다 플레이는 중단되지 않는다.
  const VERIFICATION={pending:'독립 검증 전',partial:'일부 자료 확인',original_record:'원문 기록',date_uncertain:'날짜 불확실',announced:'사전 예고',source_unavailable:'원출처 확인 어려움',date_conflict:'날짜 자료 상충',on_hold:'확인 보류'};
  const clamp=(n,lo=0,hi=100)=>Math.max(lo,Math.min(hi,n));
  const initial=()=>({minute:0,day:1,totalActions:0,career:0,careerCounts:{sing:0,dance:0,stage:0,letter:0,snack:0,rest:0},dayActions:[],dayRewarded:false,energy:70,voice:20,fans:0,stars:0,sessions:0,scene:'idle',outfit:'ribbon',year:'all',seen:[],actions:[],finished:false,message:'오늘은 어떤 노래를 연습해볼까냥? ♡',notice:'꿈을 향한 하루는 계속 이어진다냥! ♡',gift:null,coins:0,decor:'none',ownedDecor:[],badges:[],pendingEvent:null,totalStages:0,totalEvents:0,songWins:0,affection:0,interactedAt:-1,placedDecor:[],legacyEndings:[],traits:{vocal:0,stage:0,fan:0,memory:0},episodeWins:0,episodeIds:[],episodeAt:-5,endings:[],endingNow:null,journeys:1});
  const safeInt=(x,max)=>Number.isFinite(Number(x))?clamp(Math.trunc(Number(x)),0,max):0;
  function load(){
    const s=initial();
    try{
      const v=JSON.parse(localStorage.getItem(STORE)||'null');
      if (!v||typeof v!=='object'||Array.isArray(v)) return s;
      const oldMinute=safeInt(v.minute,180);
      const oldSessions=safeInt(v.sessions,999999);
      // v3: 60분 완주 시 minute=60에서 정지. 그 기록을 새 하루 시간축으로 이관한다.
      const isV4=Number.isInteger(v.totalActions)&&Number.isInteger(v.day);
      const elapsed=isV4?safeInt(v.totalActions,9999999):oldSessions*6+(oldMinute>=60?0:Math.floor(oldMinute/10));
      const day=1+Math.floor(elapsed/DAY_ACTIONS);
      const minute=(elapsed%DAY_ACTIONS)*10;
      const actions=Array.isArray(v.actions)?v.actions.filter(x=>typeof x==='string'&&['sing','dance','stage','rest','snack','letter'].includes(x)).slice(-6):[];
      const daily=Array.isArray(v.dayActions)?v.dayActions.filter(x=>typeof x==='string'&&['sing','dance','stage','rest','snack','letter'].includes(x)).slice(-DAY_ACTIONS):actions;
      const counts={...s.careerCounts};
      if(v.careerCounts&&typeof v.careerCounts==='object')for(const kind of Object.keys(counts))counts[kind]=safeInt(v.careerCounts[kind],999999);
      else {for(const kind of actions)counts[kind]++;counts.stage=Math.max(counts.stage,safeInt(v.totalStages,999999));}
      return {...s,minute,day,totalActions:elapsed,career:safeInt(v.career,CAREERS.length),careerCounts:counts,dayActions:daily,dayRewarded:isV4&&v.dayRewarded===true,
        energy:safeInt(v.energy,100),voice:safeInt(v.voice,100),fans:safeInt(v.fans,100),stars:safeInt(v.stars,999999),sessions:oldSessions,
        scene:['idle','sing','dance','stage','rest','snack','letter'].includes(v.scene)?v.scene:'idle',
        outfit:OUTFITS.some(o=>o.id===v.outfit)?v.outfit:'ribbon',year:/^\d{4}$/.test(v.year)?v.year:'all',
        seen:Array.isArray(v.seen)?[...new Set(v.seen.filter(x=>typeof x==='string'&&x.length<160))].slice(0,3000):[],
        actions,finished:false,message:typeof v.message==='string'?v.message.slice(0,120):s.message,
        notice:'♡ '+(isV4?'이어서 꿈을 키워보자냥!':'이전 성장 기록을 이어서 가져왔어!'),gift:null,
        coins:safeInt(v.coins,999999),decor:DECORS.some(d=>d.id===v.decor)?v.decor:'none',
        ownedDecor:Array.isArray(v.ownedDecor)?[...new Set(v.ownedDecor.filter(id=>DECORS.some(d=>d.id===id&&id!=='none')))].slice(0,6):[],
        badges:Array.isArray(v.badges)?[...new Set(v.badges.filter(id=>ACHIEVEMENTS.some(a=>a.id===id)))]:[],
        pendingEvent:Number.isInteger(v.pendingEvent)&&v.pendingEvent>=0&&v.pendingEvent<ENCOUNTERS.length?v.pendingEvent:null,
        totalStages:safeInt(v.totalStages,999999),totalEvents:safeInt(v.totalEvents,999999),songWins:safeInt(v.songWins,999999),
        affection:safeInt(v.affection,100),interactedAt:Number.isInteger(v.interactedAt)?v.interactedAt:-1,
        placedDecor:Array.isArray(v.placedDecor)?[...new Set(v.placedDecor.filter(id=>DECORS.some(d=>d.id===id&&id!=='none')))].slice(0,3):v.decor&&v.decor!=='none'&&DECORS.some(d=>d.id===v.decor)?[v.decor]:[],
        legacyEndings:[...new Set([...(Array.isArray(v.legacyEndings)?v.legacyEndings:[]),...(Array.isArray(v.endings)?v.endings:[])].filter(id=>Object.hasOwn(LEGACY_ENDING_NAMES,id)))],
        traits:Object.fromEntries(['vocal','stage','fan','memory'].map(k=>[k,safeInt(v.traits?.[k],999999)])),
        episodeWins:safeInt(v.episodeWins,999999),episodeIds:Array.isArray(v.episodeIds)?[...new Set(v.episodeIds.filter(id=>typeof id==='string'&&id.length<180))].slice(-500):[],
        episodeAt:Number.isInteger(v.episodeAt)?v.episodeAt:-5,
        endings:Array.isArray(v.endings)?[...new Set(v.endings.filter(id=>ENDINGS.some(e=>e.id===id)))]:[],
        endingNow:ENDINGS.some(e=>e.id===v.endingNow)?v.endingNow:null,journeys:Math.max(1,safeInt(v.journeys,9999))};
    }catch{return s;}
  }

  let state=load();
  let events=[], byYear=new Map(), current=null, ready=false, loadError=false, loading=false;
  let blink=false, blinkInterval=null, rhythmStart=0, rhythmFrame=null, challenge=false, reactionTimer=null, songTimer=null, songSequence=[],songPosition=0,songPhase='idle', noteRound=-1, noteHits=0, noteTarget=0;
  let activeTab='activity', autonomyTimer=null, ambientTurn=0, catOffset=0;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  function save(){try{localStorage.setItem(STORE,JSON.stringify({...state,gift:null}));}catch{}}
  function level(){for(let i=LEVELS.length-1;i>=0;i--)if(state.stars>=LEVELS[i].min)return i;return 0;}
  function allowOutfit(item){return state.stars>=item.min;}
  function activeOutfit(){const o=OUTFITS.find(x=>x.id===state.outfit);return o&&allowOutfit(o)?o:OUTFITS[0];}
  const ordinal=()=>Math.floor((state.minute%60)/10);
  function mission(){return MISSIONS[(state.day-1)%MISSIONS.length];}
  function missionCount(){return state.dayActions.filter(a=>a===mission().act).length;}
  function careerValue(key){if(key==='voice'||key==='fans')return state[key];if(key==='seen')return state.seen.length;return state.careerCounts[key]||0;}
  function careerReady(){return state.career<CAREERS.length&&CAREERS[state.career].goals.every(([k,target])=>careerValue(k)>=target);}
  function endingAvailable(){return state.career>=CAREERS.length&&state.totalActions>=36&&state.episodeWins>=3;}
  // 직접 선택 UI 없이, 누적 육성 행동과 에피소드 기록으로 엔딩을 결정한다.
  function endingScores(){
    const c=state.careerCounts,t=state.traits;
    const scores={
      waa:t.stage*5+state.totalStages*6+c.stage*2,
      may:t.vocal*7+state.songWins*6+c.sing*3,
      ggong:t.fan*7+c.letter*6+Math.floor(state.affection/5),
      pink:c.dance*8+state.totalEvents*5+Math.floor(state.fans/7),
      ttung:c.snack*9+c.rest*7+state.ownedDecor.length*6+Math.floor(state.affection/5),
      hong:t.memory*9+state.episodeWins*4+Math.floor(state.seen.length/2)
    };
    return scores;
  }
  function chooseEnding(){
    const scores=endingScores();
    const order=['waa','may','ggong','pink','ttung','hong'];
    // 동점 시 우선순위 고정: 저장/재로드/도감 감상 시 결과가 달라지지 않는다.
    const winner=order.reduce((best,k)=>scores[k]>scores[best]?k:best,order[0]);
    return ENDINGS.find(e=>e.id===winner);
  }
  // Reuse the user-selected source imagery. Actual labels live in DOM (Galmuri), not baked pixels.
  function renderEndingIllustration(e){
    const frame=$('snEndingArt').parentElement;
    let card=frame.querySelector('.sn-e-restored');
    if(!card){
      card=document.createElement('div');
      card.className='sn-e-restored';
      card.innerHTML=`<img class="sn-e-restored-art" id="snEArtwork" alt="" draggable="false">
        <div class="sn-e-text sn-e-overlay-title" id="snECardTitle"></div>
        <div class="sn-e-text sn-e-overlay-heading" id="snECardHeading"></div>
        <div class="sn-e-text sn-e-overlay-subtitle" id="snECardSubtitle"></div>
        <div class="sn-e-text sn-e-overlay-quote" id="snECardQuote"></div>
        <button type="button" class="sn-e-action sn-e-action-left" id="snECardBack">📖 도감 보기</button>
        <button type="button" class="sn-e-action sn-e-action-right" id="snECardAgain">↻ 새 이야기</button>`;
      card.querySelector('#snECardBack').addEventListener('click',()=>$('snEndingClose').click());
      card.querySelector('#snECardAgain').addEventListener('click',()=>$('snEndingAgain').click());
      frame.append(card);
    }
    card.dataset.ending=e.id;
    card.querySelector('#snEArtwork').src=ENDING_CARD_IMAGES[e.id];
    card.querySelector('#snEArtwork').alt=e.title+' 도트 엔딩 카드';
    card.querySelector('#snECardTitle').textContent='신냥이의 한 시간';
    card.querySelector('#snECardHeading').textContent='ENDING '+String(ENDINGS.indexOf(e)+1).padStart(2,'0')+' · '+e.title;
    card.querySelector('#snECardSubtitle').textContent=e.subtitle;
    card.querySelector('#snECardQuote').textContent=ENDING_CARD_QUOTES[e.id];
  }
  function renderEnding(){
    $('snEndingGate').hidden=activeTab!=='memory';
    $('snEndingProgress').textContent=state.career<CAREERS.length?'커리어 챕터 4개를 먼저 달성해 봐!':
      state.totalActions<36?'함께한 행동 '+state.totalActions+'/36 · DAY 03까지 성장해 보자냥':
      state.episodeWins<3?'활동 연혁 에피소드 '+state.episodeWins+'/3개 체험하기':'신냥이의 육성 기록으로 결정된 엔딩을 확인할 수 있어!';
    $('snEndingView').disabled=!endingAvailable();
    const gallery=$('snEndingGallery');gallery.replaceChildren();
    for(const e of ENDINGS){
      const seen=state.endings.includes(e.id),b=document.createElement('button');
      b.type='button';b.className='sn-ending-card'+(seen?' obtained':'');b.disabled=!seen;
      const thumb=document.createElement('span');thumb.className='sn-ending-thumb';
      if(seen){const img=document.createElement('img');img.src=ENDING_CARD_IMAGES[e.id];img.alt=e.title+' 엔딩 카드';img.loading='lazy';thumb.append(img);}
      else thumb.textContent='?';
      const title=document.createElement('span');title.textContent=seen?e.title:'??? · 미발견 엔딩';
      b.append(thumb,title);b.title=seen?e.subtitle:'육성 결과에 따라 발견할 수 있어';
      b.addEventListener('click',()=>showEnding(e.id,false));gallery.append(b);
    }
    const legacy=state.legacyEndings||[];
    if(legacy.length){const note=document.createElement('p');note.className='sn-legacy-note';note.textContent='이전 v4.2 엔딩 기록 보존: '+legacy.map(x=>LEGACY_ENDING_NAMES[x]).filter(Boolean).join(' · ')+' (새 엔딩 도감과 별도)';gallery.append(note);}
    $('snEndingCount').textContent=state.endings.filter(id=>ENDINGS.some(e=>e.id===id)).length+'/'+ENDINGS.length;
    const modal=$('snEndingModal');modal.hidden=!state.endingNow;
    if(state.endingNow){
      const e=ENDINGS.find(e=>e.id===state.endingNow);
      if(!e){modal.hidden=true;return;}
      modal.dataset.ending=e.id;
      const art=$('snEndingArt');art.hidden=true;
      renderEndingIllustration(e);
      $('snEndingClose').textContent='도감으로 돌아가기';
      $('snEndingAgain').textContent='새 이야기 시작 ♡';
      $('snEndingTitle').textContent='ENDING '+String(ENDINGS.indexOf(e)+1).padStart(2,'0')+' · '+e.title;
      $('snEndingSubtitle').textContent=e.subtitle;$('snEndingDesc').textContent=e.desc;
    }
  }
  function showEnding(id,award){
    const e=ENDINGS.find(x=>x.id===id);if(!e)return;
    if(award){if(!endingAvailable())return;const chosen=chooseEnding();if(chosen.id!==id)return;
      const first=!state.endings.includes(id);
      if(first){state.endings.push(id);state.stars+=30;state.coins+=30;state.notice='🎊 '+e.title+' 엔딩 발견! 별 +30 · 🪙 +30';rewardAchievements();burst();}
      else state.notice='🎞️ '+e.title+' 엔딩을 다시 감상해!';}
    state.endingNow=id;save();activeTab='memory';render();$('snEndingModal').scrollIntoView({block:'nearest',behavior:reduced.matches?'instant':'smooth'});
  }
  function nextJourney(){
    if(!state.endingNow||!window.confirm('엔딩 도감·구입 소품은 보존하고, 새로운 신냥이 육성을 시작할까냥?'))return;
    const prev=state;state=initial();state.endings=[...prev.endings];state.ownedDecor=[...prev.ownedDecor];state.placedDecor=[...prev.placedDecor];state.decor=prev.decor;state.journeys=prev.journeys+1;state.legacyEndings=[...prev.legacyEndings];
    state.notice='🌱 '+state.journeys+'번째 신냥이 이야기 시작! 엔딩 도감과 구매한 가구는 남아 있어.';
    activeTab='activity';$('snGift').hidden=true;save();render();
  }
  function renderCareer(){
    const done=state.career>=CAREERS.length;
    const c=done?null:CAREERS[state.career];
    $('snCareerChapter').textContent=done?'✦ 모든 커리어 달성':`CHAPTER ${state.career+1} / ${CAREERS.length}`;
    $('snCareerTitle').textContent=done?'👑 반짝반짝 스타냥!':c.icon+' '+c.title;
    $('snCareerDesc').textContent=done?'이제 매일 자유롭게 스케줄을 만들고 무대에 도전할 수 있어.':c.desc;
    const host=$('snCareerGoals');host.replaceChildren();
    if(c)for(const [key,target,label] of c.goals){
      const value=careerValue(key);const complete=value>=target;
      const item=document.createElement('div');item.className='sn-career-goal'+(complete?' complete':'');
      const mark=document.createElement('span');mark.textContent=complete?'✓':'○';
      const title=document.createElement('span');title.textContent=label;
      const progress=document.createElement('strong');progress.textContent=Math.min(target,value)+' / '+target;
      item.append(mark,title,progress);host.appendChild(item);
    }
    $('snCareerClaim').hidden=done;
    $('snCareerClaim').disabled=!ready||!careerReady()||challenge||songPhase!=='idle'||noteRound>=0||state.pendingEvent!==null;
    $('snCareerClaim').textContent=careerReady()?'✦ 목표 달성! 다음 이야기 열기':'목표 달성 후 다음 이야기';
  }
  function claimCareer(){
    if(!ready||challenge||songPhase!=='idle'||state.pendingEvent!==null||!careerReady())return;
    const completed=CAREERS[state.career];state.career++;state.stars+=25;state.coins=clamp(state.coins+20,0,999999);
    state.notice='🎉 '+completed.title+' 성공! 별 +25 · 냥코인 +20';
    state.message='다음 무대도 기대된다냥! ♡';state.scene='stage';rewardAchievements();save();render();pop();burst();sparkle('✦ LEVEL UP!');
  }
  function renderTabs(){
    panel.querySelectorAll('[data-sn-tab]').forEach(b=>{const on=b.dataset.snTab===activeTab;b.setAttribute('aria-pressed',String(on));b.classList.toggle('selected',on);});
    panel.querySelectorAll('[data-sn-act]').forEach(b=>{b.hidden=(activeTab==='activity'?!['sing','dance','stage'].includes(b.dataset.snAct):activeTab==='life'?!['snack','rest','letter'].includes(b.dataset.snAct):true);});
    $('snExtras').hidden=!['decor','memory'].includes(activeTab);
    $('snExtras').querySelectorAll('[data-sn-extra]').forEach(d=>{d.hidden=d.dataset.snExtra!==activeTab;});
    $('shinnyangActions').hidden=challenge||songPhase!=='idle'||noteRound>=0||state.pendingEvent!==null||!['activity','life'].includes(activeTab);
    $('snNoteStart').hidden=activeTab!=='activity'||challenge||songPhase!=='idle'||noteRound>=0||state.pendingEvent!==null;
    $('snChooseHead').hidden=!['activity','life'].includes(activeTab);
    $('shinnyangMoment').hidden=activeTab!=='memory';
    $('snEpisode').hidden=activeTab!=='activity';
    $('snEndingGate').hidden=activeTab!=='memory';
  }
  function historyDate(e){const d=String(e.date||'');return e.precision==='year'?d.slice(0,4)+'년 (월·일 미상)':e.precision==='month'?d.slice(0,4)+'.'+d.slice(5,7)+' (일 미상)':d.replace(/-/g,'.');}
  function chooseMoment(){
    const pool=state.year==='all'?events:(byYear.get(state.year)||[]);
    if (!pool.length)return null;
    // Deterministic non-repeating step within each session, jump across full archive in all-years mode.
    const n=state.year==='all'?(state.totalActions*419+state.day*157):(state.totalActions*7+state.day*17);
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
  function renderEpisode(){
    const box=$('snEpisode');box.hidden=activeTab!=='activity';if(!ready||!current){$('snEpisodeIntro').textContent='연혁 자료를 불러오면 스케줄을 만날 수 있어.';$('snEpisodeTitle').textContent='기록을 기다리는 중';return;}
    const ep=EPISODES[episodeType(current)];$('snEpisodeType').textContent=ep.icon+' '+ep.name;
    $('snEpisodeTitle').textContent=historyDate(current)+' · '+current.title;
    $('snEpisodeIntro').textContent=ep.text;
    $('snEpisodeA').textContent=ep.choices[0][0];$('snEpisodeB').textContent=ep.choices[1][0];
    const cooled=state.totalActions-state.episodeAt>=3;
    const visited=state.episodeIds.includes(current.id);
    const active=ready&&cooled&&!visited&&!challenge&&songPhase==='idle'&&state.pendingEvent===null;
    $('snEpisodeA').disabled=!active;$('snEpisodeB').disabled=!active;
    $('snEpisodeHint').textContent=visited?'이 기록의 에피소드는 이미 완료했어. 다음 활동 기록을 만나봐!':
      !cooled?'다음 에피소드까지 '+(3-(state.totalActions-state.episodeAt))+'번 행동이 필요해.':'실제 날짜·제목을 소재로 한 창작 게임이야. 아래 선택지는 실제 활동 내용이 아니야.';
  }
  function playEpisode(which){
    if(!ready||!current||challenge||songPhase!=='idle'||state.pendingEvent!==null||state.totalActions-state.episodeAt<3||state.episodeIds.includes(current.id))return;
    const ep=EPISODES[episodeType(current)];const [label,key,points,coins]=ep.choices[which];
    state.traits[key]+=points;state.coins=clamp(state.coins+coins,0,999999);state.stars+=6;state.episodeWins++;
    state.episodeAt=state.totalActions;state.episodeIds.push(current.id);state.episodeIds=state.episodeIds.slice(-500);
    const collected=collectMoment();state.message=ep.icon+' '+label+'! 오늘의 경험을 하나 더 쌓았다냥.';
    state.notice='📜 '+ep.name+' 성공 · '+label+' · 별 +6, 🪙 +'+coins+(collected?' · 추억 카드 수집!':'');
    state.scene=episodeType(current)==='stage'?'stage':'letter';rewardAchievements();save();render();pop();burst();sparkle('✦ EPISODE!');
  }
  function petCat(){
    if(!ready||state.pendingEvent!==null)return;
    if(state.interactedAt===state.totalActions){state.message='냐옹~ ♡ 다음 활동을 하고 또 놀아줘!';$('shinnyangDialogue').textContent=state.message;return;}
    state.affection=clamp(state.affection+5);state.traits.fan+=1;state.coins=clamp(state.coins+1,0,999999);state.interactedAt=state.totalActions;
    state.message='골골골... 쓰다듬어줘서 행복하다냥 ♡';state.scene='idle';state.notice='🐾 쓰다듬기 · 호감도 +5 · 🪙 +1';save();render();burst();sparkle('♡ LOVE!');
  }
  function interactFurniture(side){
    if(!ready||state.pendingEvent!==null)return;
    const kind=side==='left'?'vocal':'memory';
    if(state.interactedAt===state.totalActions){state.message='가구랑 또 놀려면 다른 활동을 먼저 해봐냥!';$('shinnyangDialogue').textContent=state.message;return;}
    state.interactedAt=state.totalActions;state.traits[kind]++;state.affection=clamp(state.affection+3);state.coins=clamp(state.coins+2,0,999999);
    state.scene=side==='left'?'sing':'letter';state.message=side==='left'?'띵동~ 피아노 소리가 예쁘다냥! ♪':'반짝이는 물건을 살펴보는 중이냥! ✦';
    state.notice='🧸 소품 상호작용 성공 · 호감도 +3 · 🪙 +2';save();render();burst();sparkle('✧ PLAY!');
  }
  function idleTick(){
    if(panel.hidden||document.hidden||challenge||songPhase!=='idle'||state.pendingEvent!==null||reduced.matches)return;
    ambientTurn++;catOffset=[-52,22,57,-15,0][ambientTurn%5];
    $('shinnyangSprite').style.setProperty('--sn-wander-x',catOffset+'px');
    if(state.scene==='idle'&&ambientTurn%3===0){$('shinnyangDialogue').textContent=['창밖에 별이 보인다냥 ✦','실뭉치가 어디 갔을까냥?','오늘의 노래를 흥얼흥얼 ♪','냐옹! 같이 놀자 ♡'][ambientTurn%4];}
    if(state.scene==='idle'&&ambientTurn%5===0){$('snIdleBubble').textContent=['♪','♡','Zz','✧'][ambientTurn%4];$('snIdleBubble').classList.remove('sn-idle-pop');void $('snIdleBubble').offsetWidth;$('snIdleBubble').classList.add('sn-idle-pop');}
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
      const selected=state.placedDecor.includes(item.id);
      const button=document.createElement('button');button.type='button';button.className='sn-shop-item';button.classList.toggle('selected',selected);
      const full=state.placedDecor.length>=3;
      button.setAttribute('aria-pressed',String(selected));button.disabled=item.id==='none'||(!owned&&(state.coins<item.cost||full))||(owned&&!selected&&full);
      const em=document.createElement('span');em.className='sn-shop-emoji';em.textContent=item.icon;
      const title=document.createElement('b');title.textContent=item.name;
      const sub=document.createElement('small');sub.textContent=item.id==='none'?'기본 제공':selected?'배치 중 · 누르면 보관':owned?(full?'3개까지 배치':'배치하기'):(item.cost+' 🪙');
      button.append(em,title,sub);
      button.addEventListener('click',()=>{
        if(!owned){if(state.coins<item.cost||state.placedDecor.length>=3)return;state.coins-=item.cost;state.ownedDecor.push(item.id);state.notice='🧸 '+item.name+' 구입!';}
        if(state.placedDecor.includes(item.id))state.placedDecor=state.placedDecor.filter(x=>x!==item.id);
        else if(state.placedDecor.length<3)state.placedDecor.push(item.id);
        state.decor=state.placedDecor.at(-1)||'none';rewardAchievements();save();render();pop();burst();sparkle('✦ ROOM UP!');
      });host.appendChild(button);
    }
    $('snDecorCount').textContent=state.ownedDecor.length+'/'+(DECORS.length-1);
    $('snShopCoins').textContent=state.coins+' 🪙';
    const placement=$('snPlacement');placement.textContent='방에 배치: '+state.placedDecor.map(id=>DECORS.find(d=>d.id===id)?.icon||'').join(' ')+' ('+state.placedDecor.length+'/3)';
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
    $('shinnyangClock').textContent='DAY '+String(state.day).padStart(2,'0')+' · '+String(9+Math.floor(state.minute/60)).padStart(2,'0')+':'+String(state.minute%60).padStart(2,'0');
    $('shinnyangScene').dataset.scene=state.scene;
    const stage=state.scene==='stage',rest=state.scene==='rest',snack=state.scene==='snack',dance=state.scene==='dance',letter=state.scene==='letter';
    $('shinnyangSceneTag').textContent=stage?'✦ 반짝이는 무대':rest?'☾ 포근한 침실':snack?'🍰 간식 타임':dance?'🪩 춤 연습실':letter?'💌 팬레터 시간':'♪ 아늑한 연습실';
    $('snPropLeft').textContent=stage?'🎸':rest?'🛏️':snack?'🍮':letter?'✉️':dance?'🪩':'🎹';
    $('snPropRight').textContent=stage?'🌟':rest?'🌙':snack?'🫖':letter?'💐':dance?'🎶':'🧸';
    $('shinnyangDialogue').textContent=state.message;
    $('shinnyangToast').textContent=state.notice;
    $('snEnergy').textContent=state.energy;$('snVoice').textContent=state.voice;$('snFans').textContent=state.fans;
    for(const [id,n] of [['snEnergyBar',state.energy],['snVoiceBar',state.voice],['snFansBar',state.fans]])$(id).style.width=n+'%';
    $('shinnyangStars').textContent=state.stars.toLocaleString('ko-KR')+' 별 · 함께한 '+state.sessions+'시간';
    $('snCoins').textContent=state.coins;
    $('snEventCount').textContent=state.totalEvents;
    const decorHost=$('snRoomDecor');decorHost.replaceChildren();
    for(const id of state.placedDecor){const item=DECORS.find(d=>d.id===id);if(!item)continue;const icon=document.createElement('span');icon.textContent=item.icon;icon.title=item.name;decorHost.appendChild(icon);}
    decorHost.setAttribute('aria-label',state.placedDecor.map(id=>DECORS.find(d=>d.id===id)?.name||'').join(', ')||'기본 방');
    $('snAffection').textContent=state.affection;
    $('shinnyangScene').classList.toggle('sn-cloudy',state.day%3===0);
    $('snWeather').textContent=state.day%3===0?'☁️ · 오늘은 구름 낀 날':state.day%3===2?'🌤️ · 말랑말랑 봄날':'☀️ · 햇살 좋은 날';
    [...$('shinnyangProgress').children].forEach((node,i)=>node.classList.toggle('filled',i<ordinal()));
    $('snMissionTitle').textContent=m.label;
    $('snDailyReward').textContent=state.dayRewarded?'✓ 오늘 보상 수령 완료':'완료 시 별 +12 · 🪙 +8';
    renderCareer();
    $('snMissionCount').textContent=Math.min(missionCount(),m.count)+'/'+m.count;
    $('snMissionCount').classList.toggle('complete',missionCount()>=m.count);
    panel.querySelectorAll('[data-sn-act]').forEach(b=>{
      const kind=b.dataset.snAct;
      b.disabled=!ready||challenge||songPhase!=='idle'||noteRound>=0||state.pendingEvent!==null||((kind==='sing'||kind==='dance')&&state.energy<14)||(kind==='stage'&&(state.energy<22||state.voice<25))||(kind==='letter'&&state.energy<5);
      if(kind==='stage') b.title=state.voice<25?'노래 실력 25 이상 필요':state.energy<22?'체력 22 이상 필요':'리듬 타이밍 미니게임';
    });
    $('snStageChallenge').hidden=!challenge;
    $('snSongChallenge').hidden=songPhase==='idle';
    $('snNoteChallenge').hidden=noteRound<0;
    $('snNoteRound').textContent=noteRound<0?'0 / 3':(noteRound+1)+' / 3';
    $('snNoteTarget').textContent=['♪','♫','♬'][noteTarget];
    $('snSongInput').querySelectorAll('button').forEach(b=>{b.disabled=songPhase!=='input';});
    renderTabs();
    renderEvent();
    renderOutfits();renderShop();renderAchievements();renderCollection();renderMoment();renderEpisode();renderEnding();drawCat();
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
    if(!ready||state.pendingEvent!==null)return;
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
    state.scene=a.scene;state.message=fanDialogue(kind)||a.speech;state.notice='✦ '+a.label+' · 별 +'+a.s+(newMemory?' · 새로운 연혁 카드 수집!':'');
    state.coins=clamp(state.coins+(kind==='stage'?5:kind==='sing'?3:2),0,999999);
    if(kind==='stage'){state.totalStages++;state.traits.stage++;}
    if(kind==='sing')state.traits.vocal++;
    if(kind==='letter')state.traits.fan++;
    if(kind==='dance')state.traits.stage++;
    if(kind==='rest'||kind==='snack')state.affection=clamp(state.affection+2);
    state.actions.push(kind);state.actions=state.actions.slice(-6);
    state.dayActions.push(kind);state.careerCounts[kind]=(state.careerCounts[kind]||0)+1;
    state.minute+=10;state.totalActions++;
    if(!state.dayRewarded&&missionCount()>=mission().count){
      state.dayRewarded=true;state.stars+=12;state.coins=clamp(state.coins+8,0,999999);
      state.notice+=' · 📋 오늘의 스케줄 성공! 별 +12 · 🪙 +8';
    }
    if(state.minute===90)state.pendingEvent=(state.day*5+Math.floor(state.stars/37))%ENCOUNTERS.length;
    if(state.minute%20===0)giftAlert(state.day*3+state.minute/20);
    if(state.minute%60===0){
      state.sessions++;state.stars+=3;state.notice+=' · ⏰ 한 시간이 흘렀어. 계속 이어가자냥! 별 +3';
    }
    if(state.minute>=DAY_ACTIONS*10){
      state.day++;state.minute=0;state.dayActions=[];state.dayRewarded=false;
      state.notice+=' · ☀️ DAY '+state.day+' 시작! 새로운 스케줄이 열렸어';
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
    if(!ready||state.pendingEvent!==null||songPhase!=='idle'||state.energy<14)return;
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
  function startNoteGame(){
    if(!ready||challenge||songPhase!=='idle'||noteRound>=0||state.pendingEvent!==null||state.energy<14)return;
    noteRound=0;noteHits=0;noteTarget=(state.totalActions+state.day+1)%3;
    $('snNoteFeedback').textContent='위에 보이는 음표와 같은 버튼을 눌러봐!';render();
  }
  function hitNote(note){
    if(noteRound<0)return;
    if(note===noteTarget)noteHits++;
    noteRound++;
    if(noteRound===3){const successes=noteHits;noteRound=-1;apply('sing');
      state.voice=clamp(state.voice+successes*3);state.coins=clamp(state.coins+successes*2,0,999999);
      state.notice+=' · ✨ 음표 잡기 '+successes+'/3 · 실력 +'+(successes*3)+' · 🪙 +'+(successes*2);
      state.traits.vocal+=successes;save();render();sparkle(successes===3?'♫ ALL CATCH!':'♪ GOOD JOB!');return;
    }
    noteTarget=(noteTarget+noteRound+1)%3;
    $('snNoteFeedback').textContent=noteHits+'개 성공! 계속 다음 음표를 잡아봐!';render();
  }
  function closeNote(){if(noteRound<0)return;noteRound=-1;state.notice='음표 게임을 잠깐 쉬어가자냥!';save();render();}
  function startRhythm(){
    if(!ready||state.pendingEvent!==null||songPhase!=='idle'||state.energy<22||state.voice<25)return;
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
  function setOpen(open){
    panel.hidden=!open;trigger.setAttribute('aria-expanded',String(open));trigger.setAttribute('aria-label',open?'신냥이 게임 닫기':'신냥이 게임 열기');
    if(open){if(!ready&&!loading)void loadHistory();render();$('shinnyangClose').focus();if(!blinkInterval&&!reduced.matches)blinkInterval=setInterval(()=>{if(!document.hidden){blink=!blink;drawCat();}},1500);if(!autonomyTimer&&!reduced.matches)autonomyTimer=setInterval(idleTick,4000);}
    else{if(noteRound>=0)noteRound=-1;if(autonomyTimer){clearInterval(autonomyTimer);autonomyTimer=null;}if(blinkInterval){clearInterval(blinkInterval);blinkInterval=null;}if(challenge){challenge=false;if(rhythmFrame)cancelAnimationFrame(rhythmFrame);rhythmFrame=null;}if(songPhase!=='idle')clearSong();trigger.focus();}
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
    else{
      // 기본 무표정만 조정: 코 아래에서 자연스럽게 이어지는 작은 ㅅ형 입
      px(25,27,1,1,'edge');px(24,28,1,1,'edge');px(26,28,1,1,'edge');
      px(23,29,1,1,'edge');px(27,29,1,1,'edge');
    }
    px(14,34,4,4,'edge');px(15,35,3,2,'fur');px(33,34,4,4,'edge');px(34,35,3,2,'fur');
    if(outfit==='glasses'){px(16,21,9,5,'eye');px(28,21,9,5,'eye');px(25,22,3,2,'edge');px(17,21,2,1,'white');px(29,21,2,1,'white');}
    if(outfit==='beret'){px(14,8,25,4,'lilac');px(18,5,15,4,'lilac');px(23,3,4,3,'edge');}
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
  $('snCareerClaim').addEventListener('click',claimCareer);
  $('snNoteStart').addEventListener('click',startNoteGame);
  panel.querySelectorAll('[data-sn-catch]').forEach(b=>b.addEventListener('click',()=>hitNote(Number(b.dataset.snCatch))));
  $('snNoteCancel').addEventListener('click',closeNote);
  $('shinnyangSprite').addEventListener('click',petCat);
  $('shinnyangSprite').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();petCat();}});
  $('snPropLeft').addEventListener('click',()=>interactFurniture('left'));
  $('snPropRight').addEventListener('click',()=>interactFurniture('right'));
  $('snEpisodeA').addEventListener('click',()=>playEpisode(0));
  $('snEpisodeB').addEventListener('click',()=>playEpisode(1));
  $('snEndingView').addEventListener('click',()=>{if(endingAvailable())showEnding(chooseEnding().id,true);});
  $('snEndingClose').addEventListener('click',()=>{state.endingNow=null;save();render();});
  $('snEndingAgain').addEventListener('click',nextJourney);
  panel.querySelectorAll('[data-sn-tab]').forEach(b=>b.addEventListener('click',()=>{activeTab=b.dataset.snTab;renderTabs();}));
  $('snGiftClose').addEventListener('click',()=>$('snGift').hidden=true);
  $('snEra').addEventListener('change',ev=>{state.year=ev.target.value;save();renderMoment();});
  $('shinnyangReset').addEventListener('click',()=>{if(!window.confirm('신냥이의 별과 추억을 모두 처음부터 다시 시작할까냥?'))return;state=initial();activeTab='activity';clearSong();noteRound=-1;challenge=false;if(rhythmFrame)cancelAnimationFrame(rhythmFrame);rhythmFrame=null;$('snGift').hidden=true;if(ready)$('snEra').value='all';save();render();});
  document.addEventListener('keydown',ev=>{if(!panel.hidden&&ev.key==='Escape'){if(challenge){challenge=false;if(rhythmFrame)cancelAnimationFrame(rhythmFrame);rhythmFrame=null;render();}else if(songPhase!=='idle'){clearSong();render();}else if(noteRound>=0){closeNote();}else setOpen(false);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&rhythmFrame){cancelAnimationFrame(rhythmFrame);rhythmFrame=null;if(challenge){challenge=false;render();}if(songPhase!=='idle'){clearSong();render();}if(noteRound>=0){closeNote();}}});
  render();
  // Lazy-load in the archive so the game does not trigger a second 4MB fetch before the stamp is clicked.
  // The public game page opens immediately, archive page retains stamp-triggered popup.
  if(document.body.classList.contains('shinnyang-page'))setOpen(true);
})();
