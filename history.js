"use strict";
// Public timeline. No browser writeback, no admin/API mutation. Only approved curated links can be called related videos.
const $ = selector => document.querySelector(selector);
const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const pad2 = x => String(x).padStart(2,'0');
const validDay = (y,m,d) => { const date=new Date(Date.UTC(y,m-1,d)); return date.getUTCFullYear()===y && date.getUTCMonth()===m-1 && date.getUTCDate()===d; };
const qs=new URLSearchParams(location.search);
let events=[],chapters=[],researchSources=new Map(),eventAliases={},filtered=[],activeChapter='chapter1',pageSize=70,visibleCount=70,highlightEvent='',explicitDate='';
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
function normalizedWords(s){return String(s||'').normalize('NFKC').toLocaleLowerCase().replace(/shinhwa|sinhwa/gi,'신화').replace(/hye\s*sung|hyesung/gi,'신혜성');}
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
function videoEvidence(video){
 const manual=(video.dates||[]).filter(x=>x.precision==='day'&&x.sourceDate&&DAY.test(x.sourceDate)).map(x=>x.sourceDate);
 let dates=[...new Set(manual)];let origin='관리자 등록 날짜';
 if(!dates.length){dates=dateStringsFromText(video.source);origin='영상 원본 정보';}
 if(!dates.length){
   // Use content metadata, never YouTube upload time. Avoid channel URLs, hashtags and links.
   const desc=String(video.description||'').split(/\n\s*(?:채널\s*:|링크\s*:|#)/)[0].slice(0,1200);
   dates=dateStringsFromText(desc);origin='영상 설명';
 }
 if(dates.length!==1)return null; // One video covering multiple dates cannot identify one schedule confidently.
 const source=String(video.source||'').trim();
 const summary=source.length>=5?source:String(video.description||'').split(/\n\s*(?:채널\s*:|링크\s*:|#)/)[0].slice(0,360);
 const content=[summary,video.title||''].join(' ');
 return {date:dates[0],origin,content,program:detectProgram(content),episode:epNum(content),fanclub:fanclubNum(content),song:exactSong(content),compact:compactWords(content)};
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
 if(meta.date.slice(0,7)!==e.date.slice(0,7))return null;
 const days=Math.round(Math.abs(Date.parse(meta.date+'T00:00:00Z')-Date.parse(e.date+'T00:00:00Z'))/86400000);
 if(days>7)return null;
 const text=[e.title,...(e.mergedDetails||[])].join(' '),p=detectProgram(text),n=epNum(text),f=fanclubNum(text),song=exactSong(text);
 // Album release, filming dates, and other different event types must not borrow a same-day music show clip.
 if(/^(음반|릴리즈|발매)$/.test(e.category))return null;
 if(p&&meta.program&&p!==meta.program)return null;
 if(n!==null&&meta.episode!==null&&p&&meta.program&&n!==meta.episode)return null;
 if(f!==null&&meta.fanclub!==null&&f!==meta.fanclub)return null;
 if(p&&meta.program&&p===meta.program&&song&&meta.song&&song!==meta.song)return null;
 const exact=days===0,programSame=!!p&&p===meta.program,fanSame=f!==null&&meta.fanclub===f;
 const episodeSame=programSame&&n!==null&&meta.episode===n;
 const songSame=programSame&&!!song&&song===meta.song;
 const distinct=strongContentOverlap(e.title,meta.content);
 let score=0, reason='';
 if(fanSame&&/팬미팅|창단|팬클럽|fan/i.test(text)){score=.83;reason=`신화창조 ${f}기 행사 일치`;}
 else if(episodeSame){score=.85;reason=`프로그램과 ${n}회차 일치`;}
 else if(programSame&&songSame){score=.82;reason='프로그램과 무대 곡명 일치';}
 else if(programSame&&p!=='음악캠프'&&p!=='뮤직뱅크'&&p!=='인기가요'&&p!=='쇼뮤직탱크'&&p!=='쇼음악중심'&&p!=='엠카운트다운'){
   score=.76;reason='고유 프로그램명 일치';
 }
 else if(programSame&&distinct){score=.75;reason='프로그램과 세부 콘텐츠 일치';}
 else if(programSame&&exact&&n===null&&meta.episode===null){score=.56;reason='방송명 일치';} // insufficient for weekly music shows
 else if(distinct&&e.category!=='시상식'){score=.76;reason='고유 행사·콘텐츠명 일치';}
 else return null;
 score+=exact?.13:days<=2?.06:.0;
 // Nearby dates need especially strong program/episode or event/edition identity.
 if(!exact&&!(episodeSame||fanSame||(distinct&&programSame)))return null;
 score=Math.min(.99,Number(score.toFixed(2)));
 if(score<.70)return null;
 return {videoId:String(video.id),kind:'추천 영상 후보',score,reason:`${reason} · ${exact?'날짜 일치':`같은 달 ${days}일 차이`} · ${meta.origin}`,reviewStatus:'candidate',dateGapDays:days};
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
   if(ids.has(r.videoId))continue;ids.add(r.videoId);selected.push(r);if(selected.length>=5)break;
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
   .slice(0,5).map(r=>{
     const video=videoById.get(String(r.videoId));
     const url=ytUrl(video);
     if(!isSafeUrl(url))return '';
     const percent=Math.round(Number(r.score)*100);
     return `<a class="candidate" href="${safe(url)}" target="_blank" rel="noopener noreferrer" title="규칙 기반 연관도 ${percent}점 · ${safe(r.reason)} · 동일 영상 검증 완료를 의미하지 않음">▶ ${safe(video.title||'관련 영상')} <small>연관도 ${percent}점</small></a>`;
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
 const rows=ordered.map(r=>`<li><span class="source-kind">${safe(r.kind)}</span> <a href="${safe(r.url)}" target="_blank" rel="noopener noreferrer">${safe(r.label)} ↗</a>${r.note?`<small>${safe(r.note)}</small>`:''}</li>`).join('');
 const entries=rows?`<ul>${rows}</ul>`:'<p class="source-unlinked">이 일정에 연결된 외부 근거 URL이 없습니다.</p>';
 return `<span class="source-widget"><button type="button" class="source-trigger" aria-label="${safe(e.date)} ${safe(e.title)} 출처 보기" aria-expanded="false" title="출처·검증 근거 보기">ⓘ</button><span class="source-panel" role="group" aria-label="출처 정보"><strong>자료 · 검증 근거</strong><span class="source-status">${safe(status)}</span><p>기록 계열: ${safe(provenance)} · ${safe(e.dateKind||'날짜 종류 미확인')}</p>${note?`<p>${safe(note.slice(0,350))}</p>`:''}${entries}</span></span>`;
}
function researchWidget(){
 const rows=[...researchSources.values()].map(r=>`<li><span class="source-kind">${safe(r.kind)}</span> <a href="${safe(r.url)}" target="_blank" rel="noopener noreferrer">${safe(r.title)} ↗</a><small>${safe(r.note)}</small></li>`).join('');
 return `<span class="source-widget source-catalog"><button type="button" class="source-trigger source-catalog-trigger" aria-label="조사에 활용한 공개 자료 목록 보기" aria-expanded="false" title="조사 자료 목록">ⓘ 조사 자료</button><span class="source-panel" role="group" aria-label="조사 자료 목록"><strong>조사·대조한 공개 자료</strong><p>이 목록에 포함된 사이트·링크가 모든 일정의 날짜를 증명하는 것은 아닙니다. 각 이벤트의 ⓘ에서 연결 근거를 구분해 보세요.</p><ul>${rows}</ul></span></span>`;
}
function enableSourceWidgets(){
  // One document-level overlay solves z-index/stacking and clipping from rows.
  // Links inside the overlay remain interactive on hover, keyboard, and touch.
  const float=document.createElement('div');
  float.id='history-source-float';float.className='source-float';
  float.setAttribute('role','dialog');float.setAttribute('aria-label','자료 및 검증 근거');
  document.body.appendChild(float);
  let active=null, pinned=false, closeTimer=null;
  const cancel=()=>{if(closeTimer!==null){clearTimeout(closeTimer);closeTimer=null;}};
  const release=()=>{cancel();if(active){active.setAttribute('aria-expanded','false');active.closest('.source-widget')?.classList.remove('is-open');}active=null;pinned=false;float.classList.remove('is-visible');float.innerHTML='';};
  function position(){
    if(!active||!float.classList.contains('is-visible'))return;
    const r=active.getBoundingClientRect(),w=innerWidth,h=innerHeight;
    if(w<=550){float.style.removeProperty('left');float.style.removeProperty('top');return;}
    float.style.left='0px';float.style.top='0px';
    const width=float.getBoundingClientRect().width||390,height=float.getBoundingClientRect().height||280;
    // Prefer placing away from the underlying row text on wide screens.
    let left=(w-r.right>width+18)?r.right+10:(r.left-width-10>8?r.left-width-10:Math.min(Math.max(10,r.left),w-width-10));
    let top=r.bottom+8;
    if(top+height>h-10)top=Math.max(10,r.top-height-9);
    if(top+height>h-10)top=Math.max(10,h-height-10);
    float.style.left=Math.round(left)+'px';float.style.top=Math.round(top)+'px';
  }
  function show(button,lock=false){
    cancel();if(active!==button){if(active){active.setAttribute('aria-expanded','false');active.closest('.source-widget')?.classList.remove('is-open');}
      active=button;float.innerHTML=button.closest('.source-widget')?.querySelector('.source-panel')?.innerHTML||'';}
    pinned=lock;active.setAttribute('aria-expanded','true');active.setAttribute('aria-controls',float.id);
    active.closest('.source-widget')?.classList.add('is-open');
    float.classList.add('is-visible');position();
  }
  function later(){if(pinned)return;cancel();closeTimer=setTimeout(()=>{if(!float.matches(':hover')&&!(active?.matches(':hover'))&&!float.contains(document.activeElement)){release();}},160);}
  document.addEventListener('pointerover',event=>{
    const button=event.target.closest?.('.source-trigger');
    if(!button||event.pointerType==='touch')return;
    if(button===active){cancel();return;}
    if(pinned)return;show(button);
  });
  document.addEventListener('pointerout',event=>{
    if(event.target.closest?.('.source-widget') && !event.relatedTarget?.closest?.('.source-widget'))later();
  });
  float.addEventListener('pointerenter',cancel);
  float.addEventListener('pointerleave',later);
  document.addEventListener('focusin',event=>{const button=event.target.closest?.('.source-trigger');if(button&&!pinned)show(button);});
  document.addEventListener('focusout',event=>{if(event.target.closest?.('.source-widget'))later();});
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('.source-trigger');
    if(button){event.preventDefault();if(active===button&&pinned)release();else show(button,true);return;}
    if(!float.contains(event.target))release();
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active){const last=active;release();last.focus();}});
  document.addEventListener('scroll',()=>{if(active)position();},true);
  window.addEventListener('resize',position);
}

function renderItems(){
 const to=filtered.slice(0,visibleCount),last=to.length;
 $('#summary').textContent=`전체 ${events.length.toLocaleString('ko-KR')}건 · 조건에 맞는 ${filtered.length.toLocaleString('ko-KR')}건 · 현재 ${last.toLocaleString('ko-KR')}건 표시 · 일부 자료는 날짜·내용 검증 전`;
 if(!last){$('#events').innerHTML='<p class="empty">조건에 맞는 일정이 없습니다.</p>';$('#loadMore').hidden=true;return;}
 let prev='';
 $('#events').innerHTML=to.map(e=>{
  const header=monthHeading(e,prev);prev=e.date.slice(0,7);
  const links=recommendedLinks(e);
  const linkHtml=links.length?`<div class="candidates">${links.join('')}</div>`:'';
  const details=Array.isArray(e.mergedDetails)?e.mergedDetails.slice(0,3):[];
  const detailHtml=details.length?`<div class="detail-note">세부 기록: ${safe(details.map(t=>String(t).slice(0,170)).join(' · '))}</div>`:'';
  const conflictHtml=e.conflictingDates?.length?`<div class="detail-note conflict">원문 날짜 충돌: ${safe(e.conflictingDates.join(' / '))} · 공식 날짜 추가 확인 필요</div>`:'';
  const desc=String(e.sourceNote||'').slice(0,380);
  return `${header}<article class="item" id="event-${safe(e.id)}"><div class="date" title="${safe(e.date)} · ${safe(e.dateKind||'')}">${safe(fmt(e))}</div><div class="item-main"><div class="name">${safe(e.title)}</div><div class="meta"><span class="tag">${safe(e.category)}</span><span class="tag">${safe(e.subject==='신화 전체'?'신화 전체':e.subject==='신혜성 개인'?'신혜성':e.subject==='신혜성 포함 합동'?'신혜성 참여':e.subject)}</span><span class="${e.verification==='날짜 충돌'?'conflict':e.verification.includes('검증 전')||e.verification==='원문 기록'?'unconfirmed':''}" title="${safe(desc||e.source||'')}">${e.verification==='날짜 충돌'?'⚠':'◌'} ${safe(e.verification)}</span>${e.precision!=='day'?'<span class="inexact">일자 미상</span>':''}${e.recordCount>1?`<span class="tag" title="${safe(e.recordCount)}개 원본 기록 통합">원본 ${e.recordCount}건 통합</span>`:(e.possibleDuplicate?'<span class="inexact">중복 검토 필요</span>':'')}${e.transition?`<span class="tag">${safe(e.transition)}</span>`:''}${links.length?`<span class="video" title="규칙 기반 70점 이상 · 동일 행사 확정 아님">▶ 추천 ${links.length}개</span>`:''}${sourceWidget(e)}</div>${conflictHtml}${detailHtml}${e.verification==='날짜 충돌'?`<div class="detail-note">${safe(desc)}</div>`:''}${linkHtml}</div></article>`;
 }).join('');
 $('#loadMore').hidden=filtered.length<=last;
 if(highlightEvent){
   const target=document.getElementById('event-'+highlightEvent);
   if(target) target.classList.add('focused-event');
 }
}
function resetAndRender(){visibleCount=pageSize;selectRows();if(highlightEvent){const at=filtered.findIndex(e=>e.id===highlightEvent);if(at>=visibleCount)visibleCount=Math.ceil((at+1)/pageSize)*pageSize;}renderItems();}
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
  $('#withVideos').addEventListener('change',resetAndRender);
  for(const key of ['year','category','subject','verification','search']) $('#'+key).addEventListener(key==='search'?'input':'change',resetAndRender);
  $('#allChapters').addEventListener('click',()=>{activeChapter='';$('#year').value='';applyChapter();});
  $('#loadMore').addEventListener('click',()=>{visibleCount+=pageSize;renderItems();});
  if(explicitDate||highlightEvent){
    $('.date-filter-hint').hidden=false;
    $('.date-filter-hint span').textContent=explicitDate?`${explicitDate} 날짜로 필터 중`:'기존 영상에서 연결된 일정 표시 중';
    if(highlightEvent){const chosen=events.find(e=>e.id===highlightEvent);if(chosen){activeChapter=chosen.chapter;applyChapter();}}
  }
  if(highlightEvent){document.getElementById('event-'+highlightEvent)?.scrollIntoView({block:'center'});}
 }catch(err){$('#events').innerHTML=`<p class="empty">활동 연표를 불러오지 못했습니다. ${safe(err.message)}</p>`;}
}
init();
