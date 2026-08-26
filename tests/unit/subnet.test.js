import { describe, expect, it } from 'vitest';
import { parseIPv4 } from '../../src/core/ipv4.js';
import { broadcastOf, isUsableHost, networkOf, parseMask, sameSubnet, usableRange } from '../../src/core/subnet.js';

const ip = (value) => parseIPv4(value);

describe('subnet calculations', () => {
  it('parses CIDR and contiguous dotted masks', () => {
    expect(parseMask('/27')).toEqual({ prefix: 27, mask: 4294967264 });
    expect(parseMask('255.255.255.224')).toEqual({ prefix: 27, mask: 4294967264 });
    expect(parseMask('255.0.255.0')).toBeNull();
    expect(parseMask('/33')).toBeNull();
  });

  it('finds a /27 network, broadcast, and usable range', () => {
    expect(networkOf(ip('192.168.12.77'), 27)).toBe(ip('192.168.12.64'));
    expect(broadcastOf(ip('192.168.12.77'), 27)).toBe(ip('192.168.12.95'));
    expect(usableRange(ip('192.168.12.77'), 27)).toEqual({ first: ip('192.168.12.65'), last: ip('192.168.12.94'), count: 30 });
  });

  it('rejects network and broadcast host addresses', () => {
    expect(isUsableHost(ip('192.168.12.64'), 27)).toBe(false);
    expect(isUsableHost(ip('192.168.12.95'), 27)).toBe(false);
    expect(isUsableHost(ip('192.168.12.65'), 27)).toBe(true);
  });

  it('compares two interfaces using the same prefix', () => {
    expect(sameSubnet(ip('10.0.0.1'), ip('10.0.0.2'), 30)).toBe(true);
    expect(sameSubnet(ip('10.0.0.1'), ip('10.0.0.5'), 30)).toBe(false);
  });

  it('defines point-to-point and host-only ranges explicitly', () => {
    expect(usableRange(ip('10.0.0.1'), 30)?.count).toBe(2);
    expect(usableRange(ip('10.0.0.1'), 31)).toBeNull();
    expect(usableRange(ip('10.0.0.1'), 32)).toBeNull();
    expect(networkOf(ip('203.0.113.4'), 0)).toBe(0);
  });
});
