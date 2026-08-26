import { formatIPv4, parseIPv4 } from '../core/ipv4.js';
import { broadcastOf, networkOf, parseMask, sameSubnet } from '../core/subnet.js';
import { validateRoundTrip } from '../core/routing.js';

function diagnostic(code, { deviceId = null, field = null, params = {} } = {}) {
  return { code, messageKey: `diagnostic.${code}`, deviceId, field, params };
}

function hostAddressCode(address, prefix) {
  if (!Number.isInteger(address) || address < 0 || address > 0xffffffff) return 'invalid-ip';
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return 'invalid-mask';
  if (prefix >= 31) return null;
  if (address === networkOf(address, prefix)) return 'network-address';
  if (address === broadcastOf(address, prefix)) return 'broadcast-address';
  return null;
}

export function classifyHostAddress(address, prefix) {
  const parsed = parseIPv4(address);
  if (parsed === null) return 'invalid-ip';
  return hostAddressCode(parsed, prefix);
}

function validateGatewayValue(interfaceEntry, gateway, context = {}) {
  const reachable = Number.isInteger(interfaceEntry?.address)
    && Number.isInteger(interfaceEntry?.prefix)
    && sameSubnet(interfaceEntry.address, gateway, interfaceEntry.prefix);
  return reachable
    ? null
    : diagnostic(context.code ?? 'unreachable-gateway', {
      ...context,
      params: { ...context.params, prefix: interfaceEntry?.prefix },
    });
}

export function validateGateway(interfaceEntry, gateway) {
  const localAddress = parseIPv4(interfaceEntry?.address);
  const parsedGateway = parseIPv4(gateway);
  if (localAddress === null) {
    return diagnostic('invalid-ip', { params: { value: interfaceEntry?.address ?? null } });
  }
  if (!Number.isInteger(interfaceEntry?.prefix) || interfaceEntry.prefix < 0 || interfaceEntry.prefix > 32) {
    return diagnostic('invalid-mask', { params: { value: interfaceEntry?.prefix ?? null } });
  }
  if (parsedGateway === null) {
    return diagnostic('invalid-ip', { params: { value: gateway } });
  }
  return validateGatewayValue({ address: localAddress, prefix: interfaceEntry.prefix }, parsedGateway);
}

function parseEditableFields(exercise, submission) {
  const diagnostics = [];
  const values = new Map();
  for (const field of exercise.editableFields) {
    const value = submission?.[field];
    const meta = exercise.fieldMeta?.[field];
    if (meta?.kind === 'prefix') {
      if (meta.syntax === 'cidr' && !/^\/(0|[1-9]|[12]\d|3[0-2])$/.test(value ?? '')) {
        diagnostics.push(diagnostic('invalid-mask', {
          deviceId: meta.deviceId ?? null,
          field,
          params: { value: value ?? null },
        }));
        continue;
      }
      const parsed = parseMask(value);
      if (parsed === null) {
        diagnostics.push(diagnostic('invalid-mask', {
          deviceId: meta.deviceId ?? null,
          field,
          params: { value: value ?? null },
        }));
      } else {
        values.set(field, parsed.prefix);
      }
      continue;
    }

    const parsed = parseIPv4(value);
    if (parsed === null) {
      diagnostics.push(diagnostic('invalid-ip', {
        deviceId: meta?.deviceId ?? null,
        field,
        params: { value: value ?? null },
      }));
    } else {
      values.set(field, parsed);
    }
  }
  return { diagnostics, values };
}

function fieldLocation(field) {
  const [deviceId, section, entryId, property] = field.split('.');
  if (!['interfaces', 'routes'].includes(section) || !deviceId || !entryId || !property) return null;
  return { deviceId, section, entryId, property };
}

function applySubmission(exercise, values) {
  const configured = structuredClone(exercise);
  for (const [field, value] of values) {
    const location = fieldLocation(field);
    if (!location) continue;
    const device = configured.devices.find((candidate) => candidate.id === location.deviceId);
    const entries = location.section === 'interfaces' ? device?.interfaces : device?.routes;
    const entry = entries?.find((candidate) => candidate.id === location.entryId);
    if (entry) entry[location.property] = value;
  }
  return configured;
}

function validateCalculatedAnswers(exercise, values) {
  const diagnostics = [];
  for (const [field, value] of values) {
    const meta = exercise.fieldMeta?.[field];
    if (fieldLocation(field) || !meta || meta.kind !== 'address') continue;
    const expected = parseIPv4(exercise.solution[field]);
    if (expected !== null && value !== expected) {
      diagnostics.push(diagnostic('incorrect-calculation', {
        field,
        params: { role: meta.role },
      }));
    }
  }
  return diagnostics;
}

