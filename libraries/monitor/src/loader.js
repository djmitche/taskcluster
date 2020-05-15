const {Loader} = require('taskcluster-lib-loader');
const MonitorManager = require('./monitormanager');

Loader.registerComponent({
  name: 'monitor',
  requiredParameters: ['process', 'profile', 'serviceName'],
}, async (loader, parameters) => {
  const {process, profile, serviceName} = parameters;
  const cfg = await loader.load('cfg', parameters);

  return MonitorManager.setup({
    processName: process,
    serviceName: serviceName,
    verify: profile !== 'production',
    ...cfg.monitoring,
  });
});
