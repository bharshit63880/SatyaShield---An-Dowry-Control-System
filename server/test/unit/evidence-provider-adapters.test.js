import '../helpers/environment.js';

import assert from 'node:assert/strict';
import test from 'node:test';

import { HttpEvidenceScanner } from '../../src/services/evidence-scanner.service.js';
import { ObjectPrivateStorageProvider } from '../../src/services/storage/object-private-storage.provider.js';

test('HTTP scanner accepts only bounded clean or infected provider results', async () => {
  const scanner = new HttpEvidenceScanner({
    url: 'https://scanner.test/scan', token: 'test-token', timeoutMs: 1000,
    fetchImpl: async (_url, request) => {
      assert.equal(request.headers.authorization, 'Bearer test-token');
      return { ok: true, json: async () => ({ status: 'clean', engine: 'safe-test' }) };
    }
  });
  assert.deepEqual(await scanner.scan(Buffer.from('fixture')), {
    status: 'clean', engine: 'safe-test', engineVersion: null
  });

  const invalid = new HttpEvidenceScanner({
    url: 'https://scanner.test/scan', token: 'test-token',
    fetchImpl: async () => ({ ok: true, json: async () => ({ status: 'unknown' }) })
  });
  await assert.rejects(() => invalid.scan(Buffer.from('fixture')), /invalid result/);
});

test('private object adapter encrypts before upload and detects ciphertext tampering', async () => {
  let stored;
  const client = {
    async send(command) {
      if (command.constructor.name === 'PutObjectCommand') {
        stored = Buffer.from(command.input.Body);
        assert.equal(command.input.ACL, undefined);
        assert.equal(command.input.ServerSideEncryption, 'AES256');
        return {};
      }
      if (command.constructor.name === 'GetObjectCommand') {
        return { Body: { transformToByteArray: async () => stored } };
      }
      throw new Error('unexpected command');
    }
  };
  const provider = new ObjectPrivateStorageProvider({
    client, bucket: 'private-test', prefix: 'evidence', keyHex: 'a'.repeat(64)
  });
  const saved = await provider.save(Buffer.from('private evidence'));
  assert.doesNotMatch(stored.toString('utf8'), /private evidence/);
  assert.equal((await provider.open(saved.storageId)).toString(), 'private evidence');
  stored[stored.length - 1] ^= 1;
  await assert.rejects(() => provider.open(saved.storageId), /integrity verification failed/);
});
