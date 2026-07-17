import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildObjectKey,
  mediaTypeFromContentType,
  resolveStorageEnv,
  sanitizeObjectFilename,
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
