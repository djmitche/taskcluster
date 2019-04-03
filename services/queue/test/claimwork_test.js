const debug = require('debug')('test:claim-work');
const assert = require('assert');
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

  // Generate random workerType id to use for this test
  const workerType = slugid.v4();

  const makeTask = (priority, workerType) => {
    return {
      provisionerId: 'no-provisioner-extended-extended',
      workerType: workerType,
      priority: priority,
      created: taskcluster.fromNowJSON(),
      deadline: taskcluster.fromNowJSON('30 min'),
      payload: {},
      metadata: {
        name: 'Unit testing task',
        description: 'Task created during unit tests',
        owner: 'jonsafj@mozilla.com',
        source: 'https://github.com/taskcluster/taskcluster-queue',
      },
    };
  };

  test('claimWork from empty queue', testing.runWithFakeTime(async function() {
    helper.scopes(
      'queue:claim-work:no-provisioner-extended-extended/' + workerType,
      'queue:worker-id:my-worker-group-extended-extended/my-worker-extended-extended',
    );

    let started = new Date();
    let result = await helper.queue.claimWork('no-provisioner-extended-extended', workerType, {
      workerGroup: 'my-worker-group-extended-extended',
      workerId: 'my-worker-extended-extended',
      tasks: 2,
    });
    assert(result.tasks.length === 0, 'Did not expect any claims');
    assert(new Date() - started >= 20 * 1000, 'Expected 20s sleep');
  }, {mock, maxTime: 25000}));

  test('claimWork requires scopes', async () => {
    // wrong provisionerId scope
    helper.scopes(
      'queue:claim-work:wrong-provisioner/' + workerType,
      'queue:worker-id:my-worker-group-extended-extended/my-worker-extended-extended',
    );
    await helper.queue.claimWork('no-provisioner-extended-extended', workerType, {
      workerGroup: 'my-worker-group-extended-extended',
      workerId: 'my-worker-extended-extended',
    }).then(
      () => assert(false, 'Expected error'),
      err => assert(err.code, err.code),
    );

    // wrong workerId scope
    helper.scopes(
      'queue:claim-work:no-provisioner-extended-extended/' + workerType,
      'queue:worker-id:my-worker-group/other-worker',
    );
    await helper.queue.claimWork('no-provisioner-extended-extended', workerType, {
      workerGroup: 'my-worker-group-extended-extended',
      workerId: 'my-worker-extended-extended',
    }).then(
      () => assert(false, 'Expected error'),
      err => {
        if (err.code !== 'InsufficientScopes') {
          throw err;
        }
      },
    );
  });

  test('claimWork, reclaimTask, reportCompleted', async () => {
    let taskId = slugid.v4();

    debug('### Creating task');
    await helper.queue.createTask(taskId, makeTask('normal', workerType));
    helper.checkNextMessage('task-defined');
    helper.checkNextMessage('task-pending');

    debug('### Claim task');
    // Reduce scopes available to test minimum set of scopes required
    helper.scopes(
      'queue:claim-work:no-provisioner-extended-extended/' + workerType,
      'queue:worker-id:my-worker-group-extended-extended/my-worker-extended-extended',
    );
    let before = new Date();
    let r1 = await helper.queue.claimWork('no-provisioner-extended-extended', workerType, {
      workerGroup: 'my-worker-group-extended-extended',
      workerId: 'my-worker-extended-extended',
    });
    assert(r1.tasks.length === 1, 'Expected a single task');
    assert(r1.tasks[0].status.taskId === taskId, 'Expected specific taskId');
    assert(r1.tasks[0].runId === 0, 'Expected runId = 0');
    let takenUntil = new Date(r1.tasks[0].takenUntil);
    // Compare to time before the request, because claimTimeout is very small
    // so we can only count on takenUntil being larger than or equal to the
    // time before the request was made
    assume(takenUntil.getTime()).is.greaterThan(before.getTime() - 1);

    // check that the task was logged
    assert.deepEqual(helper.monitor.messages.find(({Type}) => Type === 'task-claimed'), {
      Type: 'task-claimed',
      Logger: 'taskcluster.queue.root.api',
      Fields: {
        provisionerId: "no-provisioner-extended-extended",
        v: 1,
        workerGroup: "my-worker-group-extended-extended",
        workerId: "my-worker-extended-extended",
        workerType,
        taskId,
        runId: 0,
      },
    });

    // Check that task definition is included..
    assume(r1.tasks[0].task).deep.equals(await helper.queue.task(taskId));

    debug('### Waiting for task running message');
    helper.checkNextMessage('task-running',
      message => assume(message.payload.status).deep.equals(r1.tasks[0].status));

    debug('### Fetch task status');
    let r2 = await helper.queue.status(taskId);
    assume(r2.status).deep.equals(r1.tasks[0].status);

    debug('### reportCompleted');
    // Report completed with temp creds from claimWork
    let queue = new helper.Queue({rootUrl: helper.rootUrl, credentials: r1.tasks[0].credentials});
    await queue.reportCompleted(taskId, 0);
    helper.checkNextMessage('task-completed');
  });

  test('claimWork, reclaimTask, reportCompleted', async () => {
    let taskId = slugid.v4();

    debug('### Creating task');
    await helper.queue.createTask(taskId, makeTask('normal', workerType));
    helper.checkNextMessage('task-defined');
    helper.checkNextMessage('task-pending');

    debug('### Claim task');
    // Reduce scopes available to test minimum set of scopes required
    helper.scopes(
      'queue:claim-work:no-provisioner-extended-extended/' + workerType,
      'queue:worker-id:my-worker-group-extended-extended/my-worker-extended-extended',
    );
    let before = new Date();
    let r1 = await helper.queue.claimWork('no-provisioner-extended-extended', workerType, {
      workerGroup: 'my-worker-group-extended-extended',
      workerId: 'my-worker-extended-extended',
    });
    assert(r1.tasks.length === 1, 'Expected a single task');
    assert(r1.tasks[0].status.taskId === taskId, 'Expected specific taskId');
    assert(r1.tasks[0].runId === 0, 'Expected runId = 0');
    let takenUntil = new Date(r1.tasks[0].takenUntil);
    // Compare to time before the request, because claimTimeout is very small
    // so we can only count on takenUntil being larger than or equal to the
    // time before the request was made
    assume(takenUntil.getTime()).is.greaterThan(before.getTime() - 1);

    // Check that task definition is included..
    assume(r1.tasks[0].task).deep.equals(await helper.queue.task(taskId));

    debug('### Waiting for task running message');
    helper.checkNextMessage('task-running',
      message => assume(message.payload.status).deep.equals(r1.tasks[0].status));

    debug('### Fetch task status');
    let r2 = await helper.queue.status(taskId);
    assume(r2.status).deep.equals(r1.tasks[0].status);

    debug('### reclaimTask');
    // Use temp creds from claimWork
    let queue = new helper.Queue({rootUrl: helper.rootUrl, credentials: r1.tasks[0].credentials});
    let r3 = await queue.reclaimTask(taskId, 0);
    let takenUntil2 = new Date(r3.takenUntil);
    assume(takenUntil2.getTime()).is.greaterThan(takenUntil.getTime() - 1);

    // check that the task was logged
    assert.deepEqual(helper.monitor.messages.find(({Type}) => Type === 'task-reclaimed'), {
      Type: 'task-reclaimed',
      Logger: 'taskcluster.queue.root.api',
      Fields: {
        workerGroup: 'my-worker-group-extended-extended',
        workerId: 'my-worker-extended-extended',
        taskId,
        runId: 0,
        v: 1,
      },
    });

    debug('### reportCompleted');
    // Report completed with temp creds from reclaimTask
    queue = new helper.Queue({rootUrl: helper.rootUrl, credentials: r3.credentials});
    await queue.reportCompleted(taskId, 0);
    helper.checkNextMessage('task-completed');
  });

  test('claimWork gets "high" before "normal" priority', async () => {
    let taskIdA = slugid.v4();
    let taskIdB = slugid.v4();

    debug('### Creating task');
    await helper.queue.createTask(taskIdB, makeTask('normal', workerType));
    helper.checkNextMessage('task-defined', m => assert.equal(m.payload.status.taskId, taskIdB));
    helper.checkNextMessage('task-pending', m => assert.equal(m.payload.status.taskId, taskIdB));
    await helper.queue.createTask(taskIdA, makeTask('high', workerType));
    helper.checkNextMessage('task-defined', m => assert.equal(m.payload.status.taskId, taskIdA));
    helper.checkNextMessage('task-pending', m => assert.equal(m.payload.status.taskId, taskIdA));

    debug('### ClaimWork');
    let r1 = await helper.queue.claimWork('no-provisioner-extended-extended', workerType, {
      workerGroup: 'my-worker-group-extended-extended',
      workerId: 'my-worker-extended-extended',
      tasks: 1,
    });
    assert(r1.tasks.length === 1, 'Expected a task');
    assert(r1.tasks[0].status.taskId === taskIdA, 'Expected high priorty task');
    helper.checkNextMessage('task-running', m => assert.equal(m.payload.status.taskId, taskIdA));

    debug('### ClaimWork');
    let r2 = await helper.queue.claimWork('no-provisioner-extended-extended', workerType, {
      workerGroup: 'my-worker-group-extended-extended',
      workerId: 'my-worker-extended-extended',
      tasks: 1,
    });
    assert(r2.tasks.length === 1, 'Expected a task');
    assert(r2.tasks[0].status.taskId === taskIdB, 'Expected high priorty task');
    helper.checkNextMessage('task-running', m => assert.equal(m.payload.status.taskId, taskIdB));

    debug('### reportCompleted');
    // Report completed with temp creds from claimWork
    let queueA = new helper.Queue({rootUrl: helper.rootUrl, credentials: r1.tasks[0].credentials});
    await queueA.reportCompleted(taskIdA, 0);

    debug('### reportCompleted');
    // Report completed with temp creds from claimWork
    let queueB = new helper.Queue({rootUrl: helper.rootUrl, credentials: r2.tasks[0].credentials});
    await queueB.reportCompleted(taskIdB, 0);
  });

  test('createTask twice, claimWork, reportCompleted', async () => {
    let workerType = slugid.v4(); // need a fresh workerType
    let taskId = slugid.v4();
    let task = makeTask('normal', workerType);

    debug('### Creating task');
    await helper.queue.createTask(taskId, task);
    helper.checkNextMessage('task-defined');
    helper.checkNextMessage('task-pending');
    debug('### Creating task (again)');
    await helper.queue.createTask(taskId, task);
    helper.checkNextMessage('task-defined');
    helper.checkNextMessage('task-pending');

    debug('### Claim task');
    let r1 = await helper.queue.claimWork('no-provisioner-extended-extended', workerType, {
      workerGroup: 'my-worker-group-extended-extended',
      workerId: 'my-worker-extended-extended',
      tasks: 2,
    });
    assert(r1.tasks.length === 1, 'Expected a single task');
    assert(r1.tasks[0].status.taskId === taskId, 'Expected specific taskId');
    assert(r1.tasks[0].runId === 0, 'Expected runId = 0');

    debug('### reportCompleted');
    // Report completed with temp creds from claimWork
    let queue = new helper.Queue({rootUrl: helper.rootUrl, credentials: r1.tasks[0].credentials});
    await queue.reportCompleted(taskId, 0);
  });
});
