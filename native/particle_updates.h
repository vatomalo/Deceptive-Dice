/* Keep particle object state visible to the game while updating in native loops. */
static void set_number(JSValueConst object,const char *key,double value) {
    JS_SetPropertyStr(ctx,object,key,JS_NewFloat64(ctx,value));
}
static void update_grass(JSValueConst array,double dt) {
    int count=propnum(array,"length");
    for(int i=0;i<count;i++) {
        JSValue p=JS_GetPropertyUint32(ctx,array,i);
        set_number(p,"phase",propnum(p,"phase")+propnum(p,"speed")*dt);
        JS_FreeValue(ctx,p);
    }
}
static void update_weather(JSValueConst weather,double dt,double height) {
    const char *names[]={"petals","flakes","drops","grass"};
    for(int kind=0;kind<4;kind++) {
        JSValue array=JS_GetPropertyStr(ctx,weather,names[kind]);
        int count=propnum(array,"length"),live=0;
        for(int i=0;i<count;i++) {
            JSValue p=JS_GetPropertyUint32(ctx,array,i);int dead=0;
            double x=propnum(p,"x"),y=propnum(p,"y");
            if(kind==2) {y+=propnum(p,"speed")*dt/16;set_number(p,"y",y);dead=y>height+10;}
            else {
                double life=propnum(p,"life")-dt,t=propnum(p,"t")+dt;
                set_number(p,"life",life);set_number(p,"t",t);
                if(kind==0) {
                    x+=(propnum(p,"speedX")+sin(t*propnum(p,"waveFreq"))*propnum(p,"waveAmp")*.02)*dt/16;
                    y+=propnum(p,"speedY")*dt/16;
                    set_number(p,"x",x);set_number(p,"y",y);
                    set_number(p,"rotation",propnum(p,"rotation")+propnum(p,"rotSpeed")*dt/16);
                    dead=life<=0||y>propnum(p,"screenH")+40;
                } else if(kind==1) {
                    y+=propnum(p,"speedY")*dt/16;x+=sin(t*propnum(p,"waveFreq"))*propnum(p,"waveAmp")*.02*dt/16;
                    set_number(p,"x",x);set_number(p,"y",y);dead=life<=0||y>propnum(p,"screenH")+20;
                } else dead=life<=0;
            }
            if(dead)JS_FreeValue(ctx,p);
            else if(live!=i)JS_SetPropertyUint32(ctx,array,live++,p);
            else {live++;JS_FreeValue(ctx,p);}
        }
        JS_SetPropertyStr(ctx,array,"length",JS_NewInt32(ctx,live));JS_FreeValue(ctx,array);
    }
}
static void update_smoke(JSValueConst smoke,double dt) {
    JSValue array=JS_GetPropertyStr(ctx,smoke,"particles");int count=propnum(array,"length"),live=0;
    for(int i=0;i<count;i++) {
        JSValue p=JS_GetPropertyUint32(ctx,array,i);double life=propnum(p,"life")-dt,alpha=propnum(p,"alpha");
        set_number(p,"life",life);
        if(life>0) {
            set_number(p,"x",propnum(p,"x")+propnum(p,"vx")*dt/16);
            set_number(p,"y",propnum(p,"y")+propnum(p,"vy")*dt/16);
            alpha=fmax(0,alpha-.001*dt);set_number(p,"alpha",alpha);
        }
        if(life<=0||alpha<=0)JS_FreeValue(ctx,p);
        else if(live!=i)JS_SetPropertyUint32(ctx,array,live++,p);
        else {live++;JS_FreeValue(ctx,p);}
    }
    JS_SetPropertyStr(ctx,array,"length",JS_NewInt32(ctx,live));JS_FreeValue(ctx,array);
}
