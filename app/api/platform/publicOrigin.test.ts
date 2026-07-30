import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isPlaceholderUrl,
  resolvePublicOrigin,
  resolveRequestOrigin,
  resolveS3BrowserEndpoint,
} from './publicOrigin.ts';

test('isPlaceholderUrl catches YOUR_DOMAIN placeholders', () => {
  assert.equal(isPlaceholderUrl('https://YOUR_DOMAIN/s3'), true);
  assert.equal(isPlaceholderUrl('https://cdn.example.com/s3'), false);
  assert.equal(isPlaceholderUrl('https://syncingtravel.com/s3'), false);
});

test('resolvePublicOrigin prefers PUBLIC_DOMAIN over PUBLIC_IP', () => {
  assert.equal(
    resolvePublicOrigin({
      PUBLIC_DOMAIN: 'trips.example.org',
      PUBLIC_IP: '203.0.113.10',
      APP_ENV: 'prod',
    }),
    'https://trips.example.org',
  );
});

test('resolvePublicOrigin uses PUBLIC_IP with http when no domain', () => {
  assert.equal(
    resolvePublicOrigin({
      PUBLIC_IP: '203.0.113.10',
      APP_ENV: 'prod',
    }),
    'http://203.0.113.10',
  );
});

test('resolvePublicOrigin skips LAN unless prod/deploy', () => {
  assert.equal(resolvePublicOrigin({}), null);
});

test('resolveRequestOrigin respects X-Forwarded-*', () => {
  assert.equal(
    resolveRequestOrigin({
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'shop.example.com',
        host: '127.0.0.1:3000',
      },
    }),
    'https://shop.example.com',
  );
});

test('resolveS3BrowserEndpoint uses requestOrigin first', () => {
  assert.equal(
    resolveS3BrowserEndpoint(
      { S3_BROWSER_ENDPOINT: 'https://cdn.example.com/s3' },
      'http://10.0.0.5:3000',
    ),
    'http://10.0.0.5:3000/s3',
  );
});
