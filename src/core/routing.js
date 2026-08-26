import { networkOf, sameSubnet } from './subnet.js';

function cloneAndFreeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(cloneAndFreeze));
  if (value && typeof value === 'object') {
    return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, cloneAndFreeze(nestedValue)]),
    ));
  }
  return value;
}

function freezeTrace(result) {
  const hops = result.hops.map((hop) => Object.freeze({
    ...hop,
    route: hop.route === null ? null : cloneAndFreeze(hop.route),
  }));
  return Object.freeze({ ...result, hops: Object.freeze(hops) });
}

export function selectRoute(routes, destinationIp) {
  return routes.find(
    (route) => networkOf(destinationIp, route.prefix) === networkOf(route.destination, route.prefix),
  ) ?? null;
}

export function isDirectlyReachable(device, targetIp) {
  return device.interfaces.some(
    (entry) => Number.isInteger(entry.address) && sameSubnet(entry.address, targetIp, entry.prefix),
  );
}

function findLayer2Peers(topology, startInterfaceId) {
  const ownerByInterface = new Map();
  const interfaceById = new Map();
  for (const device of topology.devices) {
    for (const entry of device.interfaces) {
      ownerByInterface.set(entry.id, device);
      interfaceById.set(entry.id, entry);
    }
  }

  const queue = [startInterfaceId];
  const visited = new Set(queue);
  const peers = [];

  while (queue.length > 0) {
    const currentInterfaceId = queue.shift();
    const connected = topology.links
      .filter((link) => link.a === currentInterfaceId || link.b === currentInterfaceId)
      .map((link) => (link.a === currentInterfaceId ? link.b : link.a));

    for (const peerId of connected) {
      if (visited.has(peerId)) continue;
      visited.add(peerId);
      const owner = ownerByInterface.get(peerId);
      if (!owner) continue;
      if (owner.kind === 'switch') {
        for (const switchPort of owner.interfaces) {
          if (!visited.has(switchPort.id)) queue.push(switchPort.id);
        }
      } else {
        peers.push({ device: owner, interface: interfaceById.get(peerId) });
      }
    }
  }

  return peers;
}

export function tracePacket(topology, sourceId, destinationIp) {
  const devices = new Map(topology.devices.map((device) => [device.id, device]));
  const visited = new Set();
  const hops = [];
  let current = devices.get(sourceId);

  while (current && hops.length <= topology.devices.length * 2) {
    if (current.interfaces.some((entry) => entry.address === destinationIp)) {
      return freezeTrace({ ok: true, hops });
    }

    const direct = current.interfaces.find(
      (entry) => Number.isInteger(entry.address) && sameSubnet(entry.address, destinationIp, entry.prefix),
    );
    const route = direct ? null : selectRoute(current.routes, destinationIp);
    const nextHop = direct ? destinationIp : route?.gateway;

    if (nextHop === undefined || nextHop === null) {
      return freezeTrace({ ok: false, reason: 'missing-route', deviceId: current.id, hops });
    }
    if (!isDirectlyReachable(current, nextHop)) {
      return freezeTrace({ ok: false, reason: 'unreachable-gateway', deviceId: current.id, hops });
    }

    const outgoing = current.interfaces.find(
      (entry) => Number.isInteger(entry.address) && sameSubnet(entry.address, nextHop, entry.prefix),
    );
    const peer = findLayer2Peers(topology, outgoing.id)
      .find((candidate) => candidate.interface.address === nextHop);
    if (!peer) {
      return freezeTrace({ ok: false, reason: 'missing-link', deviceId: current.id, hops });
    }

    const visitKey = `${current.id}:${peer.device.id}:${destinationIp}`;
    if (visited.has(visitKey)) {
      return freezeTrace({ ok: false, reason: 'routing-loop', deviceId: current.id, hops });
    }
    visited.add(visitKey);
    hops.push({ deviceId: current.id, outgoingInterfaceId: outgoing.id, nextHop, route });
    current = devices.get(peer.device.id);
  }

  return freezeTrace({ ok: false, reason: 'hop-limit', deviceId: current?.id ?? null, hops });
}

export function validateRoundTrip(topology, sourceId, destinationId) {
  const source = topology.devices.find((device) => device.id === sourceId);
  const destination = topology.devices.find((device) => device.id === destinationId);
  const forward = tracePacket(topology, sourceId, destination.interfaces[0].address);

  if (!forward.ok) {
    return Object.freeze({ ok: false, failedDirection: 'forward', forward, return: null });
  }

  const back = tracePacket(topology, destinationId, source.interfaces[0].address);
  return Object.freeze(back.ok
    ? { ok: true, failedDirection: null, forward, return: back }
    : { ok: false, failedDirection: 'return', forward, return: back });
}
