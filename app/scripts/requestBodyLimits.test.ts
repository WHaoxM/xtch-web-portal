import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import {
  ClientAbortedError,
  InvalidJsonBodyError,
  JSON_API_BODY_LIMIT_BYTES,
  PayloadTooLargeError,
  STRIPE_WEBHOOK_BODY_LIMIT_BYTES,
  bodyLimitBytesForKind,
  readLimitedRequestBody,
} from './requestBodyLimits.ts';

function makeReq(
  chunks: Array<string | Buffer>,
  headers: Record<string, string | undefined> = {},
) {
  const stream = Readable.from(chunks);
  (stream as Readable & { headers: typeof headers }).headers = headers;
  return stream as Readable & {
    headers: Record<string, string | string[] | undefined>;
  };
}

test('body limits are distinct and finite', () => {
  assert.equal(bodyLimitBytesForKind('json'), JSON_API_BODY_LIMIT_BYTES);
  assert.equal(bodyLimitBytesForKind('webhook'), STRIPE_WEBHOOK_BODY_LIMIT_BYTES);
  assert.ok(JSON_API_BODY_LIMIT_BYTES > 0);
  assert.ok(STRIPE_WEBHOOK_BODY_LIMIT_BYTES > 0);
  assert.ok(JSON_API_BODY_LIMIT_BYTES !== STRIPE_WEBHOOK_BODY_LIMIT_BYTES);
});

test('small valid JSON passes', async () => {
  const req = makeReq(['{"ok":true}'], { 'content-length': '11' });
  const body = await readLimitedRequestBody(req, { raw: false, limitBytes: 1024 });
  assert.deepEqual(body, { ok: true });
});

test('small valid webhook raw body passes', async () => {
  const payload = Buffer.from('{"id":"evt_1"}');
  const req = makeReq([payload], { 'content-length': String(payload.length) });
  const body = await readLimitedRequestBody(req, { raw: true, limitBytes: 256 });
  assert.ok(Buffer.isBuffer(body));
  assert.equal(body.toString('utf8'), '{"id":"evt_1"}');
});

test('over-limit Content-Length rejects before reading into handler budget', async () => {
  const req = makeReq(['never-read'], { 'content-length': '9999' });
  await assert.rejects(
    () => readLimitedRequestBody(req, { raw: false, limitBytes: 16 }),
    (error: unknown) => error instanceof PayloadTooLargeError && error.statusCode === 413,
  );
});

test('chunked body over limit rejects with 413', async () => {
  const req = makeReq(['aaaaaaaaaa', 'bbbbbbbbbb', 'cccccccccc']);
  await assert.rejects(
    () => readLimitedRequestBody(req, { raw: true, limitBytes: 16 }),
    (error: unknown) => error instanceof PayloadTooLargeError && error.statusCode === 413,
  );
});

test('invalid JSON returns stable 400 error type', async () => {
  const req = makeReq(['{not-json']);
  await assert.rejects(
    () => readLimitedRequestBody(req, { raw: false, limitBytes: 1024 }),
    (error: unknown) => error instanceof InvalidJsonBodyError && error.statusCode === 400,
  );
});

test('client abort while streaming becomes ClientAbortedError', async () => {
  const stream = new Readable({
    read() {
      this.push(Buffer.from('partial'));
      this.destroy(Object.assign(new Error('aborted'), { code: 'ECONNRESET' }));
    },
  });
  (stream as Readable & { headers: Record<string, never> }).headers = {};
  await assert.rejects(
    () =>
      readLimitedRequestBody(stream as Readable & { headers: Record<string, string | string[] | undefined> }, {
        raw: true,
        limitBytes: 1024,
      }),
    (error: unknown) => error instanceof ClientAbortedError,
  );
});
