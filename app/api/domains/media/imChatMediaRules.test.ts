import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesChatAttachmentSignature, readChatAttachmentInput, sanitizeChatFilename } from './imChatMediaRules';

test('chat attachment input accepts only bounded common image and document types', () => {
  assert.deepEqual(readChatAttachmentInput({ filename: '照片.png', contentType: 'image/png', byteSize: 100, kind: 'image' }),
    { filename: '照片.png', contentType: 'image/png', byteSize: 100, kind: 'image' });
  assert.equal(readChatAttachmentInput({ filename: 'proposal.pdf', contentType: 'application/pdf', byteSize: 10, kind: 'file' }).kind, 'file');
  assert.throws(() => readChatAttachmentInput({ filename: 'bad.svg', contentType: 'image/svg+xml', byteSize: 1, kind: 'image' }));
  assert.throws(() => readChatAttachmentInput({ filename: 'bad.exe', contentType: 'application/octet-stream', byteSize: 1, kind: 'file' }));
  assert.throws(() => readChatAttachmentInput({ filename: 'photo.png', contentType: 'image/jpeg', byteSize: 1, kind: 'image' }));
  assert.throws(() => readChatAttachmentInput({ filename: 'large.jpg', contentType: 'image/jpeg', byteSize: 8 * 1024 * 1024 + 1, kind: 'image' }), /8 MB/);
  assert.throws(() => readChatAttachmentInput({ filename: 'large.pdf', contentType: 'application/pdf', byteSize: 15 * 1024 * 1024 + 1, kind: 'file' }), /15 MB/);
});

test('filenames are reduced to safe basenames and magic bytes reject spoofed MIME', () => {
  assert.equal(sanitizeChatFilename('../../quoted".pdf'), 'quoted-.pdf');
  assert.equal(matchesChatAttachmentSignature('image/png', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  assert.equal(matchesChatAttachmentSignature('image/png', Uint8Array.from([0xff, 0xd8, 0xff])), false);
  assert.equal(matchesChatAttachmentSignature('application/pdf', Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d])), true);
  assert.equal(matchesChatAttachmentSignature('text/plain', Uint8Array.from([0x61, 0x62, 0x63])), true);
  assert.equal(matchesChatAttachmentSignature('text/plain', Uint8Array.from([0x61, 0x00, 0x63])), false);
});
