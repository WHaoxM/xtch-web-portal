import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifyPagePath,
  createPublicPathSet,
  loadPublicRouteManifest,
  looksLikeStaticAssetPath,
  normalizePagePathname,
} from './httpRoutePolicy.ts';

test('loads SEO public route manifest and keeps homepage public', () => {
  const manifest = loadPublicRouteManifest();
  assert.equal(manifest.version, 1);
  assert.ok(manifest.paths.includes('/'));
  assert.ok(manifest.paths.includes('/destinations/beijing'));
  const paths = createPublicPathSet(manifest);
  assert.equal(classifyPagePath('/', paths), 'public');
  assert.equal(classifyPagePath('/destinations/beijing/', paths), 'public');
});

test('SPA shells remain deep-linkable (not unknown)', () => {
  const paths = createPublicPathSet({ version: 1, paths: ['/'] });
  assert.equal(classifyPagePath('/account', paths), 'spa');
  assert.equal(classifyPagePath('/admin', paths), 'spa');
  assert.equal(classifyPagePath('/wenshu/review', paths), 'spa');
  assert.equal(classifyPagePath('/search', paths), 'spa');
  assert.equal(classifyPagePath('/auth/callback', paths), 'spa');
  assert.equal(classifyPagePath('/orders/XTCH-123', paths), 'spa');
  assert.equal(classifyPagePath('/china-tours', paths), 'spa');
});

test('unknown pages are classified for HTTP 404', () => {
  const paths = createPublicPathSet({ version: 1, paths: ['/', '/about'] });
  assert.equal(classifyPagePath('/this-page-does-not-exist', paths), 'unknown');
  assert.equal(classifyPagePath('/destinations/not-a-real-slug', paths), 'unknown');
  assert.equal(classifyPagePath('/tours/missing-tour', paths), 'unknown');
});

test('normalize and static asset heuristics', () => {
  assert.equal(normalizePagePathname('/about/'), '/about');
  assert.equal(looksLikeStaticAssetPath('/assets/index-abc.js'), true);
  assert.equal(looksLikeStaticAssetPath('/favicon.ico'), true);
  assert.equal(looksLikeStaticAssetPath('/about'), false);
});
