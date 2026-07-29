import '../helpers/environment.js';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const { LocalPrivateStorageProvider } = await import(
  '../../src/services/storage/local-private-storage.provider.js'
);
const { createVaultEvidence } = await import('../../src/services/evidence-vault.service.js');

test('local private storage encrypts, authenticates, isolates names, and cleans temporary files', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'satyashield-vault-unit-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const key = crypto.randomBytes(32).toString('hex');
  const provider = new LocalPrivateStorageProvider({ rootDirectory: root, keyHex: key });
  const plaintext = Buffer.from('highly sensitive evidence bytes');

  const first = await provider.save(plaintext);
  const second = await provider.save(plaintext);
  assert.match(first.storageId, /^[a-f0-9]{64}$/);
  assert.notEqual(first.storageId, second.storageId);
  assert.equal(first.storageId.includes('evidence'), false);
  const stored = await fs.readFile(path.join(root, first.storageId));
  assert.equal(stored.includes(plaintext), false);
  assert.deepEqual(await provider.open(first.storageId), plaintext);
  assert.notDeepEqual(
    (await fs.readFile(path.join(root, first.storageId))).subarray(4, 16),
    (await fs.readFile(path.join(root, second.storageId))).subarray(4, 16)
  );

  stored[stored.length - 1] ^= 1;
  await fs.writeFile(path.join(root, first.storageId), stored);
  await assert.rejects(() => provider.open(first.storageId), (error) => error.code === 'EVIDENCE_INTEGRITY_FAILED');

  const wrongKey = new LocalPrivateStorageProvider({
    rootDirectory: root,
    keyHex: crypto.randomBytes(32).toString('hex')
  });
  await assert.rejects(() => wrongKey.open(second.storageId));
  assert.throws(() => provider.resolve('../escape'));
  assert.equal((await fs.readdir(root)).some((name) => name.endsWith('.tmp')), false);
});

test('vault compensates storage when database persistence fails', async () => {
  let deletedStorageId = null;
  const storage = {
    name: 'test_private',
    save: async () => ({
      storageId: 'a'.repeat(64),
      encryptedDigest: 'b'.repeat(64),
      encryptionVersion: 1
    }),
    delete: async (storageId) => {
      deletedStorageId = storageId;
    }
  };
  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    Buffer.alloc(16, 1),
    Buffer.from([0xff, 0xd9])
  ]);
  await assert.rejects(() => createVaultEvidence({
    file: { buffer: jpeg, originalname: 'proof.jpg', mimetype: 'image/jpeg' },
    complaintId: 'anon-test',
    req: { user: null },
    storage,
    scanner: { scan: async () => ({ status: 'clean' }) },
    evidenceModel: { create: async () => { throw new Error('database failure'); } }
  }));
  assert.equal(deletedStorageId, 'a'.repeat(64));
});
