import { describe, expect, it } from 'vitest';
import { getHint } from '../../src/exercises/hints.js';
import { getWorkshopGenerator } from '../../src/exercises/generators.js';
import { validateSubmission } from '../../src/exercises/validators.js';
import { curriculum } from '../../src/content/curriculum.js';

describe('getHint', () => {
  it('strengthens gateway hints with calculated subnet boundaries without returning the completed answer', () => {
    const validation = {
      ok: false,
      diagnostics: [{
        code: 'unreachable-gateway',
        deviceId: 'a',
        field: 'a.gateway',
        params: { prefix: 27, localAddress: '192.168.12.77' },
      }],
    };
    const exercise = { id: 'hint-test', solution: { 'a.gateway': '192.168.12.65' } };

    expect(getHint(exercise, validation, 1)).toEqual({ key: 'hint.gateway.observe', params: { deviceId: 'a' } });
    expect(getHint(exercise, validation, 2)).toEqual({ key: 'hint.gateway.method', params: { prefix: 27, localAddress: '192.168.12.77' } });
    const nearSolution = getHint(exercise, validation, 3);
    expect(nearSolution).toEqual({
      key: 'hint.gateway.nearSolution',
      params: {
        prefix: 27,
        localAddress: '192.168.12.77',
        network: '192.168.12.64',
        broadcast: '192.168.12.95',
        expectedShape: 'IPv4 address',
      },
    });
    expect(JSON.stringify(nearSolution)).not.toContain(exercise.solution['a.gateway']);
  });

  it('selects subnet and return-path families from their first diagnostic', () => {
    const exercise = { id: 'hint-family', solution: { 'a.interfaces.a1.address': '10.0.0.2' } };

    expect(getHint(exercise, {
      ok: false,
      diagnostics: [{ code: 'different-subnet', deviceId: 'a', field: 'a.interfaces.a1.address', params: { prefix: 24 } }],
    }, 2)).toEqual({ key: 'hint.subnet.method', params: { prefix: 24 } });
    expect(getHint(exercise, {
      ok: false,
      diagnostics: [{ code: 'missing-return-path', deviceId: 'b', field: null, params: {} }],
    }, 1)).toEqual({ key: 'hint.return.observe', params: { deviceId: 'b' } });
  });

  it('rejects levels outside the three-step learning loop', () => {
    expect(() => getHint({ solution: {} }, { diagnostics: [] }, 0)).toThrow(RangeError);
    expect(() => getHint({ solution: {} }, { diagnostics: [] }, 4)).toThrow(RangeError);
  });

  it.each([
    ['ipv4-validity-1', 'hint.ipv4'],
    ['mask-conversion-1', 'hint.mask'],
    ['subnet-range-1', 'hint.range'],
    ['packet-path-3', 'hint.route'],
    ['return-path-4', 'hint.return'],
  ])('progresses through three semantic hints before validation for %s', (workshopId, family) => {
    const exercise = getWorkshopGenerator(workshopId)({ seed: `precheck-${workshopId}` });
    const hints = [1, 2, 3].map((level) => getHint(exercise, null, level));

    expect(hints.map((hint) => hint.key)).toEqual([
      `${family}.observe`,
      `${family}.method`,
      `${family}.nearSolution`,
    ]);
    expect(new Set(hints.map((hint) => hint.key)).size).toBe(3);
    for (const answer of Object.values(exercise.solution)) {
      expect(JSON.stringify(hints)).not.toContain(`"${answer}"`);
    }
  });

  it('includes useful seed facts without exposing calculated answers', () => {
    const mask = getWorkshopGenerator('mask-conversion-1')({ seed: 'hint-mask' });
    const range = getWorkshopGenerator('subnet-range-1')({ seed: 'hint-range' });
    const route = getWorkshopGenerator('packet-path-3')({ seed: 'hint-route' });
    const gateway = getWorkshopGenerator('valid-gateway-2')({ seed: 'hint-gateway' });

    expect(getHint(mask, null, 2)).toMatchObject({
      key: 'hint.mask.method',
      params: { dottedMask: mask.facts.clue },
    });
    expect(getHint(range, null, 2)).toMatchObject({
      key: 'hint.range.method',
      params: { prefix: range.facts.prefix, blockSize: range.facts.blockSize },
    });
    expect(getHint(route, null, 2)).toMatchObject({
      key: 'hint.route.method',
      params: { source: 'alpha', destination: 'beta', deviceId: 'atlas' },
    });
    expect(getHint(mask, null, 1).params).toMatchObject({ dottedMask: mask.facts.clue });
    expect(getHint(range, null, 1).params).toMatchObject({ prefix: range.facts.prefix });
    expect(getHint(route, null, 1).params).toMatchObject({ source: 'alpha', destination: 'beta' });
    expect(getHint(gateway, null, 2)).toMatchObject({
      key: 'hint.gateway.method',
      params: { localAddress: expect.stringMatching(/^10\./), prefix: gateway.facts.prefix },
    });
    expect(getHint(gateway, null, 3)).toMatchObject({
      key: 'hint.gateway.nearSolution',
      params: {
        network: expect.stringMatching(/^10\./),
        broadcast: expect.stringMatching(/^10\./),
      },
    });
  });

  it('routes common diagnostics to the workshop operation rather than generic hints', () => {
    const ipv4 = getWorkshopGenerator('ipv4-validity-1')({ seed: 'hint-invalid-ip' });
    const ipv4Field = ipv4.editableFields[0];
    const mask = getWorkshopGenerator('mask-conversion-1')({ seed: 'hint-invalid-mask' });
    const maskField = mask.editableFields[0];
    const range = getWorkshopGenerator('subnet-range-1')({ seed: 'hint-calculation' });
    const rangeField = range.editableFields[0];
    const route = getWorkshopGenerator('packet-path-3')({ seed: 'hint-route-destination' });
    const routeField = route.editableFields.find((field) => field.endsWith('.destination'));

    const invalidIp = validateSubmission(ipv4, { [ipv4Field]: '999.1.1.1' });
    const invalidMask = validateSubmission(mask, { [maskField]: mask.facts.clue });
    const incorrectCalculation = validateSubmission(range, {
      ...range.solution,
      [rangeField]: '203.0.113.0',
    });
    const wrongRoute = validateSubmission(route, {
      ...route.solution,
      [routeField]: '203.0.113.0',
    });

    expect(getHint(ipv4, invalidIp, 2).key).toBe('hint.ipv4.method');
    expect(getHint(mask, invalidMask, 2).key).toBe('hint.mask.method');
    expect(getHint(range, incorrectCalculation, 2).key).toBe('hint.range.method');
    expect(getHint(route, wrongRoute, 2).key).toBe('hint.route.method');
  });

  it('does not expose any complete curriculum answer before validation', () => {
    for (const id of curriculum.flatMap((stage) => stage.workshops)) {
      const exercise = getWorkshopGenerator(id)({ seed: `non-leak-${id}` });
      const renderedHints = JSON.stringify([1, 2, 3].map((level) => getHint(exercise, null, level)));
      for (const answer of Object.values(exercise.solution).filter((value) => value.length >= 5)) {
        expect(renderedHints, `${id} leaked ${answer}`).not.toContain(`"${answer}"`);
      }
    }
  });
});
