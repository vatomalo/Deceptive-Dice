setTimeout(()=>{
  __testNativeCore();
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  assert(xbar&&dice.player.loaded&&samurai.anim.frameWidth>0,'Assets and combat must initialize');
  assert(canvas.width===640&&canvas.height===360,'Preserve the original 640x360 game resolution');
  assert(SAMURAI_HOME_X===120&&KNIGHT_HOME_X===420&&SAMURAI_HOME_Y===375,'Preserve original actor positions');
  assert(xbar.rollBtn.y===320&&xbar.passBtn.x===180,'Preserve original action positions');
  const fields={x:10,y:20,life:100,maxLife:100,t:10,speed:5,speedX:.2,speedY:.4,waveAmp:3,waveFreq:.01,rotation:.3,rotSpeed:.02,screenH:360};
  const classes=[WeatherSakuraPetal,WeatherSnowFlake,WeatherRainDrop,WeatherGrassFoliage];
  const names=['petals','flakes','drops','grass'],fixture={},expected={};
  for(let i=0;i<classes.length;i++){
    fixture[names[i]]=[Object.assign(Object.create(classes[i].prototype),fields)];
    expected[names[i]]=[Object.assign(Object.create(classes[i].prototype),fields)];
    expected[names[i]][0].update(32);
  }
  NativeFX.updateWeather(fixture,32);
  for(const name of names)for(const key of ['x','y','life','t','rotation'])
    assert(Math.abs(fixture[name][0][key]-expected[name][0][key])<1e-9,'Native weather parity: '+name+'.'+key);
  const dying=Object.assign(Object.create(SmokeParticle.prototype),{x:1,y:2,life:10,alpha:.5,vx:.2,vy:-.3});
  const live=Object.assign(Object.create(SmokeParticle.prototype),{x:1,y:2,life:100,alpha:.5,vx:.2,vy:-.3});
  const reference=Object.assign(Object.create(SmokeParticle.prototype),live);reference.update(32);
  const smokeFixture={particles:[dying,live]};NativeFX.updateSmoke(smokeFixture,32);
  assert(smokeFixture.particles.length===1,'Native smoke must cull expired particles');
  for(const key of ['x','y','life','alpha'])assert(Math.abs(live[key]-reference[key])<1e-9,'Native smoke parity: '+key);
  const grassFixture=[{phase:.2,speed:.001}];NativeFX.updateGrass(grassFixture,32);
  assert(Math.abs(grassFixture[0].phase-.232)<1e-9,'Native grass timing');
  console.log('NATIVE_PARTICLE_PARITY_PASSED');
  const stance=Stance.current;cycleStance(1);assert(Stance.current!==stance,'Shoulder must change stance');cycleStance(-1);
  MateriaInventory.push('crit');materiaMenuOpen=true;
  const buttons=Array(17).fill(false);buttons[0]=true;__pad(buttons);
  assert(MateriaSlots.equipped[0]==='crit'&&Materia.crit,'Controller must equip materia');
  __pad(Array(17).fill(false));materiaMenuOpen=false;
  MateriaInventory.pop();MateriaSlots.equipped[0]=null;rebuildMateriaFlags();
  const result=QTE.prompt({durationMs:200});
  const map={cross:0,circle:1,square:2,triangle:3};
  buttons.fill(false);buttons[map[QTE.action]]=true;__pad(buttons);QTE.pollGamepad();QTE.update();
  result.then(ok=>{assert(ok,'Correct controller QTE must succeed');console.log('NATIVE_INPUT_TESTS_PASSED');});
  __pad(Array(17).fill(false));
},200);
setTimeout(()=>{
  if(!globalThis.__smokeAttackSent||TotalKills<1||xbar.mode!=='roll')throw new Error('Combat smoke round did not finish');
  console.log('NATIVE_COMBAT_ROUND_PASSED');
},6500);