function validateExactAnswers(exercise, values) {
  const diagnostics = [];
  for (const [field, value] of values) {
    const meta = exercise.fieldMeta?.[field];
    if (!meta?.requiresExact) continue;
    const expected = meta.kind === 'prefix'
      ? parseMask(exercise.solution[field])?.prefix
      : parseIPv4(exercise.solution[field]);
    if (expected !== value) {
      diagnostics.push(diagnostic(meta.exactDiagnostic ?? 'incorrect-calculation', {
        deviceId: meta.deviceId ?? null,
        field,
        params: { role: meta.role },
      }));
    }
  }
  return diagnostics;
}

function editableFieldFor(device, section, entry, property) {
  const field = `${device.id}.${section}.${entry.id}.${property}`;
  return entry.editable?.[property] ? field : null;
}

function validateHostAddresses(topology) {
  const diagnostics = [];
  for (const device of topology.devices) {
    for (const entry of device.interfaces) {
      if (entry.address === null || entry.address === undefined) continue;
      const code = hostAddressCode(entry.address, entry.prefix);
      if (code) {
        diagnostics.push(diagnostic(code, {
          deviceId: device.id,
          field: editableFieldFor(device, 'interfaces', entry, code === 'invalid-mask' ? 'prefix' : 'address'),
          params: {
            address: Number.isInteger(entry.address) ? formatIPv4(entry.address) : entry.address,
            prefix: entry.prefix,
          },
        }));
      }
    }
  }
  return diagnostics;
}

function validateLinkedSubnets(topology) {
  const owners = new Map();
  for (const device of topology.devices) {
    for (const entry of device.interfaces) owners.set(entry.id, { device, entry });
  }
  const diagnostics = [];
  for (const link of topology.links) {
    const left = owners.get(link.a);
    const right = owners.get(link.b);
    if (!left || !right || left.entry.address === null || right.entry.address === null) continue;
    if (!sameSubnet(left.entry.address, right.entry.address, left.entry.prefix)
      || !sameSubnet(left.entry.address, right.entry.address, right.entry.prefix)) {
      diagnostics.push(diagnostic('different-subnet', {
        deviceId: left.device.id,
        field: editableFieldFor(left.device, 'interfaces', left.entry, 'address'),
        params: { peerDeviceId: right.device.id, prefix: left.entry.prefix },
      }));
    }
  }
  return diagnostics;
}

function validateOverlaps(topology) {
  const diagnostics = [];
  for (const device of topology.devices) {
    const interfaces = device.interfaces.filter((entry) => Number.isInteger(entry.address) && Number.isInteger(entry.prefix));
    for (let index = 0; index < interfaces.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < interfaces.length; otherIndex += 1) {
        const left = interfaces[index];
        const right = interfaces[otherIndex];
        const overlap = networkOf(left.address, left.prefix) <= broadcastOf(right.address, right.prefix)
          && networkOf(right.address, right.prefix) <= broadcastOf(left.address, left.prefix);
        if (overlap) {
          diagnostics.push(diagnostic('overlapping-subnets', {
            deviceId: device.id,
            field: editableFieldFor(device, 'interfaces', right, 'address'),
            params: { firstInterfaceId: left.id, secondInterfaceId: right.id },
          }));
        }
      }
    }
  }
  return diagnostics;
}

function validateGateways(topology) {
  const diagnostics = [];
  for (const device of topology.devices) {
    for (const route of device.routes) {
      const localInterface = device.interfaces.find((entry) => Number.isInteger(entry.address)
        && sameSubnet(entry.address, route.gateway, entry.prefix));
      if (!localInterface) {
        const referenceInterface = device.interfaces.find((entry) => Number.isInteger(entry.address));
        diagnostics.push(diagnostic(device.kind === 'host' ? 'unreachable-gateway' : 'unreachable-next-hop', {
          deviceId: device.id,
          field: editableFieldFor(device, 'routes', route, 'gateway'),
          params: {
            gateway: Number.isInteger(route.gateway) ? formatIPv4(route.gateway) : route.gateway,
            localAddress: referenceInterface ? formatIPv4(referenceInterface.address) : null,
            prefix: referenceInterface?.prefix ?? null,
          },
        }));
      }
    }
  }
  return diagnostics;
}

function directlyConnected(source, destination) {
  return source.interfaces.some((left) => Number.isInteger(left.address)
    && destination.interfaces.some((right) => Number.isInteger(right.address)
      && sameSubnet(left.address, right.address, left.prefix)
      && sameSubnet(left.address, right.address, right.prefix)));
}

