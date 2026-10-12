// 交互和计时层：只把输入交给规则，再让渲染器绘制。
(() => {
  'use strict';
  const game=new GameRules.SnakeGame();
  const canvas=document.querySelector('#board');
  const renderer=new SnakeRenderer(canvas,SnakeSkin);
  const ui=Object.fromEntries(['score','status','start-toggle','board-overlay','overlay-title','board-action','game-over','over-title','final-score','leaderboard-dialog'].map(id=>[id,document.getElementById(id)]));
  let lastTime=null,accumulator=0,resultShown=false,resumeAfterLeaderboard=false;
  function sync() {
    ui.score.textContent=game.score;
    const status=game.status;
    ui['start-toggle'].textContent={ready:'开始',playing:'暂停',paused:'继续',over:'结算',won:'结算'}[status];
    ui['board-overlay'].hidden=status==='playing';
    ui['overlay-title'].textContent={ready:'准备开始',paused:'已暂停',over:'游戏结束',won:'棋盘已填满'}[status]||'';
    ui['board-action'].textContent=status==='ready'?'开始游戏':status==='paused'?'继续游戏':'查看成绩';
    ui.status.textContent={ready:'方向键 / WASD 移动 · 空格暂停',playing:'方向键 / WASD 移动 · 空格暂停',paused:'已暂停 · 空格继续',over:'撞到墙壁或身体 · 本局结束',won:'棋盘已填满 · 挑战完成'}[status];
  }
  function showResult() {
    if(!resultShown) {
      resultShown=true;
      ui['over-title'].textContent=game.status==='won'?'恭喜通关':'游戏结束';
      ui['final-score'].textContent=game.score;
      LeaderboardUI.endRound(game.score);
    }
    if(!ui['game-over'].open)ui['game-over'].showModal();
  }
  function reset() {
    if(ui['game-over'].open)ui['game-over'].close();
    if(ui['leaderboard-dialog'].open){resumeAfterLeaderboard=false;ui['leaderboard-dialog'].close();}
    game.reset();LeaderboardUI.startRound();accumulator=0;lastTime=null;resultShown=false;sync();renderer.draw(game);
  }
  function toggle() {
    if(game.status==='ready')game.start();
    else if(game.status==='playing'||game.status==='paused')game.pause();
    else showResult();
    accumulator=0;lastTime=null;sync();
  }
  function direction(value) {
    if(game.status==='ready'){game.start();lastTime=null;accumulator=0;}
    game.turn(value);sync();
  }
  document.querySelector('#start-toggle').addEventListener('click',toggle);
  document.querySelector('#board-action').addEventListener('click',toggle);
  document.querySelector('#restart').addEventListener('click',reset);
  document.querySelector('#play-again').addEventListener('click',reset);
  document.querySelector('#view-board').addEventListener('click',()=>ui['game-over'].close());
  document.querySelector('#open-leaderboard').addEventListener('click',()=>{
    resumeAfterLeaderboard=game.status==='playing';
    if(resumeAfterLeaderboard)game.pause();
    accumulator=0;lastTime=null;sync();
    ui['leaderboard-dialog'].showModal();document.querySelector('#refresh-leaderboard').click();
  });
  document.querySelector('#close-leaderboard').addEventListener('click',()=>ui['leaderboard-dialog'].close());
  ui['leaderboard-dialog'].addEventListener('close',()=>{
    if(resumeAfterLeaderboard && game.status==='paused' && !document.hidden)game.pause();
    resumeAfterLeaderboard=false;accumulator=0;lastTime=null;sync();
  });
  const keyDirections={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'};
  document.addEventListener('keydown',event=>{
    if(event.target.closest('input,textarea,select,[contenteditable=true]') || document.querySelector('dialog[open]'))return;
    const key=event.key.length===1?event.key.toLowerCase():event.key;
    if(keyDirections[key]){event.preventDefault();if(!event.repeat)direction(keyDirections[key]);}
    else if((key===' '||key==='Enter') && !event.target.closest('button')){event.preventDefault();if(!event.repeat)toggle();}
    else if(key==='p'){event.preventDefault();if(!event.repeat)toggle();}
    else if(key==='r'){event.preventDefault();if(!event.repeat)reset();}
  });
  for(const button of document.querySelectorAll('[data-direction]'))button.addEventListener('click',()=>direction(button.dataset.direction));
  let touchStart=null;
  canvas.addEventListener('pointerdown',event=>{
    if(!event.isPrimary)return;
    touchStart={x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointerup',event=>{
    if(!touchStart)return;
    const dx=event.clientX-touchStart.x,dy=event.clientY-touchStart.y;touchStart=null;
    if(Math.max(Math.abs(dx),Math.abs(dy))>=15)direction(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');
  });
  canvas.addEventListener('pointercancel',()=>{touchStart=null;});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden && game.status==='playing'){game.pause();accumulator=0;lastTime=null;sync();}
  });
  function frame(now) {
    if(lastTime===null)lastTime=now;
    if(game.status==='playing') {
      accumulator+=Math.min(now-lastTime,GameRules.settings.tickMs*3);
      while(accumulator>=GameRules.settings.tickMs && game.status==='playing') {
        accumulator-=GameRules.settings.tickMs;game.step();sync();
        if(game.status==='over'||game.status==='won')showResult();
      }
    } else accumulator=0;
    lastTime=now;renderer.draw(game);requestAnimationFrame(frame);
  }
  reset();requestAnimationFrame(frame);
})();

