"use strict";
// Public timeline. No browser writeback, no admin/API mutation. Only approved curated links can be called related videos.
const $ = selector => document.querySelector(selector);
const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const pad2 = x => String(x).padStart(2,'0');
const validDay = (y,m,d) => { const date=new Date(Date.UTC(y,m-1,d)); return date.getUTCFullYear()===y && date.getUTCMonth()===m-1 && date.getUTCDate()===d; };
let events=[],chapters=[],researchSources=new Map(),eventAliases={},filtered=[],activeChapter='chapter1',pageSize=70,visibleCount=70,highlightEvent='',explicitDate='';
let viewMode='list',calendarMonth='',selectedCalendarDate='';
const videoById=new Map();
let historyReady=false,restoringHistory=false,expiryTimer=null,searchTimer=null;
// Archive timeline date extraction mirrors the main archive's description parser.
// Embedded here to avoid an additional deployable JavaScript asset.
const HistoryArchiveDates = (() => {
  const pad2=n=>String(n).padStart(2,"0");
  function isValidDate(y, m, d) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y &&
           dt.getUTCMonth() + 1 === m &&
           dt.getUTCDate() === d;
  }
  
  function normalizeTwoDigitYear(yy) {
    const n = Number(yy);
    // Archive context rule:
    // 00~29 => 2000~2029
    // 30~99 => 1930~1999
    return n <= 29 ? 2000 + n : 1900 + n;
  }
  
  function pushUniqueDate(list, entry) {
    if (!entry || !entry.sourceDate) return;
    const key = `${entry.sourceDate}|${entry.precision || "day"}|${entry.source || ""}`;
    if (!list.some(x =>
      `${x.sourceDate}|${x.precision || "day"}|${x.source || ""}` === key
    )) {
      list.push(entry);
    }
  }
  
  function removeHashtagsFromDescription(text="") {
    return String(text || "")
      // Remove hashtag tokens such as #1999, #2015-02-27, #신혜성
      // until whitespace or another # begins.
      .replace(/#[^\s#]+/g, " ");
  }
  
  function extractDatesFromText(text="") {
    const input = String(text || "");
    const found = [];
  
    const addDay = (y, m, d) => {
      y = Number(y); m = Number(m); d = Number(d);
      if (!isValidDate(y, m, d)) return;
      pushUniqueDate(found, {
        sourceDate: `${y}-${pad2(m)}-${pad2(d)}`,
        source: "",
        precision: "day",
        inferred: false
      });
    };
  
    const addMonth = (y, m) => {
      y = Number(y); m = Number(m);
      if (y < 1900 || y > 2099 || m < 1 || m > 12) return;
      pushUniqueDate(found, {
        sourceDate: `${y}-${pad2(m)}-01`,
        source: "",
        precision: "month",
        inferred: true
      });
    };
  
    const addYear = (y) => {
      y = Number(y);
      if (y < 1900 || y > 2099) return;
      pushUniqueDate(found, {
        sourceDate: `${y}-01-01`,
        source: "",
        precision: "year",
        inferred: true
      });
    };
  
    // 1) YYYY년 M월 D일
    for (const m of input.matchAll(/(?<!\d)((?:19|20)\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g)) {
      addDay(m[1], m[2], m[3]);
    }
  
    // 2) YYYY.MM.DD / YYYY-MM-DD / YYYY/MM/DD
    for (const m of input.matchAll(/(?<!\d)((?:19|20)\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})(?!\d)/g)) {
      addDay(m[1], m[2], m[3]);
    }
  
    // 3) YY.MM.DD / YY-MM-DD / YY/MM/DD e.g. 08.11.08 => 2008-11-08
    for (const m of input.matchAll(/(?<!\d)(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})(?!\d)/g)) {
      addDay(normalizeTwoDigitYear(m[1]), m[2], m[3]);
    }
  
    // 4) YYYYMMDD
    for (const m of input.matchAll(/(?<!\d)((?:19|20)\d{2})(\d{2})(\d{2})(?!\d)/g)) {
      addDay(m[1], m[2], m[3]);
    }
  
    // 5) YYMMDD e.g. 150227, 010826, 981025
    for (const m of input.matchAll(/(?<!\d)(\d{2})(\d{2})(\d{2})(?!\d)/g)) {
      const y = normalizeTwoDigitYear(m[1]);
      addDay(y, m[2], m[3]);
    }
  
    // 6) YYYY년 M월
    for (const m of input.matchAll(/(?<!\d)((?:19|20)\d{2})\s*년\s*(\d{1,2})\s*월(?!\s*\d+\s*일)/g)) {
      addMonth(m[1], m[2]);
    }
  
    // 7) YYYY.MM / YYYY-MM / YYYY/MM
    for (const m of input.matchAll(/(?<!\d)((?:19|20)\d{2})[.\-/](\d{1,2})(?![.\-/]\d|\d)/g)) {
      addMonth(m[1], m[2]);
    }
  
    // 8) YYYY년 / YYYY년도
    for (const m of input.matchAll(/(?<!\d)((?:19|20)\d{2})\s*년(?:도)?(?!\s*\d+\s*월)/g)) {
      addYear(m[1]);
    }
  

  // Same-line day list: `990815, 0822, 0829 인기가요`.
  // Only borrow the explicit first date's YEAR, never an upload year, and
  // never assign a missing date from another line or video title.
  for (const line of input.split(/\r?\n/)) {
    const groups=line.matchAll(/(?<!\d)((?:19|20)\d{6}|\d{6})((?:\s*[,，/&+]\s*(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))+)(?!\d)/g);
    for (const group of groups) {
      const initial=group[1];
      const year=initial.length===8?Number(initial.slice(0,4)):normalizeTwoDigitYear(initial.slice(0,2));
      const firstMonth=Number(initial.slice(-4,-2));
      const firstDay=Number(initial.slice(-2));
      if (!isValidDate(year,firstMonth,firstDay)) continue;
      for(const dayToken of group[2].split(/[,，/&+]/).map(s=>s.trim()).filter(Boolean)) {
        const month=Number(dayToken.slice(0,2)),day=Number(dayToken.slice(-2));
        if(isValidDate(year,month,day)) addDay(year,month,day);
      }
    }
  }
    return found;
  }
  return Object.freeze({extractDatesFromText, removeHashtagsFromDescription});
})();


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
 ['쇼챔피언',/쇼!?\s*챔피언/i],
 ['소년24',/소년\s*24|boys\s*24/i],
 ['와이드연예뉴스',/와이드\s*(?:연예)?\s*뉴스|wide\s*news/i],
 ['최정원의감성시대',/최정원(?:의)?\s*감성\s*시대/i],
 ['퀴즈육감대결',/퀴즈!?\s*육감\s*대결|퀴즈\s*육감대결/i],
 ['텐텐클럽',/텐\s*텐\s*클럽/i],
 ['기쁜우리젊은날',/기쁜\s*우리\s*젊은\s*날/i],
 ['별이빛나는밤에',/별이\s*빛나는\s*밤에|별밤/i],
 ['슈퍼스테이션',/서세원의?\s*슈퍼스테이션|슈퍼스테이션/i],
 ['스타챔피언',/스타\s*!?\s*챔피언/i],
 ['뮤직플러스',/뮤직\s*플러스|music\s*plus/i],
 ['쇼킹엠',/쇼킹\s*엠|show\s*king\s*m/i],
 ['육감대결',/육감\s*대결/i],
 ['가요대전',/가요\s*대전/i]
];
const commonPrograms=[
 ['음악캠프',/음악\s*캠프|music\s*camp/i],
 ['뮤직뱅크',/뮤직\s*뱅크|music\s*bank|뮤뱅(?![가-힣])/i],
 ['인기가요',/인기\s*가요|인가(?![가-힣])/i],
 ['쇼뮤직탱크',/쇼!?\s*뮤직\s*탱크|쇼탱|music\s*tank/i],
 ['쇼음악중심',/쇼!?\s*음악\s*중심|음중/i],
 ['엠카운트다운',/m\s*!?\s*countdown|엠\s*카운트다운/i]
];
function normalizedWords(s){return String(s||'').normalize('NFKC').toLocaleLowerCase().replace(/shinhwa|sinhwa/gi,'신화').replace(/hye\s*sung|hyesung/gi,'신혜성').replace(/\bi\s*am\b/gi,'아이엠').replace(/happy\s*together/gi,'해피투게더').replace(/friend[s]?/gi,'프렌즈');}
function compactWords(s){return normalizedWords(s).replace(/[^0-9a-z가-힣]/g,'');}
function detectProgram(s){const text=normalizedWords(s);for(const [k,re] of [...rarePrograms,...commonPrograms])if(re.test(text))return k;return '';}
// Cross-lingual programme/concert keys, used only together with day and conflict checks.
const namedActivityKeys=[
 ['keepleaves',/keep\s*leaves/i],
 ['yearjourney',/(?:the\s*)?year[’'\u2019]?s\s*journey/i],
 ['closetoyou',/close\s*to\s*you/i],
 ['liveandletlive',/live\s*and\s*let\s*live/i],
 ['소년24',/소년\s*24|boys\s*24/i],
 ['smileconcert',/smile\s*콘서트|스마일\s*콘서트/i],
 ['감성시대',/최정원(?:의)?\s*감성\s*시대/i],
 ['신화베이징',/17\s*주년\s*콘서트|asia\s*tour\s*concert/i],
 ['소년24세미파이널',/소년\s*24.*세미\s*파이널|소년\s*24.*semi\s*final/i],
 ['SHSjourney',/\bshs\s*(?:the\s*)?year[’'\u2019]?s\s*journey/i],
 ['themovetour',/\bmove\b.{0,18}concert|콘서트.{0,18}move|신화.*(?:섬머|summer).*라이브.*move/i],
 ['shinhwaBeijingTour',/(?:17\s*주년\s*콘서트.*beijing|beijing.*(?:아시아\s*투어|asia\s*tour).*콘서트|베이징.*(?:아시아\s*투어|asia\s*tour).*콘서트)/i],
 ['sbsiconcert',/sbs\s*i\s*concert|sbs\s*i\s*콘서트/i],
 ['mbcminiconcert',/mbc.*(?:신동진(?:의)?\s*미니\s*콘서트|mini\s*concert)/i],
 ['오월지련쇼케이스',/오월\s*지련.*쇼케이스/i],
 ['최신가요차트',/중국\s*최신\s*가요.*(?:차트|어워드|어워즈)/i],
 ['신혜성팬미팅',/신혜성.*팬\s*미팅/i]
];
function namedActivityTokens(text){
 const t=normalizedWords(text);
 const tokens=new Set(namedActivityKeys.filter(([key,re])=>re.test(t)).map(([key])=>key));
 if(tokens.has('SHSjourney'))tokens.add('yearjourney');
 if(tokens.has('소년24세미파이널'))tokens.add('소년24');
 return tokens;
}
function locationTokens(text){
 const t=normalizedWords(text);const found=[];
 for(const [city,re] of [['상하이',/상하이|shanghai/i],['베이징',/베이징|beijing/i],['서울',/서울|seoul/i],['부산',/부산|busan/i],['도쿄',/도쿄|tokyo|東京/i],['나고야',/나고야|nagoya/i],['타이베이',/타이베이|taipei/i]]) if(re.test(t))found.push(city);
 return found;
}
function epNum(s){const m=String(s||'').match(/(?:\bep(?:isode)?\.?\s*|\bE\s*|제\s*)(\d{1,4})(?:\s*회|\b)|\b(\d{1,4})\s*회(?!\d)/i);return m?Number(m[1]||m[2]):null;}
function fanclubNum(s){const m=normalizedWords(s).match(/신화\s*창조\s*(\d+)\s*기/);return m?Number(m[1]):null;}
function exactSong(s){
 const t=normalizedWords(s);
 const songs=[['천일유혼',/천일\s*유혼/],['으쌰으쌰',/으[쌰샤]\s*!?\s*으[쌰샤]|usha\s*usha/],['해결사',/해결사/],['인형',/인형/],['top',/\bt\s*\.?\s*o\s*\.?\s*p\.?\b|<\s*top\s*>/i],['yo',/\byo\s*!/i],['onlyone',/only\s*one/i],['allyourdreams',/all\s*your\s*dreams|all\s*your\s*ereams/i],['heycomeon',/hey\s*,?\s*come\s*on/i],['wild eyes',/wild\s*eyes/i],['perfectman',/perfect\s*man/i],['ipray4u',/i\s*pray\s*4\s*u/i],['brandnew',/brand\s*new/i],['onceinalifetime',/once\s*in\s*a\s*lifetime/i],['비처럼음악처럼',/비처럼\s*음악처럼/],['같은생각',/같은\s*생각/],['너의결혼식',/너의\s*결혼식|\bwedding\b/i],['사랑이온다',/사랑이\s*온다/]];
 for(const [k,re] of songs)if(re.test(t))return k;return '';
}
function dateStringsFromText(raw){
 const text=String(raw||'').replace(/https?:\/\/\S+/g,'');
 const cleaned=HistoryArchiveDates.removeHashtagsFromDescription(text);
 return [...new Set(HistoryArchiveDates.extractDatesFromText(cleaned)
   .filter(d=>d.precision==='day'&&DAY.test(d.sourceDate)).map(d=>d.sourceDate))];
}
function originalTitleLine(video){
 const text=String(video.description||'');
 const m=text.match(/(?:^|\n)\s*(?:제목|영상제목|방송명)\s*[:：]\s*([^\r\n]{4,250})/im);
 return m?m[1].trim():'';
}
function strongDateEvidence(video){
 // Same date parser as the video archive, based on the saved description alone.
 const descriptionDates=dateStringsFromText(String(video.description||''));
 const stored=(video.dates||[]).filter(x=>x.precision==='day'&&DAY.test(String(x.sourceDate||''))).map(x=>x.sourceDate);
 if(!stored.length&&DAY.test(String(video.sourceDate||'')))stored.push(video.sourceDate);
 const manual=[...new Set(stored)];
 if(manual.length>1||descriptionDates.length>1)return null; // montage/compilation: never claim a single broadcast day
 if(manual.length&&descriptionDates.length&&manual[0]!==descriptionDates[0])return null;
 if(manual.length)return {date:manual[0],origin:'아카이브 저장 날짜'};
 if(descriptionDates.length)return {date:descriptionDates[0],origin:'아카이브 설명 날짜'};
 // Unassigned archive dates: source/title clues are conservative candidates only.
 const fields=[['영상 원본 정보',dateStringsFromText(video.source)],['원본 제목',dateStringsFromText(originalTitleLine(video))],['영상 제목',dateStringsFromText(video.title)]];
 const found=fields.filter(([n,arr])=>arr.length);
 if(found.some(([n,arr])=>arr.length!==1)||new Set(found.map(([n,arr])=>arr[0])).size>1)return null;
 return found.length?{date:found[0][1][0],origin:'원본 제목·출처 표기 날짜(아카이브 날짜 미확인)',sourceOnly:true}:null;
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
// Multi-date compilations share the archive's parsed date list. Never infer that a
// compilation is a single original episode; match only the dated segment's title.
function datedSegments(video){
 if(video.contentType==='playlist')return [];
 const description=HistoryArchiveDates.removeHashtagsFromDescription(video.description||'').replace(/https?:\/\/\S+/g,' ');
 const days=dateStringsFromText(description);
 if(days.length<2)return [];
 // Prefer a separately curated source with dated programme segments when available.
 // For compilations whose source is just the uploader/channel name, accept only
 // description lines that BEGIN with a valid date and name a recognisable show.
 // These are references to an excerpt in a montage, not independently verified videos.
 const source=String(video.source||'');
 const sourceHasDates=dateStringsFromText(source).length>0;
 const segments=sourceHasDates?source:description;
 const dateR=/(?<!\d)(?:((?:19|20)\d{2})\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일|(?:19|20)\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}|\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}|(?:19|20)\d{6}|\d{6})(?!\d)/g;
 const results=new Map();
 for(const rawLine of segments.split(/\r?\n/)){
  // Audio montages use playback timestamps before the original broadcast date.
  const line=rawLine.replace(/^\s*(?:[-*•]\s*)?\d{1,2}:\d{2}(?::\d{2})?\s+/,'').trim();
  // Comma-separated lists share the trailing programme title:
  // `990815, 0822, 0829 인기가요` / `990704, 990711 인기가요`.
  const grouped=line.match(/^\s*(?:[-*•]\s*)?((?:(?:19|20)\d{6}|\d{6})(?:\s*[,，/&+]\s*(?:(?:19|20)\d{6}|\d{6}|\d{4}))+)(?:\s+)(.+)$/);
  if(grouped){
   const dated=dateStringsFromText(grouped[1]);
   const context=grouped[2].trim();
   const program=detectProgram(context),keys=namedActivityTokens(context);
   if(dated.length>=2&&(program||keys.size))for(const day of dated){
    if(!days.includes(day))continue;
    const meta={date:day,origin:'영상 설명 같은 연도 날짜 목록',multiDate:true,content:context,
     program,episode:epNum(context),fanclub:fanclubNum(context),song:exactSong(context),
     compact:compactWords(context),title:video.title,labels:contentLabels(context)};
    results.set(day,meta);
   }
   continue;
  }
  // In descriptions, exclude incidental dates inside narrative or citations;
  // recognise only source lists with the date first on its own line.
  if(!sourceHasDates&&!/^\s*(?:[-*•]\s*)?(?:(?:19|20)\d{2}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일|(?:19|20)\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}|\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}|(?:19|20)\d{6}|\d{6})(?!\d)/.test(line))continue;
  const matches=[...line.matchAll(dateR)];
  for(let i=0;i<matches.length;i++){
   const match=matches[i],day=dateStringsFromText(match[0])[0];
   if(!day||!days.includes(day))continue;
   const end=matches[i+1]?.index??line.length;
   // If a date is followed by another date, never borrow the other segment's show label.
   const segment=line.slice(match.index+match[0].length,end).trim();
   // Use text belonging to this date only; a paragraph prefix may describe another event.
   const context=segment;
   if(!context||context.length<3)continue;
   const program=detectProgram(context);
   const keys=namedActivityTokens(context);
   const labels=contentLabels(context);
   if(!program&&!keys.size)continue;
   const meta={date:day,origin:sourceHasDates?'원본 출처 날짜별 내용':'설명 내 날짜별 장면 표기',multiDate:true,content:context,
    program,episode:epNum(context),fanclub:fanclubNum(context),song:exactSong(context),
    compact:compactWords(context),title:video.title,labels};
   if(!results.has(day)||context.length>results.get(day).content.length)results.set(day,meta);
  }
 }
 return [...results.values()];
}
function videoEvidences(video){
 const primary=videoEvidence(video);
 if(primary)return [primary];
 return datedSegments(video);
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
 const eventKeys=namedActivityTokens(e.title),videoKeys=namedActivityTokens(meta.content);
 const namedMatch=[...eventKeys].some(k=>videoKeys.has(k)&&k!=='SHSjourney'&&k!=='소년24');
 const eventCities=locationTokens(e.title),videoCities=locationTokens(meta.content);
 if(eventCities.length&&videoCities.length&&!eventCities.some(c=>videoCities.includes(c)))return null;
 const showMatch=commonMatch||genericMatch||namedMatch;
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
 const distinct=strongContentOverlap(e.title,meta.content)||namedMatch;
 // A real source/show name and exact date beats conflicting archive episode numbering.
 // Nearby-date matches require a strongly identified programme and an uncertainty marker.
 if(!showMatch&&!(exact&&distinct))return null;
 if(!exact&&!showMatch)return null;
 if(meta.sourceOnly&&(!exact||!showMatch))return null;
 if(meta.multiDate&&(!exact||!(commonMatch||namedMatch)||epConflict))return null;
 // Different named songs in the same programme need manual verification.
 if(song&&meta.song&&song!==meta.song)return null;
 if(!exact&&epConflict)return null;
 let score=exact?(episodeSame?.97:songSame?.94:showMatch?.85:.78):(episodeSame?.81:.72);
 if(epConflict)score=.74;
 if(meta.sourceOnly)score=Math.min(score,.77);
 if(meta.multiDate)score=Math.min(score,.76);
 let reason=episodeSame?'프로그램·날짜·회차 일치':songSame?'프로그램·날짜·곡명 일치':showMatch?'영상 출처·공연명 일치':'고유 콘텐츠명 일치';
 if(epConflict)reason+=` · 회차 표기 불일치(연표 ${n} / 영상 ${meta.episode})`;
 if(!exact)reason+=` · 날짜 ${days}일 차이(동일 방송 미확정, 확인 필요)`;
 if(meta.multiDate)reason+=' · 편집영상 설명의 날짜별 장면 표기, 실제 장면 확인 필요';
 return {videoId:String(video.id),kind:!exact||epConflict?'검토 필요 추천영상':'관련 영상 후보',score,reason:reason+' · '+meta.origin,reviewStatus:'candidate',dateGapDays:days};
}
function generateRuntimeRecommendations(videos){
 const byMonth=new Map(),stats={withSingleContentDate:0,matches:0,events:0};
 for(const v of videos||[]){
  if(!/^[A-Za-z0-9_-]{11}$/.test(String(v.id||'')))continue;
  if(v.url && !/^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(String(v.url)))continue;
  if(!isSafeUrl(ytUrl(v)))continue;
  const metas=videoEvidences(v);if(!metas.length)continue;
  if(metas.length===1&&!metas[0].multiDate)stats.withSingleContentDate++;
  else stats.multiDateVideos=(stats.multiDateVideos||0)+1;
  for(const m of metas){
   const ym=m.date.slice(0,7);if(!byMonth.has(ym))byMonth.set(ym,[]);
   byMonth.get(ym).push({video:v,meta:m});
  }
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
  // Preserve links reviewed from source-description dates and show names.
  // These identifiers originate only in data/history.json and must still
  // exist in the current archive's video list before a link can be shown.
  const approved=[];
  for(const id of e.archiveVideoIds||[]){
   const video=videoById.get(String(id));
   if(!video||!isSafeUrl(ytUrl(video)))continue;
   const existing=selected.find(r=>r.videoId===String(id));
   if(existing){
    existing.archiveMapped=true;
    existing.kind='아카이브 출처 연결';
    existing.reason='영상 설명에 적힌 날짜·활동명 기준 연결 · 별도 방송 영상 검증 전';
    approved.push(existing);
   }else approved.push({videoId:String(id),kind:'아카이브 출처 연결',score:.85,
    reason:'영상 설명에 적힌 날짜·활동명 기준 연결 · 별도 방송 영상 검증 전',
    reviewStatus:'candidate',dateGapDays:0,archiveMapped:true});
  }
  const ordered=[...approved,...selected.filter(r=>!approved.some(a=>a.videoId===r.videoId))];
  e.relatedVideos=ordered.slice(0,12);
  if(e.relatedVideos.length){stats.events++;stats.matches+=e.relatedVideos.length;}
 }
 return stats;
}

function ytUrl(video) {
  const link=String(video.url||'');
  return /^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(link)?link:`https://www.youtube.com/watch?v=${encodeURIComponent(String(video.id||''))}`;
}
function isSafeUrl(value){
 const url=String(value||'');
 if(/^\/history-evidence\/[a-z0-9][a-z0-9._-]*\.png$/i.test(url))return true;
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
function applyChapter(render=true){
 for(const btn of document.querySelectorAll('[data-chapter]')){
   const chosen=btn.dataset.chapter===activeChapter;
   btn.classList.toggle('active',chosen);btn.setAttribute('aria-pressed',String(chosen));
 }
 const years=[...new Set(events.filter(e=>!activeChapter||e.chapter===activeChapter).map(e=>e.date.slice(0,4)))].sort();
 const selected=$('#year').value;
 $('#year').innerHTML='<option value="">전체 연도</option>'+years.map(y=>`<option value="${safe(y)}">${safe(y)}년</option>`).join('');
 if(years.includes(selected)) $('#year').value=selected;
 if(render)resetAndRender();
}
function normalizeSubject(s){
 if(s==='신화 전체')return 'group';
 if(s==='신혜성 개인')return 'solo';
 if(s==='신혜성 포함 합동'||s==='신혜성 개인·합동')return 'together';
 return 'historical';
}
// A newly imported historical event is NEW for 24h after its registeredAt timestamp.
// Its historical event date never influences this badge.
const NEW_WINDOW_MS=24*60*60*1000;
function isNewEvent(e,now=Date.now()){
 const at=Date.parse(String(e.registeredAt||''));
 return Number.isFinite(at)&&at<=now&&now-at<NEW_WINDOW_MS;
}
// Display groups only: preserve every original verdict and never infer completed verification.
const VERIFICATION_GROUPS=[
 ['독립검증 완료','기존 판정에 검증 완료가 명시된 기록입니다. 확인 범위와 개별 출처를 함께 확인하세요.'],
 ['일부 확인','일부 사실에 관한 확인 기록이 있습니다. 날짜·출연·곡명 등이 모두 확인됐다는 뜻은 아닙니다.'],
 ['예정 자료 확인','예고·예정 자료가 포함된 기록입니다. 실제 개최·방송·출연 여부는 상세 판정을 확인하세요.'],
 ['날짜 미확정','방송일·촬영일·공연일 등 날짜에 미확정 사항이 있습니다.'],
 ['날짜 충돌','날짜 또는 시각에 서로 다른 주장이 있어 추가 확인이 필요합니다.'],
 ['원문 미확보','확인에 필요한 원문이나 방송 원본을 확보하지 못한 부분이 있습니다.'],
 ['원문 기록','기존 원문에 기재된 기록입니다. 독립검증 완료를 뜻하지 않습니다.'],
 ['독립 검증 전','원본 기록·영상 제목·설명 등의 단서가 있으며 독립적인 확인이 남아 있습니다.'],
 ['검토 보류','판정을 보류한 기록입니다. 상세 사유를 확인하세요.'],
 ['상태 분류 필요','표시 상태 코드가 없거나 유효하지 않습니다. 기존 상세 판정을 확인하세요.']
];
const VERIFICATION_CODES={verified:'독립검증 완료',partial:'일부 확인',announced:'예정 자료 확인',date_uncertain:'날짜 미확정',date_conflict:'날짜 충돌',source_unavailable:'원문 미확보',original_record:'원문 기록',pending:'독립 검증 전',on_hold:'검토 보류'};
function verificationGroup(e){return VERIFICATION_CODES[e.verificationDisplayCode]||'상태 분류 필요';}
function verificationHelp(group){return VERIFICATION_GROUPS.find(([label])=>label===group)?.[1]||'';}
function normalizeHistorySearch(value){return String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,'');}
function matchesHistorySearch(e,query){
 if(!query)return true;
 const compact=String(query).trim().replace(/[.\/\-\s]/g,'');
 if(/^\d{6}$|^\d{8}$/.test(compact)){
   const long=compact.length===6?`${Number(compact.slice(0,2))<=29?'20':'19'}${compact}`:compact;
   const year=Number(long.slice(0,4)),month=Number(long.slice(4,6)),day=Number(long.slice(6));
   if(validDay(year,month,day)){const date=`${year}-${pad2(month)}-${pad2(day)}`;return e.precision==='day'&&(e.date===date||(e.conflictingDates||[]).includes(date));}
 }
 return normalizeHistorySearch([e.title,e.date,e.category,e.subject,e.sourceNote,e.verification,verificationGroup(e)].join(' ')).includes(normalizeHistorySearch(query));
}
function selectRows(){
 const year=$('#year').value,category=$('#category').value,subject=$('#subject').value,verification=$('#verification').value,q=$('#search').value.trim();
 filtered=events.filter(e=>(!activeChapter||e.chapter===activeChapter)&&(!explicitDate||e.date===explicitDate||(e.conflictingDates||[]).includes(explicitDate))&&(!year||e.date.startsWith(year))&&(!category||e.category===category)&&(!subject||(subject==='new'?isNewEvent(e):normalizeSubject(e.subject)===subject))&&(!verification||verificationGroup(e)===verification)&&(!$('#withVideos').checked||hasEventVideo(e))&&matchesHistorySearch(e,q));
}
function chronologicalKey(e){
  const year=e.date.slice(0,4);
  if(e.precision==='year')return `${year}-13-00`;
  if(e.precision==='month')return `${e.date.slice(0,7)}-32`;
  return e.date;
}
function headingKey(e){return e.precision==='year'?`${e.date.slice(0,4)}-unknown`:e.date.slice(0,7);}
function monthHeading(e,previous) {
 const key=headingKey(e);
 if(key===previous)return '';
 return e.precision==='year'
  ? `<h2 class="month-title" data-year="${safe(e.date.slice(0,4))}">${safe(e.date.slice(0,4))}년 · 월·일 미상</h2>`
  : `<h2 class="month-title" data-year="${safe(e.date.slice(0,4))}">${safe(key.slice(0,4))}년 ${safe(Number(key.slice(5)))}월</h2>`;
}
// A full broadcast that covers the same performance makes the same uploader's
// isolated clip unnecessary in the event's link panel. These pairs are curated
// from same-date, same-episode VIDEOTANK references; do not apply this preference
// to other channels, different programmes, or different songs within a show.
// The source records remain intact for research and provenance.
const FULL_BROADCAST_FOR_CLIP = new Map([
 ['vs2BwOC90Zk','dMp1aL73mZU'], // 1998-03-28, Music Tank 144
 ['AgngNp44RwY','oCHBNqhYTAk'], // 1998-08-15, Music Tank 164 pt 2
 ['eh6wymwCGJ8','wBVlvLNmNW0'], // 1998-07-11, Music Tank 159
 ['A9IswxiKjzA','fheX_QasEUs'], // 1998-06-24, Music Tank 157
 ['IUreidEJYjE','fheX_QasEUs'], // 1998-06-24, Music Tank 157
 ['HovHrNgA5AE','Tagc1NhsrfM'], // 1999-07-24, Music Tank 213
 ['bgY_V5peyTY','7xV1cXOrsRs'], // 1999-05-22, Music Tank 204
 ['1s1RI3OklBk','QsVSDQcXrC0'], // 1999-08-27, Music Tank 218
 ['7JXKxji5neg','DwrkmJQjH2E'], // 2001-07-13, Music Tank 316 pt 1
 ['6Dj-v-BoWkA','DwrkmJQjH2E'], // 2001-07-13, Music Tank 316 pt 1
 ['3Rs1GFV8EGM','X_vFQf50gQs'], // 2001-12-19, KMTV music awards
 ['jJdhyIkzERM','EA-a8QabNeE']  // 2001-11-23, Mnet MMF pt 1-2
]);

function youtubeVideoId(url){
 try{
  const parsed=new URL(String(url||''));
  if(parsed.protocol!=='https:')return '';
  const host=parsed.hostname.toLowerCase();
  let id='';
  if(host==='youtube.com'||host==='www.youtube.com'||host==='m.youtube.com'){
   if(parsed.pathname==='/watch')id=parsed.searchParams.get('v')||'';
   else id=parsed.pathname.match(/^\/(?:shorts|live)\/([\w-]{11})(?:\/|$)/)?.[1]||'';
  }else if(host==='youtu.be'||host==='www.youtu.be'){
   id=parsed.pathname.match(/^\/([\w-]{11})(?:\/|$)/)?.[1]||'';
  }
  return /^[\w-]{11}$/.test(id)?id:'';
 }catch{return '';}
}

function hasEventVideo(e){
 const urls=[e.verificationUrl,...(e.verificationUrls||[]),e.sourceUrl,...(e.sourceUrls||[]),e.referenceVideoUrl,...(e.referenceVideoUrls||[])];
 for(const id of e.sourceRefs||[])urls.push(researchSources.get(id)?.url);
 for(const video of e.fanVideoSources||[])urls.push(video?.url);
 return !!e.relatedVideos?.length||urls.some(url=>isSafeUrl(url)&&youtubeVideoId(url));
}
function redundantSourceClips(e){
 const ids=new Set();
 const urls=[e.verificationUrl,...(e.verificationUrls||[]),e.sourceUrl,...(e.sourceUrls||[]),e.referenceVideoUrl,...(e.referenceVideoUrls||[])];
 for(const key of e.sourceRefs||[]){const source=researchSources.get(key);if(source)urls.push(source.url);}
 for(const v of e.fanVideoSources||[])urls.push(v?.url);
 for(const url of urls){const id=youtubeVideoId(url);if(id)ids.add(id);}
 const redundant=new Set();
 for(const [clip,full] of FULL_BROADCAST_FOR_CLIP){
  if(ids.has(clip)&&ids.has(full))redundant.add(clip);
 }
 // Also handle links explicitly marked Shorts, only when that exact clip's
 // event+uploader pair is documented above. Avoid inferring sameness by date alone.
 return redundant;
}

function normalizeArchiveVideoContext(video){
 // Source string identifies one scene/programme; different source strings must
 // not be treated as the same broadcast even when the date matches.
 return String(video?.source||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
}
function normalizedVideoTitle(video){
 return String(video?.title||'').normalize('NFKC').toLowerCase()
  .replace(/(?:#?shorts|쇼츠|short\s*(?:ver(?:sion)?|clip)?|풀버전|full\s*(?:ver(?:sion)?|video)?|하이라이트|highlight)/gi,'')
  .replace(/[^a-z0-9가-힣一-龥]+/g,' ').replace(/\s+/g,' ').trim();
}
function filteredArchiveCandidates(e){
 const candidates=Array.isArray(e.relatedVideos)?e.relatedVideos.filter(r=>r.reviewStatus==='candidate' &&
   Number(r.score)>=0.70 && videoById.has(String(r.videoId)) && r.reason && r.kind):[];
 const standard=candidates.map(r=>videoById.get(String(r.videoId)))
   .filter(v=>v?.videoFormat!=='shorts');
 return candidates.filter(r=>{
  const v=videoById.get(String(r.videoId));
  if(v?.videoFormat!=='shorts')return true;
  const context=normalizeArchiveVideoContext(v),title=normalizedVideoTitle(v);
  if(!context||!title)return true;
  return !standard.some(full=>normalizeArchiveVideoContext(full)===context &&
    normalizedVideoTitle(full)===title);
 });
}

// Apply the same mobile YouTube-link navigation as the video archive. Preserve
// the original timestamp, especially links to a performance within a full show.
function openHistoryYoutubeVideo(event,anchor){
 const videoId=youtubeVideoId(anchor.href);
 if(!videoId)return;
 const ua=navigator.userAgent||'';
 const android=/Android/i.test(ua),ios=/iPhone|iPad|iPod/i.test(ua);
 if(!android&&!ios)return; // desktop: normal target=_blank link
 event.preventDefault();
 const webUrl=anchor.href;
 if(android){
  const parsed=new URL(webUrl);
  const isShorts=/^\/shorts\//.test(parsed.pathname);
  let path=isShorts?`www.youtube.com/shorts/${encodeURIComponent(videoId)}`:
    `www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  // watch/start-position URLs are deliberately kept as long-form URLs.
  if(!isShorts){
   const t=parsed.searchParams.get('t')||parsed.searchParams.get('start');
   if(t)path+=`&t=${encodeURIComponent(t)}`;
  }
  window.location.href=`intent://${path}#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
  return;
 }
 // iOS Universal Links: the OS chooses YouTube app where eligible; otherwise
 // it opens the HTTPS URL. Do not falsely claim an app launch is guaranteed.
 window.location.href=webUrl;
}

document.addEventListener('click',event=>{
 const anchor=event.target.closest?.('a[href]');
 if(anchor)openHistoryYoutubeVideo(event,anchor);
});

function recommendedLinks(e){
 return filteredArchiveCandidates(e).slice(0,8).map(r=>{
     const video=videoById.get(String(r.videoId));
     const url=ytUrl(video);
     if(!isSafeUrl(url))return '';
     const percent=Math.round(Number(r.score)*100);
     const archiveTag=r.archiveMapped?' [아카이브 날짜·활동명 연결 · 장면 검증 전]':'';
     const caution=r.reason.includes('편집영상')?' [편집영상 · 장면 확인 필요]':(r.dateGapDays||r.reason.includes('회차 표기 불일치')||r.reason.includes('아카이브 날짜 미확인'))?' [날짜·회차 확인 필요]':'';
     return `<a class="candidate" href="${safe(url)}" target="_blank" rel="noopener noreferrer" title="${safe(r.reason)} · 영상 설명이 실제 방송일을 독립 증명하는 것은 아님">▶ ${safe(video.title||'관련 영상')}${archiveTag||safe(caution)} <small>${r.archiveMapped?'보유 아카이브':`연관도 ${percent}점`}</small></a>`;
   }).filter(Boolean);
}
function fmt(e){
 if(e.precision==='month')return `${e.date.slice(5,7)}월`;
 if(e.precision==='year')return '월·일 미상';
 return e.date.slice(5).replace('-','.');
}
function sourceWidget(e){
 const ordered=[];const seen=new Set();
 const redundant=redundantSourceClips(e);
 const youtubeId=youtubeVideoId;
 const fanVideos=Array.isArray(e.fanVideoSources)?e.fanVideoSources:[];
 const fanById=new Map(fanVideos.filter(v=>v&&youtubeId(v.url)).map(v=>[youtubeId(v.url),v]));
 const add=(label,url,kind,note)=>{
   if(!isSafeUrl(url)||seen.has(url))return;
   const id=youtubeId(url);
   if(id&&redundant.has(id))return;
   if(id){
     const timestamp=value=>{const u=new URL(value);return u.searchParams.get('t')||u.searchParams.get('start')||u.hash.match(/^#t=(.+)$/)?.[1]||'';};
     const time=timestamp(url);
     const existing=ordered.filter(r=>youtubeId(r.url)===id);
     if(existing.some(r=>timestamp(r.url)===time)||(!time&&existing.length))return;
     // Prefer a stage timestamp over an un-timed link; retain distinct stage timestamps.
     if(time)for(let i=ordered.length-1;i>=0;i--)if(youtubeId(ordered[i].url)===id&&!timestamp(ordered[i].url))ordered.splice(i,1);
   }
   // Existing video references are kept once, now with their correct channel attribution.
   const fan=id?fanById.get(id):null;
   if(fan){label=`셩공시대님 — ${fan.title}`;kind='관련 영상 · 팬채널 참고';note=fan.note;}
   seen.add(url);
   ordered.push({label,url,kind,note});
 };
 if(e.verificationUrl){const src=[...researchSources.values()].find(x=>x.url===e.verificationUrl);add(src?`${src.publisher||'출처'} — ${src.title}`:'연결된 확인 자료',e.verificationUrl,src?.kind||'확인 자료',src?.note||'이 자료가 확인하는 범위는 위의 상세 판정을 참고하세요.');}
 for(const url of e.verificationUrls||[])add('통합된 기록의 확인 자료',url,'확인 자료','통합 전 기록에 연결되어 있던 자료입니다.');
 for(const key of e.sourceRefs||[]){
   const r=researchSources.get(key);if(r)add(`${r.publisher||'출처'} — ${r.title}`,r.url,r.kind,r.note);
 }
 for(const url of [...(e.sourceUrls||[]),e.sourceUrl].filter(Boolean))add(url.includes('docs.google.com/spreadsheets')?'원본 시트의 해당 행':'기록 원문',url,'원자료','기존 기록의 출처입니다. 별도 확인 여부는 상세 판정을 참고하세요.');
 for(const url of [...(e.referenceVideoUrls||[]),e.referenceVideoUrl].filter(Boolean)){
   // Reference videos must be playable on YouTube, not old V LIVE or arbitrary extinct platforms.
   if(/^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(url))add('원본에 기재된 유튜브 영상',url,'원본 영상','기존 기록에 연결된 영상입니다. 실제 방송·촬영일은 별도 확인이 필요할 수 있습니다.');
 }
 for(const video of fanVideos){
   if(!video||typeof video.url!=='string'||typeof video.title!=='string')continue;
   if(youtubeId(video.url))add(`셩공시대님 — ${video.title}`,video.url,'관련 영상 · 팬채널 참고',video.note||'팬채널 참고 영상입니다. 영상 제목의 날짜와 실제 방송·공연일은 다를 수 있습니다.');
 }
 const status=verificationGroup(e);
 const originalStatus=String(e.verification||'판정 미기재');
 const note=String(e.sourceNote||'');
 const provenance=(e.allSources||[e.source||'출처 미기재']).join(' · ');
 const categoryOrigin=e.categoryOriginal?`<p>활동 분류: ${safe(e.categoryOriginal)} → ${safe(e.category)}</p>`:'';
 const rows=ordered.map(r=>`<li><span class="source-kind">${safe(r.kind)}</span> <a href="${safe(r.url)}" target="_blank" rel="noopener noreferrer">${safe(r.label)} ↗</a>${r.note?`<small>${safe(r.note)}</small>`:''}</li>`).join('');
 const mediaRecords=Array.isArray(e.mergedSourceRecords)?e.mergedSourceRecords:[];
 const originalList=mediaRecords.length>1
  ? `<h4 class="source-merged-title">통합 전 개별 방송·행사 기록 (${mediaRecords.length}건)</h4><ol class="source-merged-list">${mediaRecords.map(r=>`<li><strong>${safe(r.title||'제목 미기재')}</strong><small>${safe(r.date||'날짜 미상')} · ${safe(r.source||'출처 미기재')} · ${safe(r.verification||'검증 상태 미기재')}</small>${r.sourceNote?`<small>${safe(String(r.sourceNote))}</small>`:''}</li>`).join('')}</ol>`
  : '';
 const entries=rows?`<ul>${rows}</ul>`:'<p class="source-unlinked">연결된 근거 링크가 없습니다. 출처 확보가 필요합니다.</p>';
 return `<span class="source-widget"><button type="button" class="source-trigger" aria-label="${safe(e.date)} ${safe(e.title)} 근거 보기" aria-expanded="false" title="근거와 확인 범위 보기">ⓘ</button><span class="source-panel" role="group" aria-label="출처 정보"><strong>근거와 확인 범위</strong><span class="source-status">${safe(status)}</span><p class="verification-help">${safe(verificationHelp(status))}</p><h4 class="source-section-title">기존 상세 판정</h4><p>${safe(originalStatus)}</p>${note?`<p>${safe(note)}</p>`:''}<h4 class="source-section-title">날짜와 기록 출처</h4><p>기록일: ${safe(e.date)} · ${safe(e.dateKind||'날짜 종류 미확인')}</p><p>출처: ${safe(provenance)}</p>${categoryOrigin}${originalList}<h4 class="source-section-title">연결 자료</h4>${entries}</span></span>`;
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
      float.innerHTML=`<div class="source-float-toolbar"><span>근거와 확인 범위</span><button type="button" class="source-close" aria-label="근거 팝업 닫기">×</button></div><div class="source-float-content">${content}</div>`;
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
  const status=verificationGroup(e);
  const newBadge=isNewEvent(e)?'<span class="history-new-badge" aria-label="최근 24시간 이내 등록된 연혁">NEW</span>':'';
  return `<article class="item" id="event-${safe(e.id)}"><div class="date" title="${safe(e.date)} · ${safe(e.dateKind||'')}">${safe(fmt(e))}</div><div class="item-main"><div class="name">${safe(e.title)}${newBadge}</div><div class="meta"><span class="tag">${safe(e.category)}</span><span class="tag">${safe(e.subject==='신화 전체'?'신화 전체':e.subject==='신혜성 개인'?'신혜성':e.subject==='신혜성 포함 합동'?'신혜성 참여':e.subject)}</span><span class="verification-label ${status==='날짜 충돌'?'conflict':status==='독립검증 완료'?'confirmed':'unconfirmed'}" title="${safe(e.verification)}">${status==='날짜 충돌'?'⚠':'◌'} ${safe(status)}</span>${e.precision!=='day'?'<span class="inexact">일자 미상</span>':''}${e.recordCount>1?`<span class="tag" title="${safe(e.recordCount)}개 원본 기록 통합">원본 ${e.recordCount}건 통합</span>`:(e.possibleDuplicate?'<span class="inexact">중복 검토 필요</span>':'')}${e.transition?`<span class="tag">${safe(e.transition)}</span>`:''}${links.length?`<span class="video" title="규칙 기반 70점 이상 · 동일 행사 확정 아님">▶ 추천 ${links.length}개</span>`:''}${sourceWidget(e)}</div>${officialLiveListLink}${conflictHtml}${detailHtml}${e.verification==='날짜 충돌'?`<div class="detail-note">${safe(desc)}</div>`:''}${linkHtml}</div></article>`;
}
function renderItems(){
  $('#events').hidden=false;$('#calendar').hidden=true;
  const to=filtered.slice(0,visibleCount),last=to.length;
  $('#summary').textContent=`전체 ${events.length.toLocaleString('ko-KR')}건 · 조건에 맞는 ${filtered.length.toLocaleString('ko-KR')}건 · 현재 ${last.toLocaleString('ko-KR')}건 표시 · 일부 자료는 날짜·내용 검증 전`;
  if(!last){updateReadingYear();$('#events').innerHTML='<p class="empty">조건에 맞는 일정이 없습니다.</p>';$('#loadMore').hidden=true;persistHistoryView();return;}
  let prev='';
  $('#events').innerHTML=to.map(e=>{
    const header=monthHeading(e,prev);prev=headingKey(e);
    return header+eventMarkup(e);
  }).join('');
  $('#loadMore').hidden=filtered.length<=last;
  updateReadingYear();
  persistHistoryView();
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
  if(highlightEvent){const record=events.find(e=>e.id===highlightEvent);if(record)return record.precision==='year'?`${record.date.slice(0,4)}-12`:record.date.slice(0,7);}
  if(filtered.length){const last=filtered[filtered.length-1];return last.precision==='year'?`${last.date.slice(0,4)}-12`:last.date.slice(0,7);}
  return calendarRange()[1];
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
  const monthEvents=filtered.filter(e=>e.date.slice(0,7)===calendarMonth&&e.precision!=='year');
  const yearUnknownEvents=m===12?filtered.filter(e=>e.precision==='year'&&e.date.slice(0,4)===String(y)):[];
  const exactEvents=monthEvents.filter(e=>e.precision==='day');
  const unknownEvents=monthEvents.filter(e=>e.precision!=='day');
  const dateUnknownEvents=[...unknownEvents,...yearUnknownEvents];
  const unknownKey=`${calendarMonth}-unknown`;
  const grouped=new Map();
  for(const e of exactEvents){const day=Number(e.date.slice(8));if(!grouped.has(day))grouped.set(day,[]);grouped.get(day).push(e);}
  if(!selectedCalendarDate||!selectedCalendarDate.startsWith(`${calendarMonth}-`)){
    const linked=filtered.find(e=>e.id===highlightEvent);
    const linkedDay=explicitDate&&explicitDate.startsWith(calendarMonth+'-')?explicitDate:(linked&&linked.date.startsWith(calendarMonth+'-')?(linked.precision==='day'?linked.date:unknownKey):(linked?.precision==='year'&&calendarMonth===linked.date.slice(0,4)+'-12'?unknownKey:''));
    const d=[...grouped.keys()].sort((a,b)=>a-b).pop();
    selectedCalendarDate=linkedDay|| (d?`${calendarMonth}-${pad2(d)}`:(dateUnknownEvents.length?unknownKey:''));
  }
  const [startMonth,endMonth]=calendarRange();
  const cells=[];
  for(let i=0;i<firstDay;i++)cells.push('<div class="cal-blank" aria-hidden="true"></div>');
  for(let d=1;d<=daysInMonth;d++){
    const dayDate=`${calendarMonth}-${pad2(d)}`,items=grouped.get(d)||[];
    const hasVideo=items.some(hasEventVideo);
    const isSelected=selectedCalendarDate===dayDate;
    const note=items.length?`${items.length}건의 일정${hasVideo?', 관련 영상 있음':''}`:'등록 일정 없음';
    cells.push(`<button type="button" class="cal-day${items.length?' has-events':''}${isSelected?' is-selected':''}" data-date="${dayDate}" aria-label="${y}년 ${m}월 ${d}일, ${note}" aria-pressed="${isSelected}"><span class="cal-day-number">${d}</span>${items.length?`<span class="cal-day-count">${items.length}건</span>`:''}${hasVideo?'<span class="cal-video-dot" title="관련 영상 있음" aria-hidden="true"></span>':''}</button>`);
  }
  // The undated tile is always appended immediately after the final numbered day.
  const unknownSelected=selectedCalendarDate===unknownKey;
  const hasUnknownVideo=dateUnknownEvents.some(hasEventVideo);
  cells.push(`<button type="button" class="cal-day cal-day-unknown${dateUnknownEvents.length?' has-events':''}${unknownSelected?' is-selected':''}" data-date="${unknownKey}" aria-label="${y}년 ${m}월 날짜 미상, ${dateUnknownEvents.length}건" aria-pressed="${unknownSelected}"><span class="cal-day-number">날짜 미상</span><span class="cal-day-count">${dateUnknownEvents.length}건</span>${hasUnknownVideo?'<span class="cal-video-dot" title="관련 영상 있음" aria-hidden="true"></span>':''}</button>`);
  const selected=unknownSelected?dateUnknownEvents:(selectedCalendarDate?grouped.get(Number(selectedCalendarDate.slice(8)))||[]:[]);
  const selectedLabel=unknownSelected?`${y}년 ${m}월 날짜 미상${m===12&&yearUnknownEvents.length?' (연도만 확인된 기록 포함)':''}`:(selectedCalendarDate?`${y}년 ${m}월 ${Number(selectedCalendarDate.slice(8))}일`:`${y}년 ${m}월`);
  const details=selected.length?selected.map(eventMarkup).join(''):'<p class="cal-no-day">이 칸에 해당하는 활동 기록이 없습니다.</p>';
  $('#summary').textContent=`전체 ${events.length.toLocaleString('ko-KR')}건 · 조건에 맞는 ${filtered.length.toLocaleString('ko-KR')}건 · ${y}년 ${m}월 ${monthEvents.length+yearUnknownEvents.length}건 · 일부 날짜·내용 검증 전`;
  const yearOptions=Array.from({length:Number(endMonth.slice(0,4))-Number(startMonth.slice(0,4))+1},(_,i)=>Number(startMonth.slice(0,4))+i).map(yr=>`<option value="${yr}" ${yr===y?'selected':''}>${yr}년</option>`).join('');
  const monthOptions=Array.from({length:12},(_,i)=>i+1).map(mo=>`<option value="${pad2(mo)}" ${mo===m?'selected':''}>${mo}월</option>`).join('');
  $('#calendar').innerHTML=`<div class="cal-controls"><button class="cal-nav" id="calPrev" type="button" aria-label="이전 달" ${calendarMonth<=startMonth?'disabled':''}>‹</button><div class="cal-month-select"><select id="calYear" aria-label="달력 연도 선택">${yearOptions}</select><select id="calMonth" aria-label="달력 월 선택">${monthOptions}</select></div><button class="cal-nav" id="calNext" type="button" aria-label="다음 달" ${calendarMonth>=endMonth?'disabled':''}>›</button></div><div class="cal-weekdays" aria-hidden="true">${['일','월','화','수','목','금','토'].map(t=>`<span>${t}</span>`).join('')}</div><div class="cal-days">${cells.join('')}</div><p class="cal-hint">날짜별 일정 수를 표시합니다. 파란 점은 관련 유튜브 영상이 있는 날짜입니다. 날짜 미상 칸은 실제 특정 일자에 배정되지 않은 기록을 보여줍니다. 연도만 확인된 항목은 12월의 날짜 미상 칸에서 찾을 수 있습니다.</p><section class="cal-detail" aria-live="polite"><h2 class="cal-detail-title">${selectedLabel} · ${selected.length}건</h2>${details}</section>`;
  $('#calPrev').addEventListener('click',()=>setCalendarMonth(shiftCalendarMonth(calendarMonth,-1)));
  $('#calNext').addEventListener('click',()=>setCalendarMonth(shiftCalendarMonth(calendarMonth,1)));
  const selectCalendarMonth=()=>setCalendarMonth(`${$('#calYear').value}-${$('#calMonth').value}`);
  $('#calYear').addEventListener('change',selectCalendarMonth);
  $('#calMonth').addEventListener('change',selectCalendarMonth);
  for(const btn of $('#calendar').querySelectorAll('[data-date]'))btn.addEventListener('click',()=>{selectedCalendarDate=btn.dataset.date;renderCalendar();$('#calendar').querySelector(`[data-date=\"${selectedCalendarDate}\"]`)?.focus({preventScroll:true});});
  if(highlightEvent)document.getElementById('event-'+highlightEvent)?.classList.add('focused-event');
  persistHistoryView();
}
function renderPage(){document.dispatchEvent(new Event('history-view-change'));if(viewMode==='calendar')renderCalendar();else renderItems();updateReadingYear();}
function changeView(next){
  if(next!=='list'&&next!=='calendar')return;
  viewMode=next;
  $('#listView').classList.toggle('is-active',next==='list');$('#calendarView').classList.toggle('is-active',next==='calendar');
  $('#listView').setAttribute('aria-pressed',String(next==='list'));$('#calendarView').setAttribute('aria-pressed',String(next==='calendar'));
  renderPage();
}
function resetAndRender(){visibleCount=pageSize;selectRows();if(highlightEvent){const at=filtered.findIndex(e=>e.id===highlightEvent);if(at>=visibleCount)visibleCount=Math.ceil((at+1)/pageSize)*pageSize;}renderPage();}
async function requestHistoryJSON(url,timeout=6000){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{const response=await fetch(url,{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error(`HTTP ${response.status}`);return await response.json();}finally{clearTimeout(timer);}
}
function setVideoLoadMessage(failed){
 const status=$('#videoLoadStatus');status.hidden=!failed;
 if(failed)status.innerHTML='영상 추천을 불러오지 못했습니다. 연혁과 기존 근거 링크는 볼 수 있습니다. '+'<button type="button" id="retryVideos">영상 추천 다시 불러오기</button>';
 $('#retryVideos')?.addEventListener('click',()=>loadOptionalVideos());
}
async function loadOptionalVideos(){
 const button=$('#retryVideos');if(button)button.disabled=true;
 try{
  const data=await requestHistoryJSON('./data/videos.json');
  if(!Array.isArray(data.videos))throw new Error('영상 자료 형식 오류');
  videoById.clear();for(const video of data.videos){const id=String(video.id||'');if(/^[A-Za-z0-9_-]{11}$/.test(id))videoById.set(id,video);}
  generateRuntimeRecommendations(data.videos);setVideoLoadMessage(false);
  if(historyReady)refreshHistoryInPlace();
 }catch{setVideoLoadMessage(true);}
}
function saveHistoryScroll(){
 if(historyReady)history.replaceState({...history.state,historyView:true,scrollY:window.scrollY},'',location.href);
}
function persistHistoryView(replace=false){
 if(!historyReady||restoringHistory)return;
 const url=new URL(location.href),values={chapter:activeChapter||'all',year:$('#year').value,category:$('#category').value,subject:$('#subject').value,verification:$('#verification').value,q:$('#search').value,video:$('#withVideos').checked?'1':'',view:viewMode==='calendar'?'calendar':'',month:viewMode==='calendar'?calendarMonth:'',day:viewMode==='calendar'?selectedCalendarDate:'',limit:visibleCount>pageSize?String(visibleCount):'',event:highlightEvent,date:explicitDate};
 for(const [key,value]of Object.entries(values)){if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);}
 const state={...history.state,historyView:true,scrollY:window.scrollY};
 if(url.href===location.href||replace)history.replaceState(state,'',url);else history.pushState(state,'',url);
}
function restoreHistoryView(scroll=false){
 restoringHistory=true;clearTimeout(searchTimer);
 const query=new URLSearchParams(location.search);
 explicitDate=DAY.test(query.get('date')||'')?query.get('date'):'';
 highlightEvent=eventAliases[query.get('event')||'']||query.get('event')||'';
 const linked=events.find(e=>e.id===highlightEvent)||events.find(e=>e.date===explicitDate);
 const chapter=query.get('chapter');activeChapter=chapter==='all'?'':chapters.some(c=>c.id===chapter)?chapter:(linked?.chapter||'chapter1');
 for(const id of ['year','category','subject','verification','search']){
  const value=query.get(id==='search'?'q':id)||'';
  if(id==='search')$('#'+id).value=value;else if(id!=='year')$('#'+id).value=[...$('#'+id).options].some(o=>o.value===value)?value:'';
 }
 $('#withVideos').checked=query.get('video')==='1';
 const savedCount=Number(query.get('limit'));visibleCount=Number.isFinite(savedCount)&&savedCount>=pageSize?Math.min(Math.floor(savedCount),events.length):pageSize;
 applyChapter(false);
 const year=query.get('year')||'';$('#year').value=[...$('#year').options].some(o=>o.value===year)?year:'';
 viewMode=query.get('view')==='calendar'?'calendar':'list';calendarMonth=/^\d{4}-(0[1-9]|1[0-2])$/.test(query.get('month')||'')?query.get('month'):'';
 const day=query.get('day')||'';selectedCalendarDate=/^\d{4}-\d{2}-(?:\d{2}|unknown)$/.test(day)?day:'';
 selectRows();if(highlightEvent){const index=filtered.findIndex(e=>e.id===highlightEvent);if(index>=visibleCount)visibleCount=Math.ceil((index+1)/pageSize)*pageSize;}
 changeView(viewMode);
 $('.date-filter-hint').hidden=!(explicitDate||highlightEvent);
 $('.date-filter-hint span').textContent=explicitDate?`${explicitDate} 날짜로 필터 중`:'연결된 일정 표시 중';
 restoringHistory=false;
 if(scroll){const y=history.state?.historyView?history.state.scrollY:0;requestAnimationFrame(()=>window.scrollTo(0,y||0));}
}
function refreshHistoryInPlace(){
 const y=window.scrollY;restoringHistory=true;
 selectRows();renderPage();restoringHistory=false;persistHistoryView(true);
 window.scrollTo(0,y);
}
function setupHistoryNavigation(){
 if('scrollRestoration'in history)history.scrollRestoration='manual';
 let scrollTimer;window.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(saveHistoryScroll,100);},{passive:true});
 window.addEventListener('pagehide',saveHistoryScroll);
 window.addEventListener('popstate',()=>restoreHistoryView(true));
}
async function init(){
 try{
  const hd=await requestHistoryJSON('./data/history.json');
  if(!Array.isArray(hd.events)||!Array.isArray(hd.chapters))throw new Error('연혁 자료 형식 오류');
  events=hd.events;chapters=hd.chapters;eventAliases=hd.metadata?.legacyEventAliases||{};researchSources=new Map((hd.researchSources||[]).map(s=>[s.id,s]));
  events.sort((a,b)=>chronologicalKey(a).localeCompare(chronologicalKey(b))||String(a.id).localeCompare(String(b.id)));
  for(const c of [...new Set(events.map(e=>e.category))].sort()) $('#category').add(new Option(c,c));
  for(const [label] of VERIFICATION_GROUPS){const count=events.filter(e=>verificationGroup(e)===label).length;if(count)$('#verification').add(new Option(`${label} (전체 ${count.toLocaleString('ko-KR')}건)`,label));}
  const guide=$('#researchGuide');if(guide)guide.innerHTML=researchWidget();enableSourceWidgets();
  buildChapterButtons();restoreHistoryView();setupChapterDisclosure();
  if(!reducedHistoryMotion()){
    $('#events').classList.add('history-enter');
    window.setTimeout(()=>$('#events').classList.remove('history-enter'),750);
  }
  refreshNewBadgeExpiry();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshHistoryInPlace();refreshNewBadgeExpiry();}});
  const filtersChanged=()=>{calendarMonth='';selectedCalendarDate='';resetAndRender();};
  $('#withVideos').addEventListener('change',filtersChanged);
  $('#resetFilters').addEventListener('click',()=>{
    clearTimeout(searchTimer);saveHistoryScroll();explicitDate='';highlightEvent='';activeChapter='';calendarMonth='';selectedCalendarDate='';
    for(const id of ['year','category','subject','verification','search'])$('#'+id).value='';
    $('#withVideos').checked=false;$('.date-filter-hint').hidden=true;applyChapter();
  });
  $('#subject').addEventListener('change',()=>{
    if($('#subject').value==='new'){
      activeChapter='';
      changeView('list');
      applyChapter();
    }else filtersChanged();
  });
  for(const key of ['year','category','verification']) $('#'+key).addEventListener('change',()=>{saveHistoryScroll();filtersChanged();});
  $('#search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{saveHistoryScroll();filtersChanged();},200);});
  $('#year').addEventListener('change',()=>{
    const target=viewMode==='calendar'?$('#calendar'):$('#events').querySelector('.month-title');
    if(!target)return;
    target.scrollIntoView({block:'start',behavior:reducedHistoryMotion()?'auto':'smooth'});
    target.classList.remove('history-arrival');
    void target.offsetWidth;
    target.classList.add('history-arrival');
  });
  $('#allChapters').addEventListener('click',()=>{activeChapter='';calendarMonth='';selectedCalendarDate='';$('#year').value='';applyChapter();});
  $('#listView').addEventListener('click',()=>changeView('list'));
  $('#calendarView').addEventListener('click',()=>changeView('calendar'));
  $('#loadMore').addEventListener('click',()=>{visibleCount+=pageSize;renderItems();});
  historyReady=true;setupHistoryNavigation();
  const restoreScroll=history.state?.historyView?history.state.scrollY:null;
  persistHistoryView(true);
  if(restoreScroll!==null&&restoreScroll!==undefined)requestAnimationFrame(()=>window.scrollTo(0,restoreScroll));
  else if(highlightEvent)document.getElementById('event-'+highlightEvent)?.scrollIntoView({block:'center'});
  loadOptionalVideos();
 }catch(err){$('#events').innerHTML=`<p class="empty">활동 연표를 불러오지 못했습니다. ${safe(err.message)}</p><button type="button" id="retryHistory">연혁 다시 불러오기</button>`;$('#retryHistory').addEventListener('click',()=>location.reload());}finally{$('#events').setAttribute('aria-busy','false');}
}
function refreshNewBadgeExpiry(){
 clearTimeout(expiryTimer);
 const now=Date.now();
 const expires=events.map(e=>Date.parse(String(e.registeredAt||''))+NEW_WINDOW_MS)
   .filter(t=>Number.isFinite(t)&&t>now).sort((a,b)=>a-b);
 if(!expires.length)return;
 // one-shot scheduled refresh, then re-arm for any later batch
 expiryTimer=window.setTimeout(()=>{refreshHistoryInPlace();refreshNewBadgeExpiry();},Math.max(1,Math.min(expires[0]-now+30,2147483647)));
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
function setupChapterDisclosure(){
 const toggle=$('#chapterToggle'),grid=$('#chapters'),mobile=window.matchMedia('(max-width:550px)');
 const setOpen=open=>{grid.hidden=!open;toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'시기 선택 접기 ▴':'시기 선택 펼치기 ▾';};
 toggle.addEventListener('click',()=>setOpen(grid.hidden));
 const sync=()=>setOpen(!mobile.matches);
 mobile.addEventListener('change',sync);sync();
}
function reducedHistoryMotion(){return window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
function updateReadingYear(){
  const badge=$('#readingYear');
  if(!badge)return;
  const headings=viewMode==='list'?[...$('#events').querySelectorAll('.month-title')]:[];
  const boundary=100;
  let current=null;
  for(const heading of headings){if(heading.getBoundingClientRect().top<=boundary)current=heading;else break;}
  badge.hidden=!current||$('#events').hidden||!filtered.length;
  if(current)badge.textContent=`${current.dataset.year}년 · 활동 연표`;
}
function setupReadingYear(){
  let scheduled=false;
  const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;updateReadingYear();});};
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule,{passive:true});
}
setupBackToTop();
setupReadingYear();
init();
