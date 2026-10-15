// 将本文件全部粘贴到Cloudflare Worker编辑器，D1绑定变量名必须为DB。
// 无依赖；兼容现有贪吃蛇前端的GET/POST接口。
const DEFAULT_ORIGIN='https://starryskyyyyy.github.io';
const MAX_SCORE=397, LIMIT=20, MAX_BODY=2048;
const visitors=new Map();
class HttpError extends Error {
  constructor(status,message){super(message);this.status=status;}
}
function validate(input) {
  if(!input || typeof input!=='object' || Array.isArray(input))throw new HttpError(400,'提交内容必须是对象');
  if(typeof input.nickname!=='string')throw new HttpError(400,'请填写昵称');
  const nickname=input.nickname.trim(),score=input.score,submissionId=input.submissionId;
  if(!nickname || [...nickname].length>20 || /\p{Cc}/u.test(nickname))throw new HttpError(400,'昵称需要1～20个字符，且不能包含控制字符');
  if(!Number.isSafeInteger(score) || score<0 || score>MAX_SCORE)throw new HttpError(400,'成绩必须是0～397之间的整数');
  if(typeof submissionId!=='string' || !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(submissionId))throw new HttpError(400,'本局标识无效，请重新开始游戏');
  return {nickname,score,submissionId:submissionId.toLowerCase()};
}
async function readInput(request) {
  if(!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('Content-Type') || ''))throw new HttpError(415,'请使用JSON格式提交');
  const reader=request.body?.getReader(),chunks=[];let size=0;
  if(reader)try {
    while(true){
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>MAX_BODY){await reader.cancel();throw new HttpError(413,'提交内容过长');}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try {return JSON.parse(new TextDecoder().decode(bytes));}
  catch {throw new HttpError(400,'JSON内容无效');}
}
function rateLimit(request,env) {
  // 每个Worker实例内的轻量限流；不同边缘实例各自计数。
  const now=Date.now(),ip=request.headers.get('CF-Connecting-IP') || 'unknown';
  for(const [key,value] of visitors)if(value.expires<=now)visitors.delete(key);
  let visitor=visitors.get(ip);
  if(!visitor){
    if(visitors.size>=4096)throw new HttpError(429,'提交较多，请稍后重试');
    visitor={count:0,expires:now+60000};visitors.set(ip,visitor);
  }
  const limit=Math.max(1,Math.min(10000,Number(env.RATE_LIMIT) || 30));
  if(++visitor.count>limit)throw new HttpError(429,'提交太频繁，请稍等一分钟后重试');
}
const rankingSql='SELECT id,nickname,score,created_at FROM scores ORDER BY score DESC,id ASC LIMIT 20';
const publicEntries=rows=>rows.map((row,i)=>({rank:i+1,nickname:row.nickname,score:row.score,createdAt:row.created_at}));
async function submit(db,input) {
  const {nickname,score,submissionId}=validate(input);
  // D1 batch是原子事务。资格检查直接写在INSERT中，避免并发查询旧门槛。
  const results=await db.batch([
    db.prepare('SELECT id,nickname,score FROM scores WHERE submission_id=?').bind(submissionId),
    db.prepare(`INSERT INTO scores(submission_id,nickname,score,created_at)
      SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM scores WHERE submission_id=?)
      AND ((SELECT count(*) FROM scores)<20 OR ?>
        (SELECT score FROM scores ORDER BY score DESC,id ASC LIMIT 1 OFFSET 19))`)
      .bind(submissionId,nickname,score,new Date().toISOString(),submissionId,score),
    db.prepare('DELETE FROM scores WHERE id NOT IN (SELECT id FROM scores ORDER BY score DESC,id ASC LIMIT 20)'),
    db.prepare('SELECT id FROM scores WHERE submission_id=?').bind(submissionId),
    db.prepare(rankingSql),
  ]);
  const existing=results[0].results[0],stored=results[3].results[0],rows=results[4].results;
  if(existing && (existing.nickname!==nickname || existing.score!==score))throw new HttpError(409,'这一局已经提交，请勿更改内容');
  return {qualified:!!stored,rank:stored?rows.findIndex(row=>row.id===stored.id)+1:null,
    duplicate:!!existing,entries:publicEntries(rows)};
}
export default {
  async fetch(request,env) {
    const cors={},origin=request.headers.get('Origin');
    const json=(body,status=200)=>new Response(JSON.stringify(body),{
      status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...cors}});
    try {
      const origins=String(env.ALLOWED_ORIGINS || DEFAULT_ORIGIN).split(',').map(value=>value.trim());
      if(origin && !origins.includes(origin))throw new HttpError(403,'此网站未获准连接排行榜');
      if(origin){cors['Access-Control-Allow-Origin']=origin;cors.Vary='Origin';}
      const path=new URL(request.url).pathname;
      const method=path==='/api/scores'?'POST':'GET';
      if(!['/','/api/health','/api/leaderboard','/api/scores'].includes(path))throw new HttpError(404,'没有找到这个接口');
      if(request.method==='OPTIONS') {
        if(request.headers.get('Access-Control-Request-Method')!==method)throw new HttpError(405,'预检请求方法不受支持');
        const headers=String(request.headers.get('Access-Control-Request-Headers') || '').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
        if(headers.some(header=>header!=='content-type'))throw new HttpError(403,'预检请求头不受支持');
        return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':method,'Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'}});
      }
      if(request.method!==method)throw new HttpError(405,'此接口只允许'+method+'请求');
      if(!env.DB)throw new HttpError(503,'排行榜数据库尚未连接，请检查D1绑定变量名是否为DB');
      if(path==='/' || path==='/api/health') {
        await env.DB.prepare('SELECT count(*) FROM scores').all();
        return json({ok:true,service:'naiwa-leaderboard'});
      }
      if(path==='/api/leaderboard')return json({entries:publicEntries((await env.DB.prepare(rankingSql).all()).results),limit:LIMIT});
      rateLimit(request,env);
      const result=await submit(env.DB,await readInput(request));
      return json(result,result.qualified && !result.duplicate?201:200);
    } catch(error) {
      if(!(error instanceof HttpError))console.error('排行榜数据库请求失败',error.message);
      if(error.status===429)cors['Retry-After']='60';
      return json({error:error instanceof HttpError?error.message:'排行榜服务尚未准备好，请确认数据库已建表后重试。'},error.status || 500);
    }
  },
};
