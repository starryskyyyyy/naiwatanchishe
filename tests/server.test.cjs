const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const {mkdtempSync,existsSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join} = require('node:path');
let createApplication;
try { ({createApplication} = require('../server.js')); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
async function setup(t, options = {}) {
  assert.ok(createApplication, '需要HTTP服务模块');
  const app = createApplication({dbPath:':memory:',rateLimit:100, ...options});
  t.after(async () => { await new Promise(resolve => { app.server.close(resolve); app.server.closeAllConnections(); }); app.board.close(); });
  await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const post = (score, nickname='玩家', submissionId=randomUUID()) => fetch(base+'/api/scores',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({score,nickname,submissionId})});
  return { ...app, base, post };
}

test('真实HTTP读写、幂等与同分顺序', async t => {
  const app = await setup(t);
  const id = randomUUID();
  const first = await app.post(1,'小蛇',id);
  assert.equal(first.status,201);
  assert.equal((await first.json()).rank,1);
  const retry = await app.post(1,'小蛇',id);
  assert.equal(retry.status,200); assert.equal((await retry.json()).duplicate,true);
  assert.equal((await app.post(2,'小蛇',id)).status,409);
  await app.post(1,'后来者');
  const get = await fetch(app.base+'/api/leaderboard');
  assert.equal(get.headers.get('cache-control'),'no-store');
  const body = await get.json();
  assert.equal(body.limit,20); assert.deepEqual(body.entries.map(row=>row.nickname),['小蛇','后来者']);
});

test('60个并发提交最终只保留最高20个，低分不存储', async t => {
  const app = await setup(t);
  const responses = await Promise.all(Array.from({length:60},(_,i)=>app.post(i)));
  assert.ok(responses.every(r=>[200,201].includes(r.status)));
  const { entries } = await (await fetch(app.base+'/api/leaderboard')).json();
  assert.deepEqual(entries.map(row=>row.score),Array.from({length:20},(_,i)=>59-i));
  const loser = await app.post(10);
  assert.equal((await loser.json()).qualified,false);
  assert.equal(app.board.db.prepare('SELECT count(*) AS n FROM scores').get().n,20);
});

test('非法JSON、类型、过长正文、方法与路径均有可读错误', async t => {
  const app = await setup(t);
  assert.equal((await app.post(-1)).status,400);
  const malformed = await fetch(app.base+'/api/scores',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});
  assert.equal(malformed.status,400); assert.equal(typeof (await malformed.json()).error,'string');
  assert.equal((await fetch(app.base+'/api/scores',{method:'POST',body:'x'})).status,415);
  const huge = await fetch(app.base+'/api/scores',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:'a'.repeat(3000)})});
  assert.equal(huge.status,413);
  assert.equal((await fetch(app.base+'/api/scores')).status,405);
  assert.equal((await fetch(app.base+'/api/nope')).status,404);
  assert.equal(app.board.list().length,0);
});

test('只提供允许的前端文件，数据库与后端源码不可下载', async t => {
  const app = await setup(t);
  const page = await fetch(app.base+'/');
  assert.equal(page.status,200); assert.match(await page.text(),/贪吃蛇/);
  assert.match((await fetch(app.base+'/game.js')).headers.get('content-type'),/javascript/);
  assert.equal((await fetch(app.base+'/styles.css',{method:'HEAD'})).status,200);
  assert.equal((await fetch(app.base+'/skin.js')).status,200);
  assert.equal((await fetch(app.base+'/snake-renderer.js')).status,200);
  for(const part of ['head','body','corner','tail','apple','pear','peach']) {
    const image=await fetch(app.base+'/assets/'+part+'.png');
    assert.equal(image.status,200,part);
    assert.equal(image.headers.get('content-type'),'image/png');
    const bytes=Buffer.from(await image.arrayBuffer());
    assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  }
  assert.equal((await fetch(app.base+'/assets/missing.png')).status,404);
  for (const path of ['/server.js','/backend/leaderboard.cjs','/data/snake.sqlite','/data/private.sqlite','/package.json','/.env','/%2e%2e/server.js']) {
    assert.equal((await fetch(app.base+path)).status,404,path);
  }
});

test('使用配置的持久目录创建贪吃蛇数据库',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'snake-isolation-'));
  const previous=process.env.DATA_DIR;
  let app;
  try { process.env.DATA_DIR=dir;app=await setup(t,{dbPath:undefined}); }
  finally { if(previous===undefined)delete process.env.DATA_DIR;else process.env.DATA_DIR=previous; }
  assert.equal(app.board.list().length,0);
  assert.equal((await app.post(1)).status,201);
  assert.equal(app.board.list()[0].score,1);
  assert.ok(existsSync(join(dir,'snake.sqlite')));
});

test('频率限制返回429与Retry-After，不影响读取排行榜', async t => {
  const app = await setup(t,{rateLimit:2});
  await app.post(10); await app.post(20);
  const limited = await app.post(30);
  assert.equal(limited.status,429); assert.ok(Number(limited.headers.get('retry-after'))>0);
  assert.equal((await fetch(app.base+'/api/leaderboard')).status,200);
  assert.equal(app.board.list().length,2);
});
