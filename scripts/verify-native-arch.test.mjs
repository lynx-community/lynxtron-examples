import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifyNativeArch } from './verify-native-arch.cjs';
test('checks extensionless PE files and rejects foreign embedded binaries', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-arch-test-'));
  try {
    const pe = Buffer.alloc(70);
    pe.writeUInt16LE(0x5a4d, 0); pe.writeUInt32LE(64, 60);
    pe.writeUInt32LE(0x4550, 64); pe.writeUInt16LE(0x8664, 68);
    fs.writeFileSync(path.join(root, 'helper'), pe);
    assert.equal(verifyNativeArch(root, 'win32', 'x64'), 1);
    assert.throws(() => verifyNativeArch(root, 'darwin', 'arm64'), /Wrong PE/);
    pe.writeUInt16LE(0xaa64, 68);
    fs.writeFileSync(path.join(root, 'helper'), pe);
    assert.throws(() => verifyNativeArch(root, 'win32', 'x64'), /Wrong PE/);
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});
