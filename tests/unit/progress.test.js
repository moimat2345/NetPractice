import { describe, expect, it } from 'vitest';
import { completeWorkshop, loadProgress, recordExam, saveProgress } from '../../src/storage/progress.js';

function memoryStorage(initial = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_, next) => { value = next; },
    removeItem: () => { value = null; },
  };
}

function passedExam(id, seconds) {
  return {
    id,
    seed: id.replace(/^exam:/, ''),
    passed: true,
    seconds,
    score: 3,
    status: 'complete',
    missions: [0, 1, 2].map((index) => ({
      missionSeed: `${id}:${index}`,
      passed: true,
      diagnosticCodes: [],
    })),
  };
}

describe('progress storage', () => {
  it('recovers from missing, corrupted, wrong-shaped, and future-version data', () => {
    const expected = { version: 1, locale: 'fr', completed: {}, current: null, exams: [], bestExamSeconds: null };
    expect(loadProgress(memoryStorage())).toEqual(expected);
    expect(loadProgress(memoryStorage('{broken'))).toEqual(expected);
    expect(loadProgress(memoryStorage(JSON.stringify([])))).toEqual(expected);
    expect(loadProgress(memoryStorage(JSON.stringify({ version: 1, completed: [] })))).toEqual(expected);
    expect(loadProgress(memoryStorage(JSON.stringify({ version: 2, locale: 'en', completed: {} })))).toEqual(expected);
  });

  it('stays safe when browser storage is unavailable or throws', () => {
    expect(loadProgress()).toMatchObject({ version: 1, completed: {}, exams: [] });
    const unavailable = {
      getItem: () => { throw new Error('storage disabled'); },
      setItem: () => { throw new Error('storage full'); },
    };
    expect(loadProgress(unavailable)).toMatchObject({ version: 1, completed: {} });
    expect(() => saveProgress(unavailable, loadProgress())).not.toThrow();
  });

  it('round-trips only a safe version-one progress shape', () => {
    const storage = memoryStorage();
    const progress = {
      version: 1,
      locale: 'en',
      completed: { 'subnet-1': { attempts: 2, hints: 1 } },
      current: { id: 'subnet-1', seed: 'seed-a' },
      exams: [passedExam('exam:round-trip', 780)],
      bestExamSeconds: 780,
    };

    saveProgress(storage, progress);

    expect(loadProgress(storage)).toEqual(progress);
  });

  it('records completion and the best passed exam time without mutating sources', () => {
    const initial = loadProgress(memoryStorage());
    const result = { attempts: 2, hints: 1, diagnostics: [{ code: 'network-address' }] };
    const completed = completeWorkshop(initial, 'subnet-1', result);
    const firstExam = recordExam(completed, passedExam('exam:first', 780));
    const failedExam = recordExam(firstExam, { passed: false, seconds: 400, score: 0 });
    const slowerExam = recordExam(failedExam, passedExam('exam:slower', 900));
    const fasterExam = recordExam(slowerExam, passedExam('exam:faster', 690));

    expect(initial).toEqual({ version: 1, locale: 'fr', completed: {}, current: null, exams: [], bestExamSeconds: null });
    expect(result).toEqual({ attempts: 2, hints: 1, diagnostics: [{ code: 'network-address' }] });
    expect(completed.completed['subnet-1']).toMatchObject({ attempts: 2, hints: 1, diagnostics: [{ code: 'network-address' }] });
    expect(completed.completed['subnet-1']).not.toBe(result);
    expect(fasterExam.bestExamSeconds).toBe(690);
    expect(fasterExam.exams).toHaveLength(4);
    expect(failedExam.bestExamSeconds).toBe(780);
    expect(failedExam.exams).toHaveLength(2);
  });

  it('records a finalized exam id once and updates best time only for a full pass', () => {
    const initial = loadProgress(memoryStorage());
    const expired = recordExam(initial, { id: 'exam:reload', passed: false, seconds: 900, score: 2 });
    const duplicate = recordExam(expired, passedExam('exam:reload', 100));
    const partial = recordExam(duplicate, { id: 'exam:partial', passed: false, seconds: 200, score: 2 });
    const inconsistent = recordExam(partial, { id: 'exam:inconsistent', passed: true, seconds: 100, score: 2 });
    const passed = recordExam(inconsistent, passedExam('exam:passed', 640));

    expect(duplicate.exams).toEqual(expired.exams);
    expect(partial.bestExamSeconds).toBeNull();
    expect(inconsistent.bestExamSeconds).toBeNull();
    expect(passed.bestExamSeconds).toBe(640);
    expect(passed.exams).toHaveLength(4);

    const inconsistentStored = loadProgress(memoryStorage(JSON.stringify({
      version: 1,
      locale: 'fr',
      completed: {},
      exams: [{ id: 'exam:bad-best', passed: true, seconds: 100, score: 2 }],
      bestExamSeconds: 100,
    })));
    expect(inconsistentStored.bestExamSeconds).toBeNull();
  });

  it('rejects structurally corrupted complete-looking records from best-time calculations', () => {
    const corrupted = {
      id: 'exam:corrupted',
      passed: true,
      score: 3,
      status: 'expired',
      seconds: 7,
      missions: [],
    };
    const emptyComplete = {
      ...corrupted,
      id: 'exam:empty-complete',
      seed: 'empty-complete',
      status: 'complete',
    };
    const recorded = recordExam(recordExam(loadProgress(memoryStorage()), corrupted), emptyComplete);
    const stored = loadProgress(memoryStorage(JSON.stringify({
      version: 1,
      locale: 'fr',
      completed: {},
      exams: [corrupted, emptyComplete, passedExam('exam:valid', 640)],
      bestExamSeconds: 7,
    })));

    expect(recorded.exams).toContainEqual(corrupted);
    expect(recorded.exams).toContainEqual(emptyComplete);
    expect(recorded.bestExamSeconds).toBeNull();
    expect(stored.bestExamSeconds).toBe(640);
  });

  it('detaches nested progress data from caller-owned objects', () => {
    const nested = { attempts: 1, metadata: { tags: ['range'] } };
    const source = {
      version: 1,
      locale: 'fr',
      completed: { existing: nested },
      current: { id: 'existing', options: { difficulty: 2 } },
      exams: [{ passed: true, seconds: 700, details: { missions: ['a'] } }],
      bestExamSeconds: 700,
    };
    const next = recordExam(completeWorkshop(source, 'new', nested), {
      passed: true,
      seconds: 650,
      details: { missions: ['b'] },
    });

    next.completed.existing.metadata.tags.push('untouched');
    next.completed.new.metadata.tags.push('changed');
    next.current.options.difficulty = 3;
    next.exams[0].details.missions.push('changed');

    expect(source.completed.existing.metadata.tags).toEqual(['range']);
    expect(source.completed).not.toHaveProperty('new');
    expect(source.current.options.difficulty).toBe(2);
    expect(source.exams[0].details.missions).toEqual(['a']);
  });

  it('preserves shared nested values while safely breaking genuine cycles', () => {
    const shared = { label: 'same metadata', tags: ['range'] };
    const result = { first: shared, second: shared };
    const source = loadProgress(memoryStorage());
    const next = completeWorkshop(source, 'shared-alias', result);

    expect(next.completed['shared-alias'].first).toEqual(shared);
    expect(next.completed['shared-alias'].second).toEqual(shared);
    expect(next.completed['shared-alias'].first).not.toBe(shared);
    expect(next.completed['shared-alias'].second).not.toBe(shared);
    next.completed['shared-alias'].first.tags.push('changed');
    expect(result.first.tags).toEqual(['range']);
    expect(result.second.tags).toEqual(['range']);

    const cycle = {};
    cycle.self = cycle;
    const cycled = recordExam(source, { passed: false, details: cycle });
    expect(cycled.exams[0].details.self).toBeNull();
    expect(cycle.self).toBe(cycle);
  });
});
