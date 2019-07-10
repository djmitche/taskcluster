# Providers

Providers are implemented as subclasses of `Provider` in `services/worker-manager/src/providers`, with their `providerType` defined in `index.js` in that directory.

## Operation

### Setup

At start-up, the service reads the set of defined providers and creates a class instance for each one.
The class constructor should set instance properties, but should not do anything that can fail, as such a failure would cause the process to exit, preventing other providers from operating.

The async `setup` method is called after the constructor, and can be used to perform more sophisticated setup operations.
No other methods will be called until `setup` has completed.
This is a good choice for setting up resources that are global to this provider, such as cloud-provider resources.

Note that this method is called once per *provider*, and thus may be called multiple times in the same process for a provider type.
It is also called in every worker-manager process as the process starts up; this often occurs simultaneously for several processes.
For example, a user might configure two providers with provider type `google`, and the `setup` methods for those providers will run simultaneously.
The method should be designed carefully to be idempotent and, if possible, to include the `providerId` in any named resources it manages.

## API Access

The `web` processes that run the API server maintain an active set of providers.

### Validation

Whenever a worker pool configuration is created or modified, the API method calls the relevant provider's `validate` method, passing the configuration object.
The default implementation of this method validates the configuration against the JSON schema named in `this.configSchema`.
The method returns null if everything is fine and an error message if not.

### Managing Workers

* createWorker
* removeWorker
* registerWorker

## Provisioning

### Provisioning Workers

* prepare / cleanup
* provisioner
* deprovision

### Managing Worker-Pool Resources

* wp.providerData

## Background Jobs

* scanPrepare
* scanCleanup
* checkWorker
