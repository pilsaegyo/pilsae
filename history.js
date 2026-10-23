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
 filtered=events.filter(e=>(!activeChapter||e.chapter===activeChapter)&&(!explicitDate||e.date===explicitDate||(e.conflictingDates||[]).includes(explicitDate))&&(!year||e.date.startsWith(year))&&(!category||e.category===category)&&(!subject||normalizeSubject(e.subject)===subject)&&(!verification||e.verification===verification)&&(!q||[e.title,e.date,e.category,e.subject,e.sourceNote].join(' ').toLocaleLowerCase().includes(q)));
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
 if(e.verificationUrl)add('기사·공식 검증 출처',e.verificationUrl,'검증 자료','검증 상태와 이 링크가 뒷받침하는 사실을 함께 확인하세요.');
 for(const url of e.verificationUrls||[])add('병합된 기록의 검증 출처',url,'검증 자료','병합된 개별 원문을 뒷받침하는 링크입니다.');
 for(const key of e.sourceRefs||[]){
   const r=researchSources.get(key);if(r)add(r.title,r.url,r.kind,r.note);
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
 document.addEventListener('click',event=>{
   const button=event.target.closest?.('.source-trigger');
   const isWithin=event.target.closest?.('.source-widget');
   for(const w of document.querySelectorAll('.source-widget.is-open')){
     if(w!==isWithin){w.classList.remove('is-open');w.querySelector('.source-trigger')?.setAttribute('aria-expanded','false');}
   }
   if(button){const w=button.closest('.source-widget');const opened=w.classList.toggle('is-open');button.setAttribute('aria-expanded',String(opened));}
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape')for(const w of document.querySelectorAll('.source-widget.is-open')){w.classList.remove('is-open');w.querySelector('.source-trigger')?.setAttribute('aria-expanded','false');}});
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
  events.sort((a,b)=>a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id)));
  explicitDate=DAY.test(qs.get('date')||'')?qs.get('date'):'';
  highlightEvent=eventAliases[qs.get('event')||'']||qs.get('event')||'';
  if(highlightEvent){const selected=events.find(e=>e.id===highlightEvent);if(selected){activeChapter=selected.chapter;}}
  else if(explicitDate){const record=events.find(e=>e.date===explicitDate || (e.conflictingDates||[]).includes(explicitDate));if(record)activeChapter=record.chapter;}
  for(const c of [...new Set(events.map(e=>e.category))].sort()) $('#category').add(new Option(c,c));
  for(const c of [...new Set(events.map(e=>e.verification))].sort()) $('#verification').add(new Option(c,c));
  const guide=$('#researchGuide');if(guide)guide.innerHTML=researchWidget();enableSourceWidgets();
  buildChapterButtons();applyChapter();
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
