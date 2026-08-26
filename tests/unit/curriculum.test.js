import { describe, expect, it } from 'vitest';
import { curriculum, getWorkshopDefinition } from '../../src/content/curriculum.js';
import { lessonsEn } from '../../src/content/lessons.en.js';
import { lessonsFr } from '../../src/content/lessons.fr.js';
import { getWorkshopGenerator } from '../../src/exercises/generators.js';
import { assertExercise } from '../../src/exercises/schema.js';
import { validateSubmission } from '../../src/exercises/validators.js';
import { correctionSteps } from '../../src/ui/feedback.js';

const expectedWorkshops = {
  'ipv4-validity-1': { concept: 'ipv4-validity', difficulty: 1, roles: ['valid-ipv4'], kinds: ['host'], correctionStrategy: 'ipv4-format' },
  'ipv4-octets-2': { concept: 'ipv4-octets', difficulty: 2, roles: ['octet-boundary'], kinds: ['host'], correctionStrategy: 'octet-boundaries' },
  'mask-conversion-1': { concept: 'mask-conversion', difficulty: 1, roles: ['mask'], kinds: ['host'], correctionStrategy: 'mask-conversion' },
  'subnet-range-1': { concept: 'subnet-range', difficulty: 1, roles: ['network', 'broadcast'], kinds: ['host'], correctionStrategy: 'subnet-boundaries' },
  'usable-host-2': { concept: 'usable-host-range', difficulty: 2, roles: ['first-host', 'last-host'], kinds: ['host'], correctionStrategy: 'usable-hosts' },
  'same-subnet-3': { concept: 'same-subnet', difficulty: 2, roles: ['host'], kinds: ['host', 'router'], correctionStrategy: 'compare-networks' },
  'neighbors-1': { concept: 'direct-neighbors', difficulty: 1, roles: ['neighbor'], kinds: ['host'], correctionStrategy: 'compare-networks' },
  'switch-segment-2': { concept: 'switch-segment', difficulty: 2, roles: ['switch-host'], kinds: ['host', 'switch'], correctionStrategy: 'switch-segment' },
  'router-interface-1': { concept: 'router-interface', difficulty: 1, roles: ['router-interface'], kinds: ['host', 'router'], correctionStrategy: 'connected-interface' },
  'valid-gateway-2': { concept: 'gateway', difficulty: 2, roles: ['gateway'], kinds: ['host', 'router'], correctionStrategy: 'gateway-membership' },
  'direct-network-3': { concept: 'direct-network', difficulty: 2, roles: ['direct-network'], kinds: ['router'], correctionStrategy: 'connected-network' },
  'route-parts-1': { concept: 'route-parts', difficulty: 1, roles: ['route-destination', 'route-prefix', 'gateway'], kinds: ['router'], correctionStrategy: 'route-components' },
  'default-route-2': { concept: 'default-route', difficulty: 1, roles: ['route-destination', 'route-prefix', 'gateway'], kinds: ['router', 'internet'], correctionStrategy: 'default-route' },
  'packet-path-3': { concept: 'forward-packet', difficulty: 2, roles: ['route-destination', 'route-prefix', 'gateway'], kinds: ['host', 'router'], correctionStrategy: 'forward-trace' },
  'return-path-4': { concept: 'return-path', difficulty: 2, roles: ['route-destination', 'route-prefix', 'gateway'], kinds: ['host', 'router'], correctionStrategy: 'return-trace' },
  'routing-mission-5': { concept: 'routing-mission', difficulty: 3, roles: ['host', 'mask', 'gateway', 'route-destination', 'route-prefix'], kinds: ['host', 'router'], correctionStrategy: 'packet-round-trip' },
  'guided-mission-1': { concept: 'guided-mission', difficulty: 2, roles: ['host', 'gateway', 'route-destination'], kinds: ['host', 'router', 'switch', 'internet'], correctionStrategy: 'packet-round-trip' },
  'guided-mission-2': { concept: 'guided-mission', difficulty: 3, roles: ['router-interface', 'mask', 'gateway', 'route-destination'], kinds: ['host', 'router', 'switch', 'internet'], correctionStrategy: 'branch-round-trip' },
  'mock-exam': { concept: 'mock-exam', difficulty: 3, roles: ['gateway', 'route-destination', 'route-prefix'], kinds: ['host', 'router', 'internet'], correctionStrategy: 'timed-round-trip' },
};

