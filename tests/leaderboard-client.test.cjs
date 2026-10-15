const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {join}=require('node:path');
const source=fs.readFileSync(join(__dirname,'../leaderboard.js'),'utf8');
test('生产配置连接Cloudflare，本地开发和自动测试不连接正式榜单',()=>{
  const config=fs.readFileSync(join(__dirname,'../config.js'),'utf8');
  for(const hostname of ['localhost','127.0.0.1','starryskyyyyy.github.io']) {
    const context={location:{hostname}};vm.runInNewContext(config,context);
    assert.equal(context.SnakeConfig.apiBaseUrl,hostname.endsWith('.github.io')
      ? 'https://fancy-meadow-3bf8naiwatanchishe-api.linstarryskyyy.workers.dev' : '');
  }
});
function client(hostname,apiBaseUrl='') {
  const elements=new Map(),requests=[];
  const element=selector=>{
    if(!elements.has(selector))elements.set(selector,{value:'',textContent:'',disabled:false,hidden:false,
      handlers:{},addEventListener(name,handler){this.handlers[name]=handler;},
      setCustomValidity(){},replaceChildren(){},append(){},reportValidity(){}});
    return elements.get(selector);
  };
  const context={location:{protocol:'https:',hostname},SnakeConfig:{apiBaseUrl},
    document:{querySelector:element,createElement:()=>({append(){}})},
    URL,AbortController,setTimeout,clearTimeout,localStorage:{getItem(){return null;},setItem(){}},
    crypto:{randomUUID:()=> '10000000-0000-4000-8000-000000000000'},
    fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({entries:[],qualified:true,rank:1})};}};
  vm.runInNewContext(source,context);context.LeaderboardUI.startRound();
  return {context,element,requests};
}
test('GitHub Pages未配置后端时明确提示并禁用提交，不请求不存在的API',()=>{
  const c=client('starryskyyyyy.github.io');c.context.LeaderboardUI.endRound(1);
  assert.equal(c.requests.length,0);assert.equal(c.element('#submit-score').disabled,true);
  assert.equal(c.element('#score-form').hidden,true);
  assert.match(c.element('#submit-status').textContent,/尚未连接/);
});
test('GitHub Pages配置独立后端后，榜单读取与成绩提交都使用完整后端地址',async()=>{
  const c=client('starryskyyyyy.github.io','https://snake.example/api-service/');
  assert.equal(c.requests[0].url,'https://snake.example/api-service/api/leaderboard');
  c.context.LeaderboardUI.endRound(1);c.element('#nickname').value='玩家';
  await c.element('#score-form').handlers.submit({preventDefault(){}});
  assert.equal(c.requests[1].url,'https://snake.example/api-service/api/scores');
  assert.equal(JSON.parse(c.requests[1].options.body).score,1);
});
test('同站点Node部署默认保持相对API地址，非法或不安全后端地址不会发出请求',()=>{
  assert.equal(client('snake.example').requests[0].url,'/api/leaderboard');
  for(const value of ['http://snake.example','not-a-url','https://user:password@snake.example','https://snake.example?token=secret']) {
    assert.equal(client('starryskyyyyy.github.io',value).requests.length,0);
  }
});
