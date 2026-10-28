/* QuickJS + Cairo Canvas implementation, SDL display, controllers and mixer. */
#include "quickjs.h"
#include <SDL.h>
#include <SDL_image.h>
#include <SDL_ttf.h>
#include <SDL_mixer.h>
#include <cairo.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#include "profile.h"
#include "sprite_core.h"

#define LIMIT 4096
typedef struct { cairo_surface_t *surface; cairo_t *cr; char *path; SDL_Texture *gpu_texture; unsigned revision,gpu_revision,bounds_revision; int bounds_valid; SDL_Rect bounds; } Surface;
static Surface surfaces[LIMIT];
static int used, failed, audio_ready;
static JSContext *ctx;
static TTF_Font *fonts[100];
static Mix_Chunk *sounds[256];
static char *sound_paths[256];
static int sound_count;
static Mix_Music *music;
static double num(JSValueConst v){double d=0;JS_ToFloat64(ctx,&d,v);return d;}
static const char *str(JSValueConst v){return JS_ToCString(ctx,v);}
static void error(void){JSValue e=JS_GetException(ctx);const char *s=str(e);fprintf(stderr,"JavaScript: %s\n",s?s:"exception");JS_FreeCString(ctx,s);JSValue stack=JS_GetPropertyStr(ctx,e,"stack");s=str(stack);fprintf(stderr,"%s\n",s?s:"");JS_FreeCString(ctx,s);JS_FreeValue(ctx,stack);JS_FreeValue(ctx,e);failed=1;}
static JSValue run(const char *source,const char *name){JSValue r=JS_Eval(ctx,source,strlen(source),name,JS_EVAL_TYPE_GLOBAL);if(JS_IsException(r))error();return r;}
static char *read_file(const char *path){FILE *f=fopen(path,"rb");if(!f)return NULL;fseek(f,0,SEEK_END);long n=ftell(f);rewind(f);if(n<0||n>32*1024*1024){fclose(f);return NULL;}char *s=malloc(n+1);if(!s){fclose(f);return NULL;}size_t got=fread(s,1,n,f);s[got]=0;fclose(f);return s;}
static void load_script(const char *path){char *s=read_file(path);if(!s){fprintf(stderr,"Missing script: %s\n",path);failed=1;return;}JS_FreeValue(ctx,run(s,path));free(s);}
static Surface *surface(int id){return id>0&&id<=used?&surfaces[id]:NULL;}
static int create(int w,int h){if(used+1>=LIMIT||w<1||h<1||w>8192||h>8192)return 0;Surface *s=&surfaces[++used];s->surface=cairo_image_surface_create(CAIRO_FORMAT_ARGB32,w,h);s->cr=cairo_create(s->surface);return used;}
static void rgba(const char *s,double *r,double *g,double *b,double *a){
 *r=*g=*b=0;*a=1;if(!s)return;
 if(s[0]=='#'){unsigned v=0;sscanf(s+1,"%x",&v);if(strlen(s)==4){*r=((v>>8)&15)/15.;*g=((v>>4)&15)/15.;*b=(v&15)/15.;}else{*r=((v>>16)&255)/255.;*g=((v>>8)&255)/255.;*b=(v&255)/255.;}}
 else if(!strncmp(s,"rgb",3)){double rr=0,gg=0,bb=0,aa=1;const char *p=strchr(s,'(');if(p)sscanf(p+1,"%lf , %lf , %lf , %lf",&rr,&gg,&bb,&aa);*r=rr/255;*g=gg/255;*b=bb/255;*a=aa;}
 else if(!strcmp(s,"white"))*r=*g=*b=1;
 else if(!strcmp(s,"red"))*r=1;
 else if(!strcmp(s,"yellow"))*r=*g=1;
 else if(!strcmp(s,"transparent"))*a=0;
}
static void color(cairo_t *cr,JSValueConst v,double alpha){const char *s=str(v);double r,g,b,a;rgba(s,&r,&g,&b,&a);cairo_set_source_rgba(cr,r,g,b,a*alpha);JS_FreeCString(ctx,s);}
static double propnum(JSValueConst v,const char *p){JSValue x=JS_GetPropertyStr(ctx,v,p);double n=num(x);JS_FreeValue(ctx,x);return n;}
static double itemnum(JSValueConst v,int i){JSValue x=JS_GetPropertyUint32(ctx,v,i);double n=num(x);JS_FreeValue(ctx,x);return n;}
static int image(const char *path){for(int i=1;i<=used;i++)if(surfaces[i].path&&!strcmp(surfaces[i].path,path))return i;SDL_Surface *loaded=IMG_Load(path);if(!loaded)return 0;SDL_Surface *s=SDL_ConvertSurfaceFormat(loaded,SDL_PIXELFORMAT_ARGB8888,0);SDL_FreeSurface(loaded);if(!s)return 0;int id=create(s->w,s->h);if(id){Surface *d=surface(id);cairo_surface_flush(d->surface);unsigned char *out=cairo_image_surface_get_data(d->surface);int stride=cairo_image_surface_get_stride(d->surface);for(int y=0;y<s->h;y++)for(int x=0;x<s->w;x++){Uint32 p=*((Uint32*)((char*)s->pixels+y*s->pitch)+x);unsigned a=p>>24,r=(p>>16)&255,g=(p>>8)&255,b=p&255;((Uint32*)(out+y*stride))[x]=(a<<24)|((r*a/255)<<16)|((g*a/255)<<8)|(b*a/255);}cairo_surface_mark_dirty(d->surface);d->path=strdup(path);}SDL_FreeSurface(s);return id;}
static TTF_Font *font(const char *spec){int size=16;for(const char *p=spec;*p;p++)if(*p>='0'&&*p<='9'){size=atoi(p);break;}if(size<6)size=6;if(size>99)size=99;if(!fonts[size])fonts[size]=TTF_OpenFont("native/font.ttf",size);return fonts[size];}
#include "gpu.h"
#include "particle_updates.h"
#include "game_core.h"
#include "audio.h"
#include "sprite_bridge.h"

