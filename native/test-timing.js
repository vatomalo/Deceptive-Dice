/* Verify elapsed-time animation at different render rates without SDL. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={console:{log(){}},Math,canvas:{width:640,height:360}};
context.window=context;context.document={getElementById:()=>context.canvas};
vm.createContext(context);
for(const name of ['spritesheetanimator','weatherfx','dice-smoke'])
  vm.runInContext(fs.readFileSync(`engine/${name}.js`,'utf8'),context);
function simulate(code){return vm.runInContext(code,context);}
const animation=step=>simulate(`(()=>{const a=Object.assign(Object.create(SpriteSheetAnimator.prototype),{timer:0,frameTime:55,currentFrame:0,frameCount:7});for(let t=0;t<960;t+=${step})a.update(${step});return [a.currentFrame,a.timer];})()`);
assert.deepEqual(Array.from(animation(16)),Array.from(animation(32)));
assert.deepEqual(Array.from(animation(16)),Array.from(animation(64)));
const rain=step=>simulate(`(()=>{const d=Object.assign(Object.create(WeatherRainDrop.prototype),{y:0,speed:5});for(let t=0;t<960;t+=${step})d.update(${step});return d.y;})()`);
assert.equal(rain(16),rain(32));assert.equal(rain(16),rain(64));
const smoke=step=>simulate(`(()=>{const p=Object.assign(Object.create(SmokeParticle.prototype),{x:0,y:0,vx:.2,vy:-.3,life:2000,alpha:1});for(let t=0;t<320;t+=${step})p.update(${step});return [p.x,p.y,p.alpha];})()`);
const a=smoke(16),b=smoke(32);for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i]-b[i])<1e-9);
context.Character=function(){};context.performance={now:()=>context.clock};context.clock=0;
context.requestAnimationFrame=callback=>context.callbacks.push(callback);context.callbacks=[];
vm.runInContext(fs.readFileSync('engine/fxsystem_character.js','utf8'),context);
for(const step of [16,32,64,250]) {
  context.clock=0;context.callbacks=[];
  context.actor={x:0,y:0,alpha:1,setState(state){this.state=state;}};
  simulate('Character.prototype.blinkTo.call(actor,123,375)');
  while(context.callbacks.length){context.clock+=step;const callbacks=context.callbacks.splice(0);callbacks.forEach(callback=>callback(context.clock));}
  assert.equal(context.actor.x,123);assert.equal(context.actor.y,375);assert.equal(context.actor.alpha,1);assert.equal(context.actor.state,'idle');
  assert.ok(context.clock>=192&&context.clock<192+step);
}
for(const step of [16,32,64]) {
  simulate('shadowClones=[{life:160,alpha:.7}]');
  for(let t=0;t<192;t+=step)simulate(`updateShadowClones(${step})`);
  assert.equal(simulate('shadowClones.length'),0);
}
console.log('Animation, weather, smoke, blink and clone expiry retain timing across render rates');
