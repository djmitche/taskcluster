const APIBuilder = require('taskcluster-lib-api');
const request = require('superagent');
const Octokit = require('@octokit/rest');

const builder = new APIBuilder({
  serviceName: 'login',
  apiVersion: 'v1',
  title: 'Login API',
  description: [
    'The Login service serves as the interface between external authentication',
    'systems and Taskcluster credentials.',
  ].join('\n'),
  name: 'login',
  context: ['cfg', 'handlers'],
});

// Export builder
module.exports = builder;

builder.declare({
  method: 'get',
  route: '/oidc-credentials/:provider',
  name: 'oidcCredentials',
  idempotent: false,
  output: 'oidc-credentials-response.yml',
  title: 'Get Taskcluster credentials given a suitable `access_token`',
  stability: APIBuilder.stability.experimental,
  description: [
    'Given an OIDC `access_token` from a trusted OpenID provider, return a',
    'set of Taskcluster credentials for use on behalf of the identified',
    'user.',
    '',
    'This method is typically not called with a Taskcluster client library',
    'and does not accept Hawk credentials. The `access_token` should be',
    'given in an `Authorization` header:',
    '```',
    'Authorization: Bearer abc.xyz',
    '```',
    '',
    'The `access_token` is first verified against the named',
    ':provider, then passed to the provider\'s APIBuilder to retrieve a user',
    'profile. That profile is then used to generate Taskcluster credentials',
    'appropriate to the user. Note that the resulting credentials may or may',
    'not include a `certificate` property. Callers should be prepared for either',
    'alternative.',
    '',
    'The given credentials will expire in a relatively short time. Callers should',
    'monitor this expiration and refresh the credentials if necessary, by calling',
    'this endpoint again, if they have expired.',
  ].join('\n'),
}, async function(req, res) {
  // handlers are loaded from src/handlers based on cfg.handlers
  let handler = this.handlers[req.params.provider];

  if (!handler) {
    return res.reportError('InputError',
      'Invalid accessToken provider {{provider}}',
      {provider: req.params.provider});
  }

  let user = await handler.userFromRequest(req, res);

  if (!user) {
    // don't report much to the user, to avoid revealing sensitive information, although
    // it is likely in the service logs.
    return res.reportError('InputError',
      'Could not generate credentials for this access token',
      {});
  }

  // create and return temporary credentials, limiting expires to a max of 15 minutes
  let {credentials: issuer, startOffset} = this.cfg.app.temporaryCredentials;
  let {credentials, expires} = user.createCredentials({credentials: issuer, startOffset, expiry: '15 min'});

  // move expires back by 30 seconds to ensure the user refreshes well in advance of the
  // actual credential expiration time
  expires.setSeconds(expires.getSeconds() - 30);

  return res.reply({
    expires: expires.toJSON(),
    credentials,
  });
});

builder.declare({
  method: 'get',
  route: '/github/start',
  name: 'startGithubLogin',
  idempotent: false,
  title: 'Redirect to GH to login',
  stability: APIBuilder.stability.experimental,
  description: '...',
}, async function(req, res) {
  const scope = encodeURIComponent('user');
  // https://developer.github.com/apps/building-oauth-apps/authorizing-oauth-apps/
  const url = `https://github.com/login/oauth/authorize?client_id=${this.cfg.github.clientId}&redirect_url=${encodeURIComponent('https://github.com/login/oauth/authorize')}&scope=${scope}`;
  return res.redirect(303, url);
});

builder.declare({
  method: 'get',
  route: '/github/callback',
  name: 'githubLoginCallback',
  query: {
    code: /.*/,
    state: /.*/,
  },
  idempotent: false,
  title: 'Redirect to GH to login',
  stability: APIBuilder.stability.experimental,
  description: '...',
}, async function(req, res) {
  const {code} = req.query; // also state, but we're ignoring

  // https://developer.github.com/apps/building-oauth-apps/authorizing-oauth-apps/
  const accessTokenResponse = await request
    .post('https://github.com/login/oauth/access_token')
    .accept('application/json')
    .send(`client_id=${this.cfg.github.clientId}`)
    .send(`client_secret=${this.cfg.github.clientSecret}`)
    .send(`code=${code}`);

  if (accessTokenResponse.body.error) {
    res.reportError(
      'InputError',
      'Error getting Github access token: {{error}} -- {{error_description}}',
      accessTokenResponse.body);
  }

  const {access_token, scope, token_type} = accessTokenResponse.body;

  res.redirect(`show_stuff?access_token=${access_token}&token_type=${token_type}&scope=${encodeURIComponent(scope)}`);
});

builder.declare({
  method: 'get',
  route: '/github/show_stuff',
  name: 'githubShowStuff',
  query: {
    access_token: /.*/,
    token_type: /.*/,
    scope: /.*/,
  },
  idempotent: false,
  title: '..',
  stability: APIBuilder.stability.experimental,
  description: '...',
}, async function(req, res) {
  const {access_token, token_type, scope} = req.query;
  const result = {};

  // use that access token to try to get some details about the user
  const octokit = new Octokit({
    auth: `${token_type} ${access_token}`,
  });

  try {
    const au = await octokit.users.getAuthenticated();
    result.login = au.data.login;
    result.ghUserId = au.data.id;
    result.scopes = [`assume:login-identity:github|${au.data.id}|${au.data.login}`];

    // list teams for auth'd user
    const teams = await octokit.paginate('GET /user/teams');
    result.teams = teams.map(team => ({team: team.slug, org: team.organization.login}));
    teams
      .map(team => `${team.organization.login}/${team.slug}`)
      .forEach(team => result.scopes.push(`assume:github:team:${team}`));

    const orgs = await octokit.paginate('GET /user/memberships/orgs');
    result.orgs = orgs.map(om => om.organization.login);

    orgs
      .filter(om => om.role === 'admin')
      .map(om => om.organization.login)
      .forEach(org => result.scopes.push(`assume:github:org-admin:${org}`));

  } catch (err) {
    console.log(err);
    throw err;
  }

  res.reply(result);
});
