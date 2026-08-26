import { describe, expect, it } from 'vitest';
import { getHint } from '../../src/exercises/hints.js';
import { getWorkshopGenerator } from '../../src/exercises/generators.js';
import { validateSubmission } from '../../src/exercises/validators.js';
import { curriculum } from '../../src/content/curriculum.js';
import { parseIPv4 } from '../../src/core/ipv4.js';

function recursiveKeyValues(value, path = [], entries = []) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => recursiveKeyValues(child, [...path, String(index)], entries));
    return entries;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      entries.push({ path: [...path, '<key>'].join('.'), value: key });
      recursiveKeyValues(child, [...path, key], entries);
    }
    return entries;
  }
  entries.push({ path: path.join('.'), value });
  return entries;
}

function isEquivalentAnswer(candidate, answer, kind) {
  if (kind === 'prefix') {
    const expected = Number(String(answer).replace(/^\//, ''));
    if (typeof candidate === 'number') return candidate === expected;
    return typeof candidate === 'string'
      && /^\/?(?:0|[1-9]|[12]\d|3[0-2])$/.test(candidate)
      && Number(candidate.replace(/^\//, '')) === expected;
  }
  if (kind === 'address') {
    const expected = parseIPv4(answer);
    if (typeof candidate === 'number') return candidate === expected;
    return typeof candidate === 'string' && parseIPv4(candidate) === expected;
  }
  return candidate === answer;
}

function leakedAnswerParams(exercise, hints) {
  const candidates = recursiveKeyValues(hints.flatMap((hint) => hint.params));
  return Object.entries(exercise.solution).flatMap(([field, answer]) => {
    const kind = exercise.fieldMeta?.[field]?.kind;
    return candidates
      .filter((candidate) => isEquivalentAnswer(candidate.value, answer, kind))
      .map((candidate) => ({ field, answer, equivalent: candidate.value, path: candidate.path }));
  });
}

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
        expectedShape: { messageKey: 'semantic.shape.address' },
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
    const defaultRoute = getWorkshopGenerator('default-route-2')({ seed: 'hint-default-route' });
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
      params: {
        source: { messageKey: 'device.alpha' },
        destination: { messageKey: 'device.beta' },
        deviceId: { messageKey: 'device.atlas' },
      },
    });
    expect(getHint(mask, null, 1).params).toMatchObject({ dottedMask: mask.facts.clue });
    expect(getHint(range, null, 1).params).toMatchObject({ prefix: range.facts.prefix });
    expect(getHint(route, null, 1).params).toMatchObject({
      source: { messageKey: 'device.alpha' },
      destination: { messageKey: 'device.beta' },
    });
    expect(getHint(mask, null, 2).params).not.toHaveProperty('prefix');
    expect(getHint(route, null, 2).params).not.toHaveProperty('prefix');
    expect([1, 2, 3].map((level) => getHint(defaultRoute, null, level).key)).toEqual([
      'hint.defaultRoute.observe',
      'hint.defaultRoute.method',
      'hint.defaultRoute.nearSolution',
    ]);
    expect(getHint(defaultRoute, null, 3).params).not.toHaveProperty('prefix');
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

  it('does not expose normalized or equivalent curriculum answers in raw hint params', () => {
    for (const id of curriculum.flatMap((stage) => stage.workshops)) {
      const exercise = getWorkshopGenerator(id)({ seed: `non-leak-${id}` });
      const hints = [1, 2, 3].map((level) => getHint(exercise, null, level));
      expect(leakedAnswerParams(exercise, hints), id).toEqual([]);
    }
  });

  it('detects numeric and string equivalents for prefix and IPv4 answers recursively', () => {
    const exercise = {
      solution: { prefix: '/26', address: '10.0.0.1' },
      fieldMeta: { prefix: { kind: 'prefix' }, address: { kind: 'address' } },
    };

    expect(leakedAnswerParams(exercise, [{ params: { nested: { prefix: 26 } } }])).toEqual([
      { field: 'prefix', answer: '/26', equivalent: 26, path: '0.nested.prefix' },
    ]);
    expect(leakedAnswerParams(exercise, [{ params: { '/26': 'safe' } }])).toEqual([
      { field: 'prefix', answer: '/26', equivalent: '/26', path: '0.<key>' },
    ]);
    expect(leakedAnswerParams(exercise, [{ params: { address: 167772161 } }])).toEqual([
      { field: 'address', answer: '10.0.0.1', equivalent: 167772161, path: '0.address' },
    ]);
  });
});
