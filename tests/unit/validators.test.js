import { describe, expect, it } from 'vitest';
import { formatIPv4 } from '../../src/core/ipv4.js';
import {
  generateFocusedExercise,
  generateMission,
  getWorkshopGenerator,
} from '../../src/exercises/generators.js';
import {
  classifyHostAddress,
  validateGateway,
  validateSubmission,
} from '../../src/exercises/validators.js';

function copyExercise(exercise) {
  return structuredClone(exercise);
}

function validSubmission(exercise) {
  return { ...exercise.solution };
}

describe('validateSubmission', () => {
  it('identifies malformed exercise input before attempting a route trace', () => {
    const exercise = generateFocusedExercise({ seed: 'diagnostic-1', concept: 'gateway', difficulty: 2 });
    const field = exercise.editableFields[0];

    expect(validateSubmission(exercise, { ...exercise.initial, [field]: '999.1.1.1' }))
      .toMatchObject({
        ok: false,
        diagnostics: [{
          code: 'invalid-ip',
          messageKey: 'diagnostic.invalid-ip',
          deviceId: 'host-a',
          field,
          params: { value: '999.1.1.1' },
        }],
        traces: [],
      });
  });

  it('reports an invalid prefix using a stable mask diagnostic', () => {
    const exercise = generateMission({ seed: 'diagnostic-mask', difficulty: 3 });
    const field = exercise.editableFields.find((candidate) => candidate.endsWith('.prefix'));

    expect(validateSubmission(exercise, { ...validSubmission(exercise), [field]: '255.0.255.0' }))
      .toMatchObject({
        ok: false,
        diagnostics: [{ code: 'invalid-mask', field, params: { value: '255.0.255.0' } }],
        traces: [],
      });
  });

  it('accepts a complete focused-exercise solution and returns its packet trace', () => {
    const exercise = generateFocusedExercise({ seed: 'complete-1', concept: 'gateway', difficulty: 2 });

    expect(validateSubmission(exercise, validSubmission(exercise)))
      .toMatchObject({ ok: true, diagnostics: [], traces: [{ ok: true }] });
  });

  it('rejects each valid-but-incorrect calculated range answer', () => {
    const exercise = generateFocusedExercise({ seed: 'range-answer-1', concept: 'host-range', difficulty: 2 });
    const { network, broadcast, usable, prefix } = exercise.facts;
    const allRangeAnswers = {
      'range.network': formatIPv4(network),
      'range.broadcast': formatIPv4(broadcast),
      'range.first-host': formatIPv4(usable.first),
      'range.last-host': formatIPv4(usable.last),
    };
    exercise.editableFields = Object.keys(allRangeAnswers);
    exercise.initial = Object.fromEntries(exercise.editableFields.map((field) => [field, '']));
    exercise.solution = allRangeAnswers;
    exercise.fieldMeta = Object.fromEntries(exercise.editableFields.map((field) => [field, {
      kind: 'address', role: field.slice('range.'.length), prefix,
    }]));

    for (const field of exercise.editableFields) {
      const submission = { ...validSubmission(exercise), [field]: '203.0.113.77' };
      const result = validateSubmission(exercise, submission);

      expect(submission[field]).not.toBe(exercise.solution[field]);
      expect(result).toMatchObject({
        ok: false,
        diagnostics: expect.arrayContaining([
          expect.objectContaining({ code: 'incorrect-calculation', field }),
        ]),
      });
    }
  });

  it('accepts any strict IPv4 value in the isolated validity drill', () => {
    const exercise = getWorkshopGenerator('ipv4-validity-1')({ seed: 'format-only' });
    const field = exercise.editableFields[0];

    expect(validateSubmission(exercise, { [field]: '8.8.8.8' }))
      .toMatchObject({ ok: true, diagnostics: [], traces: [] });
    expect(validateSubmission(exercise, { [field]: '8.8.8.999' }))
      .toMatchObject({ ok: false, diagnostics: [{ code: 'invalid-ip', field }] });
  });

  it('requires CIDR output when converting a dotted mask', () => {
    const exercise = getWorkshopGenerator('mask-conversion-1')({ seed: 'cidr-output' });
    const field = exercise.editableFields[0];
    const dottedClue = exercise.fieldMeta[field].dottedMask;

    expect(validateSubmission(exercise, { [field]: dottedClue }))
      .toMatchObject({ ok: false, diagnostics: [{ code: 'invalid-mask', field }] });
    expect(validateSubmission(exercise, { [field]: exercise.solution[field] }))
      .toMatchObject({ ok: true, diagnostics: [], traces: [{ ok: true }] });
  });

  it('rejects a reachable next hop that is not the required default-route exit', () => {
    const exercise = getWorkshopGenerator('default-route-2')({ seed: 'default-exit' });
    const field = exercise.editableFields.find((candidate) => candidate.endsWith('.gateway'));
    const wrongReachableGateway = formatIPv4(exercise.facts.gateways.borealTransit);

    expect(wrongReachableGateway).not.toBe(exercise.solution[field]);
    expect(validateSubmission(exercise, {
      ...exercise.solution,
      [field]: wrongReachableGateway,
    })).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'wrong-default-gateway', field }],
    });
  });
});

