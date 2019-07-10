const assert = require('assert');
const libUrls = require('taskcluster-lib-urls');

class Provider {
  constructor({
    providerId,
    monitor,
    notify,
    rootUrl,
    estimator,
    validator,
    Worker,
    WorkerPool,
    WorkerPoolError,
  }) {
    this.providerId = providerId;
    this.monitor = monitor;
    this.validator = validator;
    this.notify = notify;
    this.rootUrl = rootUrl;
    this.estimator = estimator;
    this.Worker = Worker;
    this.WorkerPool = WorkerPool;
    this.WorkerPoolError = WorkerPoolError;
  }

  async setup() {
  }

  /**
   * This is only called for providers that are being used in background jobs such
   * as provisioning and scanning workers.
   * If there's any taskcluster-lib-iterate loops to
   * run, this is where they should be initiated.
   */
  async initiate() {
  }

  /**
   * Terminate any code which was started by .initiate();
   */
  async terminate() {
  }

  validate(config) {
    assert(this.configSchema); // This must be set up by a provider impl
    return this.validator(config, libUrls.schema(this.rootUrl, 'worker-manager', `v1/${this.configSchema}.yml`));
  }

  /**
   * Anything a provider may want to do every provisioning loop but not tied
   * to any one worker pool. Called _before_ provision() is called.
   */
  async prepare() {
  }

  /**
   * Given a worker pool configuration, do whatever the provider might do with
   * this worker pool to create workers to do work. This may mean nothing at
   * all in the case of static provider!
   */
  async provision({workerPool}) {
  }

  /**
   * This is the oposite of provision, and is called for providers that are
   * no longer the provider for the given workerPool, but may still have workers
   * or other resources defined for the workerPool.
   *
   * The provider should tear down whatever resources this provider has created
   * for the worker pool.  This will be called in every provisioning loop until
   * there are no remaining workers in this pool with this providerId.  The
   * provider can pro-actively stop any such workers, or wait for them to stop
   * themselves.
   */
  async deprovision({workerPool}) {
  }

  /**
   * Called as a part of registerWorker, given both the WorkerPool and Worker
   * instances, as well as the workerIdentityProof from the API request.
   *
   * The provider should verify the proof and, if it is valid, adjust the worker
   * row as appropriate (at least setting its state to RUNNING).
   *
   * Providers that wish to limit registration to once per worker should return
   * an error message from this function if the worker is already RUNNING.
   *
   * If validation fails due to a user error, throw a ApiError instance,
   * which will turn into a 400 error for the user containing the error message.
   * The message should not reveal any information, whether provided by the user
   * or about the expected values.
   *
   * The return on success is an object {expires} giving the expiration time of
   * the resulting credentials.  As these are temporary credentials, this
   * cannot be more than 30 days in the future.
   */
  async registerWorker({worker, workerPool, workerIdentityProof}) {
  }

  /**
   * Anything a provider may want to do every provisioning loop but not tied
   * to any one worker pool. Called _after_ all provision() calls are complete.
   */
  async cleanup() {
  }

  /*
   * Called before an iteration of the worker scanner
   */
  async scanPrepare() {
  }

  /*
   * Called for every worker on a schedule so that we can update the state of
   * the worker locally
   */
  async checkWorker({Worker}) {
  }

  /*
   * Called after an iteration of the worker scanner
   */
  async scanCleanup() {
  }

  /**
   * Create the given worker.  Dynamic providers or any providers that do not
   * support user-initiated workers should throw a ApiError here.
   *
   * WorkerPool is the entity for this worker pool.  Input matches the
   * `create-worker-request.yml` schema, and the return value should be a
   * Worker entity.  Idempotency is the responsibility of the provider.
   */
  async createWorker({workerPool, workerGroup, workerId, input}) {
  }

  /**
   * Remove the given worker.  What this means depends on the provider, of course:
   * those which support `createWorker` can do the inverse here.  Those that create
   * workers dynamically can either throw ApiError indicating this is not
   * supported, or can treat this as a request to terminate the given worker.
   *
   * The input is a Worker entity.  That entity may still exist (and even have
   * state RUNNING) after this call returns, if that makes sense for the provider
   * (for example, if the call merely initiates instance shutdown).
   */
  async removeWorker(worker) {
  }

  /**
   * Called when a new worker pool is added to this provider to allow the provider
   * to do whatever setup is necessary, such as creating shared resources for the
   * workers.  This activity is specific to the pool, but not to individual workers.
   */
  async createResources({workerPool}) {
  }

  /**
   * Called whenever a worker pool currently assigned to this provider is changed.
   * If a currently existing worker pool is moved to a different provider, the old provider
   * will actually be asked to remove resources and the new one to create. This will not
   * be called in that case.
   */
  async updateResources({workerPool}) {
  }

  /**
   * Called when a worker pool is removed and this provider was providing for it.  After
   * this call completes correctly, this provider is removed from the list of previous
   * providerIds for this worker pool.
   */
  async removeResources({workerPool}) {
  }
}

/**
 * An error which, if thrown from API-related Provider methods, will be returned to
 * the user as a 400 Bad Request error containing `err.message`.
 */
class ApiError extends Error {
}

module.exports = {
  Provider,
  ApiError,
};
