export function parseImageDimensions(bytes: Buffer, ext: string): { width: number; height: number; format: string } {
  if (!bytes || bytes.length === 0) {
    throw new Error('EMPTY_FILE');
  }

  const cleanExt = ext.toLowerCase().replace(/^\./, '');

  if (cleanExt === 'png') {
    if (bytes.length < 24) throw new Error('CORRUPTED_PNG_HEADER');
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4E || bytes[3] !== 0x47 ||
      bytes[4] !== 0x0D || bytes[5] !== 0x0A || bytes[6] !== 0x1A || bytes[7] !== 0x0A
    ) {
      throw new Error('INVALID_PNG_SIGNATURE');
    }
    // IHDR chunk: offset 12..15 should be 'IHDR'
    const chunkType = bytes.toString('ascii', 12, 16);
    if (chunkType !== 'IHDR') throw new Error('MISSING_IHDR_CHUNK');
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    return { width, height, format: 'png' };
  }

  if (cleanExt === 'jpg' || cleanExt === 'jpeg') {
    if (bytes.length < 4) throw new Error('CORRUPTED_JPEG');
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) throw new Error('INVALID_JPEG_SIGNATURE');

    let offset = 2;
    while (offset < bytes.length) {
      if (bytes[offset] !== 0xFF) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === undefined) break;

      // Standalone markers without length: RST, SOI, EOI, TEM
      if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) {
        offset += 2;
        continue;
      }

      // Variable length markers: length is 2 bytes at offset + 2
      if (offset + 4 > bytes.length) break;
      const length = bytes.readUInt16BE(offset + 2);

      // Baseline / Progressive SOF markers
      if (
        marker === 0xC0 || marker === 0xC1 || marker === 0xC2 || marker === 0xC3 ||
        marker === 0xC5 || marker === 0xC6 || marker === 0xC7 ||
        marker === 0xC9 || marker === 0xCA || marker === 0xCB ||
        marker === 0xCD || marker === 0xCE || marker === 0xCF
      ) {
        if (offset + 9 > bytes.length) throw new Error('CORRUPTED_JPEG_SOF');
        const height = bytes.readUInt16BE(offset + 5);
        const width = bytes.readUInt16BE(offset + 7);
        return { width, height, format: 'jpeg' };
      }

      offset += 2 + length;
    }
    throw new Error('MISSING_JPEG_SOF');
  }

  if (cleanExt === 'webp') {
    if (bytes.length < 30) throw new Error('CORRUPTED_WEBP');
    const riff = bytes.toString('ascii', 0, 4);
    const webp = bytes.toString('ascii', 8, 12);
    if (riff !== 'RIFF' || webp !== 'WEBP') throw new Error('INVALID_WEBP_SIGNATURE');

    const chunkHeader = bytes.toString('ascii', 12, 16);
    if (chunkHeader === 'VP8 ') {
      if (bytes.length < 30) throw new Error('CORRUPTED_VP8');
      const width = bytes.readUInt16LE(26) & 0x3FFF;
      const height = bytes.readUInt16LE(28) & 0x3FFF;
      return { width, height, format: 'webp' };
    } else if (chunkHeader === 'VP8L') {
      if (bytes.length < 25) throw new Error('CORRUPTED_VP8L');
      const b1 = bytes[21]!;
      const b2 = bytes[22]!;
      const b3 = bytes[23]!;
      const b4 = bytes[24]!;
      const width = 1 + (((b2 & 0x3F) << 8) | b1);
      const height = 1 + (((b4 & 0x0F) << 10) | (b3 << 2) | ((b2 & 0xC0) >> 6));
      return { width, height, format: 'webp' };
    } else if (chunkHeader === 'VP8X') {
      if (bytes.length < 30) throw new Error('CORRUPTED_VP8X');
      const width = 1 + bytes.readUIntLE(24, 3);
      const height = 1 + bytes.readUIntLE(27, 3);
      return { width, height, format: 'webp' };
    }
    throw new Error('UNKNOWN_WEBP_CHUNK');
  }

  throw new Error('UNSUPPORTED_FORMAT');
}

// Test against synthetic and real buffers
const minimalPng = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // signature
  0x00, 0x00, 0x00, 0x0D, // IHDR length = 13
  0x49, 0x48, 0x44, 0x52, // IHDR
  0x00, 0x00, 0x01, 0x90, // width = 400
  0x00, 0x00, 0x02, 0x58, // height = 600
  0x08, 0x06, 0x00, 0x00, 0x00, // bits, color, comp, filter, interlace
  0x00, 0x00, 0x00, 0x00, // CRC
]);

const minimalJpg = Buffer.from([
  0xFF, 0xD8, // SOI
  0xFF, 0xE0, 0x00, 0x10, // APP0 length 16
  0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
  0xFF, 0xC0, 0x00, 0x11, // SOF0 length 17
  0x08, // precision
  0x02, 0x58, // height = 600
  0x01, 0x90, // width = 400
  0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
  0xFF, 0xD9, // EOI
]);

console.log('PNG parse:', parseImageDimensions(minimalPng, 'png'));
console.log('JPG parse:', parseImageDimensions(minimalJpg, 'jpg'));
