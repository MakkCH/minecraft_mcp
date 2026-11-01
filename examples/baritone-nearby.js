// Small real navigation exercise in a disposable world. Uses the existing terrain.
const bot = Java.type('baritone.api.BaritoneAPI').getProvider().getPrimaryBaritone();
const GoalXZ = Java.type('baritone.api.pathing.goals.GoalXZ');
const player = Player.getPlayer();
const start = {x:player.getX(), y:player.getY(), z:player.getZ()};
const goal = new GoalXZ(Math.floor(start.x) + 2, Math.floor(start.z));
Client.runOnMainThread(JavaWrapper.methodToJava(() => bot.getCustomGoalProcess().setGoalAndPath(goal)), true, 500);
let reached = false;
for (let i = 0; i < 200; i++) {
  const p = Player.getPlayer();
  reached = goal.isInGoal(Math.floor(p.getX()), Math.floor(p.getY()), Math.floor(p.getZ()));
  if (reached) break;
  Client.waitTick();
}
const end = Player.getPlayer();
console.log('NAVIGATION=' + JSON.stringify({start, end:{x:end.getX(), y:end.getY(), z:end.getZ()}, reached}));
