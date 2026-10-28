#include "game_core.h"
#include <cassert>
#include <cmath>
#include <cstdio>
static void near(double a,double b) {assert(std::fabs(a-b)<1e-9);}
int main() {
    dd_core_init();
    for(int s=0;s<4;s++) {
        const double costs[]={15,21,12,15},regen[]={1,.85,1.25,1},hit[]={1,1,.8,1.25};
        dd_pool_set(0,DD_CURRENT,costs[s]-.001);
        assert(!dd_pool_action(0,DD_ATTACK,0,s));
        near(dd_pool_get(0,DD_CURRENT),costs[s]-.001);
        dd_pool_set(0,DD_CURRENT,costs[s]);
        assert(dd_pool_action(0,DD_ATTACK,0,s));near(dd_pool_get(0,DD_CURRENT),0);
        dd_pool_action(0,DD_ON_HIT,0,s);near(dd_pool_get(0,DD_CURRENT),28*hit[s]);
        dd_pool_set(0,DD_CURRENT,0);
        for(int i=0;i<60;i++)dd_pool_action(0,DD_REGENERATE,1000./60,s);
        near(dd_pool_get(0,DD_CURRENT),.015*regen[s]*1000/16);
        dd_pool_set(0,DD_CURRENT,0);dd_pool_action(0,DD_REGENERATE,1000,s);
        near(dd_pool_get(0,DD_CURRENT),.015*regen[s]*1000/16);
    }
    dd_pool_set(0,DD_MAX,108);dd_pool_action(0,DD_GAIN,1000,0);near(dd_pool_get(0,DD_CURRENT),108);
    dd_pool_set(0,DD_CURRENT,20);dd_pool_set(1,DD_CURRENT,80);
    dd_pool_action(0,DD_ATTACK,0,0);near(dd_pool_get(1,DD_CURRENT),80);
    dd_pool_set(1,DD_REGEN,.03);dd_pool_action(1,DD_REGENERATE,32,0);near(dd_pool_get(1,DD_CURRENT),80.06);
    // Player hooks captured base rates; changing the visible rate does not alter them.
    dd_pool_set(0,DD_REGEN,10);dd_pool_set(0,DD_CURRENT,0);
    dd_pool_action(0,DD_REGENERATE,16,0);near(dd_pool_get(0,DD_CURRENT),.015);
    for(int s=0;s<4;s++)for(int strength=1;strength<20;strength++)for(int defense=1;defense<20;defense++)for(int base=0;base<80;base++) {
        double multiplier[]={1,1.4,.9,.9};
        double original=std::floor(double(base)*strength/defense);
        near(dd_damage(base,strength,defense,s,0),original);
        near(dd_damage(base,strength,defense,s,1),std::fmax(1,std::floor(original*multiplier[s])));
    }
    near(dd_chance(-1,0),.06);near(dd_chance(1,0),.075);near(dd_chance(100,0),.4);
    near(dd_chance(-1,1),.04);near(dd_chance(1,1),.05);near(dd_chance(100,1),.25);
    near(dd_pool_get(-1,0),0);near(dd_pool_action(2,0,0,0),0);
    dd_core_init();dd_pool_set(0,DD_CURRENT,0);dd_pool_set(1,DD_CURRENT,0);
    dd_core_tick(1000,1);
    near(dd_pool_get(0,DD_CURRENT),.015*(.85+1)*1000/16);
    near(dd_pool_get(1,DD_CURRENT),.012*2*1000/16);
    std::puts("NATIVE_CPP_CORE_TESTS_PASSED");
}
