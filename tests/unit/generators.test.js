import { describe, expect, it } from 'vitest';
import { generateFocusedExercise, generateMission } from '../../src/exercises/generators.js';
import { assertExercise } from '../../src/exercises/schema.js';

describe('exercise generators', () => {
  it('reproduces the same mission from the same seed', () => {
    expect(generateMission({ seed: 'atlas-42', difficulty: 3 }))
      .toEqual(generateMission({ seed: 'atlas-42', difficulty: 3 }));
  });

  it('changes address data for another seed', () => {
    expect(generateMission({ seed: 'atlas-42', difficulty: 3 }).solution)
      .not.toEqual(generateMission({ seed: 'cedar-43', difficulty: 3 }).solution);
  });

  it('produces valid exercises across many seeds', () => {
    for (let index = 0; index < 250; index += 1) {
      expect(() => assertExercise(generateMission({ seed: `mission-${index}`, difficulty: 3 }))).not.toThrow();
      expect(() => assertExercise(generateFocusedExercise({ seed: `mask-${index}`, concept: 'subnet-range', difficulty: 2 }))).not.toThrow();
    }
  });
});
