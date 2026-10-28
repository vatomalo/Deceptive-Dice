/* GPU presentation for the visible Canvas. Cairo remains the offscreen pixel API. */
static SDL_Renderer *gpu_renderer;
static int gpu_canvas;
typedef struct { char *text; int size; SDL_Texture *texture; int w,h; } GlyphRun;
static GlyphRun glyphs[256];
static unsigned glyph_next;
static SDL_Texture *frame_target;
static void gpu_begin_frame(void) {
    dd_batch_flush();
    if(!frame_target){
        frame_target=SDL_CreateTexture(gpu_renderer,SDL_PIXELFORMAT_ARGB8888,SDL_TEXTUREACCESS_TARGET,640,360);
        if(!frame_target){fprintf(stderr,"Frame target: %s\n",SDL_GetError());failed=1;return;}
        SDL_SetTextureBlendMode(frame_target,SDL_BLENDMODE_NONE);
        SDL_SetTextureScaleMode(frame_target,SDL_ScaleModeNearest);
    }
    if(SDL_SetRenderTarget(gpu_renderer,frame_target)){failed=1;return;}
    SDL_RenderSetLogicalSize(gpu_renderer,640,360);
    SDL_SetRenderDrawColor(gpu_renderer,0,0,0,255);SDL_RenderClear(gpu_renderer);
}
static void gpu_present(void) {
    dd_batch_flush();
    SDL_SetRenderTarget(gpu_renderer,NULL);SDL_RenderSetLogicalSize(gpu_renderer,640,360);
    SDL_RenderCopy(gpu_renderer,frame_target,NULL,NULL);SDL_RenderPresent(gpu_renderer);
}

