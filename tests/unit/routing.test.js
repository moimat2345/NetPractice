import { describe, expect, it } from 'vitest';
import { parseIPv4 } from '../../src/core/ipv4.js';
import {
  isDirectlyReachable,
  selectRoute,
  tracePacket,
  validateRoundTrip,
} from '../../src/core/routing.js';

const ip = (value) => parseIPv4(value);
const routes = [
  { destination: ip('10.0.0.0'), prefix: 8, gateway: ip('192.168.1.2') },
  { destination: 0, prefix: 0, gateway: ip('192.168.1.1') },
];

function makeRoutedTopology() {
  return {
    devices: [
      {
        id: 'a',
        kind: 'host',
        interfaces: [{ id: 'a1', address: ip('192.168.1.2'), prefix: 24 }],
        routes: [{ destination: 0, prefix: 0, gateway: ip('192.168.1.1') }],
      },
      {
        id: 'r',
        kind: 'router',
        interfaces: [
          { id: 'r1', address: ip('192.168.1.1'), prefix: 24 },
          { id: 'r2', address: ip('10.0.0.1'), prefix: 24 },
        ],
        routes: [],
      },
      {
        id: 'b',
        kind: 'host',
        interfaces: [{ id: 'b1', address: ip('10.0.0.2'), prefix: 24 }],
        routes: [{ destination: 0, prefix: 0, gateway: ip('10.0.0.1') }],
      },
    ],
    links: [{ a: 'a1', b: 'r1' }, { a: 'r2', b: 'b1' }],
  };
}

function makeSwitchedLanTopology() {
  return {
    devices: [
      {
        id: 'host-a',
        kind: 'host',
        interfaces: [{ id: 'host-a1', address: ip('192.168.10.2'), prefix: 24 }],
        routes: [],
      },
      {
        id: 'router',
        kind: 'router',
        interfaces: [{ id: 'router1', address: ip('192.168.10.1'), prefix: 24 }],
        routes: [],
      },
      {
        id: 'switch',
        kind: 'switch',
        interfaces: [{ id: 'sw1' }, { id: 'sw2' }, { id: 'sw3' }],
        routes: [],
      },
    ],
    links: [
      { a: 'host-a1', b: 'sw1' },
      { a: 'router1', b: 'sw2' },
    ],
  };
}

describe('routing', () => {
  it('uses the first matching ordered route', () => {
    expect(selectRoute(routes, ip('10.42.0.9'))).toBe(routes[0]);
    expect(selectRoute(routes, ip('8.8.8.8'))).toBe(routes[1]);
  });

  it('does not skip an earlier matching route', () => {
    const ordered = [
      { destination: 0, prefix: 0, gateway: ip('192.168.1.1') },
      { destination: ip('10.0.0.0'), prefix: 8, gateway: ip('192.168.1.2') },
    ];

    expect(selectRoute(ordered, ip('10.42.0.9'))).toBe(ordered[0]);
  });

  it('recognizes destinations on an attached subnet', () => {
    const device = {
      interfaces: [{ id: 'a1', address: ip('192.168.1.2'), prefix: 24 }],
    };

    expect(isDirectlyReachable(device, ip('192.168.1.99'))).toBe(true);
    expect(isDirectlyReachable(device, ip('10.0.0.1'))).toBe(false);
  });

  it('requires a valid forward and return path', () => {
    const topology = makeRoutedTopology();

    expect(validateRoundTrip(topology, 'a', 'b').ok).toBe(true);
    topology.devices[2].routes = [];
    expect(validateRoundTrip(topology, 'a', 'b')).toMatchObject({
      ok: false,
      failedDirection: 'return',
    });
  });

  it('reports a forward failure when no route reaches the destination', () => {
    const topology = makeRoutedTopology();
    topology.devices[0].routes = [];

    expect(validateRoundTrip(topology, 'a', 'b')).toMatchObject({
      ok: false,
      failedDirection: 'forward',
      return: null,
    });
  });

  it('reports an unreachable gateway', () => {
    const topology = makeRoutedTopology();
    topology.devices[0].routes[0].gateway = ip('172.16.0.1');

    expect(tracePacket(topology, 'a', ip('10.0.0.2'))).toMatchObject({
      ok: false,
      reason: 'unreachable-gateway',
      deviceId: 'a',
    });
  });

  it('reports routing loops', () => {
    const topology = makeRoutedTopology();
    topology.devices[1].routes = [
      { destination: ip('172.16.0.0'), prefix: 16, gateway: ip('192.168.1.2') },
    ];

    expect(tracePacket(topology, 'r', ip('172.16.0.1'))).toMatchObject({
      ok: false,
      reason: 'routing-loop',
      deviceId: 'r',
    });
  });

  it('crosses a layer-2 switch without requiring a route on the switch', () => {
    const topology = makeSwitchedLanTopology();

    expect(validateRoundTrip(topology, 'host-a', 'router').ok).toBe(true);
  });

  it('returns an immutable trace result', () => {
    const trace = tracePacket(makeRoutedTopology(), 'a', ip('10.0.0.2'));

    expect(Object.isFrozen(trace)).toBe(true);
    expect(Object.isFrozen(trace.hops)).toBe(true);
    expect(Object.isFrozen(trace.hops[0])).toBe(true);
  });
});
