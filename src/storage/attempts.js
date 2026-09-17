import { getBrowserStorage } from './progress.js';

const STORAGE_KEY = 'subnet-notes-attempts';
const VERSION = 1;
const MAX_ENTRIES = 50;
const MAX_VALUE_LENGTH = 65_536;
const MAX_STORAGE_LENGTH = MAX_ENTRIES * (MAX_VALUE_LENGTH + 512);

function validKey(key) {
  return typeof key === 'string' && key.length <= 256
    && /^(?:exam:[^\s]+|workshop:[^\s:]+:[^\s]+)$/.test(key);
}

function serializeValue(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const encoded = JSON.stringify(value);
    return typeof encoded === 'string' && encoded.length <= MAX_VALUE_LENGTH
      && encoded.startsWith('{') ? encoded : null;
  } catch {
    return null;
  }
}

/** Owns only attempt drafts. Unavailable storage falls back to this store's memory. */
export function createAttemptStore(storage = getBrowserStorage()) {
  const entries = new Map();

  function put(key, encoded) {
    entries.delete(key);
    entries.set(key, encoded);
    while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value);
  }

  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (typeof raw === 'string' && raw.length <= MAX_STORAGE_LENGTH) {
      const saved = JSON.parse(raw);
      if (saved?.version === VERSION && Array.isArray(saved.entries)) {
        for (const entry of saved.entries.slice(-MAX_ENTRIES)) {
          if (!validKey(entry?.key)) continue;
          const encoded = serializeValue(entry.value);
          if (encoded !== null) put(entry.key, encoded);
        }
      }
    }
  } catch {
    // Disabled or corrupt storage must not prevent a learner from practicing.
  }

  function persist() {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify({
        version: VERSION,
        entries: [...entries].map(([key, encoded]) => ({ key, value: JSON.parse(encoded) })),
      }));
    } catch {
      // Keep the current entries in memory when the browser refuses a write.
    }
  }

  return {
    get(key) {
      const encoded = entries.get(key);
      return encoded === undefined ? null : JSON.parse(encoded);
    },
    set(key, value) {
      if (!validKey(key)) return false;
      const encoded = serializeValue(value);
      if (encoded === null) return false;
      put(key, encoded);
      persist();
      return true;
    },
    remove(key) {
      if (!entries.delete(key)) return;
      persist();
    },
  };
}
