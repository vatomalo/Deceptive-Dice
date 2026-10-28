#include "sprite_core.h"
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <new>

struct DDSprite {
    int *images,image_count;
    double fields[4],width,height;
    void update(double delta){
        double &timer=fields[DD_SPRITE_TIMER],interval=fields[DD_SPRITE_INTERVAL];
        timer+=delta;
        if(interval>0&&fields[DD_SPRITE_COUNT]>0&&timer>=interval){
            const double steps=std::floor(timer/interval);
            timer=std::fmod(timer,interval);
            fields[DD_SPRITE_FRAME]=std::fmod(fields[DD_SPRITE_FRAME]+steps,fields[DD_SPRITE_COUNT]);
        }
    }
};
namespace {
struct SpriteBatch {
    enum { capacity=256 };
    SDL_Vertex vertices[capacity*4];int indices[capacity*6],size;
    SDL_Texture *texture;SDL_BlendMode blend;
    DDBatchSubmit submit;void *user;bool enabled;
    unsigned quads,submits;
    void flush(){
        if(size&&submit){submit(user,texture,blend,vertices,size*4,indices,size*6);submits++;}
        size=0;
    }
} batch={};
}
extern "C" {
DDSprite *dd_sprite_create(const int *images,int image_count,int frame_count,double interval,double width,double height){
    if(!images||image_count<1||image_count>4096||frame_count<1||!std::isfinite(interval)||interval<=0||width<=0||height<=0)return NULL;
    void *storage=std::malloc(sizeof(DDSprite));if(!storage)return NULL;
    DDSprite *sprite=new(storage) DDSprite{};
    sprite->images=(int*)std::malloc(sizeof(int)*image_count);
    if(!sprite->images){std::free(sprite);return NULL;}
    std::memcpy(sprite->images,images,sizeof(int)*image_count);sprite->image_count=image_count;
    sprite->fields[DD_SPRITE_COUNT]=frame_count;sprite->fields[DD_SPRITE_INTERVAL]=interval;
    sprite->width=width;sprite->height=height;return sprite;
}
void dd_sprite_destroy(DDSprite *sprite){if(sprite){std::free(sprite->images);sprite->~DDSprite();std::free(sprite);}}
double dd_sprite_get(const DDSprite *sprite,int field){return sprite&&field>=0&&field<4?sprite->fields[field]:0;}
void dd_sprite_set(DDSprite *sprite,int field,double value){if(sprite&&field>=0&&field<4)sprite->fields[field]=value;}
void dd_sprite_update(DDSprite *sprite,double delta){if(sprite)sprite->update(delta);}
int dd_sprite_frame(const DDSprite *sprite,DDSpriteFrame *frame){
    if(!sprite||!frame)return 0;
    const double current=sprite->fields[DD_SPRITE_FRAME];if(!std::isfinite(current)||current<0)return 0;
    frame->image=sprite->images[0];frame->whole_image=sprite->image_count>1;frame->sx=current*sprite->width;frame->sy=0;
    frame->sw=sprite->width;frame->sh=sprite->height;
    if(sprite->image_count>1){
        if(current!=std::floor(current)||current>=sprite->image_count)return 0;
        frame->image=sprite->images[(int)current];frame->sx=0;
    }
    return frame->image>0;
}
void dd_batch_configure(DDBatchSubmit submit,void *user,int enabled){batch.flush();batch.submit=submit;batch.user=user;batch.enabled=enabled!=0;}
void dd_batch_quad(SDL_Texture *texture,SDL_BlendMode blend,const SDL_Vertex *vertices){
    if(!batch.submit)return;
    if(batch.size&&(batch.texture!=texture||batch.blend!=blend||batch.size==SpriteBatch::capacity))batch.flush();
    if(!batch.size){batch.texture=texture;batch.blend=blend;}
    const int offset=batch.size*4,index=batch.size*6;
    std::memcpy(batch.vertices+offset,vertices,sizeof(SDL_Vertex)*4);
    const int quad[]={0,1,2,0,2,3};for(int i=0;i<6;i++)batch.indices[index+i]=offset+quad[i];
    batch.size++;batch.quads++;if(!batch.enabled)batch.flush();
}
void dd_batch_flush(void){batch.flush();}
void dd_batch_counts(unsigned *quads,unsigned *submits,int reset){
    if(quads)*quads=batch.quads;
    if(submits)*submits=batch.submits;
    if(reset){batch.quads=0;batch.submits=0;}
}
}