function validateDefaultRoutes(topology) {
  const devices = new Map(topology.devices.map((device) => [device.id, device]));
  const diagnostics = [];
  for (const goal of topology.goals) {
    const source = devices.get(goal.sourceId);
    const destination = devices.get(goal.destinationId);
    if (!source || !destination || source.kind !== 'host' || directlyConnected(source, destination)) continue;
    if (!source.routes.some((route) => route.destination === 0 && route.prefix === 0)) {
      diagnostics.push(diagnostic('missing-default-route', {
        deviceId: source.id,
        field: null,
        params: { destinationId: destination.id },
      }));
    }
  }
  return diagnostics;
}

function validateRouteDestinations(exercise, topology) {
  const diagnostics = [];
  const seenRoutes = new Set();
  for (const field of exercise.editableFields) {
    const meta = exercise.fieldMeta?.[field];
    if (!['route-destination', 'route-prefix'].includes(meta?.role)) continue;
    const location = fieldLocation(field);
    const routeKey = `${location?.deviceId}:${location?.entryId}`;
    if (!location || seenRoutes.has(routeKey)) continue;
    seenRoutes.add(routeKey);
    const device = topology.devices.find((candidate) => candidate.id === location?.deviceId);
    const route = device?.routes.find((candidate) => candidate.id === location?.entryId);
    const destinationField = `${location.deviceId}.routes.${location.entryId}.destination`;
    const prefixField = `${location.deviceId}.routes.${location.entryId}.prefix`;
    const expectedDestination = parseIPv4(exercise.solution[destinationField]);
    const expectedPrefix = exercise.fieldMeta?.[destinationField]?.prefix;
    if (expectedDestination === null || !Number.isInteger(expectedPrefix) || !route) continue;
    if (route.destination !== expectedDestination || route.prefix !== expectedPrefix) {
      diagnostics.push(diagnostic('wrong-route-destination', {
        deviceId: device.id,
        field: route.destination !== expectedDestination ? destinationField : prefixField,
        params: { destination: formatIPv4(route.destination), prefix: route.prefix },
      }));
    }
  }
  return diagnostics;
}

function diagnosticsFromTraces(traces) {
  const diagnostics = [];
  for (const trace of traces) {
    if (trace.ok) continue;
    if (trace.failedDirection === 'forward') {
      diagnostics.push(diagnostic('unreachable-destination', {
        deviceId: trace.forward?.deviceId ?? null,
        field: null,
        params: { reason: trace.forward?.reason ?? 'missing-route' },
      }));
    }
    if (trace.failedDirection === 'return') {
      diagnostics.push(diagnostic('missing-return-path', {
        deviceId: trace.return?.deviceId ?? null,
        field: null,
        params: { reason: trace.return?.reason ?? 'missing-route' },
      }));
    }
  }
  return diagnostics;
}

export function validateSubmission(exercise, submission) {
  const parsed = parseEditableFields(exercise, submission);
  if (parsed.diagnostics.length > 0) return { ok: false, diagnostics: parsed.diagnostics, traces: [] };

  const calculatedDiagnostics = validateCalculatedAnswers(exercise, parsed.values);
  const exactDiagnostics = validateExactAnswers(exercise, parsed.values);
  if (calculatedDiagnostics.length > 0 || exactDiagnostics.length > 0) {
    return { ok: false, diagnostics: [...calculatedDiagnostics, ...exactDiagnostics], traces: [] };
  }

  if (exercise.validationMode === 'format-only') {
    return { ok: true, diagnostics: [], traces: [] };
  }

  const configured = applySubmission(exercise, parsed.values);
  const hostDiagnostics = validateHostAddresses(configured);
  const subnetDiagnostics = validateLinkedSubnets(configured);
  const gatewayDiagnostics = validateGateways(configured);
  const defaultDiagnostics = validateDefaultRoutes(configured);
  const routeDiagnostics = validateRouteDestinations(exercise, configured);
  const overlapDiagnostics = validateOverlaps(configured);
  const traces = configured.goals.map((goal) => validateRoundTrip(configured, goal.sourceId, goal.destinationId));
  const pathDiagnostics = diagnosticsFromTraces(traces);
  const diagnostics = [
    ...hostDiagnostics,
    ...subnetDiagnostics,
    ...gatewayDiagnostics,
    ...defaultDiagnostics,
    ...routeDiagnostics,
    ...overlapDiagnostics,
    ...pathDiagnostics,
  ];
  return { ok: diagnostics.length === 0 && traces.every((trace) => trace.ok), diagnostics, traces };
}
