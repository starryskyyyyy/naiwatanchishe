// 同一个服务器既发送网页文件，也处理排行榜接口。
const http = require('node:http');
const { readFile } = require('node:fs/promises');
const { mkdirSync } = require('node:fs');
const path = require('node:path');
const { Leaderboard, HttpError } = require('./backend/leaderboard.cjs');

const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/game.js', ['game.js', 'text/javascript; charset=utf-8']],
  ['/game-rules.js', ['game-rules.js', 'text/javascript; charset=utf-8']],
  ['/leaderboard.js', ['leaderboard.js', 'text/javascript; charset=utf-8']],
  ['/skin.js', ['skin.js', 'text/javascript; charset=utf-8']],
  ['/snake-renderer.js', ['snake-renderer.js', 'text/javascript; charset=utf-8']],
]);
for (const part of ['head','body','corner','tail','apple','pear','peach']) {
  for (const extension of ['png','webp']) assets.set('/assets/'+part+'.'+extension,['assets/'+part+'.'+extension,'image/'+extension]);
}

function json(res, status, data) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'});
  res.end(JSON.stringify(data));
}

function readJson(req) {
  if (!/^application\/json(?:\s*;|\s*$)/i.test(req.headers['content-type'] || '')) {
    req.resume(); throw new HttpError(415, '请使用JSON格式提交');
  }
  return new Promise((resolve, reject) => {
    let size = 0, finished = false;
    const chunks = [];
    req.on('data', chunk => {
      if (finished) return;
      size += chunk.length;
      if (size > 2048) { finished = true; chunks.length = 0; reject(new HttpError(413, '提交内容过长')); }
      else chunks.push(chunk);
    });
    req.on('end', () => {
      if (finished) return;
      finished = true;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new HttpError(400, 'JSON内容无效')); }
    });
    req.on('error', () => { if (!finished) { finished = true; reject(new HttpError(400, '提交中断，请重试')); } });
    req.on('aborted', () => { if (!finished) { finished = true; reject(new HttpError(400, '提交中断，请重试')); } });
  });
}

function createApplication({dbPath, rateLimit = 30} = {}) {
  if (!dbPath) dbPath = path.join(process.env.DATA_DIR || path.join(__dirname,'data'),'snake.sqlite');
  if (dbPath !== ':memory:') mkdirSync(path.dirname(dbPath), {recursive:true});
  const board = new Leaderboard(dbPath);
  const visitors = new Map();
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (pathname === '/api/leaderboard') {
        if (req.method !== 'GET') { res.setHeader('Allow','GET'); throw new HttpError(405,'此接口只允许GET请求'); }
        return json(res,200,{entries:board.list(),limit:20});
      }
      if (pathname === '/api/scores') {
        if (req.method !== 'POST') { res.setHeader('Allow','POST'); throw new HttpError(405,'此接口只允许POST请求'); }
        // 只使用实际连接IP，避免客户端伪造X-Forwarded-For绕过限流。
        const now = Date.now(), ip = req.socket.remoteAddress;
        for (const [key, value] of visitors) if (value.expires <= now) visitors.delete(key);
        let visitor = visitors.get(ip);
        if (!visitor && visitors.size >= 4096) {
          res.setHeader('Retry-After','60'); req.resume(); throw new HttpError(429,'提交较多，请稍后重试');
        }
        if (!visitor) { visitor = {count:0,expires:now+60000}; visitors.set(ip,visitor); }
        if (++visitor.count > rateLimit) {
          res.setHeader('Retry-After',String(Math.max(1,Math.ceil((visitor.expires-now)/1000))));
          req.resume(); throw new HttpError(429,'提交太频繁，请稍等一分钟后重试');
        }
        const result = board.submit(await readJson(req));
        return json(res,result.qualified && !result.duplicate ? 201 : 200,result);
      }
      const asset = assets.get(pathname);
      if (!asset) throw new HttpError(404,'没有找到这个页面或接口');
      if (!['GET','HEAD'].includes(req.method)) { res.setHeader('Allow','GET, HEAD'); throw new HttpError(405,'网页文件只允许GET或HEAD请求'); }
      let content;
      try { content = await readFile(path.join(__dirname,asset[0])); }
      catch (error) { if(error.code==='ENOENT')throw new HttpError(404,'没有找到这个文件');throw error; }
      res.writeHead(200,{'Content-Type':asset[1],'Content-Length':content.length,'Cache-Control':'no-cache'});
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (res.destroyed || res.writableEnded) return;
      if (!(error instanceof HttpError)) console.error('请求处理失败：',error.code || error.name);
      json(res,error.status || 500,{error: error instanceof HttpError ? error.message : '服务器暂时繁忙，请稍后重试'});
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return {server,board};
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT需要是1～65535之间的整数');
  const {server,board} = createApplication();
  server.listen(port,process.env.HOST || '127.0.0.1',() => {
    console.log('游戏已启动：http://localhost:' + port);
    console.log('关闭服务器：按 Ctrl+C。贪吃蛇成绩保存在 data/snake.sqlite（或DATA_DIR指定目录）。');
  });
  server.on('error',error => { console.error('服务器启动失败：',error.code); board.close(); process.exitCode=1; });
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    server.close(() => board.close());
    setTimeout(() => server.closeAllConnections(),5000).unref();
  };
  process.on('SIGINT',stop); process.on('SIGTERM',stop);
}
module.exports = {createApplication};
