const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname,'../game-rules.js'),'utf8');
const context = {}; vm.runInNewContext(source,context);
const rules = context.GameRules;
function game() { assert.ok(rules.SnakeGame,'需要贪吃蛇规则'); return new rules.SnakeGame(()=>0); }
const head = snake => ({...snake.snake[0]});

test('水果按三个等长随机区间选出苹果、梨、桃子，生成在空格',()=>{
  for(const [value,type] of [[0,'apple'],[1/3-1e-8,'apple'],[1/3,'pear'],[2/3-1e-8,'pear'],[2/3,'peach'],[.999999,'peach']]) {
    const g=new rules.SnakeGame(()=>value);
    assert.equal(g.fruit?.type,type);
    assert.ok(!g.snake.some(p=>p.x===g.fruit.x&&p.y===g.fruit.y));
  }
});

test('三种水果都加1分并增长，吃完重新随机，移动与暂停不换水果',()=>{
  for(const type of ['apple','pear','peach']) {
    let value=0;
    const g=new rules.SnakeGame(()=>value);
    g.fruit={x:11,y:10,type};g.start();value=.9;g.step();
    assert.equal(g.score,1);assert.equal(g.snake.length,4);
    assert.equal(g.fruit.type,'peach');
    const fruit=g.fruit;g.step();g.pause();g.step();
    assert.equal(g.fruit,fruit);assert.equal(g.score,1);
    value=.5;g.reset();assert.equal(g.fruit.type,'pear');
  }
});

test('开始前静止，开始后向右移动，未吃苹果时长度与分数不变',()=>{
  const g=game(); const before=head(g); g.step(); assert.deepEqual(head(g),before);
  assert.equal(g.status,'ready'); assert.equal(g.snake.length,3);
  g.start(); g.step(); assert.equal(g.snake[0].x,before.x+1); assert.equal(g.score,0); assert.equal(g.snake.length,3);
});
test('吃一个苹果加1分并增长一节，苹果只生成在空格',()=>{
  const g=game(); g.start();
  g.fruit={x:g.snake[0].x+1,y:g.snake[0].y}; g.step();
  assert.equal(g.score,1); assert.equal(g.snake.length,4);
  assert.ok(!g.snake.some(p=>p.x===g.fruit.x&&p.y===g.fruit.y));
});
test('禁止反向，连续转向按不同步执行，超出队列不接受',()=>{
  const g=game();g.start();
  assert.equal(g.turn('left'),false);
  assert.equal(g.turn('up'),true);assert.equal(g.turn('left'),true);assert.equal(g.turn('down'),false);
  const before=head(g);g.step();assert.equal(g.snake[0].y,before.y-1);assert.equal(g.snake[0].x,before.x);
  g.step();assert.equal(g.snake[0].x,before.x-1);
});
test('撞墙后结束，结束后不再移动或加分',()=>{
  const g=game();g.start();
  for(let i=0;i<rules.settings.columns;i++)g.step();
  assert.equal(g.status,'over');const before=head(g);g.step();assert.deepEqual(head(g),before);assert.equal(g.score,0);
});
test('撞到身体结束，但可以进入本步即将离开的尾格',()=>{
  const g=game();g.start();g.direction='left';g.fruit={x:19,y:19};
  g.snake=[{x:2,y:2},{x:2,y:3},{x:1,y:3},{x:1,y:2}];
  g.step();assert.equal(g.status,'playing');assert.deepEqual(head(g),{x:1,y:2});
  g.snake=[{x:2,y:2},{x:2,y:3},{x:1,y:3},{x:1,y:2},{x:0,y:2}];
  g.step();assert.equal(g.status,'over');
});
test('暂停不移动，恢复后继续，重开清空所有本局状态',()=>{
  const g=game();g.start();g.pause();const before=head(g);g.step();assert.deepEqual(head(g),before);
  assert.equal(g.status,'paused');assert.equal(g.turn('up'),false);g.pause();g.step();assert.equal(g.status,'playing');
  g.score=7;g.turn('up');g.reset();assert.equal(g.score,0);assert.equal(g.status,'ready');assert.equal(g.snake.length,3);assert.equal(g.turns.length,0);
});
test('吃掉最后一个空格的苹果后通关，不会无限生成苹果',()=>{
  const g=game();g.start();
  // 蛇按逐行往返路径排列，唯一空格是头部左侧(0,0)。
  const path=[];
  for(let y=0;y<20;y++)for(let i=0;i<20;i++)path.push({x:y%2 ? 19-i : i,y});
  g.snake=path.slice(1);g.direction='left';g.fruit={x:0,y:0};g.score=396;
  g.step();assert.equal(g.status,'won');assert.equal(g.score,397);assert.equal(g.snake.length,400);assert.equal(g.fruit,null);
});

