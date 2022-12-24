const taskcluster = require('taskcluster-client');
const request = require('superagent');
const crypto = require('crypto');
const assert = require('assert');
const helper = require('../helper');
const { promisify } = require('util');
const zlib = require('zlib');

const gzip = promisify(zlib.gzip);

const responseSchema = 'https://tc-testing.example.com/schemas/object/v1/create-upload-response.json#/properties/uploadMethod';

/**
 * Test the putUrl2 upload method on the given backend.  This defines a suite
 * of tests.
 */
exports.testPutUrl2Upload = ({
  mock, skipping,

  // optional title suffix
  title,

  // a prefix for object names, so that concurrent runs do not modify the
  // same objects in the "real" storage backend
  prefix,

  // the backend to test; this will be loaded from the loader, so its configuration
  // should be set up in suiteSetup.
  backendId,

  // an async function({name}) to get the data for a given object, returning {
  // data, contentType, contentEncoding, contentDisposition }.
  getObjectContent,

  // omit testing certain functionality that's not supported on this backend; options:
  // - htmlContentDisposition -- enforcing content-disposition for text/html objects
  omit = [],

  // if true, expect the backend to accept a gzip-encoded upload
  supportsGzipUpload = false,

  // suiteDefinition defines the suite; add suiteSetup, suiteTeardown here, if
  // necessary, and any extra tests
}, suiteDefinition) => {
  suite(`putUrl2 upload method API${title ? `: ${title}` : ''}`, function() {
    (suiteDefinition || (() => {})).call(this);

    let backend;
    suiteSetup(async function() {
      const backends = await helper.load('backends');
      backend = backends.get(backendId);
    });

    const makeUpload = async ({ length = 256, contentType = 'application/random-bytes', contentEncodings = [] } = {}) => {
      const data = crypto.randomBytes(length);
      const name = helper.testObjectName(prefix);
      const expires = taskcluster.fromNow('1 hour');
      const uploadId = taskcluster.slugid();

      await helper.db.fns.create_object_for_upload(name, 'test-proj', backendId, uploadId, expires, {}, expires);
      const [object] = await helper.db.fns.get_object_with_upload(name);

      const res = await backend.createUpload(object, {
        putUrl2: { contentType, contentLength: data.length, contentEncodings },
      });

      await helper.assertSatisfiesSchema(res, responseSchema);

      return { name, data, res, uploadId, object };
    };

    const performUpload = async ({ name, data, res, uploadId, expectGzipped }) => {
      assert(new Date(res.putUrl2.expires) > new Date());

      let req = request.put(res.putUrl2.url);
      let gzipped = false;
      for (let [h, v] of Object.entries(res.putUrl2.headers)) {
        if (h === 'Content-Encoding' && v === 'gzip') {
          gzipped = true;
        }
        req = req.set(h, v);
      }
      if (expectGzipped) {
        assert(gzipped);
      }
      if (gzipped) {
        data = await gzip(data);
      }
      const putRes = await req.send(data);
      assert(putRes.ok, putRes);
    };

    const finishUpload = async ({ name, uploadId, object }) => {
      await backend.finishUpload(object);
      await helper.db.fns.object_upload_complete(name, uploadId);
    };

    for (const length of [0, 1024]) {
      test(`upload an object (length=${length})`, async function() {
        const { name, data, res, object, uploadId } = await makeUpload({ length });
        await performUpload({ name, data, res, uploadId });
        await finishUpload({ name, uploadId, object });

        const stored = await getObjectContent({ name });
        assert.equal(stored.contentType, 'application/random-bytes');
        assert.deepEqual(stored.data, data);
      });
    }

    test(`upload an object allowing gzip`, async function() {
      const { name, data, res, object, uploadId } = await makeUpload({
        length: 1024,
        contentEncodings: ['gzip'],
      });
      await performUpload({ name, data, res, uploadId, expectGzipped: supportsGzipUpload });
      await finishUpload({ name, uploadId, object });

      const stored = await getObjectContent({ name });
      assert.equal(stored.contentType, 'application/random-bytes');
      assert.deepEqual(stored.data, data);
      if (supportsGzipUpload) {
        assert.equal(stored.contentEncoding, 'gzip');
      }
    });

    test('upload an object with a bad Content-Type', async function() {
      const { data, res } = await makeUpload();

      let req = request.put(res.putUrl2.url);
      for (let [h, v] of Object.entries(res.putUrl2.headers)) {
        req = req.set(h, v);
      }
      req.set('Content-Type', 'some-other/content-type');
      req.ok(res => res.status < 500);
      const putRes = await req.send(data);

      // this request should fail, somehow (how depends on the backend)
      assert(!putRes.ok);
    });

    if (!omit.includes('htmlContentDisposition')) {
      test(`upload of type text/html has attachment disposition`, async function() {
        const { name, data, res, object, uploadId } = await makeUpload({ contentType: 'text/html' });

        await performUpload({ name, data, res, uploadId });
        await finishUpload({ name, uploadId, object });

        const stored = await getObjectContent({ name });
        assert.equal(stored.contentType, 'text/html');
        assert.equal(stored.contentDisposition, 'attachment');
        assert.deepEqual(stored.data, data);
      });
    }
  });
};
