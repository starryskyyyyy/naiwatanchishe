// 渲染只读游戏状态，不控制移动、计分和碰撞。
globalThis.SnakeRenderer = class SnakeRenderer {
  constructor(canvas, skin, layouts = globalThis.SnakeSkinLayout || {}) {
    this.canvas=canvas;this.context=canvas.getContext('2d');this.images={};
    const {columns,rows,cellSize}=GameRules.settings;
    this.width=columns*cellSize;this.height=rows*cellSize;
    const ratio=Math.min(globalThis.devicePixelRatio||1,2);
    canvas.width=this.width*ratio;canvas.height=this.height*ratio;
    this.ratio=ratio;
    this.layouts=layouts;
    for(const [part,url] of Object.entries(skin)) {
      if(!url)continue;
      const image=new Image();image.src=url;this.images[part]=image;
    }
  }
  drawSprite(part, image, size) {
    const layout=this.layouts[part];
    const sx=layout?.x || [0,1], sy=layout?.y || [0,1];
    const dx=sx.length===4?[0,.25,.75,1]:[0,1];
    const dy=sy.length===4?[0,.25,.75,1]:[0,1];
    // 九宫格缩放：将实际连接口映射到统一的中心、粗细。
    for(let y=0;y<sy.length-1;y++)for(let x=0;x<sx.length-1;x++) {
      this.context.drawImage(image,
        sx[x]*image.naturalWidth,sy[y]*image.naturalHeight,
        (sx[x+1]-sx[x])*image.naturalWidth,(sy[y+1]-sy[y])*image.naturalHeight,
        (dx[x]-.5)*size,(dy[y]-.5)*size,
        (dx[x+1]-dx[x])*size,(dy[y+1]-dy[y])*size);
    }
  }
  tile(part,point,angle=0) {
    const ctx=this.context, size=GameRules.settings.cellSize;
    ctx.save();ctx.translate((point.x+.5)*size,(point.y+.5)*size);ctx.rotate(angle);
    const image=this.images[part];
    if(image?.complete && image.naturalWidth)this.drawSprite(part,image,size);
    else {
      const fruitColors={apple:'#e48278',pear:'#f4c542',peach:'#f1a3b4'};
      const isFruit=Object.hasOwn(fruitColors,part);
      ctx.fillStyle=fruitColors[part] || (part==='head'?'#daf3b1':part==='tail'?'#87ad65':'#b4d78e');
      const padding=isFruit?5:2;
      ctx.beginPath();ctx.roundRect(-size/2+padding,-size/2+padding,size-padding*2,size-padding*2,isFruit?4:3);ctx.fill();
      if(part==='head'){ctx.strokeStyle='#f1f9e4';ctx.lineWidth=1.5;ctx.stroke();}
    }
    ctx.restore();
  }
  draw(game) {
    const ctx=this.context,size=GameRules.settings.cellSize;
    ctx.setTransform(this.ratio,0,0,this.ratio,0,0);
    ctx.fillStyle='#17251e';ctx.fillRect(0,0,this.width,this.height);
    ctx.strokeStyle='#ffffff06';ctx.lineWidth=1;
    ctx.beginPath();
    for(let x=0;x<=this.width;x+=size){ctx.moveTo(x,0);ctx.lineTo(x,this.height);}
    for(let y=0;y<=this.height;y+=size){ctx.moveTo(0,y);ctx.lineTo(this.width,y);}
    ctx.stroke();
    if(game.fruit)this.tile(game.fruit.type || 'apple',game.fruit);
    const angle=vector=>Math.atan2(vector.y,vector.x);
    game.snake.forEach((point,i)=>{
      if(i===0)this.tile('head',point,angle(GameRules.directions[game.direction]));
      else if(i===game.snake.length-1){const p=game.snake[i-1];this.tile('tail',point,angle({x:point.x-p.x,y:point.y-p.y}));}
      else {
        const before=game.snake[i-1],after=game.snake[i+1];
        if(before.x===after.x)this.tile('body',point,Math.PI/2);
        else if(before.y===after.y)this.tile('body',point);
        else {
          const side=p=>p.x<point.x?'left':p.x>point.x?'right':p.y<point.y?'up':'down';
          const key=[side(before),side(after)].sort().join(',');
          const rotations={'down,left':0,'left,up':Math.PI/2,'right,up':Math.PI,'down,right':Math.PI*1.5};
          this.tile(this.images.corner?'corner':'body',point,rotations[key]);
        }
      }
    });
  }
};
