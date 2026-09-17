'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Inspect magic bytes, not extensions: CEF framework executables have no suffix.
function verifyNativeArch(root, platform = process.platform, arch = process.arch) {
  let count = 0;
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { visit(file); continue; }
      if (!entry.isFile()) continue; // relative framework links point to checked real files
      const fd = fs.openSync(file, 'r');
      const header = Buffer.alloc(64);
      let length;
      try { length = fs.readSync(fd, header, 0, 64, 0); } finally { fs.closeSync(fd); }
      if (length < 4) continue;
      const magic = header.readUInt32BE(0);
      if (magic === 0x7f454c46) throw new Error(`Unexpected ELF binary in desktop release: ${file}`);
      if ([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe, 0xbebafeca, 0xcafebabf].includes(magic)) {
        if (platform !== 'darwin') throw new Error(`Unexpected Mach-O binary: ${file}`);
        const arches = execFileSync('lipo', ['-archs', file], { encoding: 'utf8' }).trim().split(/\s+/);
        if (!arches.includes(arch === 'x64' ? 'x86_64' : arch)) throw new Error(`Wrong architecture (${arches}): ${file}`);
        count++;
      } else if (length === 64 && header.readUInt16LE(0) === 0x5a4d) {
        const pe = Buffer.alloc(6);
        const handle = fs.openSync(file, 'r');
        try { fs.readSync(handle, pe, 0, 6, header.readUInt32LE(60)); } finally { fs.closeSync(handle); }
        if (pe.readUInt32LE(0) !== 0x4550) continue;
        if (platform !== 'win32' || arch !== 'x64' || pe.readUInt16LE(4) !== 0x8664) throw new Error(`Wrong PE architecture: ${file}`);
        count++;
      }
    }
  }
  visit(root);
  console.log(`[native-arch] ${count} binaries verified for ${platform}-${arch}: ${root}`);
  return count;
}
module.exports = { verifyNativeArch };
if (require.main === module) verifyNativeArch(process.argv[2]);
