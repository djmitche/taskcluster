require('../../prelude');
const {Loader} = require('taskcluster-lib-loader');

require('taskcluster-lib-config');
require('taskcluster-db');
require('taskcluster-lib-validate');
require('taskcluster-lib-app');
require('../src/api');
require('../src/data');

const serviceName = 'secrets';

if (!module.parent) {
  const loader = new Loader();
  loader.load(process.argv[2], {
    serviceName,
    profile: process.env.NODE_ENV,
    process: process.argv[2],
  }).catch(err => {
    console.log(err);
    process.exit(1);
  });
}

/*
  generateReferences: {
    requires: ['cfg', 'schemaset'],
    setup: ({cfg, schemaset}) => libReferences.fromService({
      schemaset,
      references: [builder.reference(), MonitorManager.reference('secrets')],
    }).generateReferences(),
  },

  expire: {
    requires: ['cfg', 'Secret', 'monitor'],
    setup: ({cfg, Secret, monitor}, ownName) => {
      return monitor.oneShot(ownName, async () => {
        const delay = cfg.app.secretExpirationDelay;
        const now = taskcluster.fromNow(delay);

        debug('Expiring secrets');
        const count = await Secret.expire(now);
        debug('Expired ' + count + ' secrets');
      });
    },
  },
}, {
  profile: process.env.NODE_ENV,
  process: process.argv[2],
});

// If this file is executed launch component from first argument
if (!module.parent) {
  load.crashOnError(process.argv[2]);
}
*/

//module.exports = load;
