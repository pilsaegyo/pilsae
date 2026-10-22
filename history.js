"use strict";
const $ = sel => document.querySelector(sel);
const safe = text => String(text ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let events=[], videoIndex=new Map();
function hasExactDay(d){return /^\d{4}-\d{2}-\d{2}$/.test(String(d?.sourceDate||'')) && d?.precision !== 'year' && d?.precision !== 'month';}
function videoCandidates(event){
  const matches=videoIndex.get(event.date)||[];
  // Date-matched candidates only, never asserting the same event.
  return matches.slice(0,8);
}
function render(){
  const year=$('#year').value, category=$('#category').value, q=$('#search').value.trim().toLowerCase();
  const rows=events.filter(e=>(!year||e.date.startsWith(year))&&(!category||e.category===category)&&(!q||`${e.title} ${e.date} ${e.keywords.join(' ')}`.toLowerCase().includes(q))).sort((a,b)=>a.date.localeCompare(b.date));
  $('#summary').textContent=`활동 기록 ${rows.length}건 · 영상은 정확한 날짜가 일치할 때만 후보로 표시`;
  if(!rows.length){$('#events').innerHTML='<p class="empty">조건에 맞는 기록이 없습니다.</p>';return;}
  let previous='';
  $('#events').innerHTML=rows.map(e=>{
    const month=e.date.slice(0,7), head=month!==previous?`<h2 class="month-title">${safe(month.replace('-','년 '))}월</h2>`:'';previous=month;
    const vids=videoCandidates(e), link=`./?q=${encodeURIComponent(e.date)}&view=grid`;
    const candidates=vids.length?`<div class="candidates">${vids.map(v=>`<a class="candidate" href="${safe(v.url)}" target="_blank" rel="noopener noreferrer" title="같은 날짜의 영상 후보 · ${safe(v.title)}">▶ ${safe(v.title)}</a>`).join('')}</div>`:'';
    return `${head}<article class="item" id="event-${safe(e.id)}"><div class="date">${safe(e.date.slice(5).replace('-','.'))}</div><div class="item-main"><div class="name">${safe(e.title)}</div><div class="meta"><span class="tag">${safe(e.category)}</span><span title="${safe(e.source)}">◌ ${safe(e.verification)}</span>${vids.length?`<a class="video" href="${link}" title="일치 날짜 영상 보기">▶ 동일 날짜 영상 후보 ${vids.length}개</a>`:''}</div>${candidates}</div></article>`;
  }).join('');
}
async function init(){
 try{
   const [h,v]=await Promise.all([fetch('./data/history.json',{cache:'no-store'}),fetch('./data/videos.json',{cache:'no-store'})]);
   if(!h.ok||!v.ok) throw new Error('데이터를 가져오지 못했습니다.');
   const hd=await h.json(), vd=await v.json();events=hd.events||[];
   for(const video of vd.videos||[]){
     const dates=(video.dates||[]).filter(hasExactDay).map(d=>d.sourceDate);
     // Legacy videos without a curated date are not silently guessed from title or upload date.
     for(const date of new Set(dates)){
       if(!videoIndex.has(date))videoIndex.set(date,[]);
       videoIndex.get(date).push({title:video.title||'영상',url:video.url||`https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`});
     }
   }
   for(const y of [...new Set(events.map(e=>e.date.slice(0,4)))].sort())$('#year').add(new Option(y+'년',y));
   for(const c of [...new Set(events.map(e=>e.category))].sort())$('#category').add(new Option(c,c));
   for(const id of ['year','category','search'])$('#'+id).addEventListener(id==='search'?'input':'change',render);
   render();
 }catch(err){$('#events').innerHTML=`<p class="empty">활동 연표를 불러오지 못했습니다. ${safe(err.message)}</p>`;}
}
init();