describe('curriculum contract', () => {
  it('resolves complete bilingual content and a generator for every workshop', () => {
    const ids = curriculum.flatMap((stage) => stage.workshops);

    expect(ids.length).toBeGreaterThanOrEqual(18);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      for (const lesson of [lessonsFr[id], lessonsEn[id]]) {
        expect(lesson).toMatchObject({
          title: expect.any(String),
          microLesson: expect.any(String),
          objective: expect.any(String),
          methodSteps: expect.any(Array),
          readinessLabel: expect.any(String),
        });
        expect(lesson.methodSteps.length).toBeGreaterThanOrEqual(3);
      }
      expect(getWorkshopDefinition(id)).not.toBeNull();
      expect(getWorkshopGenerator(id)).toEqual(expect.any(Function));
    }
  });

  it('keeps each workshop name aligned with its networking behavior', () => {
    for (const [id, expected] of Object.entries(expectedWorkshops)) {
      expect(getWorkshopDefinition(id)).toMatchObject({
        id,
        concept: expected.concept,
        difficulty: expected.difficulty,
        correctionStrategy: expected.correctionStrategy,
        objective: expect.any(String),
      });

      const generate = getWorkshopGenerator(id);
      const exercise = generate({ seed: `meaning-${id}` });
      const roles = new Set(Object.values(exercise.fieldMeta).map((meta) => meta.role));
      const kinds = new Set(exercise.devices.map((device) => device.kind));

      expect(exercise).toMatchObject({
        workshopId: id,
        concept: expected.concept,
        difficulty: expected.difficulty,
        correctionStrategy: expected.correctionStrategy,
        objective: getWorkshopDefinition(id).objective,
      });
      expected.roles.forEach((role) => expect(roles).toContain(role));
      expected.kinds.forEach((kind) => expect(kinds).toContain(kind));
    }
  });

  it('ships concise, practical, naturally distinct lessons in both languages', () => {
    for (const id of Object.keys(expectedWorkshops)) {
      const french = lessonsFr[id];
      const english = lessonsEn[id];
      const frenchWords = french.microLesson.trim().split(/\s+/);
      const englishWords = english.microLesson.trim().split(/\s+/);

      expect(frenchWords.length).toBeGreaterThanOrEqual(25);
      expect(frenchWords.length).toBeLessThanOrEqual(80);
      expect(englishWords.length).toBeGreaterThanOrEqual(25);
      expect(englishWords.length).toBeLessThanOrEqual(80);
      expect(french.microLesson).not.toBe(english.microLesson);
      expect(french.methodSteps.every((step) => step.trim().length > 8)).toBe(true);
      expect(english.methodSteps.every((step) => step.trim().length > 8)).toBe(true);
    }
  });

  it('generates deterministic, solvable exercises with detached semantic metadata', () => {
    for (const id of Object.keys(expectedWorkshops)) {
      const generate = getWorkshopGenerator(id);
      for (let index = 0; index < 20; index += 1) {
        const seed = `${id}-${index}`;
        const exercise = generate({ seed });

        expect(exercise).toEqual(generate({ seed }));
        expect(exercise.seed).toBe(seed);
        expect(() => assertExercise(exercise)).not.toThrow();
        expect(validateSubmission(exercise, exercise.solution).ok).toBe(true);
        expect(exercise.editableFields.length).toBeGreaterThan(0);
        for (const field of exercise.editableFields) {
          const meta = exercise.fieldMeta[field];
          expect(meta).toMatchObject({
            kind: expect.stringMatching(/^(address|prefix)$/),
            role: expect.any(String),
          });
          if (meta.deviceId) {
            expect(field).toMatch(new RegExp(`^${meta.deviceId}\\.(interfaces|routes)\\.`));
          }
        }
      }
      expect(generate({ seed: `${id}-variation-a` }).solution)
        .not.toEqual(generate({ seed: `${id}-variation-b` }).solution);
    }
  });

  it('uses two genuinely different guided mission shapes', () => {
    const first = getWorkshopGenerator('guided-mission-1')({ seed: 'mission-shape' });
    const second = getWorkshopGenerator('guided-mission-2')({ seed: 'mission-shape' });
    const signature = (exercise) => exercise.devices.map((device) => `${device.kind}:${device.interfaces.length}:${device.routes.length}`);

    expect(first.devices.filter((device) => device.kind === 'router')).toHaveLength(2);
    expect(first.devices.filter((device) => device.kind === 'switch')).toHaveLength(1);
    expect(first.devices.filter((device) => device.kind === 'host')).toHaveLength(3);
    expect(first.devices.filter((device) => device.kind === 'internet')).toHaveLength(1);
    expect(signature(second)).not.toEqual(signature(first));
    expect(second.editableFields).not.toEqual(first.editableFields);
  });

  it('makes route workshops perform the operation promised by their label', () => {
    const routeParts = getWorkshopGenerator('route-parts-1')({ seed: 'route-semantics' });
    const defaultRoute = getWorkshopGenerator('default-route-2')({ seed: 'route-semantics' });
    const forward = getWorkshopGenerator('packet-path-3')({ seed: 'route-semantics' });
    const back = getWorkshopGenerator('return-path-4')({ seed: 'route-semantics' });

    expect(new Set(Object.values(routeParts.fieldMeta).map((meta) => meta.role)))
      .toEqual(new Set(['route-destination', 'route-prefix', 'gateway']));
    expect(Object.entries(defaultRoute.solution).some(([field, value]) =>
      field.endsWith('.destination') && value === '0.0.0.0')).toBe(true);
    expect(Object.entries(defaultRoute.solution).some(([field, value]) =>
      field.endsWith('.prefix') && value === '/0')).toBe(true);
    expect(forward.goals[0]).toMatchObject({ sourceId: 'alpha', destinationId: 'beta' });
    expect(Object.values(back.fieldMeta).every((meta) => meta.pathDirection === 'return')).toBe(true);
  });

  it('keeps correction steps specific to the workshop operation', () => {
    const ipv4 = getWorkshopGenerator('ipv4-validity-1')({ seed: 'correction' });
    const subnet = getWorkshopGenerator('subnet-range-1')({ seed: 'correction' });
    const forward = getWorkshopGenerator('packet-path-3')({ seed: 'correction' });
    const back = getWorkshopGenerator('return-path-4')({ seed: 'correction' });

    expect(correctionSteps(ipv4).map((step) => step.key)).toEqual([
      'correction.ipv4Shape',
      'correction.octetBounds',
      'correction.expectedFields',
    ]);
    expect(correctionSteps(subnet).map((step) => step.key)).toEqual([
      'correction.identify',
      'correction.boundaries',
      'correction.expectedFields',
    ]);
    expect(correctionSteps(forward).map((step) => step.key)).toContain('correction.forward');
    expect(correctionSteps(forward).map((step) => step.key)).not.toContain('correction.return');
    expect(correctionSteps(back).map((step) => step.key)).toContain('correction.return');
  });

  it('exposes the concrete octet, mask, and block-size clues those drills teach', () => {
    const octets = getWorkshopGenerator('ipv4-octets-2')({ seed: 'boundary-clues' });
    const mask = getWorkshopGenerator('mask-conversion-1')({ seed: 'mask-clues' });
    const range = getWorkshopGenerator('subnet-range-1')({ seed: 'range-clues' });
    const octetAnswer = Object.values(octets.solution)[0].split('.').map(Number);
    const maskMeta = Object.values(mask.fieldMeta)[0];

    expect(octetAnswer).toContain(255);
    expect(octetAnswer.every((octet) => octet >= 0 && octet <= 255)).toBe(true);
    expect(maskMeta).toMatchObject({
      role: 'mask',
      dottedMask: expect.stringMatching(/^\d+\.\d+\.\d+\.\d+$/),
    });
    expect(mask.facts.clue).toBe(maskMeta.dottedMask);
    expect(range.facts.blockSize).toBe(2 ** (32 - range.facts.prefix));
  });
});
