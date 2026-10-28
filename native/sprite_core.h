#ifndef DD_SPRITE_CORE_H
#define DD_SPRITE_CORE_H
#include <SDL.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct DDSprite DDSprite;
enum { DD_SPRITE_FRAME, DD_SPRITE_TIMER, DD_SPRITE_COUNT, DD_SPRITE_INTERVAL };
typedef struct {int image,whole_image;double sx,sy,sw,sh;} DDSpriteFrame;
DDSprite *dd_sprite_create(const int *images,int image_count,int frame_count,double interval,double width,double height);
void dd_sprite_destroy(DDSprite *sprite);
double dd_sprite_get(const DDSprite *sprite,int field);
void dd_sprite_set(DDSprite *sprite,int field,double value);
void dd_sprite_update(DDSprite *sprite,double delta);
int dd_sprite_frame(const DDSprite *sprite,DDSpriteFrame *frame);
typedef void (*DDBatchSubmit)(void *user,SDL_Texture *texture,SDL_BlendMode blend,const SDL_Vertex *vertices,int count,const int *indices,int index_count);
void dd_batch_configure(DDBatchSubmit submit,void *user,int enabled);
void dd_batch_quad(SDL_Texture *texture,SDL_BlendMode blend,const SDL_Vertex *vertices);
void dd_batch_flush(void);
void dd_batch_counts(unsigned *quads,unsigned *submits,int reset);
#ifdef __cplusplus
}
#endif
#endif
