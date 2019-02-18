const debug = require('debug')('taskcluster-github:github-auth');
const jwt = require('jsonwebtoken');

const retryPlugin = (octokit, options) => {

  const retries = 7;
  const baseBackoff = 100;
  const sleep = timeout => new Promise(resolve => setTimeout(resolve, timeout));

  octokit.hook.wrap('request', async (request, options) => {
    let response;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await request(options);
      } catch (err) {
        if (attempt === retries || err.name !== 'HttpError' || err.status !== 404) {
          throw err;
        }
        debug(`404 getting retried for eventual consistency. attempt: ${attempt}`);
        await sleep(baseBackoff * Math.pow(2, attempt));
      }
    }
  });
};
const Octokit = require('@octokit/rest').plugin([retryPlugin]);

module.exports = async ({cfg}) => {
  let setupToken = () => {
    let inteToken = jwt.sign(
      {iss: cfg.github.credentials.integrationId},
      cfg.github.credentials.privatePEM,
      {algorithm: 'RS256', expiresIn: '1m'},
    );
    try {
      return new Octokit({
        promise: Promise,
        auth: `app ${inteToken}`,
      });
    } catch (e) {
      debug('Authentication as app failed!');
      throw e;
    }
  };

  // This object insures that the authentication is delayed until we need it.
  // Also, the authentication happens not just once in the beginning, but for each request.
  return {
    getIntegrationGithub: async () => {
      return setupToken();
    },
    getInstallationGithub: async (inst_id) => {
      const github = setupToken();
      // Authenticating as installation
      var instaToken = (await github.apps.createInstallationToken({
        installation_id: inst_id,
      })).data;
      try {
        let gh = new Octokit({
          promise: Promise,
          auth: `token ${instaToken}`,
        });
        debug(`Authenticated as installation: ${inst_id}`);
        return gh;
      } catch (e) {
        debug('Authentication as app failed!');
        throw e;
      }
    },
  };
};
