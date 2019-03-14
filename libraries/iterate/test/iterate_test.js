let subject = require('../');
let sandbox = require('sinon').createSandbox();
let assume = require('assume');
let debug = require('debug')('iterate-test');
let MonitorManager = require('taskcluster-lib-monitor');

let possibleEvents = [
  'started',
  'stopped',
  'completed',
  'iteration-start',
  'iteration-success',
  'iteration-failure',
  'iteration-complete',
  'error',
];

class IterateEvents {
  constructor(iterator, expectedOrder) {
    this.iterator = iterator;
    this.expectedOrder = expectedOrder;
    this.orderOfEmission = [];
    for (let x of possibleEvents) {
      iterator.on(x, () => {
        this.orderOfEmission.push(x);
      });
    }
  }

  assert(f) {
    let dl = () => { // dl === dump list
      return `\nExpected: ${JSON.stringify(this.expectedOrder, null, 2)}` +
        `\nActual: ${JSON.stringify(this.orderOfEmission, null, 2)}`;
    };

    if (this.orderOfEmission.length !== this.expectedOrder.length) {
      return f(new Error(`order emitted differs in length from expectation ${dl()}`));
    }

    for (let i = 0 ; i < this.orderOfEmission.length ; i++) {
      if (this.orderOfEmission[i] !== this.expectedOrder[i]) {
        return f(new Error(`order emitted differs in content ${dl()}`));
      }
    }

    debug(`Events Emitted: ${JSON.stringify(this.orderOfEmission)}`);
    return f();
  }

}

