const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  let i = 0;

  for (; i + 2 < bytes.length; i += 3) {
    const value = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    result += BASE64_ALPHABET[(value >> 18) & 63];
    result += BASE64_ALPHABET[(value >> 12) & 63];
    result += BASE64_ALPHABET[(value >> 6) & 63];
    result += BASE64_ALPHABET[value & 63];
  }

  if (i < bytes.length) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const value = (b0 << 16) | (b1 << 8);
    result += BASE64_ALPHABET[(value >> 18) & 63];
    result += BASE64_ALPHABET[(value >> 12) & 63];
    result += i + 1 < bytes.length ? BASE64_ALPHABET[(value >> 6) & 63] : '=';
    result += '=';
  }

  return result;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return bytesToBase64(new Uint8Array(buffer));
}
