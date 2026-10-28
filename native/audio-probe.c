#include <SDL.h>
#include <SDL_mixer.h>
#include <stdio.h>
int main(int argc,char **argv){
 setbuf(stdout,NULL);
 for(int i=0;i<SDL_GetNumAudioDrivers();i++)printf("audio driver available: %s\n",SDL_GetAudioDriver(i));
 if(SDL_Init(SDL_INIT_AUDIO)){printf("audio init failed: %s\n",SDL_GetError());return 1;}
 printf("audio driver: %s\n",SDL_GetCurrentAudioDriver());
 int codecs=Mix_Init(MIX_INIT_MP3|MIX_INIT_OGG);printf("codec flags=%d error=%s\n",codecs,Mix_GetError());
 if(Mix_OpenAudio(44100,AUDIO_S16SYS,2,1024)){printf("audio open failed: %s\n",Mix_GetError());return 2;}
 for(int i=0;i<Mix_GetNumMusicDecoders();i++)printf("music decoder: %s\n",Mix_GetMusicDecoder(i));
 for(int i=1;i<argc;i++){
  Mix_Music *music=Mix_LoadMUS(argv[i]);printf("load %s: %s\n",argv[i],music?"OK":Mix_GetError());
  if(music){int rc=Mix_PlayMusic(music,0);printf("play rc=%d error=%s\n",rc,Mix_GetError());SDL_Delay(2500);printf("playing=%d\n",Mix_PlayingMusic());Mix_HaltMusic();Mix_FreeMusic(music);}
 }
 Mix_CloseAudio();Mix_Quit();SDL_Quit();return 0;
}
