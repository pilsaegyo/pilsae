"use strict";
// Public timeline. No browser writeback, no admin/API mutation. Only approved curated links can be called related videos.
const $ = selector => document.querySelector(selector);
const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const pad2 = x => String(x).padStart(2,'0');
const validDay = (y,m,d) => { const date=new Date(Date.UTC(y,m-1,d)); return date.getUTCFullYear()===y && date.getUTCMonth()===m-1 && date.getUTCDate()===d; };
const qs=new URLSearchParams(location.search);
let events=[],chapters=[],filtered=[],activeChapter='chapter1',pageSize=70,visibleCount=70,highlightEvent='',explicitDate='';
const dateVideoIndex=new Map();
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
function isSafeUrl(value){return /^https:\/\//i.test(String(value||''));}
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
 filtered=events.filter(e=>(!activeChapter||e.chapter===activeChapter)&&(!explicitDate||e.date===explicitDate)&&(!year||e.date.startsWith(year))&&(!category||e.category===category)&&(!subject||normalizeSubject(e.subject)===subject)&&(!verification||e.verification===verification)&&(!q||[e.title,e.date,e.category,e.subject,e.sourceNote].join(' ').toLocaleLowerCase().includes(q)));
}
function monthHeading(e,previous) {
 const month=e.date.slice(0,7);
 return month===previous?'':`<h2 class="month-title">${safe(month.slice(0,4))}년 ${safe(Number(month.slice(5)))}월</h2>`;
}
function approvedLinks(e) {
 if(!Array.isArray(e.relatedVideos)) return [];
 return e.relatedVideos.filter(r=>r.reviewStatus==='approved' && videoById.has(String(r.videoId)) && r.kind && r.reason).slice(0,8).map(r=>{
  const video=videoById.get(String(r.videoId));
  return `<a class="candidate" href="${safe(ytUrl(video))}" target="_blank" rel="noopener noreferrer" title="관리자 승인 연결 · ${safe(r.reason)}">▶ ${safe(video.title||'추천 영상')} <small>(${safe(r.kind)})</small></a>`;
 });
}
function videoCandidates(e){
 if(e.precision!=='day'||!DAY.test(e.date))return [];
 return dateVideoIndex.get(e.date)||[];
}
function fmt(e){
 if(e.precision==='month')return `${e.date.slice(5,7)}월`;
 if(e.precision==='year')return '연도만';
 return e.date.slice(5).replace('-','.');
}
function renderItems(){
 const to=filtered.slice(0,visibleCount),last=to.length;
 $('#summary').textContent=`전체 ${events.length.toLocaleString('ko-KR')}건 · 조건에 맞는 ${filtered.length.toLocaleString('ko-KR')}건 · 현재 ${last.toLocaleString('ko-KR')}건 표시 · 일부 자료는 날짜·내용 검증 전`;
 if(!last){$('#events').innerHTML='<p class="empty">조건에 맞는 일정이 없습니다.</p>';$('#loadMore').hidden=true;return;}
 let prev='';
 $('#events').innerHTML=to.map(e=>{
  const header=monthHeading(e,prev);prev=e.date.slice(0,7);
  const same=videoCandidates(e), approved=approvedLinks(e);
  const sameIds=new Set((e.relatedVideos||[]).filter(r=>r.reviewStatus==='approved').map(r=>String(r.videoId)));
  const candidates=same.filter(v=>!sameIds.has(String(v.id))).slice(0,6);
  const links=[...approved,...candidates.map(v=>`<a class="candidate" href="${safe(v.url)}" target="_blank" rel="noopener noreferrer" title="동일 날짜일 뿐 같은 행사인지 미확인">▷ ${safe(v.title)} <small>(${safe(v.origin)}, 미확인)</small></a>`)];
  const linkHtml=links.length?`<div class="candidates">${links.join('')}${same.length>candidates.length?`<span class="candidate-more">같은 날짜 후보 외 ${same.length-candidates.length}개</span>`:''}</div>`:'';
  const verifiedLink=isSafeUrl(e.verificationUrl)?`<a class="source-link" href="${safe(e.verificationUrl)}" target="_blank" rel="noopener noreferrer">검증 기사 ↗</a>`:'';
  const originalLink=isSafeUrl(e.sourceUrl)&&e.sourceUrl!==e.verificationUrl?`<a class="source-link" href="${safe(e.sourceUrl)}" target="_blank" rel="noopener noreferrer" title="원본 자료로, 독립적 사실 검증을 뜻하지 않습니다">원본 자료 ↗</a>`:'';
  const sourceVideo=isSafeUrl(e.referenceVideoUrl)?`<a class="source-link" href="${safe(e.referenceVideoUrl)}" target="_blank" rel="noopener noreferrer">원본에 기재된 영상 ↗</a>`:'';
  const desc=String(e.sourceNote||'').slice(0,380);
  return `${header}<article class="item" id="event-${safe(e.id)}"><div class="date" title="${safe(e.date)} · ${safe(e.dateKind||'')}">${safe(fmt(e))}</div><div class="item-main"><div class="name">${safe(e.title)}</div><div class="meta"><span class="tag">${safe(e.category)}</span><span class="tag">${safe(e.subject==='신화 전체'?'신화 전체':e.subject==='신혜성 개인'?'신혜성':e.subject==='신혜성 포함 합동'?'신혜성 참여':e.subject)}</span><span class="${e.verification==='날짜 충돌'?'conflict':e.verification.includes('검증 전')||e.verification==='원문 기록'?'unconfirmed':''}" title="${safe(desc||e.source||'')}">${e.verification==='날짜 충돌'?'⚠':'◌'} ${safe(e.verification)}</span>${e.precision!=='day'?'<span class="inexact">일자 미상</span>':''}${e.possibleDuplicate?'<span class="inexact">중복 후보</span>':''}${e.transition?`<span class="tag">${safe(e.transition)}</span>`:''}${same.length?`<span class="video" title="같은 날짜의 영상 후보 · 동일 행사 미확인">▷ 같은 날짜 영상 ${same.length}개</span>`:''}${approved.length?`<span class="video">▶ 승인된 관련 영상 ${approved.length}개</span>`:''}</div>${(verifiedLink||originalLink||sourceVideo)?`<div class="source-row">${verifiedLink}${originalLink}${sourceVideo}</div>`:''}${e.verification==='날짜 충돌'?`<div class="detail-note">${safe(desc)}</div>`:''}${linkHtml}</div></article>`;
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
  const hd=await h.json(),vd=await v.json();events=Array.isArray(hd.events)?hd.events:[];chapters=Array.isArray(hd.chapters)?hd.chapters:[];
  for(const video of vd.videos||[]){
   const id=String(video.id||'');if(id)videoById.set(id,video);
   for(const [date,origin] of selectedDates(video)){
    if(!dateVideoIndex.has(date))dateVideoIndex.set(date,[]);
    dateVideoIndex.get(date).push({id,title:video.title||'영상',url:ytUrl(video),origin});
   }
  }
  events.sort((a,b)=>a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id)));
  explicitDate=DAY.test(qs.get('date')||'')?qs.get('date'):'';
  highlightEvent=qs.get('event')||'';
  if(highlightEvent){const selected=events.find(e=>e.id===highlightEvent);if(selected){activeChapter=selected.chapter;}}
  else if(explicitDate){const record=events.find(e=>e.date===explicitDate);if(record)activeChapter=record.chapter;}
  for(const c of [...new Set(events.map(e=>e.category))].sort()) $('#category').add(new Option(c,c));
  for(const c of [...new Set(events.map(e=>e.verification))].sort()) $('#verification').add(new Option(c,c));
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
