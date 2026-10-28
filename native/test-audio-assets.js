const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),loaded=[];
let plays=0;
class Audio {constructor(src){if(src)loaded.push(src);}addEventListener(){}pause(){}play(){plays++;this.paused=false;return Promise.resolve();}}
const context={console:{log(){},warn(){},trace(){}},Audio,document:{getElementById(){return new Audio();}},performance:{now:()=>0}};
context.window=context;vm.createContext(context);
for(const file of ['engine/sfxsystem.js','engine/BGMsystem.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
for(const src of loaded)assert(fs.existsSync(path.join(root,src)),'Missing SFX: '+src);
for(const [mood,names] of Object.entries(context.MusicSystem.tracks))for(const name of names)
 assert(fs.existsSync(path.join(root,'BGM',mood,name+'.mp3')),'Missing music: '+mood+'/'+name);
console.log('All '+loaded.length+' SFX references and all mood playlists resolve with exact filename case');
context.MusicSystem.playRandom();assert.strictEqual(plays,1,'The first request at time zero must start music');
context.MusicSystem.playRandom();assert.strictEqual(plays,1,'Repeated requests must not restart music');
console.log('Music starts at time zero and duplicate requests are suppressed');
