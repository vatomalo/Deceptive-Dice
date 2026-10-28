#ifndef DD_GAME_CORE_H
#define DD_GAME_CORE_H
#ifdef __cplusplus
extern "C" {
#endif
/* Stable C ABI: no SDL, interpreter, heap allocation, or C++ runtime needed. */
enum dd_field { DD_MAX, DD_CURRENT, DD_REGEN, DD_LOW, DD_COST, DD_PASS, DD_HIT };
enum dd_action { DD_CAN_ATTACK, DD_SPEND, DD_ATTACK, DD_GAIN, DD_ON_HIT, DD_REGENERATE, DD_RESET };
void dd_core_init(void);
double dd_pool_get(int side, int field);
void dd_pool_set(int side, int field, double value);
double dd_pool_action(int side, int action, double value, int stance);
double dd_damage(double base, double strength, double defense, int stance, int player);
double dd_chance(double agility, int multihit);
void dd_core_tick(double dt, int stance);
#ifdef __cplusplus
}
#endif
#endif
