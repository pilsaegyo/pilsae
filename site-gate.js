// Site-side access gate for SHINHWA HISTORY. Configure this on the PUBLIC website Worker, not the admin API Worker.
const OPEN_AT_MS = Date.parse('2026-11-27T00:00:00+09:00');
const COOKIE_NAME = 'pilsae_history_preview';
const TTL_SECONDS = 2 * 60 * 60;
const encoder = new TextEncoder();
const noCache = {'Cache-Control':'no-store, private, max-age=0','X-Robots-Tag':'noindex, nofollow, noarchive','Vary':'Cookie'};
function sealInput(expiry){ return `history-preview:v1:${expiry}`; }
async function sign(secret, expiry){
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(sealInput(expiry))));
  return Array.from(signature,x=>x.toString(16).padStart(2,'0')).join('');
}
function equal(a,b){ if(a.length!==b.length)return false;let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);return mismatch===0; }
function tokenFromCookie(header){
  return (header||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE_NAME+'='))?.slice(COOKIE_NAME.length+1)||'';
}
async function allowPreview(request, env){
  if(!env.HISTORY_PREVIEW_SECRET)return false;
  const match = tokenFromCookie(request.headers.get('Cookie')).match(/^(\d{10,13})\.([a-f0-9]{64})$/);
  if(!match)return false;
  const expires=Number(match[1]);
  if(!Number.isSafeInteger(expires)||expires*1000<=Date.now()||expires*1000>Date.now()+TTL_SECONDS*1000)return false;
  return equal(match[2],await sign(env.HISTORY_PREVIEW_SECRET,expires));
}
async function preparePreview(request,env){
  // Same-origin POST with Authorization header. Never accept tokens in query strings.
  const origin = request.headers.get('Origin');
  if(origin && origin!==new URL(request.url).origin)return new Response('잘못된 요청 출처입니다.',{status:403,headers:noCache});
  if(!env.HISTORY_PREVIEW_SECRET || !env.ASSETS) return new Response('사이트 공개 제한 설정이 완료되지 않았습니다.',{status:503,headers:noCache});
  const bearer=request.headers.get('Authorization')||'';
  if(!/^Bearer [^\s]+$/.test(bearer) || bearer.length>3000)return new Response('관리자 로그인이 필요합니다.',{status:401,headers:noCache});
  // Cloudflare Workers in the same account must communicate through a Service Binding.
  // Do not use global fetch() to a workers.dev URL or bypass ADMIN_TOKEN validation.
  if(!env.PILSAE_ADMIN_API || typeof env.PILSAE_ADMIN_API.fetch!=='function'){
    return new Response('관리자 인증 Service Binding(PILSAE_ADMIN_API)이 설정되지 않았습니다.',{status:503,headers:noCache});
  }
  let check;
  try{
    check=await env.PILSAE_ADMIN_API.fetch(new Request('https://pilsae-admin-api.hyesung.workers.dev/admin-auth',{
      method:'GET',headers:{Authorization:bearer},redirect:'manual',signal:AbortSignal.timeout(7000)
    }));
  }catch(error){
    console.error('[history-preview-session] Internal admin service call failed:',error?.name||'UnknownError');
    return new Response('관리자 인증 내부 서비스 호출에 실패했습니다.',{status:502,headers:noCache});
  }
  if(check.status===401 || check.status===403){
    return new Response('관리자 인증에 실패했습니다.',{status:401,headers:noCache});
  }
  if(!check.ok){
    return new Response('관리자 인증 서비스 응답 오류 (HTTP '+check.status+')',{status:502,headers:noCache});
  }
  let verified=false;
  try{ verified=(await check.json()).authenticated===true; }
  catch{ return new Response('관리자 인증 서비스의 응답 형식이 올바르지 않습니다.',{status:502,headers:noCache}); }
  if(!verified)return new Response('관리자 인증에 실패했습니다.',{status:401,headers:noCache});
  const expires=Math.floor(Date.now()/1000)+TTL_SECONDS;
  const value=expires+'.'+await sign(env.HISTORY_PREVIEW_SECRET,expires);
  const headers=new Headers(noCache);
  headers.set('Set-Cookie',`${COOKIE_NAME}=${value}; Max-Age=${TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`);
  headers.set('Content-Type','application/json; charset=utf-8');
  return new Response(JSON.stringify({ok:true,preview:true,expiresAt:new Date(expires*1000).toISOString()}),{status:200,headers});
}
function guardedPath(path){
  // Normalize decoded path; protected assets cannot bypass the guard with percent escapes.
  let val=path;
  try{val=decodeURIComponent(val);}catch{return 'bad';}
  if(val.includes('\\')||val.includes('\0'))return 'bad';
  if(val==='/history.html'||val==='/history'||val==='/history/')return 'page';
  if(val==='/data/history.json')return 'data';
  return null;
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/history-preview-session'){
      if(request.method!=='POST')return new Response('Method not allowed',{status:405,headers:noCache});
      if(Date.now()>=OPEN_AT_MS)return new Response(JSON.stringify({ok:true,preview:false}),{headers:{...noCache,'Content-Type':'application/json'}});
      return preparePreview(request,env);
    }
    if(!env.ASSETS)return new Response('Static asset binding missing',{status:503});
    const target=guardedPath(url.pathname);
    if(target==='bad')return new Response('Bad URL',{status:400,headers:noCache});
    if(target && Date.now()<OPEN_AT_MS && !(await allowPreview(request,env))){
      if(target==='data')return new Response('활동 연혁은 2026년 11월 27일 공개됩니다.',{status:403,headers:{...noCache,'Content-Type':'text/plain; charset=utf-8'}});
      const noticeUrl=new URL('/history-coming-soon.html',url);
      const response=await env.ASSETS.fetch(new Request(noticeUrl,request));
      const headers=new Headers(response.headers);
      for(const [k,v] of Object.entries(noCache))headers.set(k,v);
      return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
    }
    const response=await env.ASSETS.fetch(request);
    if(!target)return response;
    const headers=new Headers(response.headers);
    headers.set('Cache-Control','no-store, private, max-age=0');
    headers.set('Vary','Cookie');
    return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
  }
};
