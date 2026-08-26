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
      exams: [{ passed: true, seconds: 780, score: 3 }],
      bestExamSeconds: 780,
    };

    saveProgress(storage, progress);

    expect(loadProgress(storage)).toEqual(progress);
  });

  it('records completion and the best passed exam time without mutating sources', () => {
    const initial = loadProgress(memoryStorage());
    const result = { attempts: 2, hints: 1, diagnostics: [{ code: 'network-address' }] };
    const completed = completeWorkshop(initial, 'subnet-1', result);
    const firstExam = recordExam(completed, { passed: true, seconds: 780, score: 3 });
    const failedExam = recordExam(firstExam, { passed: false, seconds: 400, score: 0 });
    const slowerExam = recordExam(failedExam, { passed: true, seconds: 900, score: 3 });
    const fasterExam = recordExam(slowerExam, { passed: true, seconds: 690, score: 3 });

    expect(initial).toEqual({ version: 1, locale: 'fr', completed: {}, current: null, exams: [], bestExamSeconds: null });
    expect(result).toEqual({ attempts: 2, hints: 1, diagnostics: [{ code: 'network-address' }] });
    expect(completed.completed['subnet-1']).toMatchObject({ attempts: 2, hints: 1, diagnostics: [{ code: 'network-address' }] });
    expect(completed.completed['subnet-1']).not.toBe(result);
    expect(fasterExam.bestExamSeconds).toBe(690);
    expect(fasterExam.exams).toHaveLength(4);
    expect(failedExam.bestExamSeconds).toBe(780);
    expect(failedExam.exams).toHaveLength(2);
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
});
