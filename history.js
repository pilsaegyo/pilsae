"use strict";
// Public timeline. No browser writeback, no admin/API mutation. Only approved curated links can be called related videos.
const $ = selector => document.querySelector(selector);
const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const pad2 = x => String(x).padStart(2,'0');
const validDay = (y,m,d) => { const date=new Date(Date.UTC(y,m-1,d)); return date.getUTCFullYear()===y && date.getUTCMonth()===m-1 && date.getUTCDate()===d; };
const qs=new URLSearchParams(location.search);
let events=[],chapters=[],researchSources=new Map(),eventAliases={},filtered=[],activeChapter='chapter1',pageSize=70,visibleCount=70,highlightEvent='',explicitDate='';
let viewMode='list',calendarMonth='',selectedCalendarDate='';
const videoById=new Map();
function selectedDates(video) {
  const dates=new Map();
  const add = (raw,origin) => {
    if (!DAY.test(String(raw))) return;
    const [y,m,d]=raw.split('-').map(Number);
    if (!validDay(y,m,d)) return;
    if (!dates.has(raw) || origin==='저장된 날짜') dates.set(raw,origin);
  };
  for (const date of video.dates||[]) {
    if (date.precision==='year' || date.precision==='month') continue;
    add(date.sourceDate,'저장된 날짜');
  }
  if (!dates.size && video.sourceDate) add(video.sourceDate,'저장된 날짜');
  const text=String(video.description||'').replace(/#[^\s#]+/g,' ');
  const yy=n => Number(n)<=29?2000+Number(n):1900+Number(n);
  for (const m of text.matchAll(/(?<!\d)((?:19|20)\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g)) add(`${m[1]}-${pad2(m[2])}-${pad2(m[3])}`,'설명에서 추출');
  for (const m of text.matchAll(/(?<!\d)((?:19|20)\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})(?!\d)/g)) add(`${m[1]}-${pad2(m[2])}-${pad2(m[3])}`,'설명에서 추출');
  for (const m of text.matchAll(/(?<!\d)(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})(?!\d)/g)) add(`${yy(m[1])}-${pad2(m[2])}-${pad2(m[3])}`,'설명에서 추출');
  for (const m of text.matchAll(/(?<!\d)((?:19|20)\d{2})(\d{2})(\d{2})(?!\d)/g)) add(`${m[1]}-${m[2]}-${m[3]}`,'설명에서 추출');
  for (const m of text.matchAll(/(?<!\d)(\d{2})(\d{2})(\d{2})(?!\d)/g)) add(`${yy(m[1])}-${m[2]}-${m[3]}`,'설명에서 추출');
  return dates;
}
// Match the CURRENT public video inventory, rather than relying on video IDs captured in an older patch.
// Scores are transparent deterministic relevance points, NOT probabilities or verified identity.
const rarePrograms=[
 ['남희석의색다른밤',/남희석(?:의)?\s*색다른\s*밤|색다른\s*밤/i],
 ['올스타가요제',/올\s*스타\s*가요제/i],
 ['빅스타모창가요제',/빅\s*스타\s*모창\s*가요제/i],
 ['감성채널21',/감성\s*채널\s*@?\s*21/i],
 ['행복채널',/행복\s*채널/i],
 ['한중가요제',/한\s*중\s*가요제/i],
 ['섹션TV',/섹션\s*(?:tv|연예\s*통신|연예통신|티비|신화)|section\s*tv/i],
 ['좋은친구들',/좋은\s*친구들/i],
 ['한밤의TV연예',/한밤의\s*(?:tv|티비)?\s*연예/i],
 ['도전천곡',/도전\s*천곡/i],
 ['스타서바이벌미팅',/스타\s*서바이벌\s*미팅|스타서바이벌\s*미팅/i],
 ['신화방송',/신화\s*방송|shinhwa\s*broadcast/i],
 ['이소라의프로포즈',/이소라의\s*프로포즈/i],
 ['게릴라콘서트',/게릴라\s*콘서트/i],
 ['놀러와',/\b놀러와\b/i],
 ['리듬천국',/리듬\s*천국/i],
 ['만원의행복',/만원의\s*행복/i],
 ['스타골든벨',/스타\s*골든벨/i],
 ['강심장',/강심장/i],
 ['라디오스타',/라디오\s*스타/i],
 ['해피투게더',/해피\s*투게더/i],
 ['출발드림팀',/출발!?\s*드림팀/i],
 ['천생연분',/천생연분/i],
 ['애견지존',/애견지존/i],
 ['비디오챔피언',/비디오\s*챔피언/i],
 ['신화창조',/신화\s*창조/i],
 ['엠티비라이브',/mtv\s*(?:1st\s*)?live\s*show/i],
 ['쇼킹엠',/쇼킹\s*m|showking\s*m/i],
 ['논스톱',/논스톱|non\s*stop/i],
 ['자유선언',/자유선언/i],
 ['드림콘서트',/드림\s*콘서트/i],
 ['쇼챔피언',/쇼!?\s*챔피언/i]
];
const commonPrograms=[
 ['음악캠프',/음악\s*캠프|music\s*camp/i],
 ['뮤직뱅크',/뮤직\s*뱅크|music\s*bank|\b뮤뱅\b/i],
 ['인기가요',/인기\s*가요|\b인가\b/i],
 ['쇼뮤직탱크',/쇼!?\s*뮤직\s*탱크|쇼탱|music\s*tank/i],
 ['쇼음악중심',/쇼!?\s*음악\s*중심|음중/i],
 ['엠카운트다운',/m\s*!?\s*countdown|엠\s*카운트다운/i]
];
function normalizedWords(s){return String(s||'').normalize('NFKC').toLocaleLowerCase().replace(/shinhwa|sinhwa/gi,'신화').replace(/hye\s*sung|hyesung/gi,'신혜성').replace(/\bi\s*am\b/gi,'아이엠').replace(/happy\s*together/gi,'해피투게더').replace(/friend[s]?/gi,'프렌즈');}
function compactWords(s){return normalizedWords(s).replace(/[^0-9a-z가-힣]/g,'');}
function detectProgram(s){const text=normalizedWords(s);for(const [k,re] of [...rarePrograms,...commonPrograms])if(re.test(text))return k;return '';}
function epNum(s){const m=String(s||'').match(/(?:\bep(?:isode)?\.?\s*|\bE\s*|제\s*)(\d{1,4})(?:\s*회|\b)/i);return m?Number(m[1]):null;}
function fanclubNum(s){const m=normalizedWords(s).match(/신화\s*창조\s*(\d+)\s*기/);return m?Number(m[1]):null;}
function exactSong(s){
 const t=normalizedWords(s);
 const songs=[['천일유혼',/천일\s*유혼/],['으쌰으쌰',/으[쌰샤]\s*!?\s*으[쌰샤]|usha\s*usha/],['해결사',/해결사/],['인형',/인형/],['top',/\bt\s*\.?\s*o\s*\.?\s*p\.?\b|<\s*top\s*>/i],['yo',/\byo\s*!/i],['onlyone',/only\s*one/i],['allyourdreams',/all\s*your\s*dreams|all\s*your\s*ereams/i],['heycomeon',/hey\s*,?\s*come\s*on/i],['wild eyes',/wild\s*eyes/i],['perfectman',/perfect\s*man/i],['ipray4u',/i\s*pray\s*4\s*u/i],['brandnew',/brand\s*new/i],['onceinalifetime',/once\s*in\s*a\s*lifetime/i],['비처럼음악처럼',/비처럼\s*음악처럼/],['같은생각',/같은\s*생각/],['너의결혼식',/너의\s*결혼식|\bwedding\b/i],['사랑이온다',/사랑이\s*온다/]];
 for(const [k,re] of songs)if(re.test(t))return k;return '';
}
function dateStringsFromText(raw){
 const out=new Set(),text=String(raw||'').replace(/https?:\/\/\S+/g,'').replace(/#[^\s#]+/g,'');
 const add=(y,m,d)=>{y=Number(y);m=Number(m);d=Number(d);if(y<1990||y>2035||!validDay(y,m,d))return;out.add(`${y}-${pad2(m)}-${pad2(d)}`);};
 for(const m of text.matchAll(/(?<!\d)((?:19|20)\d{2})\s*(?:[.\-\/]\s*|년\s*)(\d{1,2})\s*(?:[.\-\/]\s*|월\s*)(\d{1,2})(?:\s*일)?(?!\d)/g))add(m[1],m[2],m[3]);
 for(const m of text.matchAll(/(?<!\d)((?:19|20)\d{2})(\d{2})(\d{2})(?!\d)/g))add(m[1],m[2],m[3]);
 for(const m of text.matchAll(/(?<!\d)(\d{2})\s*[.\-\/]\s*(\d{1,2})\s*[.\-\/]\s*(\d{1,2})(?!\d)/g))add(Number(m[1])<=29?2000+Number(m[1]):1900+Number(m[1]),m[2],m[3]);
 for(const m of text.matchAll(/(?<!\d)(\d{2})(\d{2})(\d{2})(?!\d)/g))add(Number(m[1])<=29?2000+Number(m[1]):1900+Number(m[1]),m[2],m[3]);
 return [...out];
}
function originalTitleLine(video){
 const text=String(video.description||'');
 const m=text.match(/(?:^|\n)\s*(?:제목|영상제목|방송명)\s*[:：]\s*([^\r\n]{4,250})/im);
 return m?m[1].trim():'';
}
function strongDateEvidence(video){
 const d=(video.dates||[]).filter(x=>x.precision==='day'&&DAY.test(String(x.sourceDate||''))).map(x=>x.sourceDate);
 const manual=[...new Set(d)];if(manual.length>1)return null;
 const fields=[['관리자 등록 날짜',manual],['영상 제목',dateStringsFromText(video.title)],['영상 원본 정보',dateStringsFromText(video.source)],['원본 제목',dateStringsFromText(originalTitleLine(video))]];
 const found=fields.filter(([n,arr])=>arr.length);
 if(found.some(([n,arr])=>arr.length!==1))return null;
 if(new Set(found.map(([n,arr])=>arr[0])).size>1)return null;
 if(found.length)return {date:found[0][1][0],origin:found.map(([n])=>n).join('·')};
 const content=String(video.description||'').replace(/https?:\/\/\S+/g,'').split(/(?:^|\n)\s*(?:채널\s*:|링크\s*:)/im)[0].slice(0,900);
 const dates=dateStringsFromText(content);
 return dates.length===1?{date:dates[0],origin:'영상 설명의 단일 날짜'}:null;
}
function singleMonthEvidence(video){
 const source=[video.source,originalTitleLine(video),video.title].filter(Boolean).join(' ');
 if(dateStringsFromText(source).length)return null;
 const found=new Set();
 const rex=/(?<!\d)((?:19|20)\d{2})\s*(?:년\s*|[.\-/])\s*(0?[1-9]|1[0-2])(?:\s*월)?(?!\d)/g;
 for(const m of source.matchAll(rex)) found.add(`${m[1]}-${pad2(m[2])}`);
 for(const x of video.dates||[])if(x.precision==='month'&&/^\d{4}-\d{2}$/.test(String(x.sourceDate)))found.add(x.sourceDate);
 return found.size===1?[...found][0]:null;
}
// Extract a programme identity from the archive's own source/title/description,
// without requiring each TV programme to be added to a hard-coded dictionary.
function showKey(text){
 let t=normalizedWords(text).replace(/https?:\/\/\S+/g,' ').replace(/#[^\s#]+/g,' ');
 t=t.replace(/(?<!\d)(?:19|20)\d{2}[.\-/]?\d{2}[.\-/]?\d{2}(?!\d)|(?<!\d)\d{6}(?!\d)/g,' ');
 t=t.replace(/\b(?:e|ep|episode)\s*\d+\b|제\s*\d+\s*회|\b(?:s1|s2|season\s*\d+)\b/gi,' ');
 t=t.replace(/^(?:제목|방송명|영상제목|출처)\s*[:：]\s*/i,'');
 t=t.replace(/(?:kbs|mbc|sbs|mnet|엠넷|kmtv|tvn|jtbc|ocn|방송|추석특집|특집|신혜성|신화 전체|신화)\s*/gi,' ');
 t=t.replace(/<[^>]+>/g,' ').replace(/[〈《][^〉》]+[〉》]/g,' ');
 t=t.replace(/\b(?:cut|shorts|ver|zip|mv|촬영현장)\b/gi,' ');
 return t.replace(/[^a-z0-9가-힣]/g,'');
}
function contentLabels(text){
 const raw=String(text||'').replace(/https?:\/\/\S+/g,' ').split(/\n/)[0];
 const p=detectProgram(raw);const labels=new Set();if(p)labels.add(p);
 const cleaned=normalizedWords(raw).replace(/(?<!\d)(?:19|20)\d{6}(?!\d)|(?<!\d)\d{6}(?!\d)/g,' ').replace(/\b(?:e|ep)\s*\d+\b/gi,' ');
 for(const chunk of cleaned.split(/[|｜:：<>\[\]()·,]/)){
  const x=showKey(chunk);if(x.length>=3&&x.length<=32&&!/^(?:신혜성|신화|방송|가요|콘서트|공연|무대|영상|같은생각|떠나지마)$/.test(x))labels.add(x);
 }
 return [...labels];
}
function videoEvidence(video){
 const dateResult=strongDateEvidence(video)||(()=>{const ym=singleMonthEvidence(video);return ym?{date:ym+'-01',origin:'연월만 확인',monthOnly:true}:null;})();if(!dateResult)return null;
 if(dateStringsFromText(String(video.description||'')).length>1)return null;
 const heading=originalTitleLine(video),source=String(video.source||''),title=String(video.title||'');
 const sourceTexts=[source,heading].filter(Boolean);
 const declared=sourceTexts.map(t=>detectProgram(t)).filter(Boolean);
 if(new Set(declared).size>1)return null;
 const leading=String(video.description||'').replace(/https?:\/\/\S+/g,'').split('\n\n')[0].slice(0,420);
 const program=declared[0]||detectProgram(leading)||detectProgram(title);
 const content=[source,heading,title].filter(Boolean).join(' ');
 return {...dateResult,content,program,episode:epNum(content),fanclub:fanclubNum(content),song:exactSong(content),compact:compactWords(content),title,labels:sourceTexts.flatMap(contentLabels)};
}
function strongContentOverlap(eventText, videoText){
 const x=compactWords(eventText),v=compactWords(videoText);
 // Generic words and artist names are not evidence of an event match.
 const stop=['신화','신혜성','방송','출연','무대','라이브','영상','콘서트','뮤직비디오','활동','스페셜','축하공연','현장','공연'];
 let a=x;for(const s of stop)a=a.replaceAll(s,'');
 if(a.length>=9&&v.includes(a))return true;
 const meaningful=['스타서바이벌미팅','신화창조','winterstory','summerstory','the return','firstmythology','tropicalsummerstory','불새','신화방송','비처럼음악처럼','드림콘서트','게릴라콘서트'];
 return meaningful.some(t=>a.includes(compactWords(t))&&v.includes(compactWords(t))&&compactWords(t).length>=5);
}
function rateVideo(e,video,meta){
 if(!meta||e.precision!=='day'||!DAY.test(e.date))return null;
 const text=[e.title,...(e.mergedDetails||[])].join(' ');
 const p=detectProgram(text),n=epNum(text),f=fanclubNum(text),song=exactSong(text);
 if(/음반|발매|릴리즈|발표/.test(e.category||''))return null;
 const labelCandidates=contentLabels(e.title);
 const commonMatch=!!p&&p===meta.program;
 const genericMatch=labelCandidates.some(x=>meta.labels.some(y=>x===y||(x.length>=5&&y.length>=5&&(x.includes(y)||y.includes(x)))));
 const showMatch=commonMatch||genericMatch;
 // Broadcasting station conflicts are evidence against a same-episode match.
 const station=t=>{const m=String(t||'').match(/\b(KBS|MBC|SBS|JTBC|TVN|MNET|KMTV|NTV)\b/i);return m?m[1].toUpperCase():'';};
 const eventStation=station(e.title),videoStation=station(video.source+' '+originalTitleLine(video));
 if(eventStation&&videoStation&&eventStation!==videoStation)return null;
 if(p&&meta.program&&p!==meta.program)return null;
 const epConflict=n!==null&&meta.episode!==null&&n!==meta.episode;
 const fanConflict=f!==null&&meta.fanclub!==null&&f!==meta.fanclub;
 if(fanConflict)return null;
 if(meta.monthOnly){
  if(meta.date.slice(0,7)!==e.date.slice(0,7))return null;
  if(!(showMatch&&n!==null&&n===meta.episode)&&!(f!==null&&f===meta.fanclub))return null;
  return {videoId:String(video.id),kind:'연월 참고영상',score:.73,reason:'연월 확인·회차 또는 팬클럽 기수 일치, 날짜 별도 검증 필요',reviewStatus:'candidate',dateGapDays:0};
 }
 if(meta.date.slice(0,7)!==e.date.slice(0,7))return null;
 const days=Math.round(Math.abs(Date.parse(meta.date+'T00:00:00Z')-Date.parse(e.date+'T00:00:00Z'))/86400000);
 if(days>3)return null;
 const exact=days===0,episodeSame=showMatch&&n!==null&&meta.episode===n;
 const songSame=showMatch&&!!song&&song===meta.song;
 const distinct=strongContentOverlap(e.title,meta.content);
 // A real source/show name and exact date beats conflicting archive episode numbering.
 // Nearby-date matches require a strongly identified programme and an uncertainty marker.
 if(!showMatch&&!(exact&&distinct))return null;
 if(!exact&&!showMatch)return null;
 // Different named songs in the same programme need manual verification.
 if(song&&meta.song&&song!==meta.song)return null;
 if(!exact&&epConflict)return null;
 let score=exact?(episodeSame?.97:songSame?.94:showMatch?.85:.78):(episodeSame?.81:.72);
 if(epConflict)score=.74;
 let reason=episodeSame?'프로그램·날짜·회차 일치':songSame?'프로그램·날짜·곡명 일치':showMatch?'영상 출처·방송명 일치':'고유 콘텐츠명 일치';
 if(epConflict)reason+=` · 회차 표기 불일치(연표 ${n} / 영상 ${meta.episode})`;
 if(!exact)reason+=` · 날짜 ${days}일 차이(동일 방송 미확정, 확인 필요)`;
 return {videoId:String(video.id),kind:!exact||epConflict?'검토 필요 추천영상':'관련 영상 후보',score,reason:reason+' · '+meta.origin,reviewStatus:'candidate',dateGapDays:days};
}
function generateRuntimeRecommendations(videos){
 const byMonth=new Map(),stats={withSingleContentDate:0,matches:0,events:0};
 for(const v of videos||[]){
  if(!/^[A-Za-z0-9_-]{11}$/.test(String(v.id||'')))continue;
  if(v.url && !/^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(String(v.url)))continue;
  if(!isSafeUrl(ytUrl(v)))continue;
  const m=videoEvidence(v);if(!m)continue;
  stats.withSingleContentDate++;
  const ym=m.date.slice(0,7);if(!byMonth.has(ym))byMonth.set(ym,[]);
  byMonth.get(ym).push({video:v,meta:m});
 }
 for(const e of events){
  const a=[];
  for(const {video,meta} of byMonth.get(e.date.slice(0,7))||[]){const result=rateVideo(e,video,meta);if(result)a.push(result);}
  // Recheck legacy candidates against current metadata; never blindly trust a stale static match.
  // A video ID that disappeared from current data is not linked.
  const ids=new Set(),selected=[];
  for(const r of a.sort((a,b)=>b.score-a.score||a.dateGapDays-b.dateGapDays)){
   if(ids.has(r.videoId))continue;ids.add(r.videoId);selected.push(r);if(selected.length>=8)break;
  }
  e.relatedVideos=selected;
  if(selected.length){stats.events++;stats.matches+=selected.length;}
 }
 return stats;
}

function ytUrl(video) {
  const link=String(video.url||'');
  return /^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(link)?link:`https://www.youtube.com/watch?v=${encodeURIComponent(String(video.id||''))}`;
}
function isSafeUrl(value){
 const url=String(value||'');
 if(!/^https:\/\//i.test(url))return false;
 // Defunct V LIVE/V App links must never be presented as playable sources.
 return !/(?:vlive\.tv|v-live\.tv|vlive\.com|vapp\.naver\.com)/i.test(url);
}
function buildChapterButtons() {
 const counts=new Map(chapters.map(c=>[c.id,events.filter(e=>e.chapter===c.id).length]));
 $('#chapters').innerHTML=chapters.map(c=>`<button type="button" class="chapter${c.id===activeChapter?' active':''}" data-chapter="${safe(c.id)}" aria-pressed="${c.id===activeChapter}"><span class="number">CHAPTER ${safe(c.number)}</span><strong>${safe(c.title)}</strong><span class="desc">${safe(c.subtitle)}</span><span class="count">${counts.get(c.id)||0}건</span></button>`).join('');
 for(const btn of document.querySelectorAll('[data-chapter]')) btn.addEventListener('click',()=>{
   activeChapter=btn.dataset.chapter;
   calendarMonth='';selectedCalendarDate='';
   $('#year').value='';
   applyChapter();
 });
}
function applyChapter(){
 for(const btn of document.querySelectorAll('[data-chapter]')){
   const chosen=btn.dataset.chapter===activeChapter;
   btn.classList.toggle('active',chosen);btn.setAttribute('aria-pressed',String(chosen));
 }
 const years=[...new Set(events.filter(e=>!activeChapter||e.chapter===activeChapter).map(e=>e.date.slice(0,4)))].sort();
 const selected=$('#year').value;
 $('#year').innerHTML='<option value="">전체 연도</option>'+years.map(y=>`<option value="${safe(y)}">${safe(y)}년</option>`).join('');
 if(years.includes(selected)) $('#year').value=selected;
 resetAndRender();
}
function normalizeSubject(s){
 if(s==='신화 전체')return 'group';
 if(s==='신혜성 개인')return 'solo';
 if(s==='신혜성 포함 합동'||s==='신혜성 개인·합동')return 'together';
 return 'historical';
}
function selectRows(){
 const year=$('#year').value,category=$('#category').value,subject=$('#subject').value,verification=$('#verification').value,q=$('#search').value.trim().toLocaleLowerCase();
 filtered=events.filter(e=>(!activeChapter||e.chapter===activeChapter)&&(!explicitDate||e.date===explicitDate||(e.conflictingDates||[]).includes(explicitDate))&&(!year||e.date.startsWith(year))&&(!category||e.category===category)&&(!subject||normalizeSubject(e.subject)===subject)&&(!verification||e.verification===verification)&&(!$('#withVideos').checked||!!e.relatedVideos?.length)&&(!q||[e.title,e.date,e.category,e.subject,e.sourceNote].join(' ').toLocaleLowerCase().includes(q)));
}
function monthHeading(e,previous) {
 const month=e.date.slice(0,7);
 return month===previous?'':`<h2 class="month-title">${safe(month.slice(0,4))}년 ${safe(Number(month.slice(5)))}월</h2>`;
}
function recommendedLinks(e){
 if(!Array.isArray(e.relatedVideos))return [];
 return e.relatedVideos.filter(r=>r.reviewStatus==='candidate' && Number(r.score)>=0.70 &&
   videoById.has(String(r.videoId)) && r.reason && r.kind)
   .slice(0,8).map(r=>{
     const video=videoById.get(String(r.videoId));
     const url=ytUrl(video);
     if(!isSafeUrl(url))return '';
     const percent=Math.round(Number(r.score)*100);
     const caution=(r.dateGapDays||r.reason.includes('회차 표기 불일치'))?' [날짜·회차 확인 필요]':'';
     return `<a class="candidate" href="${safe(url)}" target="_blank" rel="noopener noreferrer" title="규칙 기반 연관도 ${percent}점 · ${safe(r.reason)} · 동일 영상 검증 완료를 의미하지 않음">▶ ${safe(video.title||'관련 영상')}${safe(caution)} <small>연관도 ${percent}점</small></a>`;
   }).filter(Boolean);
}
function fmt(e){
 if(e.precision==='month')return `${e.date.slice(5,7)}월`;
 if(e.precision==='year')return '연도만';
 return e.date.slice(5).replace('-','.');
}
function sourceWidget(e){
 const ordered=[];const seen=new Set();
 const add=(label,url,kind,note)=>{
   if(!isSafeUrl(url)||seen.has(url))return;
   seen.add(url);ordered.push({label,url,kind,note});
 };
 if(e.verificationUrl){const src=[...researchSources.values()].find(x=>x.url===e.verificationUrl);add(src?`${src.publisher||'출처'} — ${src.title}`:'기사·공식 검증 출처',e.verificationUrl,src?.kind||'검증 자료',src?.note||'검증 상태와 링크가 뒷받침하는 사실을 함께 확인하세요.');}
 for(const url of e.verificationUrls||[])add('병합된 기록의 검증 출처',url,'검증 자료','병합된 개별 원문을 뒷받침하는 링크입니다.');
 for(const key of e.sourceRefs||[]){
   const r=researchSources.get(key);if(r)add(`${r.publisher||'출처'} — ${r.title}`,r.url,r.kind,r.note);
 }
 for(const url of [...(e.sourceUrls||[]),e.sourceUrl].filter(Boolean))add(url.includes('docs.google.com/spreadsheets')?'원본 시트의 해당 행':'기록 원문',url,'원자료','원본 자료는 독립 검증이 아니며 접근 제한이 있을 수 있습니다.');
 for(const url of [...(e.referenceVideoUrls||[]),e.referenceVideoUrl].filter(Boolean)){
   // Reference videos must be playable on YouTube, not old V LIVE or arbitrary extinct platforms.
   if(/^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(url))add('원본에 기재된 유튜브 영상',url,'원본 영상','개별 영상의 출처 기록으로, 동일 콘텐츠 검증을 의미하지 않습니다.');
 }
 const status=String(e.verification||'독립 검증 전');
 const note=String(e.sourceNote||'');
 const provenance=(e.allSources||[e.source||'출처 미기재']).join(' · ');
 const categoryOrigin=e.categoryOriginal?`<p>분류 표기 통일: ${safe(e.categoryOriginal)} → ${safe(e.category)}</p>`:'';
 const rows=ordered.map(r=>`<li><span class="source-kind">${safe(r.kind)}</span> <a href="${safe(r.url)}" target="_blank" rel="noopener noreferrer">${safe(r.label)} ↗</a>${r.note?`<small>${safe(r.note)}</small>`:''}</li>`).join('');
 const entries=rows?`<ul>${rows}</ul>`:'<p class="source-unlinked">이 일정에 연결된 외부 근거 URL이 없습니다.</p>';
 return `<span class="source-widget"><button type="button" class="source-trigger" aria-label="${safe(e.date)} ${safe(e.title)} 출처 보기" aria-expanded="false" title="출처·검증 근거 보기">ⓘ</button><span class="source-panel" role="group" aria-label="출처 정보"><strong>자료 · 검증 근거</strong><span class="source-status">${safe(status)}</span><p>기록 계열: ${safe(provenance)} · ${safe(e.dateKind||'날짜 종류 미확인')}</p>${categoryOrigin}${note?`<p>${safe(note.slice(0,350))}</p>`:''}${entries}</span></span>`;
}
function researchWidget(){
 const rows=[...researchSources.values()].map(r=>`<li><span class="source-kind">${safe(r.kind)}</span> <a href="${safe(r.url)}" target="_blank" rel="noopener noreferrer">${safe(r.title)} ↗</a><small>${safe(r.note)}</small></li>`).join('');
 return `<span class="source-widget source-catalog"><button type="button" class="source-trigger source-catalog-trigger" aria-label="조사에 활용한 공개 자료 목록 보기" aria-expanded="false" title="조사 자료 목록">ⓘ 조사 자료</button><span class="source-panel" role="group" aria-label="조사 자료 목록"><strong>조사·대조한 공개 자료</strong><p>이 목록에 포함된 사이트·링크가 모든 일정의 날짜를 증명하는 것은 아닙니다. 각 이벤트의 ⓘ에서 연결 근거를 구분해 보세요.</p><ul>${rows}</ul></span></span>`;
}
function enableSourceWidgets(){
  // Mobile: a modal with its own scroller, backdrop and scroll lock.
  // Desktop: keep the existing floating popover and hover/keyboard behavior.
  const float=document.createElement('div');
  float.id='history-source-float';float.className='source-float';
  float.setAttribute('role','dialog');float.setAttribute('aria-label','자료 및 검증 근거');
  float.setAttribute('tabindex','-1');
  const backdrop=document.createElement('div');
  backdrop.className='source-backdrop';backdrop.setAttribute('aria-hidden','true');
  document.body.append(backdrop,float);
  const modalScreen=window.matchMedia('(max-width: 700px)');
  let active=null,pinned=false,closeTimer=null,lockedScroll=null,ignoreFocus=false;
  const cancel=()=>{if(closeTimer!==null){clearTimeout(closeTimer);closeTimer=null;}};
  function lockBackground(){
    if(lockedScroll!==null)return;
    lockedScroll=window.scrollY;
    document.body.style.setProperty('--source-lock-offset',`-${lockedScroll}px`);
    document.body.classList.add('source-dialog-open');
    document.documentElement.classList.add('source-dialog-open');
  }
  function unlockBackground(){
    if(lockedScroll===null)return;
    const previousY=lockedScroll;
    lockedScroll=null;
    document.body.classList.remove('source-dialog-open');
    document.documentElement.classList.remove('source-dialog-open');
    document.body.style.removeProperty('--source-lock-offset');
    window.scrollTo(0,previousY);
  }
  function release(restoreFocus=false){
    cancel();const previous=active;
    if(previous){previous.setAttribute('aria-expanded','false');previous.closest('.source-widget')?.classList.remove('is-open');}
    active=null;pinned=false;
    float.classList.remove('is-visible','is-mobile-dialog');
    backdrop.classList.remove('is-visible');
    float.removeAttribute('aria-modal');float.innerHTML='';
    unlockBackground();
    if(restoreFocus&&previous?.isConnected){
      ignoreFocus=true;
      previous.focus({preventScroll:true});
      queueMicrotask(()=>{ignoreFocus=false;});
    }
  }
  function position(){
    if(!active||!float.classList.contains('is-visible'))return;
    if(modalScreen.matches){float.style.removeProperty('left');float.style.removeProperty('top');return;}
    const r=active.getBoundingClientRect(),w=window.innerWidth,h=window.innerHeight;
    float.style.left='0px';float.style.top='0px';
    const width=float.getBoundingClientRect().width||390,height=float.getBoundingClientRect().height||280;
    let left=(w-r.right>width+18)?r.right+10:(r.left-width-10>8?r.left-width-10:Math.min(Math.max(10,r.left),w-width-10));
    let top=r.bottom+8;
    if(top+height>h-10)top=Math.max(10,r.top-height-9);
    if(top+height>h-10)top=Math.max(10,h-height-10);
    float.style.left=Math.round(left)+'px';float.style.top=Math.round(top)+'px';
  }
  function show(button,lock=false){
    if(!button?.isConnected)return;
    const modal=modalScreen.matches;
    if(modal&&!lock)return;
    cancel();
    if(active!==button){
      if(active){active.setAttribute('aria-expanded','false');active.closest('.source-widget')?.classList.remove('is-open');}
      active=button;
      const content=button.closest('.source-widget')?.querySelector('.source-panel')?.innerHTML||'';
      float.innerHTML=`<div class="source-float-toolbar"><span>자료 · 검증 근거</span><button type="button" class="source-close" aria-label="근거 팝업 닫기">×</button></div><div class="source-float-content">${content}</div>`;
      float.querySelector('.source-float-content').scrollTop=0;
    }
    pinned=lock||modal;
    active.setAttribute('aria-expanded','true');active.setAttribute('aria-controls',float.id);
    active.closest('.source-widget')?.classList.add('is-open');
    float.classList.add('is-visible');
    if(modal){
      float.classList.add('is-mobile-dialog');backdrop.classList.add('is-visible');
      float.setAttribute('aria-modal','true');lockBackground();
      float.querySelector('.source-close')?.focus({preventScroll:true});
    }else{
      float.classList.remove('is-mobile-dialog');backdrop.classList.remove('is-visible');
      float.removeAttribute('aria-modal');position();
    }
  }
  function later(){
    if(pinned||modalScreen.matches)return;
    cancel();closeTimer=setTimeout(()=>{if(!float.matches(':hover')&&!(active?.matches(':hover'))&&!float.contains(document.activeElement))release();},160);
  }
  document.addEventListener('pointerover',event=>{
    if(modalScreen.matches||event.pointerType==='touch')return;
    const button=event.target.closest?.('.source-trigger');
    if(!button)return;
    if(button===active){cancel();return;}
    if(!pinned)show(button);
  });
  document.addEventListener('pointerout',event=>{
    if(!modalScreen.matches&&event.target.closest?.('.source-widget')&&!event.relatedTarget?.closest?.('.source-widget'))later();
  });
  float.addEventListener('pointerenter',cancel);
  float.addEventListener('pointerleave',later);
  document.addEventListener('focusin',event=>{
    if(ignoreFocus||modalScreen.matches)return;
    const button=event.target.closest?.('.source-trigger');
    if(button&&!pinned)show(button);
  });
  document.addEventListener('focusout',event=>{if(!modalScreen.matches&&event.target.closest?.('.source-widget'))later();});
  document.addEventListener('click',event=>{
    if(event.target.closest?.('.source-close')||event.target===backdrop){release(true);return;}
    const button=event.target.closest?.('.source-trigger');
    if(button){event.preventDefault();if(active===button&&pinned)release();else show(button,true);return;}
    if(!float.contains(event.target))release();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&active){event.preventDefault();release(true);return;}
    if(event.key!=='Tab'||!active||!modalScreen.matches)return;
    const focusable=[...float.querySelectorAll('button:not([disabled]),a[href]')].filter(e=>e.getClientRects().length);
    if(!focusable.length){event.preventDefault();float.focus();return;}
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&(document.activeElement===first||!float.contains(document.activeElement))){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&(document.activeElement===last||!float.contains(document.activeElement))){event.preventDefault();first.focus();}
  });
  document.addEventListener('history-view-change',()=>release());
  document.addEventListener('scroll',()=>{if(active&&!modalScreen.matches)position();},true);
  window.addEventListener('resize',()=>{if(active){if(float.classList.contains('is-mobile-dialog')!==modalScreen.matches)release();else position();}});
}
function eventMarkup(e){
  const links=recommendedLinks(e);
  const linkHtml=links.length?`<div class="candidates">${links.join('')}</div>`:'';
  // These 13 broadcasts currently have a verified channel/streams URL, NOT a verified per-video watch URL.
  const officialLiveListLink=String(e.id||'').startsWith('verified-feeltube:') && String(e.id||'').includes(':live-') && e.verificationUrl==='https://www.youtube.com/@FEELTUBE/streams'
    ? `<a class="source-link live-list-link" href="${safe(e.verificationUrl)}" target="_blank" rel="noopener noreferrer">▶ 공식 라이브 목록 ↗</a>` : '';
  const details=Array.isArray(e.mergedDetails)?e.mergedDetails.slice(0,3):[];
  const detailHtml=details.length?`<div class="detail-note">세부 기록: ${safe(details.map(t=>String(t).slice(0,170)).join(' · '))}</div>`:'';
  const conflictHtml=e.conflictingDates?.length?`<div class="detail-note conflict">원문 날짜 충돌: ${safe(e.conflictingDates.join(' / '))} · 공식 날짜 추가 확인 필요</div>`:'';
  const desc=String(e.sourceNote||'').slice(0,380);
  return `<article class="item" id="event-${safe(e.id)}"><div class="date" title="${safe(e.date)} · ${safe(e.dateKind||'')}">${safe(fmt(e))}</div><div class="item-main"><div class="name">${safe(e.title)}</div><div class="meta"><span class="tag">${safe(e.category)}</span><span class="tag">${safe(e.subject==='신화 전체'?'신화 전체':e.subject==='신혜성 개인'?'신혜성':e.subject==='신혜성 포함 합동'?'신혜성 참여':e.subject)}</span><span class="${e.verification==='날짜 충돌'?'conflict':e.verification.includes('검증 전')||e.verification==='원문 기록'?'unconfirmed':''}" title="${safe(desc||e.source||'')}">${e.verification==='날짜 충돌'?'⚠':'◌'} ${safe(e.verification)}</span>${e.precision!=='day'?'<span class="inexact">일자 미상</span>':''}${e.recordCount>1?`<span class="tag" title="${safe(e.recordCount)}개 원본 기록 통합">원본 ${e.recordCount}건 통합</span>`:(e.possibleDuplicate?'<span class="inexact">중복 검토 필요</span>':'')}${e.transition?`<span class="tag">${safe(e.transition)}</span>`:''}${links.length?`<span class="video" title="규칙 기반 70점 이상 · 동일 행사 확정 아님">▶ 추천 ${links.length}개</span>`:''}${sourceWidget(e)}</div>${officialLiveListLink}${conflictHtml}${detailHtml}${e.verification==='날짜 충돌'?`<div class="detail-note">${safe(desc)}</div>`:''}${linkHtml}</div></article>`;
}
function renderItems(){
  $('#events').hidden=false;$('#calendar').hidden=true;
  const to=filtered.slice(0,visibleCount),last=to.length;
  $('#summary').textContent=`전체 ${events.length.toLocaleString('ko-KR')}건 · 조건에 맞는 ${filtered.length.toLocaleString('ko-KR')}건 · 현재 ${last.toLocaleString('ko-KR')}건 표시 · 일부 자료는 날짜·내용 검증 전`;
  if(!last){$('#events').innerHTML='<p class="empty">조건에 맞는 일정이 없습니다.</p>';$('#loadMore').hidden=true;return;}
  let prev='';
  $('#events').innerHTML=to.map(e=>{
    const header=monthHeading(e,prev);prev=e.date.slice(0,7);
    return header+eventMarkup(e);
  }).join('');
  $('#loadMore').hidden=filtered.length<=last;
  if(highlightEvent){document.getElementById('event-'+highlightEvent)?.classList.add('focused-event');}
}
function calendarRange(){
  const chapterEvents=events.filter(e=>!activeChapter||e.chapter===activeChapter);
  const months=chapterEvents.map(e=>e.date.slice(0,7)).sort();
  return [months[0]||'1998-01',months[months.length-1]||'2020-12'];
}
function initialCalendarMonth(){
  // Date-linked routes should open the exact month; otherwise use the newest relevant month.
  if(explicitDate)return explicitDate.slice(0,7);
  if(highlightEvent){const record=events.find(e=>e.id===highlightEvent);if(record)return record.date.slice(0,7);}
  return filtered.length?filtered[filtered.length-1].date.slice(0,7):calendarRange()[1];
}
function shiftCalendarMonth(month,delta){
  const [y,m]=month.split('-').map(Number),next=new Date(Date.UTC(y,m-1+delta,1));
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth()+1)}`;
}
function setCalendarMonth(value){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))return;
  const [min,max]=calendarRange();if(value<min)value=min;if(value>max)value=max;
  // Navigation beyond an explicit video deeplink or year filter should not silently show an empty month.
  if(explicitDate||highlightEvent){explicitDate='';highlightEvent='';$('.date-filter-hint').hidden=true;}
  const year=$('#year');if(year.value&&year.value!==value.slice(0,4)){
    year.value=[...year.options].some(o=>o.value===value.slice(0,4))?value.slice(0,4):'';
  }
  calendarMonth=value;selectedCalendarDate='';selectRows();renderPage();
}
function renderCalendar(){
  $('#events').hidden=true;$('#calendar').hidden=false;$('#loadMore').hidden=true;
  if(!calendarMonth)calendarMonth=initialCalendarMonth();
  const [min,max]=calendarRange();
  if(calendarMonth<min||calendarMonth>max)calendarMonth=initialCalendarMonth();
  const [y,m]=calendarMonth.split('-').map(Number);
  const firstDay=new Date(Date.UTC(y,m-1,1)).getUTCDay();
  const daysInMonth=new Date(Date.UTC(y,m,0)).getUTCDate();
  const monthEvents=filtered.filter(e=>e.date.slice(0,7)===calendarMonth);
  const exactEvents=monthEvents.filter(e=>e.precision==='day');
  const unknownEvents=monthEvents.filter(e=>e.precision!=='day');
  const grouped=new Map();
  for(const e of exactEvents){const day=Number(e.date.slice(8));if(!grouped.has(day))grouped.set(day,[]);grouped.get(day).push(e);}
  if(!selectedCalendarDate||!selectedCalendarDate.startsWith(calendarMonth)){
    const d=[...grouped.keys()].sort((a,b)=>a-b).pop();
    selectedCalendarDate=d?`${calendarMonth}-${pad2(d)}`:'';
  }
  const [startMonth,endMonth]=calendarRange();
  const cells=[];
  for(let i=0;i<firstDay;i++)cells.push('<div class="cal-blank" aria-hidden="true"></div>');
  for(let d=1;d<=daysInMonth;d++){
    const dayDate=`${calendarMonth}-${pad2(d)}`,items=grouped.get(d)||[];
    const hasVideo=items.some(e=>recommendedLinks(e).length);
    const isSelected=selectedCalendarDate===dayDate;
    const note=items.length?`${items.length}건의 일정${hasVideo?', 관련 영상 있음':''}`:'등록 일정 없음';
    cells.push(`<button type="button" class="cal-day${items.length?' has-events':''}${isSelected?' is-selected':''}" data-date="${dayDate}" aria-label="${y}년 ${m}월 ${d}일, ${note}" aria-pressed="${isSelected}"><span class="cal-day-number">${d}</span>${items.length?`<span class="cal-day-count">${items.length}건</span>`:''}${hasVideo?'<span class="cal-video-dot" title="관련 영상 있음" aria-hidden="true"></span>':''}</button>`);
  }
  const selected=selectedCalendarDate?grouped.get(Number(selectedCalendarDate.slice(8)))||[]:[];
  const selectedLabel=selectedCalendarDate?`${y}년 ${m}월 ${Number(selectedCalendarDate.slice(8))}일`:`${y}년 ${m}월`;
  const details=selected.length?selected.map(eventMarkup).join(''):'<p class="cal-no-day">날짜를 선택하면 해당 날짜의 활동 기록이 표시됩니다.</p>';
  const unknown=unknownEvents.length?`<section class="cal-month-unknown"><h3>이달의 일자 미상 기록 · ${unknownEvents.length}건</h3><p class="cal-hint">실제 날짜가 확인되지 않아 달력의 특정 날짜에 배치하지 않았습니다.</p>${unknownEvents.map(eventMarkup).join('')}</section>`:'';
  $('#summary').textContent=`전체 ${events.length.toLocaleString('ko-KR')}건 · 조건에 맞는 ${filtered.length.toLocaleString('ko-KR')}건 · ${y}년 ${m}월 ${monthEvents.length}건 · 일부 날짜·내용 검증 전`;
  const yearOptions=Array.from({length:Number(endMonth.slice(0,4))-Number(startMonth.slice(0,4))+1},(_,i)=>Number(startMonth.slice(0,4))+i).map(yr=>`<option value="${yr}" ${yr===y?'selected':''}>${yr}년</option>`).join('');
  const monthOptions=Array.from({length:12},(_,i)=>i+1).map(mo=>`<option value="${pad2(mo)}" ${mo===m?'selected':''}>${mo}월</option>`).join('');
  $('#calendar').innerHTML=`<div class="cal-controls"><button class="cal-nav" id="calPrev" type="button" aria-label="이전 달" ${calendarMonth<=startMonth?'disabled':''}>‹</button><div class="cal-month-select"><select id="calYear" aria-label="달력 연도 선택">${yearOptions}</select><select id="calMonth" aria-label="달력 월 선택">${monthOptions}</select></div><button class="cal-nav" id="calNext" type="button" aria-label="다음 달" ${calendarMonth>=endMonth?'disabled':''}>›</button></div><div class="cal-weekdays" aria-hidden="true">${['일','월','화','수','목','금','토'].map(t=>`<span>${t}</span>`).join('')}</div><div class="cal-days">${cells.join('')}</div><p class="cal-hint">날짜별 일정 수를 표시합니다. 파란 점은 관련 유튜브 영상이 있는 날짜입니다.</p><section class="cal-detail" aria-live="polite"><h2 class="cal-detail-title">${selectedLabel} · ${selected.length}건</h2>${details}</section>${unknown}`;
  $('#calPrev').addEventListener('click',()=>setCalendarMonth(shiftCalendarMonth(calendarMonth,-1)));
  $('#calNext').addEventListener('click',()=>setCalendarMonth(shiftCalendarMonth(calendarMonth,1)));
  const selectCalendarMonth=()=>setCalendarMonth(`${$('#calYear').value}-${$('#calMonth').value}`);
  $('#calYear').addEventListener('change',selectCalendarMonth);
  $('#calMonth').addEventListener('change',selectCalendarMonth);
  for(const btn of $('#calendar').querySelectorAll('[data-date]'))btn.addEventListener('click',()=>{selectedCalendarDate=btn.dataset.date;renderCalendar();$('#calendar').querySelector(`[data-date=\"${selectedCalendarDate}\"]`)?.focus({preventScroll:true});});
  if(highlightEvent)document.getElementById('event-'+highlightEvent)?.classList.add('focused-event');
}
function renderPage(){document.dispatchEvent(new Event('history-view-change'));if(viewMode==='calendar')renderCalendar();else renderItems();}
function changeView(next){
  if(next!=='list'&&next!=='calendar')return;
  viewMode=next;
  $('#listView').classList.toggle('is-active',next==='list');$('#calendarView').classList.toggle('is-active',next==='calendar');
  $('#listView').setAttribute('aria-pressed',String(next==='list'));$('#calendarView').setAttribute('aria-pressed',String(next==='calendar'));
  renderPage();
}
function resetAndRender(){visibleCount=pageSize;selectRows();if(highlightEvent){const at=filtered.findIndex(e=>e.id===highlightEvent);if(at>=visibleCount)visibleCount=Math.ceil((at+1)/pageSize)*pageSize;}renderPage();}
async function init(){
 try{
  const [h,v]=await Promise.all([fetch('./data/history.json',{cache:'no-store'}),fetch('./data/videos.json',{cache:'no-store'})]);
  if(!h.ok||!v.ok) throw new Error('원본 자료 요청에 실패했습니다.');
  const hd=await h.json(),vd=await v.json();events=Array.isArray(hd.events)?hd.events:[];chapters=Array.isArray(hd.chapters)?hd.chapters:[];eventAliases=hd.metadata?.legacyEventAliases||{};researchSources=new Map((hd.researchSources||[]).map(s=>[s.id,s]));
  for(const video of vd.videos||[]){
   const id=String(video.id||'');if(/^[A-Za-z0-9_-]{11}$/.test(id))videoById.set(id,video);

  }
  const matchingStats=generateRuntimeRecommendations(vd.videos||[]);
  console.info('[활동 연표] 실시간 영상 후보 점검:', matchingStats);
  events.sort((a,b)=>a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id)));
  explicitDate=DAY.test(qs.get('date')||'')?qs.get('date'):'';
  highlightEvent=eventAliases[qs.get('event')||'']||qs.get('event')||'';
  if(highlightEvent){const selected=events.find(e=>e.id===highlightEvent);if(selected){activeChapter=selected.chapter;}}
  else if(explicitDate){const record=events.find(e=>e.date===explicitDate || (e.conflictingDates||[]).includes(explicitDate));if(record)activeChapter=record.chapter;}
  for(const c of [...new Set(events.map(e=>e.category))].sort()) $('#category').add(new Option(c,c));
  for(const c of [...new Set(events.map(e=>e.verification))].sort()) $('#verification').add(new Option(c,c));
  const guide=$('#researchGuide');if(guide)guide.innerHTML=researchWidget();enableSourceWidgets();
  buildChapterButtons();applyChapter();
  const filtersChanged=()=>{calendarMonth='';selectedCalendarDate='';resetAndRender();};
  $('#withVideos').addEventListener('change',filtersChanged);
  for(const key of ['year','category','subject','verification','search']) $('#'+key).addEventListener(key==='search'?'input':'change',filtersChanged);
  $('#allChapters').addEventListener('click',()=>{activeChapter='';calendarMonth='';selectedCalendarDate='';$('#year').value='';applyChapter();});
  $('#listView').addEventListener('click',()=>changeView('list'));
  $('#calendarView').addEventListener('click',()=>changeView('calendar'));
  $('#loadMore').addEventListener('click',()=>{visibleCount+=pageSize;renderItems();});
  if(explicitDate||highlightEvent){
    $('.date-filter-hint').hidden=false;
    $('.date-filter-hint span').textContent=explicitDate?`${explicitDate} 날짜로 필터 중`:'기존 영상에서 연결된 일정 표시 중';
    if(highlightEvent){const chosen=events.find(e=>e.id===highlightEvent);if(chosen){activeChapter=chosen.chapter;applyChapter();}}
  }
  if(highlightEvent){document.getElementById('event-'+highlightEvent)?.scrollIntoView({block:'center'});}
 }catch(err){$('#events').innerHTML=`<p class="empty">활동 연표를 불러오지 못했습니다. ${safe(err.message)}</p>`;}
}
function setupBackToTop(){
  const button=$('#backToTop');
  if(!button)return;
  const update=()=>{button.hidden=window.scrollY<240;};
  window.addEventListener('scroll',update,{passive:true});
  button.addEventListener('click',()=>{
    const reduced=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({top:0,behavior:reduced?'auto':'smooth'});
  });
  update();
}
setupBackToTop();
init();
