// 游戏规则与绘制分离；坐标是方格位置，不是像素。
globalThis.GameRules = (() => {
  const settings = { columns:20, rows:20, cellSize:24, initialLength:3, tickMs:140 };
  const directions = { up:{x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} };
  const fruitTypes = ['apple','pear','peach'];
  const same = (a,b) => a.x===b.x && a.y===b.y;
  class SnakeGame {
    constructor(random = Math.random) { this.random=random; this.reset(); }
    reset() {
      const x=Math.floor(settings.columns/2), y=Math.floor(settings.rows/2);
      this.snake=Array.from({length:settings.initialLength},(_,i)=>({x:x-i,y}));
      this.direction='right'; this.turns=[]; this.score=0; this.status='ready';
      this.fruit=this.generateFruit();
    }
    generateFruit() {
      const occupied=new Set(this.snake.map(p=>p.x+','+p.y));
      const free=[];
      for(let y=0;y<settings.rows;y++)for(let x=0;x<settings.columns;x++) {
        if(!occupied.has(x+','+y))free.push({x,y});
      }
      if(!free.length)return null;
      const position=free[Math.min(free.length-1,Math.floor(this.random()*free.length))];
      // 位置与种类分别抽取；同一种水果可以连续出现。
      const type=fruitTypes[Math.min(fruitTypes.length-1,Math.floor(this.random()*fruitTypes.length))];
      return {...position,type};
    }
    start() { if(this.status!=='ready')return false;this.status='playing';return true; }
    turn(direction) {
      if(this.status!=='playing' || !directions[direction] || this.turns.length>=2)return false;
      const last=this.turns.at(-1)||this.direction, a=directions[last], b=directions[direction];
      if(last===direction || (a.x+b.x===0 && a.y+b.y===0))return false;
      this.turns.push(direction);return true;
    }
    pause() {
      if(this.status==='playing'){this.status='paused';return true;}
      if(this.status==='paused'){this.status='playing';return true;}
      return false;
    }
    step() {
      if(this.status!=='playing')return;
      this.direction=this.turns.shift()||this.direction;
      const d=directions[this.direction], head=this.snake[0];
      const next={x:head.x+d.x,y:head.y+d.y};
      const eating=this.fruit && same(next,this.fruit);
      // 普通移动时尾格会空出来；吃到水果时尾巴不移走。
      const body=this.snake.slice(0,eating ? this.snake.length : -1);
      if(next.x<0 || next.y<0 || next.x>=settings.columns || next.y>=settings.rows || body.some(p=>same(p,next))) {
        this.status='over';return;
      }
      this.snake.unshift(next);
      if(eating) {
        this.score+=1;this.fruit=this.generateFruit();
        if(!this.fruit)this.status='won';
      } else this.snake.pop();
    }
  }
  return {settings,directions,SnakeGame,MAX_SCORE:settings.columns*settings.rows-settings.initialLength};
})();
if(typeof module!=='undefined' && module.exports)module.exports=globalThis.GameRules;

