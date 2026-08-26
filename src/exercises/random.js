function hashSeed(seed) {
  let value = 2166136261;
  for (const character of seed) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export function createRandom(seed) {
  let state = hashSeed(String(seed));
  const next = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    integer(min, max) {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    pick(values) {
      return values[this.integer(0, values.length - 1)];
    },
  };
}
