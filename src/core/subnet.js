import { parseIPv4 } from './ipv4.js';

export function prefixToMask(prefix) {
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new RangeError('Prefix must be between 0 and 32');
  }
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

export function maskToPrefix(mask) {
  if (!Number.isInteger(mask) || mask < 0 || mask > 0xffffffff) return null;
  const inverted = (~mask) >>> 0;
  if (((inverted + 1) & inverted) !== 0) return null;
  return mask === 0 ? 0 : 32 - Math.log2(inverted + 1);
}

export function parseMask(input) {
  if (typeof input !== 'string') return null;
  if (/^\/(0|[1-9]|[12]\d|3[0-2])$/.test(input)) {
    const prefix = Number(input.slice(1));
    return { prefix, mask: prefixToMask(prefix) };
  }
  const mask = parseIPv4(input);
  if (mask === null) return null;
  const prefix = maskToPrefix(mask);
  return prefix === null ? null : { prefix, mask };
}

export const networkOf = (ip, prefix) => (ip & prefixToMask(prefix)) >>> 0;

export const broadcastOf = (ip, prefix) =>
  (networkOf(ip, prefix) | (~prefixToMask(prefix))) >>> 0;

export function usableRange(ip, prefix) {
  if (prefix >= 31) return null;
  const network = networkOf(ip, prefix);
  const broadcast = broadcastOf(ip, prefix);
  return { first: network + 1, last: broadcast - 1, count: broadcast - network - 1 };
}

export function isUsableHost(ip, prefix) {
  const range = usableRange(ip, prefix);
  return range !== null && ip >= range.first && ip <= range.last;
}

export const sameSubnet = (a, b, prefix) => networkOf(a, prefix) === networkOf(b, prefix);
