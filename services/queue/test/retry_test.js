const debug = require('debug')('test:retry');
const slugid = require('slugid');
const taskcluster = require('taskcluster-client');
const assume = require('assume');
const helper = require('./helper');
const testing = require('taskcluster-lib-testing');

helper.secrets.mockSuite(__filename, ['taskcluster', 'aws', 'azure'], function(mock, skipping) {
  helper.withAmazonIPRanges(mock, skipping);
  helper.withPulse(mock, skipping);
  helper.withS3(mock, skipping);
  helper.withQueueService(mock, skipping);
  helper.withBlobStore(mock, skipping);
  helper.withEntities(mock, skipping);
  helper.withServer(mock, skipping);
  helper.withPollingServices(mock, skipping);

  // Use the same task definition for everything
  const taskDef = {
    provisionerId: 'no-provisioner-extended-extended',
    workerType: 'test-worker-extended-extended',
    created: taskcluster.fromNowJSON(),
    deadline: taskcluster.fromNowJSON('3 days'),
    retries: 1,
    payload: {},
    metadata: {
      name: 'Unit testing task',
      description: 'Task created during unit tests',
      owner: 'jonsafj@mozilla.com',
      source: 'https://github.com/taskcluster/taskcluster-queue',
    },
  };

  test('createTask, claimTask, claim-expired, retry, ...', testing.runWithFakeTime(async () => {
    const taskId = slugid.v4();

    debug('### Creating task');
    await helper.queue.createTask(taskId, taskDef);
    helper.checkNextMessage('task-defined');
    helper.checkNextMessage('task-pending');

    debug('### Claim task (runId: 0)');
    const r2 = await helper.queue.claimTask(taskId, 0, {
      workerGroup: 'my-worker-group-extended-extended',
      workerId: 'my-worker-extended-extended',
    });
    debug(`claimed until ${r2.takenUntil}, ${new Date(r2.takenUntil) - new Date()}ms from now`);
    helper.checkNextMessage('task-running');

    debug('### Start claim-resolver');
    await helper.startPollingService('claim-resolver');

    debug('### Wait for task-pending message after reaping');
    await testing.poll(async () => {
      helper.checkNextMessage('task-pending', m => {
        assume(m.payload.status.runs.length).equals(2);
        assume(m.payload.status.runs[0].state).equals('exception');
        assume(m.payload.status.runs[0].reasonResolved).equals('claim-expired');
      });
    }, Infinity);
    // there should be no task-exception message in this case
    helper.checkNoNextMessage('task-exception');

    debug('### Stop claimResolver');
    await helper.stopPollingService();

    debug('### Task status');
    const r3 = await helper.queue.status(taskId);
    assume(r3.status.state).equals('pending');

    debug('### Claim task (runId: 1)');
    const r4 = await helper.queue.claimTask(taskId, 1, {
      workerGroup: 'my-worker-group-extended-extended',
      workerId: 'my-worker-extended-extended',
    });
    assume(r4.status.retriesLeft).equals(0);
    debug(`claimed until ${r4.takenUntil}, ${new Date(r2.takenUntil) - new Date()}ms from now`);

    debug('### Start claimResolver (again)');
    await helper.startPollingService('claim-resolver');

    debug('### Wait for task-exception message (again)');
    await testing.poll(async () => {
      helper.checkNextMessage('task-exception', m => {
        assume(m.payload.status.runs.length).equals(2);
        assume(m.payload.status.runs[0].state).equals('exception');
        assume(m.payload.status.runs[0].reasonResolved).equals('claim-expired');
        assume(m.payload.status.runs[1].state).equals('exception');
        assume(m.payload.status.runs[1].reasonResolved).equals('claim-expired');
      });
    }, Infinity);
    helper.checkNoNextMessage('task-exception');

    debug('### Stop claimResolver (again)');
    await helper.stopPollingService();

    debug('### Task status (again)');
    const r5 = await helper.queue.status(taskId);
    // this time it's exception, since it's out of retries
    assume(r5.status.state).equals('exception');
  }, {mock}));
});
