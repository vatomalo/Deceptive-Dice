globalThis.installNativeSprites=function(){
  if(globalThis.__disableNativeSprites)return;
  const update=SpriteSheetAnimator.prototype.update,draw=SpriteSheetAnimator.prototype.draw;
  const characterDraw=Character.prototype.draw,clonesDraw=window.drawShadowClones;
  function ensure(anim){
    if(anim._nativeSprite)return anim._nativeSprite;
    if(!anim.frameWidth||!anim.frameHeight||!(anim.frameTime>0)||!(anim.frameCount>0))return null;
    const frames=anim.type==='list'?anim.frames:[anim.options?.depthMap&&anim.depthCanvas?anim.depthCanvas:anim.img];
    if(!frames?.length)return null;
    const handle=native('sprite-create',frames.map(frame=>frame?.id||0),anim.frameCount,anim.frameTime,anim.frameWidth,anim.frameHeight,anim.currentFrame,anim.timer);
    Object.defineProperty(anim,'_nativeSprite',{value:handle});
    ['currentFrame','timer','frameCount','frameTime'].forEach((name,field)=>Object.defineProperty(anim,name,{
      enumerable:true,configurable:true,get:()=>native('sprite-get',handle,field),set:value=>native('sprite-set',handle,field,value)
    }));
    return handle;
  }
  SpriteSheetAnimator.prototype.update=function(delta){
    const handle=ensure(this);if(handle)native('sprite-update',handle,delta);else update.call(this,delta);
  };
  SpriteSheetAnimator.prototype.draw=function(target,x,y,scale=1,tint=null){
    if(target===window.ctx&&!tint){const handle=ensure(this);if(handle){native('sprite-draw',target.canvas.id,handle,x,y,scale,target.globalAlpha,target.globalCompositeOperation);return;}}
    draw.call(this,target,x,y,scale,tint);
  };
  const actor=(object,target)=>{
    if(target!==window.ctx||!object.anim)return false;
    const handle=ensure(object.anim);if(!handle)return false;
    native('character-draw',target.canvas.id,handle,object.x,object.y,object.scale,object.flip,object.alpha,target.globalCompositeOperation);return true;
  };
  Character.prototype.draw=function(target){if(!actor(this,target))characterDraw.call(this,target);};
  window.drawShadowClones=function(target){
    if(target!==window.ctx)return clonesDraw(target);
    for(const clone of shadowClones)if(!clone.anim||!ensure(clone.anim))return clonesDraw(target);
    for(const clone of shadowClones)actor(clone,target);
  };
  globalThis.NativeSprites={ensure,referenceUpdate:update};
  console.log('Native C++ sprite timelines and actor drawing active');
};
