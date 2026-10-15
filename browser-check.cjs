const {spawn}=require('node:child_process');
const {mkdtempSync,writeFileSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {randomUUID}=require('node:crypto');
const assert=require('node:assert/strict');
const {createApplication}=require('./server.js');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  let backendUrl;
  const frontend=require('node:http').createServer(async(req,res)=>{
    try {
      if(req.url.startsWith('/api/')){res.writeHead(404);return res.end();}
      if(req.url.startsWith('/config.js')) {
        res.writeHead(200,{'Content-Type':'text/javascript'});
        return res.end('globalThis.SnakeConfig='+JSON.stringify({apiBaseUrl:backendUrl}));
      }
      const response=await fetch(backendUrl+req.url);
      res.writeHead(response.status,{'Content-Type':response.headers.get('Content-Type')});
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {res.writeHead(500);res.end();}
  });
  await new Promise(resolve=>frontend.listen(0,'127.0.0.1',resolve));
  const frontendUrl='http://127.0.0.1:'+frontend.address().port;
  const app=createApplication({dbPath:join(mkdtempSync(join(tmpdir(),'snake-qa-db-')),'snake.sqlite'),allowedOrigins:[frontendUrl]});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  backendUrl='http://127.0.0.1:'+app.server.address().port;
  app.board.submit({nickname:'<b>蛇</b>',score:9,submissionId:randomUUID()});
  const profile=mkdtempSync(join(tmpdir(),'snake-qa-edge-'));
  const proc=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9231','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let socket;
  try {
    let pages;
    for(let i=0;i<80;i++){try{pages=await(await fetch('http://127.0.0.1:9231/json')).json();break;}catch{await delay(100);}}
    assert.ok(pages,'Edge调试端点不可用');
    socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
    let seq=0;const pending=new Map(),errors=[];
    socket.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
    const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
    const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
    const wait=async(expression,label)=>{for(let i=0;i<160;i++){if(await evaluate(expression))return;await delay(25);}throw new Error('等待超时：'+label);};
    const click=id=>evaluate('document.getElementById('+JSON.stringify(id)+').click();void 0');
    const key=async(key,code=key)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code});};
    const shot=async file=>{const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});writeFileSync(file,Buffer.from(r.data,'base64'));};
    const forceEnd=async score=>{
      await click('restart');
      await evaluate('__qaGame.status="paused";__qaGame.snake=[{x:19,y:10},{x:18,y:10},{x:17,y:10}];__qaGame.direction="right";__qaGame.turns=[];__qaGame.score='+score+';__qaGame.fruit={x:0,y:0};void 0');
      await click('start-toggle');await wait('document.querySelector("#game-over").open','真实撞墙结束');
    };
    const submit=async name=>{await evaluate('document.querySelector("#nickname").value='+JSON.stringify(name)+';document.querySelector("#score-form").requestSubmit();void 0');};
    const submitted=()=>wait('document.querySelector("#submit-score").textContent==="本局已提交 ✓"','成绩保存');
    await send('Runtime.enable');await send('Page.enable');
    await send('Page.addScriptToEvaluateOnNewDocument',{source:`
      Math.random=()=>0;let rules;
      Object.defineProperty(window,'GameRules',{configurable:true,get(){return rules;},set(value){
        rules=value;const Base=value.SnakeGame;
        value.SnakeGame=class extends Base{constructor(...args){super(...args);window.__qaGame=this;}};
      }});
    `});
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:'http://127.0.0.1:'+app.server.address().port});
    await wait('!!window.__qaGame && document.querySelectorAll("#leaderboard-list li").length===1','页面加载');
    assert.equal(await evaluate('document.querySelector("aside")'),null);
    assert.equal(await evaluate('__qaGame.status'),'ready');
    const desktopBoard=await evaluate(`(()=>{
      const canvas=document.querySelector('#board'),rect=canvas.getBoundingClientRect();
      return {width:rect.width,height:rect.height,pixels:canvas.width,screenHeight:innerHeight,
        cardBottom:document.querySelector('.game-card').getBoundingClientRect().bottom};
    })()`);
    assert.ok(desktopBoard.width>740,'桌面棋盘应充分利用900像素高的窗口');
    assert.ok(Math.abs(desktopBoard.width-desktopBoard.height)<1,'棋盘保持正方形');
    assert.ok(desktopBoard.pixels>=Math.floor(desktopBoard.width),'画布分辨率应跟随显示尺寸');
    assert.ok(desktopBoard.cardBottom<=desktopBoard.screenHeight,'桌面控件和棋盘应完整显示');
    const connections=await evaluate(`(async()=>{
      const canvas=document.createElement('canvas');
      const renderer=new SnakeRenderer(canvas,SnakeSkin);
      await Promise.all(Object.values(renderer.images).map(image=>image.decode()));
      const ctx=renderer.context, spans={};
      const edge=(side)=>{
        const pixels=ctx.getImageData(24,24,24,24).data, occupied=[];
        for(let i=0;i<24;i++){
          const x=side==='left'?0:side==='right'?23:i;
          const y=side==='up'?0:side==='down'?23:i;
          if(pixels[(y*24+x)*4+3]>128)occupied.push(i);
        }
        return [occupied[0],occupied[occupied.length-1]];
      };
      for(const part of ['head','body','tail']){
        ctx.clearRect(0,0,480,480);renderer.tile(part,{x:1,y:1});
        spans[part]=edge('left');
        if(part==='body')spans.bodyRight=edge('right');
      }
      const sides=[['left','down'],['up','left'],['right','up'],['down','right']];
      for(let i=0;i<4;i++){
        ctx.clearRect(0,0,480,480);renderer.tile('corner',{x:1,y:1},i*Math.PI/2);
        for(const side of sides[i])spans['corner'+i+side]=edge(side);
      }
      const oldSize=GameRules.settings.cellSize;
      try {
        GameRules.settings.cellSize=48;canvas.width=864;canvas.height=864;
        ctx.fillStyle='#17251e';ctx.fillRect(0,0,864,864);
        const centers=[{x:5,y:5},{x:13,y:5},{x:5,y:13},{x:13,y:13}];
        centers.forEach((center,i)=>{
          const angle=i*Math.PI/2;
          const tile=(part,x,y,rotation=0)=>renderer.tile(part,{
            x:center.x+Math.round(x*Math.cos(angle)-y*Math.sin(angle)),
            y:center.y+Math.round(x*Math.sin(angle)+y*Math.cos(angle))
          },angle+rotation);
          tile('corner',0,0);tile('body',-1,0);tile('head',-2,0,Math.PI);
          tile('body',0,1,Math.PI/2);tile('tail',0,2,Math.PI/2);
        });
        return {spans,preview:canvas.toDataURL('image/png').split(',')[1]};
      } finally {GameRules.settings.cellSize=oldSize;}
    })()`);
    for(const [name,span] of Object.entries(connections.spans)){
      assert.ok(Math.abs(span[0]-6)<=1 && Math.abs(span[1]-17)<=1,
        name+'连接口应居中且宽12像素，实际'+JSON.stringify(span));
    }
    writeFileSync('preview-connections.png',Buffer.from(connections.preview,'base64'));
    await shot('preview-desktop.png');
    for(const type of ['apple','pear','peach']) {
      await click('restart');
      await evaluate('__qaGame.fruit={x:11,y:10,type:'+JSON.stringify(type)+'};void 0');
      await click('board-action');await wait('__qaGame.score===1','吃'+type+'得1分');
      await click('start-toggle');
      assert.equal(await evaluate('__qaGame.snake.length'),4);
    }
    await click('restart');
    await evaluate('__qaGame.fruit={x:11,y:10};void 0');await click('board-action');
    await wait('__qaGame.score===1','吃苹果得1分');await shot('preview-desktop.png');await click('start-toggle');
    assert.equal(await evaluate('__qaGame.snake.length'),4);
    assert.equal(await evaluate('document.querySelector("#score").textContent'),'1');
    const paused=await evaluate('JSON.stringify(__qaGame.snake)');await delay(200);assert.equal(await evaluate('JSON.stringify(__qaGame.snake)'),paused);
    await click('start-toggle');await key('ArrowUp');
    await wait('__qaGame.direction==="up"','键盘转向');
    await click('open-leaderboard');assert.equal(await evaluate('__qaGame.status'),'paused');
    assert.equal(await evaluate('document.querySelector("#leaderboard-list .player-name").textContent'),'<b>蛇</b>');
    assert.equal(await evaluate('document.querySelector("#leaderboard-list b")'),null);
    await click('close-leaderboard');await wait('__qaGame.status==="playing"','关闭排行榜后恢复');
    await forceEnd(1);await submit('一颗苹果');await submitted();
    assert.equal(app.board.list().length,2);assert.equal(app.board.list()[1].score,1);
    await submit('一颗苹果');await delay(100);assert.equal(app.board.list().length,2);
    await shot('preview-result.png');
    await forceEnd(3);
    await evaluate(`
      window.__originalFetch=window.fetch;window.__dropResponse=true;
      window.fetch=async(...args)=>{const response=await __originalFetch(...args);if(args[0]==='/api/scores'&&__dropResponse){__dropResponse=false;await response.text();throw new TypeError('丢失响应');}return response;};
    `);
    await submit('重试玩家');await wait('document.querySelector("#submit-score").textContent==="重试提交"','失败可重试');
    assert.equal(app.board.list().length,3);await submit('重试玩家');await submitted();assert.equal(app.board.list().length,3);
    await evaluate('window.fetch=__originalFetch;void 0');
    await forceEnd(4);
    await evaluate(`window.fetch=async(...args)=>{const response=await __originalFetch(...args);if(args[0]==='/api/scores')await new Promise(resolve=>window.__releaseSubmission=resolve);return response;};`);
    await submit('旧局玩家');await wait('typeof __releaseSubmission === "function"','迟到响应');
    await evaluate('window.fetch=__originalFetch;void 0');await forceEnd(5);await submit('新局玩家');await submitted();
    await evaluate('__releaseSubmission();void 0');await delay(200);
    assert.equal(await evaluate('document.querySelector("#nickname").value'),'新局玩家');
    assert.equal(await evaluate('document.querySelector("#leaderboard-list .player-score").textContent'),'9');
    assert.ok(await evaluate('[...document.querySelectorAll("#leaderboard-list .player-score")].some(e=>e.textContent==="5")'));
    assert.equal(app.board.list().length,5);
    for(let i=100;i<120;i++)app.board.submit({nickname:'榜单玩家',score:i,submissionId:randomUUID()});
    const before=app.board.db.prepare("SELECT seq FROM sqlite_sequence WHERE name='scores'").get().seq;
    await forceEnd(1);await submit('未入榜');
    await wait('document.querySelector("#submit-score").textContent==="本局未入榜"','未入榜提示');
    assert.equal(app.board.list().length,20);assert.equal(app.board.db.prepare("SELECT seq FROM sqlite_sequence WHERE name='scores'").get().seq,before);
    await click('restart');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await wait('Math.abs(document.querySelector("#board").width-document.querySelector("#board").getBoundingClientRect().width)<2','窗口变化后画布分辨率更新');
    assert.ok(await evaluate('document.querySelector("#board").getBoundingClientRect().width>350'),'手机棋盘尽量填满屏幕宽度');
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".direction-pad")).display'),'grid');
    await shot('preview-mobile.png');
    await evaluate('document.querySelector("[data-direction=up]").click();void 0');
    await wait('__qaGame.snake[0].y<10','手机方向按钮');await click('start-toggle');
    assert.equal(await evaluate('__qaGame.status'),'paused');
    await click('restart');assert.equal(await evaluate('__qaGame.score'),0);assert.equal(await evaluate('__qaGame.status'),'ready');
    await send('Page.navigate',{url:frontendUrl});
    await wait('!!window.__qaGame && document.querySelectorAll("#leaderboard-list li").length===20','独立前端跨域读取后端榜单');
    await forceEnd(130);await submit('跨站提交玩家');await submitted();
    assert.equal(app.board.list()[0].nickname,'跨站提交玩家');
    assert.equal(app.board.list()[0].score,130);assert.equal(app.board.list().length,20);
    assert.deepEqual(errors,[]);
    console.log('PASS: enlarged responsive board, fruit scoring, keyboard/mobile, pause, top20, duplicate/retry/stale protection, separate-origin API reads and submissions, no runtime exceptions');
  } finally {
    if(socket)socket.close();proc.kill();
    await new Promise(resolve=>{app.server.close(resolve);app.server.closeAllConnections();});app.board.close();
    await new Promise(resolve=>{frontend.close(resolve);frontend.closeAllConnections();});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});