static SDL_Color gpu_color(cairo_t *cr,double x,double y) {
    cairo_pattern_t *p=cairo_get_source(cr);
    double r=0,g=0,b=0,a=1;
    if(cairo_pattern_get_type(p)==CAIRO_PATTERN_TYPE_SOLID) cairo_pattern_get_rgba(p,&r,&g,&b,&a);
    else if(cairo_pattern_get_type(p)==CAIRO_PATTERN_TYPE_RADIAL) {
        double x0,y0,r0,x1,y1,r1;
        cairo_pattern_get_radial_circles(p,&x0,&y0,&r0,&x1,&y1,&r1);
        double t=fmax(0,fmin(1,(hypot(x-x1,y-y1)-r0)/fmax(.001,r1-r0)));
        int count=0;cairo_pattern_get_color_stop_count(p,&count);
        double last=0,lr=0,lg=0,lb=0,la=0;
        for(int i=0;i<count;i++) {
            double stop,rr,gg,bb,aa;cairo_pattern_get_color_stop_rgba(p,i,&stop,&rr,&gg,&bb,&aa);
            if(i==0||t>=stop){last=stop;lr=rr;lg=gg;lb=bb;la=aa;r=rr;g=gg;b=bb;a=aa;}
            else {double k=fmax(0,fmin(1,(t-last)/fmax(.00001,stop-last)));r=lr+(rr-lr)*k;g=lg+(gg-lg)*k;b=lb+(bb-lb)*k;a=la+(aa-la)*k;break;}
        }
    }
    return (SDL_Color){(Uint8)(fmax(0,fmin(1,r))*255),(Uint8)(fmax(0,fmin(1,g))*255),(Uint8)(fmax(0,fmin(1,b))*255),(Uint8)(fmax(0,fmin(1,a))*255)};
}
static SDL_BlendMode gpu_blend(cairo_t *cr) {return cairo_get_operator(cr)==CAIRO_OPERATOR_ADD?SDL_BLENDMODE_ADD:SDL_BLENDMODE_BLEND;}
static SDL_Vertex gpu_vertex(cairo_t *cr,double x,double y,SDL_Color color,float u,float v) {
    cairo_matrix_t m;cairo_get_matrix(cr,&m);cairo_matrix_transform_point(&m,&x,&y);
    return (SDL_Vertex){{(float)x,(float)y},color,{u,v}};
}
static void gpu_geometry(SDL_Texture *texture,SDL_Vertex *vertices,int count,int *indices,int index_count) {
    dd_batch_flush();
    if(SDL_RenderGeometry(gpu_renderer,texture,vertices,count,indices,index_count)) {
        fprintf(stderr,"GPU geometry: %s\n",SDL_GetError());failed=1;
    }
}
static void gpu_sprite_batch(void *user,SDL_Texture *texture,SDL_BlendMode blend,const SDL_Vertex *vertices,int count,const int *indices,int index_count){
    (void)user;SDL_SetTextureBlendMode(texture,blend);
    if(SDL_RenderGeometry(gpu_renderer,texture,vertices,count,indices,index_count)){
        fprintf(stderr,"Sprite batch: %s\n",SDL_GetError());failed=1;
    }
}
static SDL_Texture *gpu_surface(Surface *src) {
    if(src->gpu_texture&&src->gpu_revision==src->revision)return src->gpu_texture;
    dd_batch_flush();
    int w=cairo_image_surface_get_width(src->surface),h=cairo_image_surface_get_height(src->surface);
    if(src->gpu_texture)SDL_DestroyTexture(src->gpu_texture);
    src->gpu_texture=SDL_CreateTexture(gpu_renderer,SDL_PIXELFORMAT_ARGB8888,SDL_TEXTUREACCESS_STATIC,w,h);
    if(!src->gpu_texture){fprintf(stderr,"GPU texture: %s\n",SDL_GetError());failed=1;return NULL;}
    cairo_surface_flush(src->surface);
    const unsigned char *source=cairo_image_surface_get_data(src->surface);
    int stride=cairo_image_surface_get_stride(src->surface);
    Uint32 *pixels=malloc((size_t)w*h*4);if(!pixels){failed=1;return NULL;}
    for(int y=0;y<h;y++)for(int x=0;x<w;x++) {
        Uint32 p=((const Uint32*)(source+y*stride))[x];unsigned a=p>>24;
        if(a&&a<255) {
            unsigned r=((p>>16)&255)*255/a,g=((p>>8)&255)*255/a,b=(p&255)*255/a;
            if(r>255)r=255;if(g>255)g=255;if(b>255)b=255;
            p=(a<<24)|(r<<16)|(g<<8)|b;
        }
        pixels[(size_t)y*w+x]=p;
    }
    SDL_UpdateTexture(src->gpu_texture,NULL,pixels,w*4);free(pixels);
    SDL_SetTextureBlendMode(src->gpu_texture,SDL_BLENDMODE_BLEND);
    SDL_SetTextureScaleMode(src->gpu_texture,SDL_ScaleModeNearest);
    src->gpu_revision=src->revision;return src->gpu_texture;
}
static SDL_Rect gpu_alpha_bounds(Surface *src) {
    if(src->bounds_valid&&src->bounds_revision==src->revision)return src->bounds;
    cairo_surface_flush(src->surface);
    int w=cairo_image_surface_get_width(src->surface),h=cairo_image_surface_get_height(src->surface),stride=cairo_image_surface_get_stride(src->surface);
    unsigned char *pixels=cairo_image_surface_get_data(src->surface);
    int left=w,top=h,right=-1,bottom=-1;
    for(int y=0;y<h;y++)for(int x=0;x<w;x++)if(((Uint32*)(pixels+y*stride))[x]>>24){if(x<left)left=x;if(x>right)right=x;if(y<top)top=y;if(y>bottom)bottom=y;}
    src->bounds=right<left?(SDL_Rect){0,0,0,0}:(SDL_Rect){left,top,right-left+1,bottom-top+1};
    src->bounds_valid=1;src->bounds_revision=src->revision;return src->bounds;
}
static void gpu_image(cairo_t *cr,Surface *src,double alpha,const char *mode,double sx,double sy,double sw,double sh,double dx,double dy,double dw,double dh) {
    if(alpha<=0)return;
    SDL_Rect bounds=gpu_alpha_bounds(src);
    double left=fmax(sx,bounds.x),top=fmax(sy,bounds.y),right=fmin(sx+sw,bounds.x+bounds.w),bottom=fmin(sy+sh,bounds.y+bounds.h);
    if(right<=left||bottom<=top)return;
    dx+=(left-sx)*dw/sw;dy+=(top-sy)*dh/sh;dw*=(right-left)/sw;dh*=(bottom-top)/sh;
    sx=left;sy=top;sw=right-left;sh=bottom-top;
    SDL_Texture *texture=gpu_surface(src);if(!texture)return;
    double w=cairo_image_surface_get_width(src->surface),h=cairo_image_surface_get_height(src->surface);
    float u0=fmax(0,fmin(1,sx/w)),v0=fmax(0,fmin(1,sy/h)),u1=fmax(0,fmin(1,(sx+sw)/w)),v1=fmax(0,fmin(1,(sy+sh)/h));
    SDL_Color color={255,255,255,(Uint8)(fmax(0,fmin(1,alpha))*255)};
    SDL_Vertex vertices[]={gpu_vertex(cr,dx,dy,color,u0,v0),gpu_vertex(cr,dx+dw,dy,color,u1,v0),gpu_vertex(cr,dx+dw,dy+dh,color,u1,v1),gpu_vertex(cr,dx,dy+dh,color,u0,v1)};
    dd_batch_quad(texture,!strcmp(mode,"lighter")?SDL_BLENDMODE_ADD:SDL_BLENDMODE_BLEND,vertices);
}
static void gpu_quad(cairo_t *cr,SDL_Texture *texture,SDL_Color color,double x,double y,double w,double h) {
    SDL_Vertex vertices[]={gpu_vertex(cr,x,y,color,0,0),gpu_vertex(cr,x+w,y,color,1,0),gpu_vertex(cr,x+w,y+h,color,1,1),gpu_vertex(cr,x,y+h,color,0,1)};
    int indices[]={0,1,2,0,2,3};gpu_geometry(texture,vertices,4,indices,6);
}
static void gpu_rect(cairo_t *cr,double x,double y,double w,double h) {
    SDL_SetRenderDrawBlendMode(gpu_renderer,gpu_blend(cr));
    if(cairo_pattern_get_type(cairo_get_source(cr))==CAIRO_PATTERN_TYPE_SOLID) {
        gpu_quad(cr,NULL,gpu_color(cr,x,y),x,y,w,h);return;
    }
    enum {NX=24,NY=16};SDL_Vertex vertices[(NX+1)*(NY+1)];int indices[NX*NY*6],n=0;
    for(int j=0;j<=NY;j++)for(int i=0;i<=NX;i++) {double px=x+w*i/NX,py=y+h*j/NY;vertices[j*(NX+1)+i]=gpu_vertex(cr,px,py,gpu_color(cr,px,py),0,0);}
    for(int j=0;j<NY;j++)for(int i=0;i<NX;i++){int a=j*(NX+1)+i,b=a+1,c=a+NX+2,d=a+NX+1;indices[n++]=a;indices[n++]=b;indices[n++]=c;indices[n++]=a;indices[n++]=c;indices[n++]=d;}
    gpu_geometry(NULL,vertices,(NX+1)*(NY+1),indices,n);
}
static void gpu_polygon(cairo_t *cr,SDL_FPoint *points,int count,int stroke) {
    if(count<2)return;
    SDL_SetRenderDrawBlendMode(gpu_renderer,gpu_blend(cr));
    if(stroke) {
        double width=cairo_get_line_width(cr);
        for(int i=0;i<count-1;i++) {
            double ax=points[i].x,ay=points[i].y,bx=points[i+1].x,by=points[i+1].y;
            double len=hypot(bx-ax,by-ay);if(len<.001)continue;
            double nx=-(by-ay)/len*width*.5,ny=(bx-ax)/len*width*.5;
            SDL_Color color=gpu_color(cr,ax,ay);
            SDL_Vertex v[]={gpu_vertex(cr,ax+nx,ay+ny,color,0,0),gpu_vertex(cr,bx+nx,by+ny,color,0,0),gpu_vertex(cr,bx-nx,by-ny,color,0,0),gpu_vertex(cr,ax-nx,ay-ny,color,0,0)};
            int idx[]={0,1,2,0,2,3};gpu_geometry(NULL,v,4,idx,6);
        }return;
    }
    if(count<3)return;
    if(points[0].x==points[count-1].x&&points[0].y==points[count-1].y)count--;
    if(count<3||count>2046)return;
    double cx=0,cy=0;for(int i=0;i<count;i++){cx+=points[i].x;cy+=points[i].y;}cx/=count;cy/=count;
    SDL_Vertex vertices[2048];int indices[6144];
    vertices[0]=gpu_vertex(cr,cx,cy,gpu_color(cr,cx,cy),0,0);
    for(int i=0;i<count;i++){double x=points[i].x,y=points[i].y;vertices[i+1]=gpu_vertex(cr,x,y,gpu_color(cr,x,y),0,0);indices[i*3]=0;indices[i*3+1]=i+1;indices[i*3+2]=(i+1)%count+1;}
    gpu_geometry(NULL,vertices,count+1,indices,count*3);
}
static void gpu_path(cairo_t *cr,int stroke) {
    cairo_path_t *path=cairo_copy_path_flat(cr);SDL_FPoint points[2048];int count=0;
    for(int i=0;i<path->num_data;) {
        cairo_path_data_t *d=&path->data[i];
        if(d->header.type==CAIRO_PATH_MOVE_TO){if(count)gpu_polygon(cr,points,count,stroke);count=0;}
        if(d->header.type==CAIRO_PATH_MOVE_TO||d->header.type==CAIRO_PATH_LINE_TO){if(count<2047)points[count++]=(SDL_FPoint){d[1].point.x,d[1].point.y};}
        if(d->header.type==CAIRO_PATH_CLOSE_PATH&&count&&count<2048)points[count++]=points[0];
        i+=d->header.length;
    }
    if(count)gpu_polygon(cr,points,count,stroke);
    cairo_path_destroy(path);cairo_new_path(cr);
}
static void gpu_text(cairo_t *cr,const char *text,const char *spec,const char *align,const char *base,double x,double y,int stroke) {
    if(!*text)return;TTF_Font *ft=font(spec);if(!ft)return;
    int size=TTF_FontHeight(ft),slot=-1;
    for(int i=0;i<256;i++)if(glyphs[i].text&&glyphs[i].size==size&&!strcmp(glyphs[i].text,text)){slot=i;break;}
    if(slot<0) {
        slot=glyph_next++%256;GlyphRun *g=&glyphs[slot];free(g->text);if(g->texture)SDL_DestroyTexture(g->texture);memset(g,0,sizeof(*g));
        SDL_Color white={255,255,255,255};SDL_Surface *pixels=TTF_RenderUTF8_Blended(ft,text,white);if(!pixels)return;
        g->texture=SDL_CreateTextureFromSurface(gpu_renderer,pixels);g->w=pixels->w;g->h=pixels->h;g->text=strdup(text);g->size=size;SDL_FreeSurface(pixels);
        if(!g->texture){failed=1;return;}SDL_SetTextureBlendMode(g->texture,SDL_BLENDMODE_BLEND);
    }
    GlyphRun *g=&glyphs[slot];
    if(!strcmp(align,"center"))x-=g->w*.5;else if(!strcmp(align,"right")||!strcmp(align,"end"))x-=g->w;
    if(!strcmp(base,"middle"))y-=g->h*.5;else if(strcmp(base,"top")&&strcmp(base,"hanging"))y-=TTF_FontAscent(ft);
    SDL_Color color=gpu_color(cr,x,y);
    if(stroke){int radius=fmax(1,cairo_get_line_width(cr)*.5);for(int dx=-radius;dx<=radius;dx++)for(int dy=-radius;dy<=radius;dy++)if(dx*dx+dy*dy<=radius*radius)gpu_quad(cr,g->texture,color,x+dx,y+dy,g->w,g->h);}
    else gpu_quad(cr,g->texture,color,x,y,g->w,g->h);
}
static void gpu_cleanup(void) {
    dd_batch_flush();
    if(frame_target)SDL_DestroyTexture(frame_target);
    for(int i=1;i<=used;i++){if(surfaces[i].gpu_texture){SDL_DestroyTexture(surfaces[i].gpu_texture);surfaces[i].gpu_texture=NULL;}}
    for(int i=0;i<256;i++){free(glyphs[i].text);if(glyphs[i].texture)SDL_DestroyTexture(glyphs[i].texture);}
}

