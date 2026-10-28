/* Transitional presentation adapter. Stamina lives only in C++ memory. */
globalThis.installNativeCore=function(){
  const stance=()=>['balance','fang','wind','aegis'].indexOf(Stance.current);
  const fields=['max','current','regenRate','lowThreshold','attackCost','passCost','onHitGain'];
  const oldPools=[PlayerStamina,EnemyStamina];
  const oldDamage=[computePlayerDamage,computeEnemyDamage];
  globalThis.__testNativeCore=function(){
    const assert=(a,b,label)=>{if(Math.abs(a-b)>1e-9||Number.isNaN(a)!==Number.isNaN(b))throw Error('C++ parity '+label+': '+a+' != '+b);};
    const savedStance=Stance.current;
    const snapshots=oldPools.map(p=>fields.map(f=>p[f]));
    let checks=0;
    for(let side=0;side<2;side++)for(let s=0;s<4;s++){
      Stance.current=['balance','fang','wind','aegis'][s];
      const original=oldPools[side], migrated=side?EnemyStamina:PlayerStamina;
      // Original stance methods capture their original pool but use `this`.
      for(let i=0;i<300;i++){
        const current=(i*37)%125,max=100+(i%3)*8;
        original.current=current;original.max=max;migrated.current=current;migrated.max=max;
        const methods=['spendForAttack','regen','onHit','spend','gain','reset','canAttack'];
        const method=methods[i%methods.length],arg=(i*13)%120;
        const expected=original[method](arg),actual=migrated[method](arg);
        if(typeof expected==='boolean'&&expected!==actual)throw Error('C++ parity '+method);
        assert(original.current,migrated.current,method);checks++;
      }
    }
    Stance.current=savedStance;
    oldPools.forEach((p,side)=>fields.forEach((f,i)=>{p[f]=snapshots[side][i];(side?EnemyStamina:PlayerStamina)[f]=snapshots[side][i];}));
    for(let s=0;s<4;s++)for(let base=0;base<80;base++){
      Stance.current=['balance','fang','wind','aegis'][s];
      assert(oldDamage[0](base),computePlayerDamage(base),'player damage');
      assert(oldDamage[1](base),computeEnemyDamage(base),'enemy damage');checks+=2;
    }
    Stance.current=savedStance;
    console.log('NATIVE_CPP_PARITY_PASSED checks='+checks);
  };
  const pools=oldPools.map((source,side)=>{
    const p={};
    fields.forEach((field,id)=>{
      native('core-set',side,id,source[field]);
      Object.defineProperty(p,field,{enumerable:true,get:()=>native('core-get',side,id),set:value=>native('core-set',side,id,value)});
    });
    const action=(id,value=0)=>native('core-action',side,id,value,stance());
    p.canAttack=()=>!!action(0);p.spend=value=>!!action(1,value);
    p.spendForAttack=p.use=()=>!!action(2);
    p.gain=value=>{action(3,value);};p.onHit=()=>{action(4);};
    p.regen=(dt=16)=>{action(5,dt);};p.reset=()=>{action(6);};
    return p;
  });
  window.PlayerStamina=pools[0];window.EnemyStamina=pools[1];
  window.computePlayerDamage=base=>native('core-damage',base,PlayerStats.STR,CurrentEnemy.DEF,stance(),1);
  window.computeEnemyDamage=base=>native('core-damage',base,CurrentEnemy.STR,PlayerStats.DEF,stance(),0);
  const chance=(who,multi)=>native('core-chance',(who==='enemy'?CurrentEnemy:PlayerStats)?.AGI??1,multi);
  window.tryEvade=(who='player')=>Math.random()<chance(who,0);
  window.tryMultihit=(who='player')=>Math.random()<chance(who,1);
  globalThis.NativeCore={ownsStamina:true};
  window.updateStamina=dt=>native('core-tick',dt,stance());
  console.log('Native C++ stamina and combat rules active');
};
