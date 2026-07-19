/**
 * Build-time prerender for public SEO/GEO routes.
 * Usage: node scripts/prerender.mjs [distDir]
 * Requires: playwright (+ chromium via `npx playwright install chromium`)
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { getPrerenderRoutes } from './seo-public-routes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');

const ROUTES = getPrerenderRoutes();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function resolveFile(distRoot, urlPathname) {
  const relative = urlPathname === '/' ? 'index.html' : urlPathname.replace(/^\//, '');
  const abs = path.normalize(path.join(distRoot, relative));
  if (!abs.startsWith(distRoot)) return null;
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  const dirIndex = path.normalize(path.join(distRoot, relative, 'index.html'));
  if (dirIndex.startsWith(distRoot) && fs.existsSync(dirIndex) && fs.statSync(dirIndex).isFile()) {
    return dirIndex;
  }
  return null;
}

function startStaticServer(distRoot) {
  const spaIndex = path.join(distRoot, 'index.html');
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const file = resolveFile(distRoot, url.pathname);
      const target = file || spaIndex;
      if (!fs.existsSync(target)) {
        res.statusCode = 404;
        res.end('missing');
        return;
      }
      const ext = path.extname(target).toLowerCase();
      res.statusCode = 200;
      res.setHeader('content-type', MIME[ext] || 'application/octet-stream');
      fs.createReadStream(target).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port });
    });
    server.on('error', reject);
  });
}

function outPathForRoute(distRoot, route) {
  if (route === '/') return path.join(distRoot, 'index.html');
  const clean = route.replace(/^\//, '').replace(/\/$/, '');
  return path.join(distRoot, clean, 'index.html');
}

async function main() {
  const distArg = process.argv[2] || 'dist/local';
  const distRoot = path.resolve(appRoot, distArg);
  if (!fs.existsSync(path.join(distRoot, 'index.html'))) {
    console.error(`[prerender] Missing ${distRoot}/index.html — build first.`);
    process.exit(1);
  }

  const { server, port } = await startStaticServer(distRoot);
  const origin = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let ok = 0;
  let failed = 0;

  try {
    for (const route of ROUTES) {
      const url = `${origin}${route}`;
      try {
        // Prefer load over networkidle — forms (Turnstile/analytics) may never idle.
        await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
        await page.waitForFunction(
          () => document.documentElement.dataset.seoReady === '1',
          null,
          { timeout: 20_000 },
        );
        const html = await page.content();
        const outFile = outPathForRoute(distRoot, route);
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        fs.writeFileSync(outFile, html, 'utf8');
        ok += 1;
        console.log(`[prerender] OK ${route}`);
      } catch (error) {
        failed += 1;
        console.error(
          `[prerender] FAIL ${route}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`[prerender] done: ${ok} ok, ${failed} failed → ${distRoot}`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error('[prerender]', error);
  process.exit(1);
});
