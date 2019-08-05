const _ = require('lodash');
const taskdef = require('./t.json');
const tc = require('./clients/client');

const main = async () => {
  const taskGroupId = tc.slugid();
  const queue = new tc.Queue(tc.fromEnvVars());
  console.log(`task group: ${taskGroupId}`);

  for (let i = 0; i < 200; i++) {
    const task = _.cloneDeep(taskdef);
    task.taskGroupId = taskGroupId;
    task.created = tc.fromNow('0 seconds');
    task.deadline = tc.fromNow('2 hours');
    task.expires = tc.fromNow('7 days');
    const taskId = tc.slugid();

    await queue.createTask(taskId, task);
  }
};

main().then(console.log, console.log);
