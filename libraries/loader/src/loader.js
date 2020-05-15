const stringify = require('json-stable-stringify');
const taskcluster = require('taskcluster-client');
const Debug = require('debug');

const debug = Debug('Loader');

/**
 * Definitions:
 *  - Component - implmentation of a kind of resource
 *  - Parameter - input that specializes a component
 *    TODO: enforce scalar types only
 *  - Component Instance - the output of a component for a specific set of parameters
 */
class Loader {
  /**
   * Register the named component.
   *
   * - requiredParameters - parameters this component itself requires
   * - constructor - fn async (loader, parameters) that will construct an
   *   instance of this component.  Load any dependencies with `loader`.
   */
  static registerComponent({name, requiredParameters = []}, constructor) {
    if (Loader.components[name]) {
      throw new Error(`Component ${name} is already registered`);
    }
    Loader.components[name] = {constructor, requiredParameters};
  }

  constructor() {
    this.instances = new Map();
  }

  static _key(name, parameters) {
    return name + stringify(parameters);
  }

  async load(name, parameters) {
    const key = Loader._key(name, parameters);

    debug(`loading ${key}`);

    let instance = this.instances.get(key);
    if (!instance) {
      const component = Loader.components[name];
      if (!component) {
        throw new Error(`No such loader component ${name}`);
      }
      for (let p of component.requiredParameters) {
        if (!Object.prototype.hasOwnProperty.call(parameters, p)) {
          throw new Error(`Component ${name} requires parameter ${p}`);
        }
      }
      debug(`constructing ${key}`);
      instance = await component.constructor(this, parameters);
      this.instances.set(key, instance);
    } else {
      debug(`found ${key} in cache`);
    }

    return instance;
  }
}
Loader.components = {};

// TODO: where should this live?
Loader.registerComponent({
  name: 'queueClient',
  // TODO: maybe require serviceDiscoveryScheme here? auth/unauth?
}, async (loader, parameters) => {
  const cfg = await loader.load('cfg', parameters);

  return new taskcluster.Queue({
    rootUrl: cfg.taskcluster.rootUrl,
    credentials: cfg.taskcluster.credentials,
  });
});

// TODO: generate a catalog of loader components in the README
// along with the file where they are registered

exports.Loader = Loader;
