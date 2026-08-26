import { describe, expect, it } from 'vitest';
import {
  completedSectionCount,
  nextWorkshopId,
  nextWorkshopInSection,
  sectionCompleted,
  sectionStarted,
} from '../../src/ui/learning-progress.js';

const sections = [
  { id: 'first', workshops: ['a-1', 'a-2'] },
  { id: 'middle', workshops: ['b-1', 'b-2', 'b-3'] },
  { id: 'final', workshops: ['c-1'] },
];

function progress(...workshopIds) {
  return {
    completed: Object.fromEntries(workshopIds.map((id) => [id, { attempts: 1 }])),
  };
}

describe('learning path progress', () => {
  it('starts with no completed stages and the first workshop', () => {
    const empty = progress();

    expect(sectionStarted(sections[0], empty)).toBe(false);
    expect(sectionCompleted(sections[0], empty)).toBe(false);
    expect(completedSectionCount(sections, empty)).toBe(0);
    expect(nextWorkshopId(sections, empty)).toBe('a-1');
  });

  it('keeps a stage in progress when only its entry workshop is complete', () => {
    const entryOnly = progress('a-1');

    expect(sectionStarted(sections[0], entryOnly)).toBe(true);
    expect(sectionCompleted(sections[0], entryOnly)).toBe(false);
    expect(completedSectionCount(sections, entryOnly)).toBe(0);
    expect(nextWorkshopId(sections, entryOnly)).toBe('a-2');
  });

  it('reports partial middle-stage progress without skipping its earlier gap', () => {
    const partialMiddle = progress('a-1', 'a-2', 'b-2');

    expect(sectionStarted(sections[1], partialMiddle)).toBe(true);
    expect(sectionCompleted(sections[1], partialMiddle)).toBe(false);
    expect(completedSectionCount(sections, partialMiddle)).toBe(1);
    expect(nextWorkshopId(sections, partialMiddle)).toBe('b-1');
  });

  it('selects the first incomplete workshop inside the first incomplete stage', () => {
    const sequential = progress('a-1', 'a-2', 'b-1');

    expect(nextWorkshopInSection(sections[1], sequential)).toBe('b-2');
    expect(nextWorkshopId(sections, sequential)).toBe('b-2');
  });

  it('marks a stage complete only after every workshop is complete', () => {
    const middleComplete = progress('b-1', 'b-2', 'b-3');

    expect(sectionCompleted(sections[1], middleComplete)).toBe(true);
    expect(completedSectionCount(sections, middleComplete)).toBe(1);
  });

  it('returns no resume workshop after every stage is complete', () => {
    const complete = progress('a-1', 'a-2', 'b-1', 'b-2', 'b-3', 'c-1');

    expect(completedSectionCount(sections, complete)).toBe(3);
    expect(nextWorkshopId(sections, complete)).toBeNull();
  });

  it('ignores stale completion IDs', () => {
    const stale = progress('removed-workshop', 'a-1');

    expect(completedSectionCount(sections, stale)).toBe(0);
    expect(nextWorkshopId(sections, stale)).toBe('a-2');
  });
});
