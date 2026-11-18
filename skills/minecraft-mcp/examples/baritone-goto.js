// With x and z alone, any height at the destination is acceptable.
const {x, y, z} = mcp.args;
if (![x, z].every(Number.isInteger) || (y !== undefined && !Number.isInteger(y))) {
  throw new Error('Provide integer x and z, and optionally y');
}
if (!Client.isModLoaded('baritone')) throw new Error('Baritone is not installed');
const bot = Java.type('baritone.api.BaritoneAPI').getProvider().getPrimaryBaritone();
const nav = bot.getCustomGoalProcess();
const goal = y === undefined
  ? new (Java.type('baritone.api.pathing.goals.GoalXZ'))(x, z)
  : new (Java.type('baritone.api.pathing.goals.GoalBlock'))(x, y, z);

mcp.mainThread(() => {
  if (!Player.getPlayer()) throw new Error('No world loaded');
  if (nav.isActive()) throw new Error('Another custom goal is active');
  mcp.track(nav, 'onLostControl');
  nav.setGoalAndPath(goal);
});

while (true) {
  const state = mcp.mainThread(() => {
    const feet = bot.getPlayerContext().playerFeet();
    return {reached: goal.isInGoal(feet), active: nav.isActive()};
  });
  if (state.reached) break;
  if (!state.active) throw new Error('Navigation ended before reaching the destination');
  Client.waitTick(2);
}
console.log({destination: {x, y, z}, reached: true});
