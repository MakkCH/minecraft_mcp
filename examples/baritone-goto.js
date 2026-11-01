// Edit the destination before running. This moves the player's real character.
const BaritoneAPI = Java.type('baritone.api.BaritoneAPI');
const GoalBlock = Java.type('baritone.api.pathing.goals.GoalBlock');
Client.runOnMainThread(JavaWrapper.methodToJava(() => {
  BaritoneAPI.getProvider().getPrimaryBaritone().getCustomGoalProcess()
    .setGoalAndPath(new GoalBlock(100, 64, 200));
  console.log('Baritone destination set: 100, 64, 200');
}));