suite('Iterate', () => {
  let manager;
  let monitor;

  setup(async () => {
    manager = new MonitorManager({serviceName: 'iterate'});
    manager.setup({mock: true});
    monitor = manager.monitor();
  });

  teardown(() => {
    sandbox.restore();
    manager.terminate();
  });

  test('should be able to start and stop', done => {
    let iterations = 0;

    let i = new subject({
      maxIterationTime: 3000,
      waitTime: 1000,
      handler: async (watchdog, state) => {
        // In order to get the looping stuff to work, I had to stop the
        // watchdog timer.  This will be tested in the tests for the
        // Iterate.iterate method
        watchdog.on('expired', () => {
          done(new Error('incremental watch dog expiration'));
        });

        debug('iterate!');
        iterations++;
        return 1;
      },
      monitor,
    });

    i.on('error', err => {
      done(err);
    });

    i.on('stopped', () => {
      done();
    });

    i.start();

    setTimeout(() => {
      assume(iterations).equals(5);
      assume(i.keepGoing).is.ok();
      i.stop();
      assume(i.keepGoing).is.not.ok();
      assume(manager.messages.length).equals(5);
      manager.messages.forEach(message => {
        assume(message.Fields.status).equals('success');
      });
    }, 5000);

  });

  test('should stop after correct number of iterations', done => {
    let iterations = 0;

    let i = new subject({
      maxIterationTime: 3000,
      waitTime: 10,
      maxIterations: 5,
      handler: async (watchdog, state) => {
        watchdog.on('expired', () => {
          done(new Error('incremental watch dog expiration'));
        });

        debug('iterate!');
        iterations++;
        return 1;
      },
    });

    i.on('error', err => {
      done(err);
    });

    i.start();

    i.on('completed', () => {
      assume(iterations).equals(5);
      assume(i.keepGoing).is.not.ok();
      i.stop();
      done();
    });
  });

  test('should emit error when iteration watchdog expires', done => {
    let i = new subject({
      maxIterationTime: 5000,
      watchdogTime: 1000,
      waitTime: 1000,
      maxFailures: 1,
      handler: async (watchdog, state) => {
        // In order to get the looping stuff to work, I had to stop the
        // watchdog timer.  This will be tested in the tests for the
        // Iterate.iterate method
        i.on('error', err => {
          debug('correctly getting expired watchdog timer');
          i.stop();
          assume(i.keepGoing).is.not.ok();
          done();
        });
        return new Promise((res, rej) => {
          setTimeout(res, 2000);
        });

      },
    });

    i.start();
  });

  test('should emit error when overall iteration limit is hit', done => {
    let i = new subject({
      maxIterationTime: 1000,
      waitTime: 1000,
      maxFailures: 1,
      handler: async (watchdog, state) => {
        watchdog.stop();
        return new Promise((res, rej) => {
          setTimeout(() => {
            return res();
          }, 5000);
        });
      },
    });

    i.on('error', err => {
      i.stop();
      assume(i.keepGoing).is.not.ok();
      done();
    });

    i.start();
  });

  test('should emit iteration-failure when async handler fails', done => {
    let i = new subject({
      maxIterationTime: 1000,
      waitTime: 1000,
      maxFailures: 100,
      handler: async (watchdog, state) => {
        throw new Error('uhoh');
      },
    });

    i.on('iteration-failure', err => {
      i.stop();
      assume(i.keepGoing).is.not.ok();
      done();
    });

    i.start();
  });

  test('should emit iteration-failure when sync handler fails', done => {
    let i = new subject({
      maxIterationTime: 1000,
      waitTime: 1000,
      maxFailures: 100,
      handler: (watchdog, state) => {
        throw new Error('uhoh');
      },
    });

    i.on('iteration-failure', err => {
      i.stop();
      assume(i.keepGoing).is.not.ok();
      done();
    });

    i.start();
  });

  test('should emit error when iteration is too quick', done => {
    let i = new subject({
      maxIterationTime: 12000,
      minIterationTime: 10000,
      waitTime: 1000,
      handler: async (watchdog, state) => {
        watchdog.stop();
        return 1;
      },
    });

    i.start();

    i.on('error', err => {
      debug('correctly getting expired watchdog timer');
      i.stop();
      assume(i.keepGoing).is.not.ok();
      done();
    });
  });

  test('should emit error after too many failures', done => {
    let i = new subject({
      maxIterationTime: 12000,
      maxFailures: 1,
      waitTime: 1000,
      handler: async (watchdog, state) => {
        return new Promise((res, rej) => {
          rej(new Error('hi'));
        });
      },
    });

    i.start();

    i.on('error', err => {
      i.stop();
      assume(i.keepGoing).is.not.ok();
      done();
    });

  });

  test('should cause uncaughtException when error event is unhandled', done => {
    // NOTE: Mocha has it's own uncaught exception listener.  If we were to
    // leave it in force during this test, we'd end up getting two results from
    // the test.  One failure from the mocha handler and one pass from our own
    // handler.  This is obviously not ideal, and it's sort of a risk that we
    // mess up the uncaught exception handling for future tests

    let origListeners = process.listeners('uncaughtException');
    process.removeAllListeners('uncaughtException');

    let uncaughtHandler = function(err) {
      process.removeAllListeners('uncaughtException');
      for (let listener of origListeners) {
        process.on('uncaughtException', listener);
      }
      i.stop();
      assume(i.keepGoing).is.not.ok();
      done();
    };

    process.on('uncaughtException', uncaughtHandler);

    let i = new subject({
      maxIterationTime: 12000,
      maxFailures: 1,
      waitTime: 1000,
      handler: async (watchdog, state) => {
        return new Promise((res, rej) => {
          rej(new Error('hi'));
        });
      },
    });

    i.start();

  });

  test('should share state between iterations', done => {
    let iterations = 0;
    let v = {a: 1};

    let i = new subject({
      maxIterationTime: 3000,
      waitTime: 1000,
      maxIterations: 2,
      maxFailures: 1,
      handler: async (watchdog, state) => {
        watchdog.on('expired', () => {
          done(new Error('incremental watch dog expiration'));
        });

        if (iterations === 0) {
          assume(state).deeply.equals({});
          state.v = v;
        } else if (iterations === 1) {
          assume(state.v).deeply.equals(v);
          assume(state.v).equals(v);
        } else {
          done(new Error('too many iterations'));
        }

        debug('iterate!');
        iterations++;
        return 1;
      },
    });

    i.on('error', err => {
      done(err);
    });

    i.on('iteration-error', err => {
      done(err);
    });

    i.start();

    i.on('completed', () => {
      assume(iterations).equals(2);
      assume(i.keepGoing).is.not.ok();
      i.stop();
      assume(i.keepGoing).is.not.ok();
      done();
    });
  });

  test('should emit correct events for single iteration', done => {
    let iterations = 0; //eslint-disable-line no-unused-vars

    let i = new subject({
      maxIterationTime: 3000,
      waitTime: 1000,
      handler: async (watchdog, state) => {
        debug('iterate!');
        iterations++;
        return 1;
      },
    });

    i.on('error', err => {
      done(err);
    });

    let events = new IterateEvents(i, [
      'started',
      'iteration-start',
      'iteration-success',
      'iteration-complete',
      'stopped',
    ]);

    i.on('stopped', () => {
      events.assert(done);
    });

    i.on('started', () => {
      i.stop();
    });

    i.start();
  });

  test('should emit correct events with maxIterations', done => {
    let iterations = 0; //eslint-disable-line no-unused-vars

    let i = new subject({
      maxIterationTime: 3000,
      maxIterations: 1,
      waitTime: 1000,
      handler: async (watchdog, state) => {
        debug('iterate!');
        iterations++;
        return 1;
      },
    });

    i.on('error', err => {
      done(err);
    });

    let events = new IterateEvents(i, [
      'started',
      'iteration-start',
      'iteration-success',
      'iteration-complete',
      'completed',
      'stopped',
    ]);

    i.on('error', err => {
      done(err);
    });

    i.on('stopped', () => {
      events.assert(done);
    });

    i.on('started', () => {
      i.stop();
    });

    i.start();
  });

  suite('event emission ordering', () => {

    test('should be correct with maxFailures and maxIterations', done => {
      let i = new subject({
        maxIterationTime: 3000,
        maxIterations: 1,
        maxFailures: 1,
        waitTime: 1000,
        handler: async (watchdog, state) => {
          debug('iterate!');
          throw new Error('hi');
        },
      });

      let events = new IterateEvents(i, [
        'started',
        'iteration-start',
        'iteration-failure',
        'iteration-complete',
        'completed',
        'stopped',
        'error',
      ]);

      i.on('error', () => {
        events.assert(done);
      });

      i.on('started', () => {
        i.stop();
      });

      i.start();
    });

    test('should be correct with maxFailures only', done => {
      let i = new subject({
        maxIterationTime: 3000,
        maxFailures: 1,
        waitTime: 1000,
        handler: async (watchdog, state) => {
          debug('iterate!');
          throw new Error('hi');
        },
      });

      let events = new IterateEvents(i, [
        'started',
        'iteration-start',
        'iteration-failure',
        'iteration-complete',
        'stopped',
        'error',
      ]);

      i.on('error', () => {
        events.assert(done);
      });

      i.on('started', () => {
        i.stop();
      });

      i.start();
    });

    test('should be correct when handler takes too little time', done => {
      let i = new subject({
        maxIterationTime: 3000,
        minIterationTime: 100000,
        maxFailures: 1,
        waitTime: 1000,
        handler: async (watchdog, state) => {
          return true;
        },
      });

      let events = new IterateEvents(i, [
        'started',
        'iteration-start',
        'iteration-failure',
        'iteration-complete',
        'stopped',
        'error',
      ]);

      i.on('error', () => {
        events.assert(done);
      });

      i.on('started', () => {
        i.stop();
      });

      i.start();
    });

    test('should be correct when handler takes too long (incremental watchdog)', done => {
      let i = new subject({
        maxIterationTime: 5000,
        maxFailures: 1,
        watchdogTime: 100,
        waitTime: 1000,
        handler: async (watchdog, state) => {
          return new Promise((res, rej) => {
            setTimeout(res, 3000);
          });
        },
      });

      let events = new IterateEvents(i, [
        'started',
        'iteration-start',
        'iteration-failure',
        'iteration-complete',
        'stopped',
        'error',
      ]);

      i.on('error', () => {
        events.assert(done);
      });

      i.on('started', () => {
        i.stop();
      });

      i.start();
    });

    test('should be correct when handler takes too long (overall time)', done => {
      let i = new subject({
        maxIterationTime: 3000,
        maxFailures: 1,
        waitTime: 1000,
        handler: async (watchdog, state) => {
          return new Promise((res, rej) => {
            setTimeout(res, 6000);
          });
        },
      });

      let events = new IterateEvents(i, [
        'started',
        'iteration-start',
        'iteration-failure',
        'iteration-complete',
        'stopped',
        'error',
      ]);

      i.on('error', () => {
        events.assert(done);
      });

      i.on('started', () => {
        i.stop();
      });

      i.start();
    });

    test('should be correct with mixed results', done => {
      let iterations = 0;

      let i = new subject({
        maxIterationTime: 3000,
        maxIterations: 6,
        maxFailures: 5,
        waitTime: 1000,
        handler: async (watchdog, state) => {
          if (iterations++ % 2 === 0) {
            throw new Error('even, so failing');
          } else {
            return 'odd, so working';
          }
        },
      });

      let events = new IterateEvents(i, [
        'started',
        'iteration-start',
        'iteration-failure',
        'iteration-complete',
        'iteration-start',
        'iteration-success',
        'iteration-complete',
        'iteration-start',
        'iteration-failure',
        'iteration-complete',
        'iteration-start',
        'iteration-success',
        'iteration-complete',
        'iteration-start',
        'iteration-failure',
        'iteration-complete',
        'iteration-start',
        'iteration-success',
        'iteration-complete',
        'completed',
        'stopped',
      ]);

      i.on('stopped', () => {
        events.assert(done);
      });

      i.on('error', err => {
        done(err);
      });

      i.start();
    });
  });
});
