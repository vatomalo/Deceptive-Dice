/* Browser services used by Deceptive Dice, hosted by QuickJS/SDL. */
'use strict';
globalThis.window = globalThis;
const console = Object.fromEntries(['log','warn','error'].map(k=>[k,(...v)=>native('log',v.map(String).join(' '))]));
class Event {
  constructor(type, init={}) { this.type=type; Object.assign(this,init); }
  preventDefault() {} stopPropagation() {}
}
class CustomEvent extends Event {}
class EventTarget {
  constructor() { this.listeners={}; }
  addEventListener(t,f,opts) { (this.listeners[t] ||= []).push({f,once:!!opts?.once}); }
  removeEventListener(t,f) { this.listeners[t]=(this.listeners[t]||[]).filter(x=>x.f!==f); }
  dispatchEvent(e) { for(const x of [...(this.listeners[e.type]||[])]) { x.f.call(this,e); if(x.once)this.removeEventListener(e.type,x.f); } if(this['on'+e.type])this['on'+e.type](e); return true; }
}
const events = new EventTarget();
globalThis.addEventListener=events.addEventListener.bind(events);
globalThis.removeEventListener=events.removeEventListener.bind(events);
globalThis.dispatchEvent=events.dispatchEvent.bind(events);
let now=0, nextTimer=1;
const timers=new Map(), rafs=new Map();
globalThis.performance={now:()=>now};
globalThis.setTimeout=(f,ms=0,...args)=>{ const id=nextTimer++; timers.set(id,{f:()=>f(...args),due:now+Number(ms),interval:0}); return id; };
globalThis.setInterval=(f,ms=0)=>{ const id=setTimeout(f,ms); timers.get(id).interval=Math.max(1,ms); return id; };
globalThis.clearTimeout=globalThis.clearInterval=id=>timers.delete(id);
globalThis.requestAnimationFrame=f=>{const id=nextTimer++;rafs.set(id,f);return id;};
globalThis.cancelAnimationFrame=id=>rafs.delete(id);
globalThis.innerWidth=640;globalThis.innerHeight=360;globalThis.devicePixelRatio=1;
globalThis.NativeFX={
  grass:particles=>native('grass',particles),
  updateGrass:(particles,dt)=>native('update-grass',particles,dt),
  updateWeather:(weather,dt)=>native('update-weather',weather,dt,canvas.height),
  updateSmoke:(smoke,dt)=>native('update-smoke',smoke,dt)
};
globalThis.navigator={maxTouchPoints:0,getGamepads:()=>pads};
let pads=[];
globalThis.fetch=async path=>{const text=native('read',String(path));return {ok:true,json:async()=>JSON.parse(text),text:async()=>text};};
class Image extends EventTarget {
  set src(path) {
    this._src=path;
    if(String(path).endsWith('/UI/Heart.png')){const heart=new Canvas();heart.width=16;heart.height=16;const c=heart.getContext('2d');c.fillStyle='#ff5555';for(const [x,y,w,h] of [[2,2,5,3],[9,2,5,3],[1,5,14,4],[3,9,10,2],[5,11,6,2],[7,13,2,2]])c.fillRect(x,y,w,h);path=heart.toDataURL();}
    if(String(path).startsWith('native-canvas:')){const c=canvasExports.get(path);this.id=c.id;this.width=c.width;this.height=c.height;this.complete=true;setTimeout(()=>this.dispatchEvent(new Event('load')),0);return;}
    try { const a=native('image',String(path)); [this.id,this.width,this.height]=a;this.naturalWidth=this.width;this.naturalHeight=this.height;this.complete=true;setTimeout(()=>this.dispatchEvent(new Event('load')),0); }
    catch(e) {console.warn(e);setTimeout(()=>this.dispatchEvent(new Event('error')),0);}
  }
  get src(){return this._src;}
}
class Audio extends EventTarget {
  constructor(src=''){super();this.src=src;this.loop=false;this.volume=1;this.paused=true;this.currentTime=0;this.channel=-1;}
  async play(){try{this.channel=native('audio',this.src,this.loop,this.volume,this.channel);this.paused=false;}catch(error){this.paused=true;this.dispatchEvent(new Event('error'));throw error;}}
  pause(){native('pause',this.channel);this.paused=true;}
  load(){} cloneNode(){return new Audio(this.src);}
}
class Element extends EventTarget {
  constructor(){super();this.style={};this.classList={add(){},remove(){}};this.textContent='';}
  click(){this.dispatchEvent(new Event('click'));}
  getBoundingClientRect(){return {left:0,top:0,width:this.width||1280,height:this.height||720};}
  requestFullscreen(){return Promise.resolve();}
}
class Gradient {
  constructor(args){this.args=args;this.stops=[];}
  addColorStop(pos,color){this.stops.push([pos,color]);}
}
class Canvas extends Element {
  constructor(backingScale=1){super();this.backingScale=backingScale;this._width=300;this._height=150;this.id=native('canvas',300,150);this.context=new Context(this);}
  resize(){native('resize',this.id,Math.ceil(this._width*this.backingScale),Math.ceil(this._height*this.backingScale));native('scale',this.id,this.backingScale,this.backingScale);}
  get width(){return this._width;} set width(v){this._width=v;this.resize();}
  get height(){return this._height;} set height(v){this._height=v;this.resize();}
  getContext(){return this.context;}
  toDataURL(){const key='native-canvas:'+this.id;canvasExports.set(key,this);return key;}
}
const canvasExports=new Map();
class Context {
  constructor(canvas){this.canvas=canvas;this.fillStyle='#000';this.strokeStyle='#000';this.globalAlpha=1;this.lineWidth=1;this.font='10px sans-serif';this.textAlign='start';this.textBaseline='alphabetic';this.globalCompositeOperation='source-over';this.stack=[];}
  call(op,...args){return native(op,this.canvas.id,...args);}
  style(stroke=false){
    const color=stroke?this.strokeStyle:this.fillStyle;
    if(this._color===color&&this._alpha===this.globalAlpha&&this._line===this.lineWidth&&this._blend===this.globalCompositeOperation)return;
    const mode=this._opaqueBackdrop&&this.globalCompositeOperation==='source-atop'?'source-over':this.globalCompositeOperation;
    native('style',this.canvas.id,color,this.globalAlpha,this.lineWidth,mode);
    this._color=color;this._alpha=this.globalAlpha;this._line=this.lineWidth;this._blend=this.globalCompositeOperation;
  }
  save(){this.stack.push([this.fillStyle,this.strokeStyle,this.globalAlpha,this.lineWidth,this.font,this.textAlign,this.textBaseline,this.globalCompositeOperation,this._color,this._alpha,this._line,this._blend]);native('save',this.canvas.id);}
  restore(){if(this.stack.length){const s=this.stack.pop();this.fillStyle=s[0];this.strokeStyle=s[1];this.globalAlpha=s[2];this.lineWidth=s[3];this.font=s[4];this.textAlign=s[5];this.textBaseline=s[6];this.globalCompositeOperation=s[7];this._color=s[8];this._alpha=s[9];this._line=s[10];this._blend=s[11];native('restore',this.canvas.id);}}
  setTransform(...a){this.call('setTransform',...a.map(v=>v*this.canvas.backingScale));} translate(x,y){this.call('translate',x,y);} scale(x,y){this.call('scale',x,y);} rotate(a){this.call('rotate',a);}
  clearRect(...a){this.call('clear',...a);} fillRect(...a){this.style();this.call('rect',...a,false);} strokeRect(...a){this.style(true);this.call('rect',...a,true);}
  beginPath(){this.call('begin');}closePath(){this.call('close');}moveTo(x,y){this.call('move',x,y);}lineTo(x,y){this.call('line',x,y);}
  arc(...a){this.call('arc',...a);}ellipse(...a){this.call('ellipse',...a);}
  fill(){this.style();this.call('fill');}stroke(){this.style(true);this.call('stroke');}
  createRadialGradient(...a){return new Gradient(a);}
  drawImage(image,a,b,c,d,e,f,g,h){
    if(!image?.id)return;
    if(arguments.length===3)native('draw',this.canvas.id,image.id,this.globalAlpha,this.globalCompositeOperation,a,b);
    else if(arguments.length===5)native('draw',this.canvas.id,image.id,this.globalAlpha,this.globalCompositeOperation,a,b,c,d);
    else native('draw',this.canvas.id,image.id,this.globalAlpha,this.globalCompositeOperation,a,b,c,d,e,f,g,h);
  }
  getImageData(...a){const data=this.call('pixels',...a);return {data:new Uint8ClampedArray(data),width:a[2],height:a[3]};}
  putImageData(image,x,y){this.call('put',image.data.buffer,image.width,image.height,x,y);}
  measureText(t){return {width:native('measure',String(t),this.font)};}
  fillText(t,x,y){this.text(t,x,y,false);}strokeText(t,x,y){this.text(t,x,y,true);}
  text(t,x,y,stroke){this.style(stroke);this.call('text',String(t),x,y,this.font,this.textAlign,this.textBaseline,stroke);}
}
const elements={};
globalThis.document=new EventTarget();
document.getElementById=id=>elements[id] ||= id==='audioPlayer'?new Audio():id==='game-canvas'?new Canvas():new Element();
document.createElement=kind=>kind==='canvas'?new Canvas():new Element();
document.body=new Element();document.documentElement=new Element();document.exitFullscreen=()=>Promise.resolve();
globalThis.__step=function(time){now=time;for(const [id,t] of [...timers])if(t.due<=now){if(t.interval)t.due=now+t.interval;else timers.delete(id);t.f();}const frames=[...rafs];rafs.clear();for(const [,f] of frames)f(now);};
globalThis.__input=function(type,key){const e=new Event(type,{key,code:key,repeat:false});document.dispatchEvent(e);dispatchEvent(e);};
let previousButtons=[], inventoryCursor=0;
function installHudCache(){
  const paint=(cache,target,key,box,draw)=>{
    if(cache.key!==key||cache.x!==box.x||cache.y!==box.y){
      if(!cache.canvas||cache.canvas.width!==box.w||cache.canvas.height!==box.h){
        cache.canvas=new Canvas();cache.canvas.width=box.w;cache.canvas.height=box.h;
        cache.canvas.context._opaqueBackdrop=true;
      }
      const c=cache.canvas.context;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,box.w,box.h);c.translate(-box.x,-box.y);
      draw(c);cache.key=key;cache.x=box.x;cache.y=box.y;
    }
    target.drawImage(cache.canvas,box.x,box.y);
  };
  const cacheable=target=>target===window.ctx&&target.globalAlpha===1&&target.globalCompositeOperation==='source-over';
  const healthDraw=HealthBar.prototype.draw;
  HealthBar.prototype.draw=function(){
    const target=this.ctx;if(!cacheable(target))return healthDraw.call(this);
    const cache=this._hudCache ||= {};
    const key=[this.hp,this.maxHP,this.width,this.height,this.color].join('|');
    paint(cache,target,key,{x:this.x-2,y:this.y-2,w:this.width+4,h:this.height+4},c=>{this.ctx=c;try{healthDraw.call(this);}finally{this.ctx=target;}});
    const c=cache.canvas.context;
    target.fillStyle=c.fillStyle;target.strokeStyle=c.strokeStyle;target.font=c.font;target.lineWidth=c.lineWidth;target.textAlign=c.textAlign;target.textBaseline=c.textBaseline;
  };
  const names=new Map(),nameDraw=window.drawNamePlate;
  window.drawNamePlate=function(target,x,y,title,level){
    if(!cacheable(target))return nameDraw(target,x,y,title,level);
    const slot=x+':'+y;if(!names.has(slot))names.set(slot,{});
    const key=[title,level,Stance.current,katanaIconReady].join('|');
    paint(names.get(slot),target,key,{x:0,y:y-4,w:canvas.width,h:56},c=>nameDraw(c,x,y,title,level));
  };
  const statsDraw=window.drawStats,stats=[{},{}];
  window.drawStats=function(target){
    if(!cacheable(target))return statsDraw(target);
    const enemy=window.CurrentEnemy||{};
    const key=[PlayerStats.STR,PlayerStats.AGI,PlayerStats.DEF,enemy.STR,enemy.AGI,enemy.DEF,getMateriaColor('player'),getMateriaColor('enemy')].join('|');
    paint(stats[0],target,key,{x:12,y:canvas.height-288,w:88,h:96},c=>statsDraw(c));
    paint(stats[1],target,key,{x:canvas.width-88,y:canvas.height-126,w:88,h:96},c=>statsDraw(c));
  };
  const actionsDraw=XBarControls.prototype.draw;
  XBarControls.prototype.draw=function(){
    const target=this.ctx;if(!cacheable(target))return actionsDraw.call(this);
    const buttons=[this.rollBtn,this.attackBtn,this.passBtn];
    const key=this.mode+'|'+buttons.map(b=>[b.x,b.y,b.label,b.enabled,b.visible].join(',')).join('|');
    const cache=this._hudCache ||= {};
    paint(cache,target,key,{x:BTN_ROLL_X-3,y:XBAR_Y-3,w:BTN_PASS_X-BTN_ROLL_X+BTN_W+6,h:BTN_H+6},c=>{this.ctx=c;try{actionsDraw.call(this);}finally{this.ctx=target;}});
  };
}
globalThis.__pad=function(buttons){
  const pressed=i=>buttons[i]&&!previousButtons[i];
  pads=[{buttons:buttons.map(pressed=>({pressed:!!pressed,value:pressed?1:0})),axes:[0,0,0,0],mapping:'standard',connected:true}];
  if(globalThis.materiaMenuOpen){
    if(pressed(12))inventoryCursor=Math.max(0,inventoryCursor-1);
    if(pressed(13))inventoryCursor=Math.min(Math.max(0,MateriaInventory.length-1),inventoryCursor+1);
    if(pressed(14))selectedMateriaSlot=(selectedMateriaSlot+MateriaSlots.maxSlots-1)%MateriaSlots.maxSlots;
    if(pressed(15))selectedMateriaSlot=(selectedMateriaSlot+1)%MateriaSlots.maxSlots;
    if(pressed(0)&&MateriaInventory.length)handleMateriaClick(120,190+inventoryCursor*28,canvas);
    if(pressed(1))materiaMenuOpen=false;
  }
  previousButtons=buttons.slice();
};
globalThis.__boot=function(){
  resizeGameCanvas();const mainCanvas=document.getElementById('game-canvas');mainCanvas.width=640;mainCanvas.height=360;
  native('main',mainCanvas.id);
  globalThis.drawWeatherFX=()=>native('particles',Weather,false);
  DiceSmoke.draw=()=>native('particles',DiceSmoke,true);
  document.dispatchEvent(new Event('DOMContentLoaded'));dispatchEvent(new Event('DOMContentLoaded'));
  installNativeCore();
  installNativeSprites();
  if(!globalThis.__disableHudCache)installHudCache();
  globalThis.cycleStance=dir=>dir<0?Stance.prev():Stance.next();
  const originalStep=__step;
  globalThis.__step=time=>{originalStep(time);if(globalThis.materiaMenuOpen){ctx.save();ctx.fillStyle='#fff';ctx.font='16px monospace';ctx.fillText('D-PAD: ITEM / SLOT   A: EQUIP   B: CLOSE',110,canvas.height-100);ctx.fillText('SLOT '+(selectedMateriaSlot+1)+'   ITEM '+(inventoryCursor+1),110,canvas.height-75);ctx.restore();}};
  document.getElementById('start-btn').click();
};
