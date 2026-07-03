import { describe, expect, it } from 'vitest';
import { arrayBufferToBase64, bytesToBase64 } from './native-bridge-encoding';

describe('native bridge encoding', () => {
  it('encodes empty bytes', () => {
    expect(bytesToBase64(new Uint8Array())).toBe('');
  });

  it('encodes byte arrays with padding', () => {
    expect(bytesToBase64(new Uint8Array([0]))).toBe('AA==');
    expect(bytesToBase64(new Uint8Array([0, 1]))).toBe('AAE=');
  });

  it('encodes byte arrays without padding', () => {
    expect(bytesToBase64(new Uint8Array([0, 1, 2]))).toBe('AAEC');
    expect(bytesToBase64(new Uint8Array([1, 2, 3, 4]))).toBe('AQIDBA==');
  });

  it('encodes ArrayBuffer values', () => {
    const buffer = new Uint8Array([255, 254, 253]).buffer;
    expect(arrayBufferToBase64(buffer)).toBe('//79');
  });
});
