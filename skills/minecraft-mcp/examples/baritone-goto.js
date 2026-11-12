// Moves the real player to args.x, args.y, args.z.
const {x, y, z} = mcp.args;
if (![x, y, z].every(Number.isInteger)) throw new Error('Provide integer x, y and z in args');
if (!Client.isModLoaded('baritone')) throw new Error('Baritone is not installed');
const BaritoneAPI = Java.type('baritone.api.BaritoneAPI');
const GoalBlock = Java.type('baritone.api.pathing.goals.GoalBlock');
mcp.mainThread(() => {
  if (!Player.getPlayer()) throw new Error('No world loaded');
  BaritoneAPI.getProvider().getPrimaryBaritone().getCustomGoalProcess()
    .setGoalAndPath(new GoalBlock(x, y, z));
});
console.log({destination: {x, y, z}});
