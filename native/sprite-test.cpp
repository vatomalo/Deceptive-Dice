#include "sprite_core.h"
#include <cassert>
#include <cmath>
#include <cstdio>
#include <cstdint>
#include <initializer_list>
static int submits,vertices_seen;static SDL_Texture *order[16];
static void submit(void *,SDL_Texture *texture,SDL_BlendMode,const SDL_Vertex *vertices,int count,const int *indices,int index_count){
    assert(count%4==0&&index_count==count/4*6);
    for(int i=0;i<index_count;i++)assert(indices[i]>=0&&indices[i]<count);
    for(int i=0;i<count;i++)assert(vertices[i].position.x==float(vertices_seen+i));
    vertices_seen+=count;if(submits<16)order[submits]=texture;submits++;
}
static void quad(SDL_Texture *texture,SDL_BlendMode blend=SDL_BLENDMODE_BLEND){
    static int sequence;SDL_Vertex vertices[4]={};
    for(int i=0;i<4;i++)vertices[i].position.x=float(sequence++);
    dd_batch_quad(texture,blend,vertices);
}
int main(){
    int image=7;DDSpriteFrame frame;
    for(int hz: {15,30,60,120}){
        DDSprite *sprite=dd_sprite_create(&image,1,8,100,32,48);assert(sprite);
        for(int i=0;i<hz;i++)dd_sprite_update(sprite,1000./hz);
        // Floating-point frame sums may land just below the boundary; use a
        // final epsilon only for this cross-rate test of the 1-second endpoint.
        dd_sprite_update(sprite,1e-8);
        assert(dd_sprite_get(sprite,DD_SPRITE_FRAME)==2);
        assert(std::fabs(dd_sprite_get(sprite,DD_SPRITE_TIMER))<1e-6);
        assert(dd_sprite_frame(sprite,&frame)&&frame.image==7&&frame.sx==64&&frame.sw==32);
        dd_sprite_set(sprite,DD_SPRITE_FRAME,0);dd_sprite_set(sprite,DD_SPRITE_TIMER,0);
        dd_sprite_update(sprite,950);assert(dd_sprite_get(sprite,DD_SPRITE_FRAME)==1&&dd_sprite_get(sprite,DD_SPRITE_TIMER)==50);
        dd_sprite_set(sprite,DD_SPRITE_INTERVAL,50);dd_sprite_update(sprite,100);
        assert(dd_sprite_get(sprite,DD_SPRITE_FRAME)==4&&dd_sprite_get(sprite,DD_SPRITE_TIMER)==0);
        dd_sprite_destroy(sprite);
    }
    int images[]={11,0,13};DDSprite *list=dd_sprite_create(images,3,3,100,32,48);
    assert(dd_sprite_frame(list,&frame)&&frame.whole_image&&frame.image==11);
    dd_sprite_update(list,100);assert(!dd_sprite_frame(list,&frame));
    dd_sprite_update(list,100);assert(dd_sprite_frame(list,&frame)&&frame.image==13&&frame.sx==0);
    dd_sprite_destroy(list);assert(!dd_sprite_create(&image,0,1,100,32,48));
    SDL_Texture *a=(SDL_Texture*)(uintptr_t)1,*b=(SDL_Texture*)(uintptr_t)2;
    dd_batch_configure(submit,NULL,1);
    for(int i=0;i<257;i++)quad(a);
    dd_batch_flush();assert(submits==2&&vertices_seen==257*4);
    unsigned quads,draws;dd_batch_counts(&quads,&draws,1);assert(quads==257&&draws==2);
    quad(a);quad(a);quad(b);quad(a);dd_batch_flush();
    assert(submits==5&&order[2]==a&&order[3]==b&&order[4]==a);
    quad(a);quad(a,SDL_BLENDMODE_ADD);dd_batch_flush();assert(submits==7);
    dd_batch_configure(submit,NULL,0);quad(a);quad(a);assert(submits==9);
    std::puts("NATIVE_CPP_SPRITE_TESTS_PASSED");
}
