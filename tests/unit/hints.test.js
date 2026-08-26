import { describe, expect, it } from 'vitest';
import { getHint } from '../../src/exercises/hints.js';

describe('getHint', () => {
  it('strengthens gateway hints without returning the completed answer early', () => {
    const validation = {
      ok: false,
      diagnostics: [{
        code: 'unreachable-gateway',
        deviceId: 'a',
        field: 'a.gateway',
        params: { prefix: 27 },
      }],
    };
    const exercise = { id: 'hint-test', solution: { 'a.gateway': '192.168.12.65' } };

    expect(getHint(exercise, validation, 1)).toEqual({ key: 'hint.gateway.observe', params: { deviceId: 'a' } });
    expect(getHint(exercise, validation, 2)).toEqual({ key: 'hint.gateway.method', params: { prefix: 27 } });
    expect(getHint(exercise, validation, 3)).toEqual({
      key: 'hint.gateway.nearSolution',
      params: { prefix: 27, expectedShape: 'IPv4 address' },
    });
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
});
