import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateChatUploadUrl, getPrivateChatS3Config, rewritePrivateChatSignedUrlForBrowser } from './imChatMedia';

test('private chat signed URLs use the canonical S3 host, not the cross-site visitor origin', () => {
  const signed = 'http://127.0.0.1:9000/xtch-im-private/im-chat/2026/10/file?X-Amz-Signature=short';
  const rewritten = rewritePrivateChatSignedUrlForBrowser(signed, 'https://www.zhilvtravel.com', {
    S3_BROWSER_ENDPOINT: 'https://www.xuntingtravel.com/s3',
  });
  assert.equal(rewritten, 'https://www.xuntingtravel.com/s3/xtch-im-private/im-chat/2026/10/file?X-Amz-Signature=short');
  assert.equal(new URL(rewritten).origin, 'https://www.xuntingtravel.com');
});

test('local same-origin chat storage falls back to the request origin when no canonical origin is configured', () => {
  const rewritten = rewritePrivateChatSignedUrlForBrowser('http://127.0.0.1:9000/xtch-im-private/key?sig=x', 'http://localhost:3000', {});
  assert.equal(rewritten, 'http://localhost:3000/s3/xtch-im-private/key?sig=x');
});

test('request storage host takes precedence over unrelated PUBLIC_DOMAIN when no S3 browser endpoint is set', () => {
  const rewritten = rewritePrivateChatSignedUrlForBrowser('http://127.0.0.1:9000/xtch-im-private/key?sig=x', 'https://www.xuntingtravel.com', {
    PUBLIC_DOMAIN: 'https://www.zhilvtravel.com',
  });
  assert.equal(rewritten, 'https://www.xuntingtravel.com/s3/xtch-im-private/key?sig=x');
});

test('private media never falls back to the configured public content bucket', () => {
  assert.equal(getPrivateChatS3Config({
    S3_ENDPOINT: 'http://127.0.0.1:9000',
    S3_ACCESS_KEY_ID: 'test-access',
    S3_SECRET_ACCESS_KEY: 'test-secret',
    S3_BUCKET: 'xtch-prod',
    IM_MEDIA_S3_BUCKET: 'xtch-prod',
  }), null);
});

test('upload signatures bind object size and conditional creation, and use the canonical storage host', async () => {
  const keys = ['S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_BUCKET', 'IM_MEDIA_S3_BUCKET', 'S3_BROWSER_ENDPOINT'];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.S3_ENDPOINT = 'http://127.0.0.1:9000';
    process.env.S3_ACCESS_KEY_ID = 'test-access';
    process.env.S3_SECRET_ACCESS_KEY = 'test-secret';
    process.env.S3_BUCKET = 'xtch-prod';
    process.env.IM_MEDIA_S3_BUCKET = 'xtch-im-private';
    process.env.S3_BROWSER_ENDPOINT = 'https://www.xuntingtravel.com/s3';
    const signed = await createPrivateChatUploadUrl({ objectKey: 'im-chat/test-object', contentType: 'image/png', byteSize: 123 });
    const url = new URL(signed);
    assert.equal(url.origin, 'https://www.xuntingtravel.com');
    assert.equal(url.pathname, '/s3/xtch-im-private/im-chat/test-object');
    assert.equal(url.searchParams.get('X-Amz-Expires'), '300');
    const signedHeaders = url.searchParams.get('X-Amz-SignedHeaders') || '';
    assert.match(signedHeaders, /content-length/);
    assert.match(signedHeaders, /if-none-match/);
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
