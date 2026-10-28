#include "game_core.h"
#include <cmath>

namespace {
struct Stance { double strength, cost, regen, hit; };
constexpr Stance stances[]={{1,1,1,1},{1.4,1.35,.85,1},{.9,.8,1.25,.8},{.9,1,1,1.25}};
class Stamina {
public:
    double fields[7];
    // The original player stance hook captures these values at initialization.
    double base_cost, base_regen, base_hit;
    void init(bool enemy) {
        fields[DD_MAX]=fields[DD_CURRENT]=100;
        base_regen=fields[DD_REGEN]=enemy?.012:.015;
        fields[DD_LOW]=20;
        base_cost=fields[DD_COST]=15;
        fields[DD_PASS]=6;
        base_hit=fields[DD_HIT]=enemy?0:28;
    }
    double gain(double n) {
        fields[DD_CURRENT]=std::fmin(fields[DD_MAX],fields[DD_CURRENT]+n);
        return fields[DD_CURRENT];
    }
    bool spend(double n) {
        if(fields[DD_CURRENT]<n)return false;
        fields[DD_CURRENT]=std::fmax(0,fields[DD_CURRENT]-n);
        return true;
    }
};
Stamina pools[2];
bool valid(int side,int field) {return side>=0&&side<2&&field>=0&&field<7;}
const Stance &stance_at(int stance) {return stances[stance>=0&&stance<4?stance:0];}
}
extern "C" {
void dd_core_init(void) {pools[0].init(false);pools[1].init(true);}
double dd_pool_get(int side,int field) {return valid(side,field)?pools[side].fields[field]:0;}
void dd_pool_set(int side,int field,double value) {if(valid(side,field))pools[side].fields[field]=value;}
double dd_pool_action(int side,int action,double value,int stance) {
    if(side<0||side>1)return 0;
    Stamina &p=pools[side];const Stance &s=stance_at(stance);
    switch(action) {
    // Preserve the original UI affordability test, which uses the base cost.
    case DD_CAN_ATTACK:return p.fields[DD_CURRENT]>=p.fields[DD_COST];
    case DD_SPEND:return p.spend(value);
    case DD_ATTACK:return p.spend(side?p.fields[DD_COST]:std::ceil(p.base_cost*s.cost));
    case DD_GAIN:return p.gain(value);
    case DD_ON_HIT:return p.gain(side?p.fields[DD_HIT]:p.base_hit*s.hit);
    case DD_REGENERATE:return p.gain((side?p.fields[DD_REGEN]:p.base_regen*s.regen)*value/16);
    case DD_RESET:p.fields[DD_CURRENT]=p.fields[DD_MAX];return p.fields[DD_CURRENT];
    default:return 0;
    }
}
double dd_damage(double base,double strength,double defense,int stance,int player) {
    double damage=std::floor(base*strength/defense);
    return player?std::fmax(1,std::floor(damage*stance_at(stance).strength)):damage;
}
double dd_chance(double agility,int multihit) {
    return multihit?std::fmax(.04,std::fmin(.25,.04+agility*.01)):
        std::fmax(.06,std::fmin(.4,.06+agility*.015));
}
void dd_core_tick(double dt,int stance) {
    for(int side=0;side<2;side++) {
        dd_pool_action(side,DD_REGENERATE,dt,stance);
        // Preserve the second regeneration pass in the original render loop.
        pools[side].gain(pools[side].fields[DD_REGEN]*dt/16);
    }
}
}
