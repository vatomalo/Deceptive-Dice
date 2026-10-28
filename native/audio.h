/* SDK mixer has Vorbis support but no MP3 decoder. Packaged audio uses Ogg. */
static void open_audio(void){
 if(SDL_InitSubSystem(SDL_INIT_AUDIO)){
  fprintf(stderr,"Audio init failed: %s\n",SDL_GetError());return;
 }
 int codecs=Mix_Init(MIX_INIT_OGG);
 fprintf(stdout,"Audio driver=%s codecs=0x%x\n",SDL_GetCurrentAudioDriver(),codecs);
 if(!(codecs&MIX_INIT_OGG))fprintf(stderr,"Ogg decoder unavailable: %s\n",Mix_GetError());
 if(Mix_OpenAudio(44100,MIX_DEFAULT_FORMAT,2,1024)){
  fprintf(stderr,"Audio device open failed: %s\n",Mix_GetError());return;
 }
 audio_ready=1;Mix_AllocateChannels(32);
 fprintf(stdout,"Audio device opened: 44100 Hz stereo\n");
}
static JSValue play_audio(JSValueConst *v){
 if(!audio_ready)return JS_ThrowInternalError(ctx,"Audio device unavailable; see startup log");
 const char *source=str(v[1]);if(!source)return JS_EXCEPTION;
 char ogg[2048];const char *path=source;size_t length=strlen(source);
 if(length>=4&&length+1<sizeof(ogg)&&!strcmp(source+length-4,".mp3")){
  memcpy(ogg,source,length-4);strcpy(ogg+length-4,".ogg");
  FILE *f=fopen(ogg,"rb");if(f){fclose(f);path=ogg;}
 }
 int channel=-1,volume=(int)(num(v[3])*MIX_MAX_VOLUME);
 if(JS_ToBool(ctx,v[2])){
  Mix_HaltMusic();if(music){Mix_FreeMusic(music);music=NULL;}
  music=Mix_LoadMUS(path);
  if(music){Mix_VolumeMusic(volume);if(Mix_PlayMusic(music,-1)==0)channel=-2;}
 }else{
  int i;for(i=0;i<sound_count;i++)if(!strcmp(sound_paths[i],path))break;
  if(i==sound_count&&i<256){sounds[i]=Mix_LoadWAV(path);sound_paths[i]=strdup(path);sound_count++;}
  if(i<256&&sounds[i]){
   if(num(v[4])>=0)Mix_HaltChannel(num(v[4]));
   channel=Mix_PlayChannel(-1,sounds[i],0);
   if(channel>=0)Mix_Volume(channel,volume);
  }
 }
 if(channel==-1){
  fprintf(stderr,"Audio playback failed: %s: %s\n",path,Mix_GetError());
  JSValue error=JS_ThrowInternalError(ctx,"Cannot play %s: %s",path,Mix_GetError());
  JS_FreeCString(ctx,source);return error;
 }
 JS_FreeCString(ctx,source);return JS_NewInt32(ctx,channel);
}
