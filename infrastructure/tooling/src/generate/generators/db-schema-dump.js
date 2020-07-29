const tcpg = require('taskcluster-lib-postgres');
const testing = require('taskcluster-lib-testing');
const parseDbURL = require('pg-connection-string').parse;
const { REPO_ROOT, writeRepoFile, execCommand } = require('../../utils');

// Generate a readable JSON version of the schema.
exports.tasks = [{
  title: 'DB Schema Dump',
  requires: ['db-schema-serializable'],
  provides: ['db-schema-dump'],
  run: async (requirements, utils) => {
    if (!process.env.TEST_DB_URL) {
      throw new Error("'yarn generate' requires $TEST_DB_URL to be set");
    }

    // reset the DB back to its empty state..
    utils.step({title: 'Reset Test Database'});
    await testing.resetDb();

    // .. and then upgrade to the latest version
    utils.step({title: 'Upgrade Test Database'});
    const schema = tcpg.Schema.fromSerializable(requirements['db-schema-serializable']);
    await tcpg.Database.upgrade({
      schema,
      showProgress: message => utils.status({message}),
      usernamePrefix: 'test',
      adminDbUrl: process.env.TEST_DB_URL,
    });

    // now dump the schema of the DB
    utils.step({title: 'Dump Test Database'});
    const { host, port, user, password, database } = parseDbURL(process.env.TEST_DB_URL);
    const pgdump = await execCommand({
      dir: REPO_ROOT,
      command: [
        'pg_dump',
        '--schema-only',
        '-h', host,
        '-p', (port || 5432).toString(),
        '-U', user,
        '-d', database,
      ],
      keepAllOutput: true,
      env: {
        ...process.env,
        PGPASSWORD: password,
      },
      utils,
    });

    /* Parse the output as separated by comments of the form:
     *
     * --
     * -- Name: TABLE workers; Type: ACL; Schema: public; Owner: postgres
     * --
     */

    const re = /--\n-- Name: ([^;]+); Type: ([^;]+); Schema: [^;]+; Owner: [^;]+\n--\n/;
    const statements = [];
    const parts = pgdump.split(re);
    parts.shift(); // throw out the header
    for (let i = 0; i < parts.length; i += 3) {
      const [name, type, body] = parts.slice(i, i + 3);
      statements.push({name, type, body});
    }

    // reformat that schema so that it contains only what we want, and in
    // a format that doesn't change from run to run
    const output = [];
    for (let {type, body} of statements) {
      if (['TABLE', 'CONSTRAINT', 'INDEX'].includes(type)) {

        // for tables, filter out a trailing 'ALTER TABLE .. OWNER TO ..'
        switch (type) {
          case 'TABLE':
            body = body
              // drop the unnecessary ownership of this table
              .replace(/ALTER TABLE [a-zA-Z._-]+ OWNER TO [a-zA-Z_-]+;/g, '')
              // drop the unnecesary 'public.' in the table name
              .replace(/CREATE TABLE public\./, 'CREATE TABLE ');
            break;

          case 'CONSTRAINT':
            body = body
              // drop the unnecesary 'public.' in the table name
              .replace(/ALTER TABLE ONLY public\./, 'ALTER TABLE ');
            break;

          case 'INDEX':
            break;
        }

        output.push("```sql\n" + body.trim() + "\n```");
      }
    }

    // TODO:
    // put in markdown format with Table of Contents linking to each
    // put ALTER and CREATE INDEX near the table definition
    // drop redundant `public.` from CREATE, ALTER

    await writeRepoFile('db/schema.sql', output.join('\n\n'));
  },
}];
