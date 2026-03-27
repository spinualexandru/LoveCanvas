import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as zlib from "zlib";

const EXCLUDE = new Set([
  ".git",
  ".vscode",
  "node_modules",
  ".DS_Store",
  "Thumbs.db",
]);

const TEMP_DIR = path.join(os.tmpdir(), "love-preview");

/** Recursively collect relative file paths from a directory */
function collectFiles(dir: string, base: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.join(base, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, rel));
    } else if (entry.isFile()) {
      results.push(rel);
    }
  }
  return results;
}

/** Write a 4-byte little-endian uint32 */
function writeU32(buf: Buffer, offset: number, value: number): void {
  buf.writeUInt32LE(value, offset);
}

/** Write a 2-byte little-endian uint16 */
function writeU16(buf: Buffer, offset: number, value: number): void {
  buf.writeUInt16LE(value, offset);
}

/**
 * Create a .love file (ZIP archive) from a workspace directory.
 * Uses DEFLATE compression via Node's zlib. No external dependencies.
 */
export function packageGame(workspaceDir: string): string {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  const outputPath = path.join(TEMP_DIR, "game.love");

  const files = collectFiles(workspaceDir, "");
  const entries: Array<{
    name: Buffer;
    compressed: Buffer;
    uncompressed: Buffer;
    crc: number;
    localOffset: number;
  }> = [];

  const localParts: Buffer[] = [];
  let localOffset = 0;

  for (const rel of files) {
    const fullPath = path.join(workspaceDir, rel);
    const uncompressed = fs.readFileSync(fullPath);
    // Use forward slashes in zip entries
    const nameStr = rel.split(path.sep).join("/");
    const name = Buffer.from(nameStr, "utf-8");
    const crc = crc32(uncompressed);
    const compressed = zlib.deflateRawSync(uncompressed, { level: 1 });

    const entryOffset = localOffset;

    // Local file header (30 bytes + name + compressed data)
    const localHeader = Buffer.alloc(30);
    writeU32(localHeader, 0, 0x04034b50); // signature
    writeU16(localHeader, 4, 20); // version needed
    writeU16(localHeader, 6, 0); // flags
    writeU16(localHeader, 8, 8); // compression: DEFLATE
    writeU16(localHeader, 10, 0); // mod time
    writeU16(localHeader, 12, 0); // mod date
    writeU32(localHeader, 14, crc); // crc-32
    writeU32(localHeader, 18, compressed.length); // compressed size
    writeU32(localHeader, 22, uncompressed.length); // uncompressed size
    writeU16(localHeader, 26, name.length); // filename length
    writeU16(localHeader, 28, 0); // extra field length

    localParts.push(localHeader, name, compressed);
    localOffset += 30 + name.length + compressed.length;

    entries.push({
      name,
      compressed,
      uncompressed,
      crc,
      localOffset: entryOffset,
    });
  }

  // Central directory
  const centralParts: Buffer[] = [];
  let centralSize = 0;

  for (const entry of entries) {
    const centralHeader = Buffer.alloc(46);
    writeU32(centralHeader, 0, 0x02014b50); // signature
    writeU16(centralHeader, 4, 20); // version made by
    writeU16(centralHeader, 6, 20); // version needed
    writeU16(centralHeader, 8, 0); // flags
    writeU16(centralHeader, 10, 8); // compression: DEFLATE
    writeU16(centralHeader, 12, 0); // mod time
    writeU16(centralHeader, 14, 0); // mod date
    writeU32(centralHeader, 16, entry.crc); // crc-32
    writeU32(centralHeader, 20, entry.compressed.length); // compressed size
    writeU32(centralHeader, 24, entry.uncompressed.length); // uncompressed size
    writeU16(centralHeader, 28, entry.name.length); // filename length
    writeU16(centralHeader, 30, 0); // extra field length
    writeU16(centralHeader, 32, 0); // file comment length
    writeU16(centralHeader, 34, 0); // disk number start
    writeU16(centralHeader, 36, 0); // internal file attributes
    writeU32(centralHeader, 38, 0); // external file attributes
    writeU32(centralHeader, 42, entry.localOffset); // relative offset

    centralParts.push(centralHeader, entry.name);
    centralSize += 46 + entry.name.length;
  }

  // End of central directory
  const eocd = Buffer.alloc(22);
  writeU32(eocd, 0, 0x06054b50); // signature
  writeU16(eocd, 4, 0); // disk number
  writeU16(eocd, 6, 0); // disk with central dir
  writeU16(eocd, 8, entries.length); // entries on this disk
  writeU16(eocd, 10, entries.length); // total entries
  writeU32(eocd, 12, centralSize); // central dir size
  writeU32(eocd, 16, localOffset); // central dir offset
  writeU16(eocd, 20, 0); // comment length

  const zipBuffer = Buffer.concat([
    ...localParts,
    ...centralParts,
    eocd,
  ]);

  fs.writeFileSync(outputPath, zipBuffer);
  return outputPath;
}

/** Clean up temp files */
export function cleanupTemp(): void {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}

// CRC-32 implementation
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
