# Worker Manager

The worker manager service manages workers, including interacting with cloud services to create new workers on demand.

# Operation

## Providers

The service configuration defines a number of providers, indexed by `providerId`, along with configuration.
Each provider has a `providerType` indicating the class that implements the provider.

The service currently includes providers for:

* Static Workers (`static`)
* Google Cloud (`google`)
* Testing (`testing`, only used in the service's unit tests)

Implementation requirements for a provider are defined in [providers.md](providers.md).

## Worker Pools

Workers are collected into worker pools.
Each worker pool is managed by a single provider and identified by a `workerPoolId`.
All workers in a pool pull from the same `taskQueueId` (a.k.a. `provisionerId`/`workerType`) and as such are assumed to be identically configured and interchangeable.

This service considers a "workerPoolId" to be a string of the shape `<provisionerId>/<workerType>`, as defined in [RFC 0145](https://github.com/taskcluster/taskcluster-rfcs/blob/master/rfcs/0145-workerpoolid-taskqueueid.md).

A worker pool's provider can change, and the service distinguishes workers using the current provider and previous providers, automatically removing previous providers when they have no remaining workers.
The operation of deleting a worker pool takes the form of assigning the `"null-provider"` providerId.
This provider never creates workers, and pools are automatically deleted when their only provider is the null provider, thereby allowing pools to "drain" of running workers before disappearing.

## Workers

Workers are identified by a combination of a `workerGroup` and a `workerId`.
This combination is expected to be unique within a given worker pool.

Workers are managed jointly by the worker-manager service and its providers.
In some cases, the provider takes full control of the set of workers -- for example, in a cloud-provisioning context.
In other cases, the user can manipulate workers via the service's REST API -- for example, the static provider uses this approach to manage creation and removal of static workers.

# Development

No special configuration is required for development.

Run `yarn workspace taskcluster-worker-manager test` to run the tess.
Some of the tests will be skipped without additional credentials, but it is fine to make a pull request as long as no tests fail.

To run *all* tests, you will need appropriate Taskcluster credentials.
Using [taskcluster-cli](https://github.com/taskcluster/taskcluster-cli), run `eval $(taskcluster signin --scope assume:project:taskcluster:tests:taskcluster-worker-manager)`, then run the tests again.

See [providers.md](providers.md) for details on implementing providers.
