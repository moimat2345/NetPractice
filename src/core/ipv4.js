export function parseIPv4(input) {
  if (typeof input !== 'string') return null;
  const parts = input.split('.');
  if (parts.length !== 4) return null;
  if (parts.some((part) => !/^(0|[1-9]\d{0,2})$/.test(part))) return null;
  const octets = parts.map(Number);
  if (octets.some((octet) => octet > 255)) return null;
  return octets.reduce((value, octet) => ((value << 8) | octet) >>> 0, 0);
}

export function toOctets(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new RangeError('IPv4 value must be an unsigned 32-bit integer');
  }
  return [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
}

export function formatIPv4(value) {
  return toOctets(value).join('.');
}

export function isValidIPv4(input) {
  return parseIPv4(input) !== null;
}
