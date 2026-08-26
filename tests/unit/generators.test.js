import { describe, expect, it } from 'vitest';
import { isUsableHost } from '../../src/core/subnet.js';
import { validateRoundTrip } from '../../src/core/routing.js';
import { generateFocusedExercise, generateMission } from '../../src/exercises/generators.js';
import { assertExercise } from '../../src/exercises/schema.js';

function generatedEditableFields(exercise) {
  return exercise.devices.flatMap((device) => [
    ...device.interfaces.flatMap((entry) => [
      ...(entry.editable.address ? [`${device.id}.interfaces.${entry.id}.address`] : []),
      ...(entry.editable.prefix ? [`${device.id}.interfaces.${entry.id}.prefix`] : []),
    ]),
    ...device.routes.flatMap((route) => [
      ...(route.editable.destination ? [`${device.id}.routes.${route.id}.destination`] : []),
      ...(route.editable.prefix ? [`${device.id}.routes.${route.id}.prefix`] : []),
      ...(route.editable.gateway ? [`${device.id}.routes.${route.id}.gateway`] : []),
    ]),
  ]);
}

describe('exercise generators', () => {
  it('reproduces the same mission from the same seed', () => {
    expect(generateMission({ seed: 'atlas-42', difficulty: 3 }))
      .toEqual(generateMission({ seed: 'atlas-42', difficulty: 3 }));
  });

  it('changes address data for another seed', () => {
    expect(generateMission({ seed: 'atlas-42', difficulty: 3 }).solution)
      .not.toEqual(generateMission({ seed: 'cedar-43', difficulty: 3 }).solution);
  });

  it('preserves focused-exercise contracts across many seeds and concepts', () => {
    for (let index = 0; index < 250; index += 1) {
      for (const concept of ['host-range', 'same-subnet', 'gateway', 'subnet-range']) {
        const exercise = generateFocusedExercise({
          seed: `${concept}-${index}`,
          concept,
          difficulty: 2,
        });

        expect(() => assertExercise(exercise)).not.toThrow();
        expect(exercise.editableFields.length).toBeGreaterThan(0);
        for (const field of exercise.editableFields) {
          expect(exercise.initial[field]).toBe('');
          expect(exercise.solution[field]).toEqual(expect.any(String));
          expect(exercise.fieldMeta[field]).toMatchObject({ kind: expect.any(String) });
        }
      }
    }
  });

  it('keeps original missions routable, disjoint, and internally consistent across many seeds', () => {
    for (let index = 0; index < 250; index += 1) {
      const exercise = generateMission({ seed: `mission-${index}`, difficulty: 3 });
      const segments = Object.values(exercise.facts.segments);

      expect(() => assertExercise(exercise)).not.toThrow();
      expect(exercise.editableFields.length).toBeGreaterThanOrEqual(6);
      expect(exercise.editableFields.length).toBeLessThanOrEqual(10);
      expect(generatedEditableFields(exercise).sort()).toEqual(exercise.editableFields.slice().sort());

      for (const device of exercise.devices) {
        for (const entry of device.interfaces) {
          if (entry.address !== null) {
            expect(isUsableHost(entry.address, entry.prefix)).toBe(true);
          }
        }
      }
      for (let first = 0; first < segments.length; first += 1) {
        for (let second = first + 1; second < segments.length; second += 1) {
          expect(segments[first].network <= segments[second].broadcast
            && segments[second].network <= segments[first].broadcast).toBe(false);
        }
      }
      for (const goal of exercise.goals) {
        expect(validateRoundTrip(exercise, goal.sourceId, goal.destinationId).ok).toBe(true);
      }
      for (const field of exercise.editableFields) {
        expect(exercise.initial[field]).toBe('');
        expect(exercise.solution[field]).toEqual(expect.any(String));
        expect(exercise.solution[field]).not.toBe('');
        expect(exercise.fieldMeta[field]).toMatchObject({ kind: expect.any(String) });
      }
    }
  });
});
