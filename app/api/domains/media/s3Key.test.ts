import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildObjectKey,
  mediaTypeFromContentType,
  publicUrlForKey,
  resolveStorageEnv,
  rewriteSignedUploadUrlForBrowser,
  sanitizeObjectFilename,
  toSameOriginS3Path,
} from './s3.ts';

test('resolveStorageEnv prefers APP_ENV', () => {
  assert.equal(resolveStorageEnv({ APP_ENV: 'prod', NODE_ENV: 'development' }), 'prod');
  assert.equal(resolveStorageEnv({ APP_ENV: 'dev' }), 'dev');
  assert.equal(resolveStorageEnv({ NODE_ENV: 'production' }), 'prod');
  assert.equal(resolveStorageEnv({ NODE_ENV: 'development' }), 'dev');
});

test('mediaTypeFromContentType maps known types', () => {
  assert.equal(mediaTypeFromContentType('image/png'), 'image');
  assert.equal(mediaTypeFromContentType('video/mp4'), 'video');
  assert.equal(mediaTypeFromContentType('application/pdf'), 'pdf');
  assert.equal(mediaTypeFromContentType('application/octet-stream'), 'file');
});

test('buildObjectKey uses env/type/yyyy/mm/uuid-name', () => {
  const key = buildObjectKey(
    'Office Photo (1).PNG',
    'image/png',
    new Date('2026-07-17T12:00:00Z'),
    { APP_ENV: 'dev' },
  );
  assert.match(
    key,
    /^dev\/image\/2026\/07\/[0-9a-f-]{36}-Office-Photo-\(1\)\.PNG$/i,
  );
  assert.equal(key.includes('media/'), false);
});

test('sanitizeObjectFilename strips path segments', () => {
  assert.equal(sanitizeObjectFilename('C:\\tmp\\a b.png'), 'a-b.png');
});

test('rewriteSignedUploadUrlForBrowser maps MinIO URL onto /s3 public origin', () => {
  const signed =
    'http://127.0.0.1:9000/xtch-public/prod/image/x.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-SignedHeaders=host';
  const rewritten = rewriteSignedUploadUrlForBrowser(signed, {
    S3_BROWSER_ENDPOINT: 'https://cdn.example.com/s3',
  });
  assert.equal(
    rewritten,
    'https://cdn.example.com/s3/xtch-public/prod/image/x.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-SignedHeaders=host',
  );
});

test('rewriteSignedUploadUrlForBrowser prefers requestOrigin over S3_BROWSER_ENDPOINT', () => {
  const signed = 'http://127.0.0.1:9000/xtch-public/key?sig=1';
  const rewritten = rewriteSignedUploadUrlForBrowser(
    signed,
    { S3_BROWSER_ENDPOINT: 'https://cdn.example.com/s3' },
    'http://192.168.1.10:3000',
  );
  assert.equal(rewritten, 'http://192.168.1.10:3000/s3/xtch-public/key?sig=1');
});

test('rewriteSignedUploadUrlForBrowser is a no-op without browser endpoint or public origin', () => {
  const signed = 'http://127.0.0.1:9000/xtch-public/key?sig=1';
  assert.equal(rewriteSignedUploadUrlForBrowser(signed, {}), signed);
});

test('publicUrlForKey returns same-origin relative /s3 path', () => {
  assert.equal(
    publicUrlForKey('prod/image/x.png', {
      endpoint: 'http://127.0.0.1:9000',
      accessKeyId: 'x',
      secretAccessKey: 'y',
      bucket: 'xtch-prod',
      region: 'us-east-1',
      publicBaseUrl: 'http://127.0.0.1:3080/s3/xtch-prod',
    }),
    '/s3/xtch-prod/prod/image/x.png',
  );
});

test('toSameOriginS3Path strips host from absolute /s3 URLs', () => {
  assert.equal(
    toSameOriginS3Path('http://127.0.0.1:3000/s3/xtch-prod/prod/image/a.jpg'),
    '/s3/xtch-prod/prod/image/a.jpg',
  );
  assert.equal(toSameOriginS3Path('/s3/xtch-prod/prod/image/a.jpg'), '/s3/xtch-prod/prod/image/a.jpg');
  assert.equal(
    toSameOriginS3Path('https://cdn.example.com/external.jpg'),
    'https://cdn.example.com/external.jpg',
  );
});
