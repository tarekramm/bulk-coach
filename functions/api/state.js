// Protect /api/* using Cloudflare Access before enabling cloud sync.
// This header is trustworthy ONLY when Access gates every request to this route.
function who(request) {const email=request.headers.get("cf-access-authenticated-user-email");return email&&email.length<255?email.toLowerCase():null;}
const json=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
export async function onRequestGet({request,env}) {
  if(!env.DB)return json({error:"D1 binding DB is not configured"},503);
  const email=who(request);if(!email)return json({error:"Cloudflare Access authorization required"},401);
  const row=await env.DB.prepare("SELECT data FROM user_states WHERE user_id = ?").bind(email).first();
  if(!row)return json({state:null});
  try{return json({state:JSON.parse(row.data)});}catch{return json({error:"Saved state is corrupted"},500);}
}
export async function onRequestPut({request,env}){
  if(!env.DB)return json({error:"D1 binding DB is not configured"},503);
  const email=who(request);if(!email)return json({error:"Cloudflare Access authorization required"},401);
  const body=await request.text();if(body.length>1500000)return json({error:"Backup size limit exceeded"},413);
  let payload;try{payload=JSON.parse(body)}catch{return json({error:"Invalid JSON"},400)}
  const state=payload?.state;if(!state||!Array.isArray(state.exercises)||!Array.isArray(state.foods)||!Array.isArray(state.reminders))return json({error:"Invalid state"},400);
  const current=await env.DB.prepare("SELECT data FROM user_states WHERE user_id = ?").bind(email).first();
  if(current){try{const old=JSON.parse(current.data);if(Number(old.updatedAt)>Number(state.updatedAt))return json({error:"Newer cloud state exists. Refresh to avoid overwriting it."},409);}catch{}}
  await env.DB.prepare("INSERT INTO user_states(user_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at").bind(email,JSON.stringify(state),Date.now()).run();
  return json({ok:true});
}
