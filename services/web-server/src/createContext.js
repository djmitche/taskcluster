const loaders = require('./loaders');
const {MonitorManager} = require('taskcluster-lib-monitor');

MonitorManager.register({
  name: 'requestReceived',
  title: 'Request Received',
  type: 'request-received',
  version: 1,
  level: 'notice',
  description: 'A GraphQL request has been received. The traceId/request is at the top-level of the log message, above these fields.',
  fields: {
    query: 'The graphQL query string',
    operationName: `
      The name of the graphql query performed. If the operation is anonymous
      (i.e., the operation is query { ... } instead of query NamedQuery { ... })
      , then operationName is null.`,
  },
});

module.exports = ({ clients, pulseEngine, rootUrl, strategies, cfg, monitor }) => ({ req, connection }) => {
  if (req) {
    const currentClients = clients({
      credentials: req.credentials,
      rootUrl,
      traceId: req.traceId,
    });
    const currentLoaders = loaders(
      currentClients,
      Boolean(req.credentials),
      rootUrl,
      monitor,
      strategies,
      req,
      cfg,
      req.requestId,
      req.traceId,
    );

    if (req.body.operationName !== 'IntrospectionQuery') {
      monitor.log.requestReceived({
        operationName: req.body.operationName,
        query: req.body.query,
        requestId: req.requestId,
        traceId: req.traceId,
      });
    }

    return {
      clients: currentClients,
      loaders: currentLoaders,
    };
  }

  if (connection) {
    // subscriptions do not need credentials (all public data)
    const currentClients = clients({ rootUrl });
    const currentLoaders = loaders(
      currentClients,
      false,
      rootUrl,
      monitor,
    );
    // if connection is set, this is for a subscription
    return {
      pulseEngine,
      clients: currentClients,
      loaders: currentLoaders,
    };
  }

  return {};
};
