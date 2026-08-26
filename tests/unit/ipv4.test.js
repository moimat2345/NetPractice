import { describe, expect, it } from 'vitest';
import { formatIPv4, isValidIPv4, parseIPv4, toOctets } from '../../src/core/ipv4.js';

describe('IPv4 primitives', () => {
  it.each([
    ['0.0.0.0', 0],
    ['192.168.1.42', 3232235818],
    ['255.255.255.255', 4294967295],
  ])('parses %s', (input, expected) => expect(parseIPv4(input)).toBe(expected));

  it('rejects malformed values explicitly', () => {
    for (const input of ['1.2.3', '1.2.3.4.5', '1.2.3.-1', '1.2.3.256', '01.2.3.4', 'x.2.3.4', '']) {
      expect(parseIPv4(input)).toBeNull();
      expect(isValidIPv4(input)).toBe(false);
    }
  });

  it('round-trips unsigned values', () => {
    expect(formatIPv4(3232235818)).toBe('192.168.1.42');
    expect(toOctets(3232235818)).toEqual([192, 168, 1, 42]);
  });
});
