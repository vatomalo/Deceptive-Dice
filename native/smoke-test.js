setTimeout(()=>{
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  assert(xbar&&dice.player.loaded&&samurai.anim.frameWidth>0,'Assets and combat must initialize');
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
