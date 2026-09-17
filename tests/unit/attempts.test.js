import { describe, expect, it } from 'vitest';
import { createAttemptStore } from '../../src/storage/attempts.js';

const STORAGE_KEY = 'subnet-notes-attempts';

function memoryStorage(initial = null) {
  const values = new Map(initial === null ? [] : [[STORAGE_KEY, initial]]);
  return {
    getItem(key) {
      if (key !== STORAGE_KEY) throw new Error('Unrelated storage must not be read');
      return values.get(key) ?? null;
    },
    setItem(key, value) { values.set(key, value); },
  };
}

describe('attempt store', () => {
  it('restores separately keyed exam sessions and workshop drafts without exposing mutable references', () => {
    const storage = memoryStorage();
    const first = createAttemptStore(storage);
    const exam = { seed: 'one', submissions: [{ address: '10.0.0.1' }] };
    first.set('exam:one', exam);
    first.set('workshop:neighbors-1:practice', { submission: { address: '10.0.0.2' } });
    exam.submissions[0].address = 'changed externally';
    const restored = createAttemptStore(storage);
    expect(restored.get('exam:one').submissions[0].address).toBe('10.0.0.1');
    expect(restored.get('workshop:neighbors-1:practice')).toEqual({ submission: { address: '10.0.0.2' } });
    restored.get('exam:one').submissions[0].address = 'mutated snapshot';
    expect(restored.get('exam:one').submissions[0].address).toBe('10.0.0.1');
    restored.remove('exam:one');
    expect(createAttemptStore(storage).get('exam:one')).toBeNull();
    expect(createAttemptStore(storage).get('workshop:neighbors-1:practice')).not.toBeNull();
  });

  it.each([null, { getItem() { throw new Error('disabled'); }, setItem() { throw new Error('disabled'); } },
    { getItem() { return null; }, setItem() { throw new Error('quota'); } }])(
    'keeps drafts usable in memory when storage is unavailable', (storage) => {
      const attempts = createAttemptStore(storage);
      expect(() => attempts.set('exam:fallback', { index: 2 })).not.toThrow();
      expect(attempts.get('exam:fallback')).toEqual({ index: 2 });
      attempts.remove('exam:fallback');
      expect(attempts.get('exam:fallback')).toBeNull();
    },
  );

  it.each(['{broken', JSON.stringify({ version: 999, entries: [{ key: 'exam:one', value: {} }] }), 'null'])(
    'recovers from corrupt or unsupported stored data', (raw) => {
      const attempts = createAttemptStore(memoryStorage(raw));
      expect(attempts.get('exam:one')).toBeNull();
      attempts.set('exam:one', { index: 1 });
      expect(attempts.get('exam:one')).toEqual({ index: 1 });
    },
  );

  it('bounds retained attempts and protects existing entries from oversized or nonserializable writes', () => {
    const storage = memoryStorage();
    const attempts = createAttemptStore(storage);
    for (let index = 0; index < 60; index += 1) attempts.set(`exam:${index}`, { index });
    expect(attempts.get('exam:0')).toBeNull();
    expect(attempts.get('exam:59')).toEqual({ index: 59 });
    const cyclic = {};
    cyclic.self = cyclic;
    expect(() => attempts.set('exam:59', cyclic)).not.toThrow();
    attempts.set('exam:59', { huge: 'x'.repeat(100_000) });
    expect(attempts.get('exam:59')).toEqual({ index: 59 });
    expect(createAttemptStore(storage).get('exam:59')).toEqual({ index: 59 });
    attempts.set('__proto__', { corrupted: true });
    expect(attempts.get('__proto__')).toBeNull();
  });
});
