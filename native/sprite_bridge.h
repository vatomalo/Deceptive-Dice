/* QuickJS owns each handle's lifetime; C++ owns its timeline and image list. */
static JSClassID sprite_class;
static void sprite_finalizer(JSRuntime *runtime,JSValue value){(void)runtime;dd_sprite_destroy(JS_GetOpaque(value,sprite_class));}
static void sprite_class_init(JSRuntime *runtime){
    JS_NewClassID(&sprite_class);JSClassDef definition={0};definition.class_name="NativeSprite";definition.finalizer=sprite_finalizer;
    JS_NewClass(runtime,sprite_class,&definition);
}
static JSValue sprite_create(JSValueConst *values){
    int count=propnum(values[1],"length");
    if(count<1||count>4096)return JS_ThrowRangeError(ctx,"Invalid sprite image count");
    int *images=malloc(sizeof(int)*count);if(!images)return JS_ThrowOutOfMemory(ctx);
    for(int i=0;i<count;i++)images[i]=itemnum(values[1],i);
    DDSprite *sprite=dd_sprite_create(images,count,num(values[2]),num(values[3]),num(values[4]),num(values[5]));free(images);
    if(!sprite)return JS_ThrowRangeError(ctx,"Invalid native sprite clip");
    dd_sprite_set(sprite,DD_SPRITE_FRAME,num(values[6]));dd_sprite_set(sprite,DD_SPRITE_TIMER,num(values[7]));
    JSValue object=JS_NewObjectClass(ctx,sprite_class);
    if(JS_IsException(object)){dd_sprite_destroy(sprite);return object;}
    JS_SetOpaque(object,sprite);return object;
}
static void sprite_draw(JSValueConst *values,int character){
    Surface *destination=surface(num(values[1]));DDSprite *sprite=JS_GetOpaque(values[2],sprite_class);
    DDSpriteFrame frame;if(!destination||num(values[1])!=gpu_canvas||!dd_sprite_frame(sprite,&frame))return;
    Surface *source=surface(frame.image);if(!source)return;
    double scale=num(values[5]),x=num(values[3]),y=num(values[4]);if(scale<=0)return;
    const double width=frame.sw*scale,height=frame.sh*scale;
    if(frame.whole_image){frame.sw=cairo_image_surface_get_width(source->surface);frame.sh=cairo_image_surface_get_height(source->surface);}
    cairo_t *cr=destination->cr;
    if(character){cairo_save(cr);cairo_translate(cr,x,y-height);if(JS_ToBool(ctx,values[6]))cairo_scale(cr,-1,1);x=-width/2;y=0;}
    const char *mode=str(values[character?8:7]);
    gpu_image(cr,source,num(values[character?7:6]),mode,frame.sx,frame.sy,frame.sw,frame.sh,x,y,frame.sw*scale,frame.sh*scale);
    JS_FreeCString(ctx,mode);if(character)cairo_restore(cr);
}
