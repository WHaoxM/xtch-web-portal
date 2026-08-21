import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import {
  createMessagingSocketServer,
  parseMessagingSocketOrigins,
} from './messagingSocket.ts';

test('messaging socket attaches an authenticated /im namespace', async () => {
  const httpServer = createServer();
  const messaging = createMessagingSocketServer(httpServer, {
    allowedOrigins: ['https://portal.example.com'],
    authenticate: async (token) => ({
      subject: token,
      role: 'tenant_staff',
      tenantId: 'tenant-1',
      scopes: ['im:read'],
    }),
  });

  assert.equal(messaging.namespace.name, '/im');

  await new Promise<void>((resolve) => messaging.io.close(() => resolve()));
  httpServer.close();
});

test('socket origin parsing drops empty values', () => {
  assert.deepEqual(
    parseMessagingSocketOrigins(' https://portal.example.com, ,https://app.example.com '),
    ['https://portal.example.com', 'https://app.example.com'],
  );
});
