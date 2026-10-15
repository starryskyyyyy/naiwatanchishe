const test=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {randomUUID}=require('node:crypto');
const origin='https://starryskyyyyy.github.io';
async function setup(t) {
  const worker=(await import('../cloudflare/worker.mjs')).default;
  const db=new DatabaseSync(':memory:');
  db.exec(readFileSync(join(__dirname,'../cloudflare/schema.sql'),'utf8'));
  t.after(()=>db.close());
  // 使用真实SQLite执行Worker的全部SQL，模拟D1的原子batch事务。
  const execute=(sql,args)=>{
    const statement=db.prepare(sql);
    if(statement.columns().length)return {success:true,results:statement.all(...args),meta:{changes:0}};
    const result=statement.run(...args);
    return {success:true,results:[],meta:{changes:result.changes}};
  };
  const binding={prepare(sql){
    return {sql,args:[],bind(...args){return {...this,args};},
      async all(){return execute(this.sql,this.args);}};
  },async batch(statements){
    db.exec('BEGIN IMMEDIATE');
    try {const results=statements.map(s=>execute(s.sql,s.args));db.exec('COMMIT');return results;}
    catch(error){db.exec('ROLLBACK');throw error;}
  }};
  const env={DB:binding,RATE_LIMIT:'1000'},ip=randomUUID();
  const request=(path,options={})=>worker.fetch(new Request('https://worker.example'+path,{
    ...options,headers:{Origin:origin,'CF-Connecting-IP':ip,...options.headers}}),env);
  const post=(score,nickname='玩家',submissionId=randomUUID())=>request('/api/scores',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({score,nickname,submissionId})});
  return {db,post,request};
}
test('Worker兼容前端接口、跨域预检、UUID去重和内容冲突',async t=>{
  const app=await setup(t),id=randomUUID();
  const preflight=await app.request('/api/scores',{method:'OPTIONS',headers:{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
  assert.equal((await app.post(1,'小蛇',id)).status,201);
  const retry=await app.post(1,'小蛇',id);assert.equal(retry.status,200);assert.equal((await retry.json()).duplicate,true);
  assert.equal((await app.post(2,'小蛇',id)).status,409);
  const board=await app.request('/api/leaderboard');
  assert.equal(board.status,200);assert.equal((await board.json()).entries[0].score,1);
  assert.equal((await (await app.request('/api/health')).json()).ok,true);
});
test('Worker并发提交只留前20名；低分与并列第20名不执行插入',async t=>{
  const app=await setup(t);
  const responses=await Promise.all(Array.from({length:60},(_,i)=>app.post(i)));
  assert.ok(responses.every(response=>[200,201].includes(response.status)));
  const entries=(await (await app.request('/api/leaderboard')).json()).entries;
  assert.deepEqual(entries.map(row=>row.score),Array.from({length:20},(_,i)=>59-i));
  const before=app.db.prepare("SELECT seq FROM sqlite_sequence WHERE name='scores'").get().seq;
  assert.equal((await (await app.post(1)).json()).qualified,false);
  assert.equal((await (await app.post(40)).json()).qualified,false);
  assert.equal(app.db.prepare("SELECT seq FROM sqlite_sequence WHERE name='scores'").get().seq,before);
  await app.post(60);assert.equal(app.db.prepare('SELECT count(*) AS n FROM scores').get().n,20);
});
test('Worker同分按提交顺序，输入校验和来源限制不会写入非法成绩',async t=>{
  const app=await setup(t);await app.post(5,'先到');await app.post(5,'后到');
  assert.deepEqual((await (await app.request('/api/leaderboard')).json()).entries.map(row=>row.nickname),['先到','后到']);
  for(const score of [-1,398,1.5,'1'])assert.equal((await app.post(score)).status,400);
  assert.equal((await app.post(1,'x'.repeat(21))).status,400);
  assert.equal((await app.request('/api/scores',{method:'POST',headers:{Origin:'https://other.example'},body:'{}'})).status,403);
  assert.equal((await app.request('/api/scores',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})).status,400);
  assert.equal((await app.request('/api/scores',{method:'POST',headers:{'Content-Type':'application/json'},body:' '.repeat(2049)})).status,413);
  assert.equal(app.db.prepare('SELECT count(*) AS n FROM scores').get().n,2);
});