describe('address and gateway diagnostics', () => {
  it('classifies forbidden host boundaries', () => {
    expect(classifyHostAddress('192.168.12.64', 27)).toBe('network-address');
    expect(classifyHostAddress('192.168.12.95', 27)).toBe('broadcast-address');
    expect(classifyHostAddress('192.168.12.65', 27)).toBeNull();
  });

  it('does not compare an invalid gateway string as though it were an address', () => {
    expect(validateGateway({ address: '192.168.12.65', prefix: 27 }, '999.168.12.1'))
      .toMatchObject({ code: 'invalid-ip', params: { value: '999.168.12.1' } });
  });

  it('identifies a gateway outside the local interface network', () => {
    expect(validateGateway({ address: '192.168.12.65', prefix: 27 }, '192.168.13.1'))
      .toMatchObject({ code: 'unreachable-gateway', params: { prefix: 27 } });
  });

  it('reports network and broadcast addresses when they are assigned to an editable host', () => {
    const exercise = generateFocusedExercise({ seed: 'boundary-1', concept: 'same-subnet', difficulty: 2 });
    const field = exercise.editableFields[0];
    const network = exercise.facts.network;
    const broadcast = exercise.facts.broadcast;

    expect(validateSubmission(exercise, { ...validSubmission(exercise), [field]: `${network >>> 24}.${(network >>> 16) & 255}.${(network >>> 8) & 255}.${network & 255}` }))
      .toMatchObject({ diagnostics: [{ code: 'network-address', field }] });
    expect(validateSubmission(exercise, { ...validSubmission(exercise), [field]: `${broadcast >>> 24}.${(broadcast >>> 16) & 255}.${(broadcast >>> 8) & 255}.${broadcast & 255}` }))
      .toMatchObject({ diagnostics: [{ code: 'broadcast-address', field }] });
  });
});

describe('topology diagnostics', () => {
  it('reports a missing host default route before its trace fails', () => {
    const exercise = copyExercise(generateMission({ seed: 'default-1', difficulty: 3 }));
    exercise.devices.find((device) => device.id === 'alpha').routes = [];

    expect(validateSubmission(exercise, validSubmission(exercise)))
      .toMatchObject({ diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: 'missing-default-route', deviceId: 'alpha' }),
      ]) });
  });

  it('reports a route next hop that the router cannot reach locally', () => {
    const exercise = generateMission({ seed: 'next-hop-1', difficulty: 3 });
    const field = exercise.editableFields.find((candidate) => candidate.endsWith('atlas-lan-b.gateway'));

    expect(validateSubmission(exercise, { ...validSubmission(exercise), [field]: '10.0.0.1' }))
      .toMatchObject({ diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: 'unreachable-next-hop', deviceId: 'atlas', field }),
      ]) });
  });

  it('reports a route destination that no longer covers its intended remote network', () => {
    const exercise = generateMission({ seed: 'destination-1', difficulty: 3 });
    const field = exercise.editableFields.find((candidate) => candidate.endsWith('atlas-lan-b.destination'));

    expect(validateSubmission(exercise, { ...validSubmission(exercise), [field]: '203.0.113.0' }))
      .toMatchObject({ diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: 'wrong-route-destination', field }),
      ]) });
  });

  it('reports an absent return path from the packet trace', () => {
    const exercise = copyExercise(generateMission({ seed: 'return-1', difficulty: 3 }));
    exercise.devices.find((device) => device.id === 'beta').routes = [];

    expect(validateSubmission(exercise, validSubmission(exercise)))
      .toMatchObject({ diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: 'missing-return-path', deviceId: 'beta' }),
      ]) });
  });

  it('reports contradictory overlapping subnets on one device', () => {
    const exercise = copyExercise(generateMission({ seed: 'overlap-1', difficulty: 3 }));
    const atlas = exercise.devices.find((device) => device.id === 'atlas');
    atlas.interfaces[1].address = atlas.interfaces[0].address;
    atlas.interfaces[1].prefix = atlas.interfaces[0].prefix;

    expect(validateSubmission(exercise, validSubmission(exercise)))
      .toMatchObject({ diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: 'overlapping-subnets', deviceId: 'atlas' }),
      ]) });
  });

  it('reports a directly linked endpoint that belongs to a different subnet', () => {
    const exercise = generateFocusedExercise({ seed: 'subnet-1', concept: 'same-subnet', difficulty: 2 });
    const field = exercise.editableFields[0];

    expect(validateSubmission(exercise, { ...validSubmission(exercise), [field]: '10.0.0.1' }))
      .toMatchObject({ diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: 'different-subnet', deviceId: 'host-a', field }),
      ]) });
  });

  it('never accepts a required goal whose forward trace fails', () => {
    const exercise = copyExercise(generateFocusedExercise({ seed: 'forward-link-1', concept: 'gateway', difficulty: 2 }));
    exercise.links = [];

    expect(validateSubmission(exercise, validSubmission(exercise)))
      .toMatchObject({
        ok: false,
        diagnostics: expect.arrayContaining([
          expect.objectContaining({ code: 'unreachable-destination', params: { reason: 'missing-link' } }),
        ]),
        traces: [{ ok: false, failedDirection: 'forward' }],
      });
  });

  it('reports a route prefix that no longer covers its intended remote network', () => {
    const exercise = generateMission({ seed: 'destination-prefix-1', difficulty: 3 });
    const field = exercise.editableFields.find((candidate) => candidate.endsWith('atlas-lan-b.prefix'));

    expect(validateSubmission(exercise, { ...validSubmission(exercise), [field]: '/32' }))
      .toMatchObject({ diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: 'wrong-route-destination', field }),
      ]) });
  });

  it.each(['/24', '/28'])('rejects an aligned %s route prefix even when it still covers the remote endpoint', (prefix) => {
    const exercise = generateMission({ seed: 'destination-prefix-1', difficulty: 3 });
    const field = exercise.editableFields.find((candidate) => candidate.endsWith('atlas-lan-b.prefix'));

    expect(validateSubmission(exercise, { ...validSubmission(exercise), [field]: prefix }))
      .toMatchObject({
        ok: false,
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: 'wrong-route-destination',
            field,
            params: expect.objectContaining({ prefix: Number(prefix.slice(1)) }),
          }),
        ]),
      });
  });
});