/* Weather and smoke are submitted in batches instead of crossing the JS/C
 * boundary for every particle path, transform and style change. */
static SDL_Vertex particle_vertices[16384];
static int particle_indices[49152],particle_count,particle_index_count;
static void particle_flush(void){if(particle_count){SDL_SetRenderDrawBlendMode(gpu_renderer,SDL_BLENDMODE_BLEND);gpu_geometry(NULL,particle_vertices,particle_count,particle_indices,particle_index_count);}particle_count=particle_index_count=0;}
static void particle_ellipse(double x,double y,double rx,double ry,double angle,SDL_Color center,SDL_Color edge) {
    enum{N=16};if(particle_count+N+1>=16384)particle_flush();int base=particle_count;
    particle_vertices[particle_count++]=(SDL_Vertex){{x,y},center,{0,0}};
    double ca=cos(angle),sa=sin(angle);
    for(int i=0;i<N;i++){double a=i*2*M_PI/N,px=cos(a)*rx,py=sin(a)*ry;particle_vertices[particle_count++]=(SDL_Vertex){{x+px*ca-py*sa,y+px*sa+py*ca},edge,{0,0}};particle_indices[particle_index_count++]=base;particle_indices[particle_index_count++]=base+i+1;particle_indices[particle_index_count++]=base+(i+1)%N+1;}
}
static void particle_line(double ax,double ay,double bx,double by,double width,SDL_Color color) {
    if(particle_count+4>=16384)particle_flush();double length=hypot(bx-ax,by-ay);if(length<.001)return;double nx=-(by-ay)*width*.5/length,ny=(bx-ax)*width*.5/length;int base=particle_count;
    particle_vertices[particle_count++]=(SDL_Vertex){{ax+nx,ay+ny},color,{0,0}};
    particle_vertices[particle_count++]=(SDL_Vertex){{bx+nx,by+ny},color,{0,0}};
    particle_vertices[particle_count++]=(SDL_Vertex){{bx-nx,by-ny},color,{0,0}};
    particle_vertices[particle_count++]=(SDL_Vertex){{ax-nx,ay-ny},color,{0,0}};
    const int indices[]={0,1,2,0,2,3};for(int i=0;i<6;i++)particle_indices[particle_index_count++]=base+indices[i];
}
static SDL_Color particle_color(JSValueConst p,double alpha){JSValue value=JS_GetPropertyStr(ctx,p,"color");const char *s=str(value);double r,g,b,a;rgba(s,&r,&g,&b,&a);JS_FreeCString(ctx,s);JS_FreeValue(ctx,value);return(SDL_Color){r*255,g*255,b*255,fmax(0,fmin(1,a*alpha))*255};}
static void gpu_particles(JSValueConst state,int smoke) {
    particle_count=particle_index_count=0;
    const char *names[]={"petals","flakes","drops","grass"};
    for(int kind=0;kind<(smoke?1:4);kind++) {
        JSValue array=JS_GetPropertyStr(ctx,state,smoke?"particles":names[kind]);int count=propnum(array,"length");
        for(int i=0;i<count;i++) {
            JSValue p=JS_GetPropertyUint32(ctx,array,i);double x=propnum(p,"x"),y=propnum(p,"y");
            if(smoke){double a=propnum(p,"alpha"),radius=propnum(p,"size");SDL_Color center={120,120,130,fmax(0,fmin(1,a*.8))*255},edge={120,120,130,0};particle_ellipse(x,y,radius,radius,0,center,edge);}
            else if(kind==2){SDL_Color color=particle_color(p,1);particle_line(x,y,x,y+propnum(p,"len"),1,color);}
            else {
                double t=propnum(p,"life")/fmax(1,propnum(p,"maxLife"));
                if(kind==0){double size=propnum(p,"size"),rot=propnum(p,"rotation");SDL_Color color=particle_color(p,t*.9);particle_ellipse(x,y,size,size*.55,rot,color,color);double px=-size*.25,py=-size*.15;particle_ellipse(x+px*cos(rot)-py*sin(rot),y+px*sin(rot)+py*cos(rot),size*.7,size*.45,rot,color,color);}
                else if(kind==1){SDL_Color color={245,245,255,fmax(0,fmin(1,.3+.7*t))*255};double r=propnum(p,"radius");particle_ellipse(x,y,r,r,0,color,color);}
                else {double base=propnum(p,"xBase"),offset=sin(propnum(p,"t")*propnum(p,"waveFreq"))*propnum(p,"waveAmp");SDL_Color color=particle_color(p,.4+.6*t);particle_line(base,y,base+offset,y-propnum(p,"height"),propnum(p,"width"),color);}
            }
            JS_FreeValue(ctx,p);
        }
        JS_FreeValue(ctx,array);
    }
    particle_flush();
}
static void gpu_grass(JSValueConst array) {
    particle_count=particle_index_count=0;int count=propnum(array,"length");
    for(int i=0;i<count;i++) {
        JSValue p=JS_GetPropertyUint32(ctx,array,i);
        double x=propnum(p,"baseX"),y=propnum(p,"baseY"),offset=sin(propnum(p,"phase"))*propnum(p,"bend");
        SDL_Color color={79,169,58,fmax(0,fmin(1,propnum(p,"alphaBase")))*255};
        particle_line(x,y,x+offset,y-propnum(p,"height"),propnum(p,"width"),color);
        JS_FreeValue(ctx,p);
    }
    particle_flush();
}
