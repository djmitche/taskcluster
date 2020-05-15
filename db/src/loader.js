const {setup} = require('./setup');
const {Loader} = require('taskcluster-lib-loader');

Loader.registerComponent({
  name: 'db',
  requiredParameters: ['process', 'serviceName'],
}, async (loader, parameters) => {
  const {process, serviceName} = parameters;
  const cfg = await loader.load('cfg', parameters);
  const monitor = await loader.load('monitor', parameters);

  return await setup({
    readDbUrl: cfg.postgres.readDbUrl,
    writeDbUrl: cfg.postgres.writeDbUrl,
    serviceName,
    monitor: monitor.childMonitor('db'),
    statementTimeout: process === 'server' ? 30000 : 0,
  });
});
