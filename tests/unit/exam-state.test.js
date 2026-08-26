import { describe, expect, it, vi } from 'vitest';
import { createExamState } from '../../src/ui/exam.js';

function mutableClock(start = 1_000_000) {
  let now = start;
  return {
    clock: { now: () => now },
    advance(milliseconds) { now += milliseconds; },
  };
}

describe('mock exam state', () => {
  it('derives a drift-free 15:00 countdown from the clock and expires exactly at zero', () => {
    const time = mutableClock();
    const exam = createExamState({ seed: 'exam-42', clock: time.clock });

    expect(exam.snapshot()).toMatchObject({ index: 0, remainingSeconds: 900, elapsedSeconds: 0, status: 'running' });
    time.advance(899_000);
    expect(exam.snapshot()).toMatchObject({ remainingSeconds: 1, elapsedSeconds: 899, status: 'running' });
    time.advance(1_000);
    expect(exam.snapshot()).toMatchObject({ remainingSeconds: 0, elapsedSeconds: 900, status: 'expired' });
    time.advance(45_000);
    expect(exam.snapshot()).toMatchObject({ remainingSeconds: 0, elapsedSeconds: 900, status: 'expired' });
  });

  it('generates exactly three distinct deterministic advanced mission seeds', () => {
    const first = createExamState({ seed: 'deterministic', clock: { now: () => 0 } });
    const second = createExamState({ seed: 'deterministic', clock: { now: () => 999 } });

    expect(first.missions.map((mission) => mission.seed)).toEqual([
      'deterministic:0',
      'deterministic:1',
      'deterministic:2',
    ]);
    expect(first.missions.map((mission) => mission.id)).toEqual(second.missions.map((mission) => mission.id));
    expect(first.missions.every((mission) => mission.difficulty === 3)).toBe(true);
  });

  it('completes early after three successful submissions and finalizes only once', () => {
    const time = mutableClock();
    const onFinalize = vi.fn();
    const exam = createExamState({ seed: 'early', clock: time.clock, onFinalize });

    for (let index = 0; index < 3; index += 1) {
      time.advance(10_000);
      expect(exam.submit(index, { ok: true, diagnostics: [] })).toEqual({ accepted: true, passed: true });
    }

    const snapshot = exam.snapshot();
    expect(snapshot).toMatchObject({ status: 'complete', elapsedSeconds: 30, remainingSeconds: 870, index: 2 });
    expect(snapshot.results).toHaveLength(3);
    expect(snapshot.results.every((result) => result.passed)).toBe(true);
    expect(onFinalize).toHaveBeenCalledTimes(1);
    expect(onFinalize.mock.calls[0][0]).toMatchObject({ id: 'exam:early', passed: true, seconds: 30, score: 3 });
    exam.snapshot();
    exam.submit(2, { ok: true, diagnostics: [] });
    expect(onFinalize).toHaveBeenCalledTimes(1);
  });

  it('rejects submissions at exact expiry and turns every unfinished mission into one final result', () => {
    const time = mutableClock();
    const onFinalize = vi.fn();
    const exam = createExamState({ seed: 'expired', clock: time.clock, onFinalize });
    exam.submit(0, { ok: false, diagnostics: [{ code: 'unreachable-gateway', params: { gateway: 'secret' } }] });

    time.advance(900_000);
    expect(exam.submit(0, { ok: true, diagnostics: [] })).toEqual({ accepted: false, passed: false });
    const snapshot = exam.snapshot();
    expect(snapshot.status).toBe('expired');
    expect(snapshot.results).toEqual([
      { missionSeed: 'expired:0', passed: false, diagnosticCodes: ['unreachable-gateway'] },
      { missionSeed: 'expired:1', passed: false, diagnosticCodes: ['not-submitted'] },
      { missionSeed: 'expired:2', passed: false, diagnosticCodes: ['not-submitted'] },
    ]);
    expect(onFinalize).toHaveBeenCalledTimes(1);
  });

  it('announces only the five-minute and one-minute thresholds once', () => {
    const time = mutableClock();
    const exam = createExamState({ seed: 'announcements', clock: time.clock });

    expect(exam.takeAnnouncements()).toEqual([]);
    time.advance(600_000);
    exam.snapshot();
    expect(exam.takeAnnouncements()).toEqual(['five-minutes']);
    expect(exam.takeAnnouncements()).toEqual([]);
    time.advance(240_000);
    exam.snapshot();
    expect(exam.takeAnnouncements()).toEqual(['one-minute']);
    exam.snapshot();
    expect(exam.takeAnnouncements()).toEqual([]);
  });

  it('preserves active mission and submissions independently from rendering locale', () => {
    const exam = createExamState({ seed: 'locale', clock: { now: () => 10_000 } });
    const field = exam.missions[1].editableFields[0];

    expect(exam.select(1)).toBe(true);
    expect(exam.update(field, '10.20.30.40')).toBe(true);
    expect(exam.snapshot()).toMatchObject({
      seed: 'locale',
      index: 1,
      submissions: [expect.any(Object), expect.objectContaining({ [field]: '10.20.30.40' }), expect.any(Object)],
    });
  });

  it('keeps a balanced live check summary after a failed submission', () => {
    const exam = createExamState({ seed: 'live-check', clock: { now: () => 10_000 } });
    const goal = exam.missions[0].goals[0];

    exam.submit(0, {
      ok: false,
      diagnostics: [{
        code: 'missing-return-path',
        deviceId: 'atlas',
        field: 'atlas.routes.route-1.gateway',
        params: { gateway: 'must-not-leak' },
      }],
      traces: [{ ok: false, failedDirection: 'return' }],
    });

    expect(exam.snapshot().checks[0]).toEqual({
      diagnosticCodes: ['missing-return-path'],
      affectedDeviceIds: ['atlas'],
      failedPaths: [{
        sourceId: goal.sourceId,
        destinationId: goal.destinationId,
        direction: 'return',
      }],
    });
  });

  it('returns deeply immutable detached missions, snapshots, and final records', () => {
    const time = mutableClock();
    let finalRecord;
    const exam = createExamState({ seed: 'immutable', clock: time.clock, onFinalize: (record) => { finalRecord = record; } });
    time.advance(900_000);
    const snapshot = exam.snapshot();

    expect(Object.isFrozen(exam.missions)).toBe(true);
    expect(Object.isFrozen(exam.missions[0].devices[0])).toBe(true);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.results[0])).toBe(true);
    expect(Object.isFrozen(finalRecord)).toBe(true);
    expect(() => { snapshot.results[0].passed = true; }).toThrow(TypeError);
    expect(exam.snapshot().results[0].passed).toBe(false);
  });
});
