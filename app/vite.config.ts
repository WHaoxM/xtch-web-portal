import fs from 'node:fs'
import path from "path"
import type { IncomingMessage } from 'node:http'
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

const localApiRoutes: Record<string, string> = {
  '/api/inquiries': '/api/inquiries.ts',
  '/api/checkout-session': '/api/checkout-session.ts',
  '/api/auth-provider-status': '/api/auth-provider-status.ts',
  '/api/departures': '/api/departures.ts',
  '/api/stripe-webhook': '/api/stripe-webhook.ts',
  '/api/orders': '/api/orders.ts',
  '/api/my-orders': '/api/my-orders.ts',
  '/api/claim-orders': '/api/claim-orders.ts',
  '/api/admin/orders': '/api/admin/orders.ts',
  '/api/admin/dashboard': '/api/admin/dashboard.ts',
  '/api/admin/inquiries': '/api/admin/inquiries.ts',
  '/api/admin/departures': '/api/admin/departures.ts',
  '/api/custom-trip-form': '/api/custom-trip-form.ts',
  '/api/admin/custom-trip-form': '/api/admin/custom-trip-form.ts',
  '/api/destinations': '/api/destinations.ts',
  '/api/routes': '/api/routes.ts',
  '/api/admin/destinations': '/api/admin/destinations.ts',
  '/api/admin/routes': '/api/admin/routes.ts',
  '/api/admin/media': '/api/admin/media.ts',
  '/api/admin/media-presign': '/api/admin/media-presign.ts',
  '/api/categories': '/api/categories.ts',
  '/api/admin/categories': '/api/admin/categories.ts',
};

const rawBodyRoutes = new Set(['/api/stripe-webhook']);

type VercelResponseLike = {
  status: (code: number) => VercelResponseLike;
  json: (body: unknown) => void;
  send: (body: string) => void;
};

function localApiPlugin(): Plugin {
  return {
    name: 'local-vercel-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const apiPath = req.url?.split('?')[0] ?? '';
        const modulePath = localApiRoutes[apiPath];

        if (!modulePath) {
          next();
          return;
        }

        try {
          const useRawBody = rawBodyRoutes.has(apiPath);
          const body = useRawBody ? await readRawBody(req) : await readJsonBody(req);
          const { default: handler } = await server.ssrLoadModule(modulePath);
          const response: VercelResponseLike = {
            status(code) {
              res.statusCode = code;
              return response;
            },
            json(payload) {
              res.setHeader('content-type', 'application/json; charset=utf-8');
              res.end(JSON.stringify(payload));
            },
            send(payload) {
              res.setHeader('content-type', 'text/plain; charset=utf-8');
              res.end(payload);
            },
          };

          await handler(
            {
              method: req.method,
              headers: req.headers,
              url: req.url,
              body,
            },
            response,
          );
        } catch (error) {
          console.error('Local API request failed:', error);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, error: 'Local API request failed.' }));
        }
      });
    },
  };
}

async function readJsonBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return undefined;

  return JSON.parse(raw) as unknown;
}

async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

/** Apply a dotenv file so its values win over existing process.env. */
function applyEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);
  // loadEnv prefers existing process.env over .env files. After Vite's in-process
  // restart (editing .env.local), an earlier empty RESEND_API_KEY would stick.
  // Re-apply local env files so updated secrets win for the local API middleware.
  applyEnvFile(path.resolve(process.cwd(), '.env'));
  applyEnvFile(path.resolve(process.cwd(), `.env.${mode}`));
  applyEnvFile(path.resolve(process.cwd(), '.env.local'));
  applyEnvFile(path.resolve(process.cwd(), `.env.${mode}.local`));

  return {
    base: './',
    plugins: [localApiPlugin(), inspectAttr(), react()],
    server: {
      port: 3000,
      strictPort: true,
      host: '127.0.0.1',
      // Quick tunnels send Host: *.trycloudflare.com; Vite blocks unknown hosts by default.
      ...(mode === 'tunnel' ? { allowedHosts: ['.trycloudflare.com'] as string[] } : {}),
      // Same-origin /s3 → MinIO so tunnel browsers can PUT/GET with Host matching
      // the Cloudflare URL used in S3_ENDPOINT (see docs/ops/tunnel-testbed.md).
      proxy: {
        '/s3': {
          target: 'http://127.0.0.1:9000',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/s3/, ''),
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