static JSValue native(JSContext *c,JSValueConst self,int argc,JSValueConst *v){
 (void)c;(void)self;if(argc<1)return JS_UNDEFINED;const char *op=str(v[0]);Uint64 op_start=profiling?SDL_GetPerformanceCounter():0;
 #define IS(s) (!strcmp(op,s))
 #define N(i) ((i)<argc?num(v[i]):0)
 #define DONE do{profile_record(op,op_start);JS_FreeCString(ctx,op);return JS_UNDEFINED;}while(0)
 #define RET(x) do{JSValue return_value=(x);profile_record(op,op_start);JS_FreeCString(ctx,op);return return_value;}while(0)
 if(IS("sprite-create"))RET(sprite_create(v));
 if(IS("sprite-get"))RET(JS_NewFloat64(ctx,dd_sprite_get(JS_GetOpaque(v[1],sprite_class),N(2))));
 if(IS("sprite-set")){dd_sprite_set(JS_GetOpaque(v[1],sprite_class),N(2),N(3));DONE;}
 if(IS("sprite-update")){dd_sprite_update(JS_GetOpaque(v[1],sprite_class),N(2));DONE;}
 if(IS("sprite-draw")||IS("character-draw")){sprite_draw(v,IS("character-draw"));DONE;}
 if(IS("log")){const char *s=str(v[1]);fprintf(stdout,"%s\n",s?s:"");JS_FreeCString(ctx,s);DONE;}
 if(IS("core-get"))RET(JS_NewFloat64(ctx,dd_pool_get(N(1),N(2))));
 if(IS("core-set")){dd_pool_set(N(1),N(2),N(3));DONE;}
 if(IS("core-action"))RET(JS_NewFloat64(ctx,dd_pool_action(N(1),N(2),N(3),N(4))));
 if(IS("core-damage"))RET(JS_NewFloat64(ctx,dd_damage(N(1),N(2),N(3),N(4),N(5))));
 if(IS("core-chance"))RET(JS_NewFloat64(ctx,dd_chance(N(1),N(2))));
 if(IS("core-tick")){dd_core_tick(N(1),N(2));DONE;}
 if(IS("read")){const char *path=str(v[1]);char *s=read_file(path);JS_FreeCString(ctx,path);if(!s){JS_FreeCString(ctx,op);return JS_ThrowReferenceError(ctx,"Cannot read asset");}JSValue result=JS_NewString(ctx,s);free(s);RET(result);}
 if(IS("update-grass")){update_grass(v[1],N(2));DONE;} if(IS("update-weather")){update_weather(v[1],N(2),N(3));DONE;} if(IS("update-smoke")){update_smoke(v[1],N(2));DONE;} if(IS("grass")){gpu_grass(v[1]);DONE;} if(IS("particles")){gpu_particles(v[1],JS_ToBool(ctx,v[2]));DONE;} if(IS("main")){gpu_canvas=N(1);Surface *main=surface(gpu_canvas);SDL_RenderSetLogicalSize(gpu_renderer,cairo_image_surface_get_width(main->surface),cairo_image_surface_get_height(main->surface));DONE;}
 if(IS("canvas"))RET(JS_NewInt32(ctx,create(N(1),N(2))));
 if(IS("image")){const char *p=str(v[1]);int id=image(p);if(!id){fprintf(stderr,"Image unavailable: %s (%s)\n",p,IMG_GetError());JS_FreeCString(ctx,p);JS_FreeCString(ctx,op);return JS_ThrowReferenceError(ctx,"Cannot load image");}JS_FreeCString(ctx,p);JSValue a=JS_NewArray(ctx);JS_SetPropertyUint32(ctx,a,0,JS_NewInt32(ctx,id));JS_SetPropertyUint32(ctx,a,1,JS_NewInt32(ctx,cairo_image_surface_get_width(surfaces[id].surface)));JS_SetPropertyUint32(ctx,a,2,JS_NewInt32(ctx,cairo_image_surface_get_height(surfaces[id].surface)));RET(a);}
 if(IS("measure")){const char *t=str(v[1]),*f=str(v[2]);TTF_Font *ft=font(f);int w=0,h=0;if(ft)TTF_SizeUTF8(ft,t,&w,&h);JS_FreeCString(ctx,t);JS_FreeCString(ctx,f);RET(JS_NewInt32(ctx,w));}
 if(IS("audio"))RET(play_audio(v));
 if(IS("music-playing"))RET(JS_NewBool(ctx,audio_ready&&Mix_PlayingMusic()));
 if(IS("pause")){if(audio_ready){if(N(1)==-2)Mix_HaltMusic();else if(N(1)>=0)Mix_HaltChannel(N(1));}DONE;}
 Surface *s=surface(N(1));if(!s){JS_FreeCString(ctx,op);return JS_ThrowRangeError(ctx,"Invalid canvas");}cairo_t *cr=s->cr;
 if(IS("resize")){int w=N(2),h=N(3);if(w>0&&h>0&&w<=8192&&h<=8192){cairo_destroy(cr);cairo_surface_destroy(s->surface);s->surface=cairo_image_surface_create(CAIRO_FORMAT_ARGB32,w,h);s->cr=cairo_create(s->surface);s->revision++;}DONE;}
 if(IS("save"))cairo_save(cr);else if(IS("restore"))cairo_restore(cr);
 else if(IS("setTransform")){cairo_matrix_t m;cairo_matrix_init(&m,N(2),N(3),N(4),N(5),N(6),N(7));cairo_set_matrix(cr,&m);}
 else if(IS("translate"))cairo_translate(cr,N(2),N(3));else if(IS("scale"))cairo_scale(cr,N(2),N(3));else if(IS("rotate"))cairo_rotate(cr,N(2));
 else if(IS("style")){
  const char *mode=str(v[5]);cairo_set_operator(cr,mode&&!strcmp(mode,"destination-in")?CAIRO_OPERATOR_DEST_IN:mode&&!strcmp(mode,"source-atop")?CAIRO_OPERATOR_ATOP:mode&&!strcmp(mode,"lighter")?CAIRO_OPERATOR_ADD:CAIRO_OPERATOR_OVER);JS_FreeCString(ctx,mode);cairo_set_line_width(cr,N(4));
  if(JS_IsObject(v[2])){JSValue a=JS_GetPropertyStr(ctx,v[2],"args"),stops=JS_GetPropertyStr(ctx,v[2],"stops");cairo_pattern_t *p=cairo_pattern_create_radial(itemnum(a,0),itemnum(a,1),itemnum(a,2),itemnum(a,3),itemnum(a,4),itemnum(a,5));int count=propnum(stops,"length");for(int i=0;i<count;i++){JSValue stop=JS_GetPropertyUint32(ctx,stops,i),col=JS_GetPropertyUint32(ctx,stop,1);const char *cs=str(col);double r,g,b,alpha;rgba(cs,&r,&g,&b,&alpha);cairo_pattern_add_color_stop_rgba(p,itemnum(stop,0),r,g,b,alpha*N(3));JS_FreeCString(ctx,cs);JS_FreeValue(ctx,col);JS_FreeValue(ctx,stop);}cairo_set_source(cr,p);cairo_pattern_destroy(p);JS_FreeValue(ctx,a);JS_FreeValue(ctx,stops);}else color(cr,v[2],N(3));
 }
 else if(IS("clear")&&N(1)==gpu_canvas){dd_batch_flush();SDL_SetRenderDrawBlendMode(gpu_renderer,SDL_BLENDMODE_NONE);SDL_SetRenderDrawColor(gpu_renderer,0,0,0,255);SDL_RenderClear(gpu_renderer);}
 else if(IS("clear")){cairo_save(cr);cairo_set_operator(cr,CAIRO_OPERATOR_CLEAR);cairo_rectangle(cr,N(2),N(3),N(4),N(5));cairo_fill(cr);cairo_restore(cr);}
 else if(IS("rect")){cairo_new_path(cr);cairo_rectangle(cr,N(2),N(3),N(4),N(5));if(N(1)==gpu_canvas){if(JS_ToBool(ctx,v[6]))gpu_path(cr,1);else{gpu_rect(cr,N(2),N(3),N(4),N(5));cairo_new_path(cr);}}else if(JS_ToBool(ctx,v[6]))cairo_stroke(cr);else cairo_fill(cr);}
 else if(IS("begin"))cairo_new_path(cr);else if(IS("close"))cairo_close_path(cr);else if(IS("move"))cairo_move_to(cr,N(2),N(3));else if(IS("line"))cairo_line_to(cr,N(2),N(3));
 else if(IS("arc")){if(argc>7&&JS_ToBool(ctx,v[7]))cairo_arc_negative(cr,N(2),N(3),N(4),N(5),N(6));else cairo_arc(cr,N(2),N(3),N(4),N(5),N(6));}
 else if(IS("ellipse")){cairo_save(cr);cairo_translate(cr,N(2),N(3));cairo_rotate(cr,N(6));cairo_scale(cr,fmax(.001,N(4)),fmax(.001,N(5)));if(argc>9&&JS_ToBool(ctx,v[9]))cairo_arc_negative(cr,0,0,1,N(7),N(8));else cairo_arc(cr,0,0,1,N(7),N(8));cairo_restore(cr);}
 else if(IS("fill")){if(N(1)==gpu_canvas)gpu_path(cr,0);else cairo_fill(cr);}else if(IS("stroke")){if(N(1)==gpu_canvas)gpu_path(cr,1);else cairo_stroke(cr);}
 else if(IS("draw")){
  Surface *src=surface(N(2));if(src){double sx=0,sy=0,sw=cairo_image_surface_get_width(src->surface),sh=cairo_image_surface_get_height(src->surface),dx=N(5),dy=N(6),dw=sw,dh=sh;if(argc==9){dw=N(7);dh=N(8);}else if(argc==13){sx=N(5);sy=N(6);sw=N(7);sh=N(8);dx=N(9);dy=N(10);dw=N(11);dh=N(12);}if(sw>0&&sh>0&&dw>0&&dh>0){if(N(1)==gpu_canvas){const char *mode=str(v[4]);gpu_image(cr,src,N(3),mode,sx,sy,sw,sh,dx,dy,dw,dh);JS_FreeCString(ctx,mode);}else{cairo_save(cr);const char *mode=str(v[4]);cairo_set_operator(cr,!strcmp(mode,"destination-in")?CAIRO_OPERATOR_DEST_IN:!strcmp(mode,"source-atop")?CAIRO_OPERATOR_ATOP:CAIRO_OPERATOR_OVER);JS_FreeCString(ctx,mode);cairo_translate(cr,dx,dy);cairo_scale(cr,dw/sw,dh/sh);cairo_rectangle(cr,0,0,sw,sh);cairo_clip(cr);cairo_set_source_surface(cr,src->surface,-sx,-sy);cairo_pattern_set_filter(cairo_get_source(cr),CAIRO_FILTER_NEAREST);cairo_paint_with_alpha(cr,N(3));cairo_restore(cr);}}}
 }
 else if(IS("pixels")){int x=N(2),y=N(3),w=N(4),h=N(5);if(w<1||h<1||w>8192||h>8192)RET(JS_ThrowRangeError(ctx,"Invalid image size"));size_t len=(size_t)w*h*4;unsigned char *out=calloc(1,len);if(!out)RET(JS_ThrowOutOfMemory(ctx));cairo_surface_flush(s->surface);unsigned char *src=cairo_image_surface_get_data(s->surface);int stride=cairo_image_surface_get_stride(s->surface),width=cairo_image_surface_get_width(s->surface),height=cairo_image_surface_get_height(s->surface);for(int j=0;j<h;j++)for(int i=0;i<w;i++)if(x+i>=0&&x+i<width&&y+j>=0&&y+j<height){Uint32 p=((Uint32*)(src+(y+j)*stride))[x+i];unsigned a=p>>24;size_t o=((size_t)j*w+i)*4;out[o]=a?(((p>>16)&255)*255/a):0;out[o+1]=a?(((p>>8)&255)*255/a):0;out[o+2]=a?((p&255)*255/a):0;out[o+3]=a;}JSValue result=JS_NewArrayBufferCopy(ctx,out,len);free(out);RET(result);}
 else if(IS("put")){size_t len;unsigned char *in=JS_GetArrayBuffer(ctx,&len,v[2]);int w=N(3),h=N(4),x=N(5),y=N(6);if(in&&w>0&&h>0&&len>=(size_t)w*h*4){cairo_surface_flush(s->surface);unsigned char *dst=cairo_image_surface_get_data(s->surface);int stride=cairo_image_surface_get_stride(s->surface),width=cairo_image_surface_get_width(s->surface),height=cairo_image_surface_get_height(s->surface);for(int j=0;j<h;j++)for(int i=0;i<w;i++)if(x+i>=0&&x+i<width&&y+j>=0&&y+j<height){size_t o=((size_t)j*w+i)*4;unsigned a=in[o+3];((Uint32*)(dst+(y+j)*stride))[x+i]=(a<<24)|((in[o]*a/255)<<16)|((in[o+1]*a/255)<<8)|(in[o+2]*a/255);}cairo_surface_mark_dirty(s->surface);}}
 else if(IS("text")){const char *t=str(v[2]),*spec=str(v[5]),*align=str(v[6]),*base=str(v[7]);TTF_Font *ft=font(spec);if(N(1)==gpu_canvas)gpu_text(cr,t,spec,align,base,N(3),N(4),JS_ToBool(ctx,v[8]));else if(ft&&*t){double x=N(3),y=N(4);int w=0,h=0;TTF_SizeUTF8(ft,t,&w,&h);if(!strcmp(align,"center"))x-=w/2.;else if(!strcmp(align,"right")||!strcmp(align,"end"))x-=w;if(!strcmp(base,"middle"))y-=h/2.;else if(strcmp(base,"top")&&strcmp(base,"hanging"))y-=TTF_FontAscent(ft);SDL_Color white={255,255,255,255};SDL_Surface *raw=TTF_RenderUTF8_Blended(ft,t,white);if(raw){SDL_Surface *mask=SDL_ConvertSurfaceFormat(raw,SDL_PIXELFORMAT_ARGB8888,0);if(mask){cairo_surface_t *cs=cairo_image_surface_create_for_data(mask->pixels,CAIRO_FORMAT_ARGB32,mask->w,mask->h,mask->pitch);cairo_mask_surface(cr,cs,x,y);cairo_surface_destroy(cs);SDL_FreeSurface(mask);}SDL_FreeSurface(raw);}}JS_FreeCString(ctx,t);JS_FreeCString(ctx,spec);JS_FreeCString(ctx,align);JS_FreeCString(ctx,base);}
 if(N(1)!=gpu_canvas&&(IS("draw")||IS("text")||IS("rect")||IS("clear")||IS("fill")||IS("stroke")||IS("put")))s->revision++;
 if(cairo_status(cr)!=CAIRO_STATUS_SUCCESS){fprintf(stderr,"Canvas: %s\n",cairo_status_to_string(cairo_status(cr)));failed=1;}
 DONE;
}
static void jobs(JSRuntime *rt){JSContext *job;int n=0,rc;while(n++<10000&&(rc=JS_ExecutePendingJob(rt,&job))!=0)if(rc<0){error();break;}}
static void call(const char *name,int argc,JSValue *args){JSValue global=JS_GetGlobalObject(ctx),fn=JS_GetPropertyStr(ctx,global,name),r=JS_Call(ctx,fn,global,argc,args);if(JS_IsException(r))error();JS_FreeValue(ctx,r);JS_FreeValue(ctx,fn);JS_FreeValue(ctx,global);for(int i=0;i<argc;i++)JS_FreeValue(ctx,args[i]);}
static void key(const char *type,const char *name){JSValue args[]={JS_NewString(ctx,type),JS_NewString(ctx,name)};call("__input",2,args);}
int main(int argc,char **argv){
 setbuf(stdout,NULL);int frames=0,smoke=0,seed=0;const char *screenshot=NULL;for(int i=1;i<argc;i++){if(!strcmp(argv[i],"--frames")&&i+1<argc)frames=atoi(argv[++i]);else if(!strcmp(argv[i],"--profile"))profiling=1;else if(!strcmp(argv[i],"--seed")&&i+1<argc)seed=atoi(argv[++i]);else if(!strcmp(argv[i],"--smoke"))smoke=1;else if(!strcmp(argv[i],"--screenshot")&&i+1<argc)screenshot=argv[++i];}
 const char *display=getenv("DICE_DISPLAY_RESOLUTION");if(!display)display="960x540";
 int display_w=960,display_h=540;if(sscanf(display,"%dx%d",&display_w,&display_h)!=2||!((display_w==960&&display_h==540)||(display_w==1280&&display_h==720))){fprintf(stderr,"Unsupported display surface\n");return 1;}
 setenv("SDL_PE_GFX_RESOLUTION",display,1);
 if(SDL_Init(SDL_INIT_VIDEO|SDL_INIT_GAMECONTROLLER|SDL_INIT_TIMER)){fprintf(stderr,"SDL: %s\n",SDL_GetError());return 1;}IMG_Init(IMG_INIT_PNG);TTF_Init();open_audio();
 SDL_Window *window=SDL_CreateWindow("Deceptive Dice",SDL_WINDOWPOS_CENTERED,SDL_WINDOWPOS_CENTERED,display_w,display_h,frames?SDL_WINDOW_HIDDEN:SDL_WINDOW_SHOWN);SDL_Renderer *renderer=SDL_CreateRenderer(window,-1,SDL_RENDERER_ACCELERATED|SDL_RENDERER_PRESENTVSYNC);if(!renderer)renderer=SDL_CreateRenderer(window,-1,SDL_RENDERER_SOFTWARE);if(!window||!renderer){fprintf(stderr,"Display: %s\n",SDL_GetError());return 1;}gpu_renderer=renderer;dd_batch_configure(gpu_sprite_batch,NULL,!getenv("DICE_DISABLE_BATCH"));SDL_RendererInfo ri;SDL_GetRendererInfo(renderer,&ri);fprintf(stdout,"Renderer: %s flags=%u geometry=SDL_RenderGeometry\n",ri.name,ri.flags);SDL_RenderSetLogicalSize(renderer,640,360);SDL_Texture *texture=NULL;int tw=0,th=0;
 JSRuntime *rt=JS_NewRuntime();JS_SetMemoryLimit(rt,256*1024*1024);JS_SetMaxStackSize(rt,2*1024*1024);ctx=JS_NewContext(rt);sprite_class_init(rt);JSValue global=JS_GetGlobalObject(ctx);JS_SetPropertyStr(ctx,global,"native",JS_NewCFunction(ctx,native,"native",1));JS_FreeValue(ctx,global);
 dd_core_init();load_script("native/platform.js");if(getenv("DICE_REFERENCE_SPRITES"))JS_FreeValue(ctx,run("globalThis.__disableNativeSprites=true","reference-sprites"));if(seed){char code[256];snprintf(code,sizeof(code),"RunSeed=%d;Math.random=(()=>{let s=RunSeed;return()=>{s=(Math.imul(s,1664525)+1013904223)|0;return(s>>>0)/4294967296;};})()",seed);JS_FreeValue(ctx,run(code,"seed"));}char *list=read_file("native/scripts.txt");if(!list)return 1;char *save=NULL;for(char *p=strtok_r(list,"\r\n",&save);p&&!failed;p=strtok_r(NULL,"\r\n",&save))load_script(p);free(list);jobs(rt);JS_FreeValue(ctx,run("__boot()","boot"));jobs(rt);if(smoke)load_script("native/smoke-test.js");
 SDL_GameController *controller=NULL;for(int i=0;i<SDL_NumJoysticks()&&!controller;i++)if(SDL_IsGameController(i))controller=SDL_GameControllerOpen(i);
 memset(profile_native,0,sizeof(profile_native));memset(profile_calls,0,sizeof(profile_calls));Uint32 start=SDL_GetTicks();int running=1,frame=0,profile_warmup=0;Uint32 profile_start=start;while(running&&!failed&&(!frames||frame<frames)){
 if(gpu_canvas)gpu_begin_frame();
 SDL_Event e;while(SDL_PollEvent(&e)){if(e.type==SDL_QUIT)running=0;if(e.type==SDL_CONTROLLERDEVICEADDED&&!controller&&SDL_IsGameController(e.cdevice.which))controller=SDL_GameControllerOpen(e.cdevice.which);if(e.type==SDL_CONTROLLERDEVICEREMOVED&&controller&&!SDL_GameControllerGetAttached(controller)){SDL_GameControllerClose(controller);controller=NULL;}if(e.type==SDL_KEYDOWN||e.type==SDL_KEYUP){const char *name=SDL_GetKeyName(e.key.keysym.sym);char lower[32];snprintf(lower,sizeof(lower),"%s",name);if(strlen(lower)==1&&lower[0]>='A'&&lower[0]<='Z')lower[0]+=32;if(e.key.keysym.sym==SDLK_ESCAPE&&e.type==SDL_KEYDOWN)running=0;else key(e.type==SDL_KEYDOWN?"keydown":"keyup",lower);}}
 if(controller){static const SDL_GameControllerButton map[]={SDL_CONTROLLER_BUTTON_A,SDL_CONTROLLER_BUTTON_B,SDL_CONTROLLER_BUTTON_X,SDL_CONTROLLER_BUTTON_Y,SDL_CONTROLLER_BUTTON_LEFTSHOULDER,SDL_CONTROLLER_BUTTON_RIGHTSHOULDER,SDL_CONTROLLER_BUTTON_INVALID,SDL_CONTROLLER_BUTTON_INVALID,SDL_CONTROLLER_BUTTON_BACK,SDL_CONTROLLER_BUTTON_START,SDL_CONTROLLER_BUTTON_LEFTSTICK,SDL_CONTROLLER_BUTTON_RIGHTSTICK,SDL_CONTROLLER_BUTTON_DPAD_UP,SDL_CONTROLLER_BUTTON_DPAD_DOWN,SDL_CONTROLLER_BUTTON_DPAD_LEFT,SDL_CONTROLLER_BUTTON_DPAD_RIGHT,SDL_CONTROLLER_BUTTON_GUIDE};JSValue buttons=JS_NewArray(ctx);for(int i=0;i<17;i++)JS_SetPropertyUint32(ctx,buttons,i,JS_NewBool(ctx,map[i]!=SDL_CONTROLLER_BUTTON_INVALID&&SDL_GameControllerGetButton(controller,map[i])));JSValue args[]={buttons};call("__pad",1,args);if(SDL_GameControllerGetButton(controller,SDL_CONTROLLER_BUTTON_START)&&SDL_GameControllerGetButton(controller,SDL_CONTROLLER_BUTTON_BACK))running=0;}
 if(smoke&&frame==20)JS_FreeValue(ctx,run("rollDie=(()=>{let n=0;return()=>++n%2?6:1;})()","fixed-roll"));if(smoke&&frame==30)JS_FreeValue(ctx,run("xbar.tryPress('roll')","smoke-roll"));if(smoke&&frame>=100&&frame<240)JS_FreeValue(ctx,run("if(!globalThis.__smokeAttackSent&&xbar.mode==='combat'&&xbar.attackBtn.enabled&&!xbar.lock){globalThis.__smokeAttackSent=true;xbar.tryPress('attack');}","smoke-attack"));
 JSValue args[]={JS_NewFloat64(ctx,frames?frame*(1000./60):SDL_GetTicks()-start)};Uint64 step_start=SDL_GetPerformanceCounter();call("__step",1,args);jobs(rt);profile_step_ms+=(SDL_GetPerformanceCounter()-step_start)*1000./SDL_GetPerformanceFrequency();Uint64 present_start=SDL_GetPerformanceCounter();
 global=JS_GetGlobalObject(ctx);JSValue canvas=JS_GetPropertyStr(ctx,global,"canvas");int id=propnum(canvas,"id");JS_FreeValue(ctx,canvas);JS_FreeValue(ctx,global);Surface *s=surface(id);if(s&&gpu_canvas){if(screenshot&&frames&&frame==frames-1){int w,h;SDL_GetRendererOutputSize(renderer,&w,&h);SDL_Surface *capture=SDL_CreateRGBSurfaceWithFormat(0,w,h,32,SDL_PIXELFORMAT_ARGB8888);if(capture){dd_batch_flush();SDL_RenderReadPixels(renderer,NULL,SDL_PIXELFORMAT_ARGB8888,capture->pixels,capture->pitch);SDL_SaveBMP(capture,screenshot);SDL_FreeSurface(capture);}}gpu_present();}else if(s){int w=cairo_image_surface_get_width(s->surface),h=cairo_image_surface_get_height(s->surface);if(!texture||tw!=w||th!=h){if(texture)SDL_DestroyTexture(texture);texture=SDL_CreateTexture(renderer,SDL_PIXELFORMAT_ARGB8888,SDL_TEXTUREACCESS_STREAMING,w,h);tw=w;th=h;}cairo_surface_flush(s->surface);SDL_UpdateTexture(texture,NULL,cairo_image_surface_get_data(s->surface),cairo_image_surface_get_stride(s->surface));SDL_SetRenderDrawColor(renderer,0,0,0,255);SDL_RenderClear(renderer);SDL_RenderCopy(renderer,texture,NULL,NULL);SDL_RenderPresent(renderer);if(screenshot&&frames&&frame==frames-1){SDL_Surface *capture=SDL_CreateRGBSurfaceWithFormatFrom(cairo_image_surface_get_data(s->surface),w,h,32,cairo_image_surface_get_stride(s->surface),SDL_PIXELFORMAT_ARGB8888);SDL_SaveBMP(capture,screenshot);SDL_FreeSurface(capture);}}
 profile_present_ms+=(SDL_GetPerformanceCounter()-present_start)*1000./SDL_GetPerformanceFrequency();frame++;if(profiling&&frame==60&&frames>=120){profile_warmup=60;profile_start=SDL_GetTicks();dd_batch_counts(NULL,NULL,1);memset(profile_native,0,sizeof(profile_native));memset(profile_calls,0,sizeof(profile_calls));profile_step_ms=profile_present_ms=0;}if(!frames)SDL_Delay(1);
 }
 profile_report(frame-profile_warmup,SDL_GetTicks()-profile_start);if(profiling){unsigned quads,submits;dd_batch_counts(&quads,&submits,0);fprintf(stdout,"SPRITE_BATCH quads=%u submits=%u\n",quads,submits);}if(smoke)JS_FreeValue(ctx,run("console.log(JSON.stringify({player:hpSamurai.hp,enemy:CurrentEnemy.hp,roll:playerFace,mode:xbar.mode,kills:TotalKills,attack:!!globalThis.__smokeAttackSent,assets:ASSET_PROMISES.length}))","smoke-result"));
 if(controller)SDL_GameControllerClose(controller);JS_FreeContext(ctx);JS_FreeRuntime(rt);if(audio_ready){Mix_HaltChannel(-1);for(int i=0;i<sound_count;i++){Mix_FreeChunk(sounds[i]);free(sound_paths[i]);}if(music)Mix_FreeMusic(music);Mix_CloseAudio();}for(int i=0;i<100;i++)if(fonts[i])TTF_CloseFont(fonts[i]);gpu_cleanup();for(int i=1;i<=used;i++){cairo_destroy(surfaces[i].cr);cairo_surface_destroy(surfaces[i].surface);free(surfaces[i].path);}if(texture)SDL_DestroyTexture(texture);SDL_DestroyRenderer(renderer);SDL_DestroyWindow(window);TTF_Quit();IMG_Quit();SDL_Quit();return failed?1:0;
}
