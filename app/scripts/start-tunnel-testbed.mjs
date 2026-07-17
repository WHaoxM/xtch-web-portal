/**
 * Start Cloudflare quick tunnel + vite --mode tunnel.
 *
 * Prerequisites (manual):
 * - docker compose up -d (Postgres + MinIO; xtch_tunnel DB + xtch-tunnel bucket)
 * - app/.env.tunnel.local filled (from .env.tunnel.local.example), including Resend
 * - cloudflared on PATH
 * - npm run db:migrate:tunnel already applied once
 *
 * Does NOT create secrets. Rewrites S3_* / redirect URLs to the live tunnel host.
 */
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const envPath = path.join(appRoot, '.env.tunnel.local');
const PORT = 3000;

function whichCloudflared() {
  try {
    if (process.platform === 'win32') {
      const out = execSync('where cloudflared', { encoding: 'utf8' }).trim();
      return out.split(/\r?\n/).find(Boolean) || null;
    }
    return execSync('command -v cloudflared', { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

function upsertEnvKeys(filePath, updates) {
  let text = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  if (!text.endsWith('\n') && text.length > 0) text += '\n';

  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(text)) {
      text = text.replace(re, line);
    } else {
      text += `${line}\n`;
    }
  }

  fs.writeFileSync(filePath, text, 'utf8');
}

function freePort(port) {
  execSync(`node "${path.join(appRoot, 'scripts', 'free-dev-port.mjs')}"`, {
    cwd: appRoot,
    env: { ...process.env, DEV_PORT: String(port) },
    stdio: 'inherit',
  });
}

function applyTunnelUrls(tunnelOrigin) {
  const origin = tunnelOrigin.replace(/\/$/, '');
  upsertEnvKeys(envPath, {
    S3_ENDPOINT: `${origin}/s3`,
    S3_PUBLIC_BASE_URL: `${origin}/s3/xtch-tunnel`,
    VITE_AUTH_REDIRECT_URL: `${origin}/#/china-trips?auth=callback`,
    STRIPE_CHECKOUT_SUCCESS_URL: `${origin}/#/china-trips?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    STRIPE_CHECKOUT_CANCEL_URL: `${origin}/#/china-trips?checkout=cancelled`,
  });
}

async function waitForTunnelUrl(cloudflaredProc, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => {
      reject(new Error('Timed out waiting for trycloudflare.com URL from cloudflared.'));
    }, timeoutMs);

    const onData = (chunk) => {
      const text = chunk.toString();
      buffer += text;
      process.stderr.write(text);
      const match = buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (match) {
        clearTimeout(timer);
        cloudflaredProc.stdout?.off('data', onData);
        cloudflaredProc.stderr?.off('data', onData);
        resolve(match[0]);
      }
    };

    cloudflaredProc.stdout?.on('data', onData);
    cloudflaredProc.stderr?.on('data', onData);
    cloudflaredProc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    cloudflaredProc.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`cloudflared exited early with code ${code}`));
    });
  });
}

function main() {
  if (!whichCloudflared()) {
    console.error(
      '[testbed:tunnel] cloudflared not found on PATH.\n' +
        'Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/',
    );
    process.exit(1);
  }

  if (!fs.existsSync(envPath)) {
    console.error(
      `[testbed:tunnel] Missing ${envPath}\n` +
        'Copy app/.env.tunnel.local.example → app/.env.tunnel.local and fill Resend + bypass emails.',
    );
    process.exit(1);
  }

  // Free 3000 before the tunnel attaches so we never proxy an old `npm run dev` instance.
  freePort(PORT);

  console.log('[testbed:tunnel] Starting cloudflared quick tunnel → http://127.0.0.1:3000 ...');

  const cloudflared = spawn(
    'cloudflared',
    ['tunnel', '--url', `http://127.0.0.1:${PORT}`],
    {
      cwd: appRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );

  let vite = null;
  let shuttingDown = false;

  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[testbed:tunnel] Shutting down (${signal}). Tunnel URL stops working.`);
    try {
      vite?.kill('SIGTERM');
    } catch {
      /* ignore */
    }
    try {
      cloudflared.kill('SIGTERM');
    } catch {
      /* ignore */
    }
    setTimeout(() => process.exit(0), 500);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  waitForTunnelUrl(cloudflared)
    .then((tunnelUrl) => {
      console.log(`[testbed:tunnel] Public URL: ${tunnelUrl}`);
      applyTunnelUrls(tunnelUrl);
      console.log('[testbed:tunnel] Updated S3_ENDPOINT / S3_PUBLIC_BASE_URL / redirect URLs in .env.tunnel.local');

      console.log('[testbed:tunnel] Starting vite --mode tunnel ...');
      console.log('[testbed:tunnel] When finished: Ctrl+C (closes Vite + cloudflared).');
      console.log(`[testbed:tunnel] Open: ${tunnelUrl}`);
      console.log(
        '[testbed:tunnel] SECURITY: Admin + auth bypass are exposed on this URL. Do not share casually.',
      );

      vite = spawn('npx', ['vite', '--mode', 'tunnel'], {
        cwd: appRoot,
        stdio: 'inherit',
        shell: process.platform === 'win32',
        env: process.env,
      });

      vite.on('exit', (code) => {
        if (!shuttingDown) {
          console.log(`[testbed:tunnel] Vite exited (${code}). Stopping tunnel.`);
          shutdown('vite-exit');
        }
      });
    })
    .catch((error) => {
      console.error('[testbed:tunnel]', error instanceof Error ? error.message : error);
      try {
        cloudflared.kill('SIGTERM');
      } catch {
        /* ignore */
      }
      process.exit(1);
    });
}

main();
