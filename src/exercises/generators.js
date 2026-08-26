import { formatIPv4, parseIPv4 } from '../core/ipv4.js';
import { broadcastOf, networkOf, usableRange } from '../core/subnet.js';
import { createRandom } from './random.js';
import { assertExercise } from './schema.js';

const editableField = (deviceId, section, entryId, property) =>
  `${deviceId}.${section}.${entryId}.${property}`;

function address(value) {
  const parsed = parseIPv4(value);
  if (parsed === null) throw new TypeError(`Invalid generated address: ${value}`);
  return parsed;
}

function segment(value, prefix) {
  const network = networkOf(address(value), prefix);
  const usable = usableRange(network, prefix);
  if (!usable) throw new RangeError('Generated segments require usable host addresses');
  return {
    network,
    prefix,
    broadcast: broadcastOf(network, prefix),
    usable,
  };
}

function chooseHost(network, prefix, random, excluded = []) {
  const range = usableRange(network, prefix);
  if (!range) throw new RangeError('A usable range is required');
  const blocked = new Set(excluded);
  const candidates = [];
  for (let candidate = range.first; candidate <= range.last; candidate += 1) {
    if (!blocked.has(candidate)) candidates.push(candidate);
  }
  if (candidates.length === 0) throw new RangeError('No usable host remains');
  return random.pick(candidates);
}

function segmentsOverlap(a, b) {
  return a.network <= b.broadcast && b.network <= a.broadcast;
}

function assertDistinctSegments(segments) {
  for (let index = 0; index < segments.length; index += 1) {
    for (let next = index + 1; next < segments.length; next += 1) {
      if (segmentsOverlap(segments[index], segments[next])) {
        throw new RangeError('Generated network segments overlap');
      }
    }
  }
}

function makeInitialAndSolution(selectedFields) {
  const initial = {};
  const solution = {};
  const fieldMeta = {};
  for (const field of selectedFields) {
    initial[field.id] = '';
    solution[field.id] = field.value;
    fieldMeta[field.id] = { ...field.meta };
  }
  return { initial, solution, fieldMeta };
}

function setEditable(devices, selectedFields) {
  const selected = new Set(selectedFields.map((field) => field.id));
  for (const device of devices) {
    for (const entry of device.interfaces) {
      entry.editable.address = selected.has(editableField(device.id, 'interfaces', entry.id, 'address'));
      entry.editable.prefix = selected.has(editableField(device.id, 'interfaces', entry.id, 'prefix'));
    }
    for (const route of device.routes) {
      route.editable.destination = selected.has(editableField(device.id, 'routes', route.id, 'destination'));
      route.editable.prefix = selected.has(editableField(device.id, 'routes', route.id, 'prefix'));
      route.editable.gateway = selected.has(editableField(device.id, 'routes', route.id, 'gateway'));
    }
  }
}

function withExerciseCheck(exercise) {
  assertExercise(exercise);
  return exercise;
}

function rangeFields(prefix, network, broadcast, usable) {
  return [
    {
      id: 'range.network',
      value: formatIPv4(network),
      meta: { kind: 'address', role: 'network', prefix },
    },
    {
      id: 'range.broadcast',
      value: formatIPv4(broadcast),
      meta: { kind: 'address', role: 'broadcast', prefix },
    },
    {
      id: 'range.first-host',
      value: formatIPv4(usable.first),
      meta: { kind: 'address', role: 'first-host', prefix },
    },
    {
      id: 'range.last-host',
      value: formatIPv4(usable.last),
      meta: { kind: 'address', role: 'last-host', prefix },
    },
  ];
}

export function generateFocusedExercise({ seed, concept, difficulty = 1 }) {
  const random = createRandom(seed);
  const normalizedConcept = concept === 'subnet-range' ? 'host-range' : concept;
  if (!['host-range', 'same-subnet', 'gateway'].includes(normalizedConcept)) {
    throw new RangeError(`Unsupported focused concept: ${concept}`);
  }

  const prefix = random.pick([26, 27, 28]);
  const network = segment(`10.${random.integer(16, 200)}.${random.integer(1, 220)}.0`, prefix);
  const gateway = network.usable.first;
  const hostA = chooseHost(network.network, prefix, random, [gateway]);
  const hostB = chooseHost(network.network, prefix, random, [gateway, hostA]);
  const devices = [
    {
      id: 'host-a',
      kind: 'host',
      labelKey: 'device.focusedHostA',
      interfaces: [{ id: 'host-a-lan', address: hostA, prefix, editable: { address: false, prefix: false } }],
      routes: [{
        id: 'host-a-default', destination: 0, prefix: 0, gateway,
        editable: { destination: false, prefix: false, gateway: false },
      }],
      position: { x: 25, y: 50 },
    },
    {
      id: 'router',
      kind: 'router',
      labelKey: 'device.focusedRouter',
      interfaces: [{ id: 'router-lan', address: gateway, prefix, editable: { address: false, prefix: false } }],
      routes: [],
      position: { x: 75, y: 50 },
    },
  ];
  const links = [{ a: 'host-a-lan', b: 'router-lan' }];
  let fields;

  if (normalizedConcept === 'host-range') {
    fields = rangeFields(prefix, network.network, network.broadcast, network.usable)
      .slice(0, difficulty >= 2 ? 2 : 1);
  } else if (normalizedConcept === 'same-subnet') {
    fields = [{
      id: editableField('host-a', 'interfaces', 'host-a-lan', 'address'),
      value: formatIPv4(hostA),
      meta: { kind: 'address', role: 'host', deviceId: 'host-a', interfaceId: 'host-a-lan', prefix },
    }];
  } else {
    fields = [{
      id: editableField('host-a', 'routes', 'host-a-default', 'gateway'),
      value: formatIPv4(gateway),
      meta: { kind: 'address', role: 'gateway', deviceId: 'host-a', routeId: 'host-a-default', prefix },
    }];
  }

  setEditable(devices, fields);
  const values = makeInitialAndSolution(fields);
  return withExerciseCheck({
    id: `focused-${normalizedConcept}-${seed}`,
    seed: String(seed),
    type: 'focused',
    concept: normalizedConcept,
    difficulty,
    devices,
    links,
    goals: [{ sourceId: 'host-a', destinationId: 'router' }],
    editableFields: fields.map((field) => field.id),
    ...values,
    facts: { prefix, network: network.network, broadcast: network.broadcast, usable: network.usable },
  });
}

function buildOriginalMission({
  seed,
  difficulty = 3,
  secondOctet,
  lanAThird,
  lanBThird,
  lanAPrefix,
  lanBPrefix,
  random,
}) {
  const source = random ?? createRandom(seed);
  const internetSegment = segment(`172.${secondOctet}.252.0`, 30);
  const transitSegment = segment(`172.${secondOctet}.253.0`, 30);
  const lanA = segment(`10.${secondOctet}.${lanAThird}.0`, lanAPrefix);
  const lanB = segment(`10.${secondOctet}.${lanBThird}.0`, lanBPrefix);
  assertDistinctSegments([internetSegment, transitSegment, lanA, lanB]);

  const atlasWan = internetSegment.usable.first;
  const internetWan = chooseHost(internetSegment.network, internetSegment.prefix, source, [atlasWan]);
  const atlasTransit = transitSegment.usable.first;
  const borealTransit = chooseHost(transitSegment.network, transitSegment.prefix, source, [atlasTransit]);
  const atlasLan = lanA.usable.first;
  const alphaLan = chooseHost(lanA.network, lanAPrefix, source, [atlasLan]);
  const borealLan = lanB.usable.first;
  const betaLan = chooseHost(lanB.network, lanBPrefix, source, [borealLan]);

  const devices = [
    {
      id: 'internet', kind: 'internet', labelKey: 'device.internet',
      interfaces: [{ id: 'internet-uplink', address: internetWan, prefix: internetSegment.prefix, editable: { address: false, prefix: false } }],
      routes: [
        { id: 'internet-lan-a', destination: lanA.network, prefix: lanAPrefix, gateway: atlasWan, editable: { destination: false, prefix: false, gateway: false } },
        { id: 'internet-lan-b', destination: lanB.network, prefix: lanBPrefix, gateway: atlasWan, editable: { destination: false, prefix: false, gateway: false } },
      ],
      position: { x: 10, y: 15 },
    },
    {
      id: 'atlas', kind: 'router', labelKey: 'device.atlas',
      interfaces: [
        { id: 'atlas-wan', address: atlasWan, prefix: internetSegment.prefix, editable: { address: false, prefix: false } },
        { id: 'atlas-transit', address: atlasTransit, prefix: transitSegment.prefix, editable: { address: false, prefix: false } },
        { id: 'atlas-lan-a', address: atlasLan, prefix: lanAPrefix, editable: { address: false, prefix: false } },
      ],
      routes: [
        { id: 'atlas-lan-b', destination: lanB.network, prefix: lanBPrefix, gateway: borealTransit, editable: { destination: false, prefix: false, gateway: false } },
        { id: 'atlas-default', destination: 0, prefix: 0, gateway: internetWan, editable: { destination: false, prefix: false, gateway: false } },
      ],
      position: { x: 40, y: 30 },
    },
    {
      id: 'boreal', kind: 'router', labelKey: 'device.boreal',
      interfaces: [
        { id: 'boreal-transit', address: borealTransit, prefix: transitSegment.prefix, editable: { address: false, prefix: false } },
        { id: 'boreal-lan-b', address: borealLan, prefix: lanBPrefix, editable: { address: false, prefix: false } },
      ],
      routes: [
        { id: 'boreal-lan-a', destination: lanA.network, prefix: lanAPrefix, gateway: atlasTransit, editable: { destination: false, prefix: false, gateway: false } },
        { id: 'boreal-default', destination: 0, prefix: 0, gateway: atlasTransit, editable: { destination: false, prefix: false, gateway: false } },
      ],
      position: { x: 68, y: 56 },
    },
    {
      id: 'orme', kind: 'switch', labelKey: 'device.orme',
      interfaces: [
        { id: 'orme-atlas', address: null, prefix: null, editable: { address: false, prefix: false } },
        { id: 'orme-alpha', address: null, prefix: null, editable: { address: false, prefix: false } },
      ],
      routes: [],
      position: { x: 68, y: 20 },
    },
    {
      id: 'alpha', kind: 'host', labelKey: 'device.alpha',
      interfaces: [{ id: 'alpha-lan', address: alphaLan, prefix: lanAPrefix, editable: { address: false, prefix: false } }],
      routes: [{ id: 'alpha-default', destination: 0, prefix: 0, gateway: atlasLan, editable: { destination: false, prefix: false, gateway: false } }],
      position: { x: 90, y: 15 },
    },
    {
      id: 'beta', kind: 'host', labelKey: 'device.beta',
      interfaces: [{ id: 'beta-lan', address: betaLan, prefix: lanBPrefix, editable: { address: false, prefix: false } }],
      routes: [{ id: 'beta-default', destination: 0, prefix: 0, gateway: borealLan, editable: { destination: false, prefix: false, gateway: false } }],
      position: { x: 90, y: 72 },
    },
  ];

  const allFields = [
    { id: editableField('alpha', 'interfaces', 'alpha-lan', 'address'), value: formatIPv4(alphaLan), meta: { kind: 'address', role: 'host', deviceId: 'alpha', interfaceId: 'alpha-lan', prefix: lanAPrefix } },
    { id: editableField('alpha', 'interfaces', 'alpha-lan', 'prefix'), value: `/${lanAPrefix}`, meta: { kind: 'prefix', role: 'mask', deviceId: 'alpha', interfaceId: 'alpha-lan' } },
    { id: editableField('alpha', 'routes', 'alpha-default', 'gateway'), value: formatIPv4(atlasLan), meta: { kind: 'address', role: 'gateway', deviceId: 'alpha', routeId: 'alpha-default', prefix: lanAPrefix } },
    { id: editableField('beta', 'routes', 'beta-default', 'gateway'), value: formatIPv4(borealLan), meta: { kind: 'address', role: 'gateway', deviceId: 'beta', routeId: 'beta-default', prefix: lanBPrefix } },
    { id: editableField('atlas', 'routes', 'atlas-lan-b', 'destination'), value: formatIPv4(lanB.network), meta: { kind: 'address', role: 'route-destination', deviceId: 'atlas', routeId: 'atlas-lan-b', prefix: lanBPrefix } },
    { id: editableField('atlas', 'routes', 'atlas-lan-b', 'prefix'), value: `/${lanBPrefix}`, meta: { kind: 'prefix', role: 'route-prefix', deviceId: 'atlas', routeId: 'atlas-lan-b' } },
    { id: editableField('atlas', 'routes', 'atlas-lan-b', 'gateway'), value: formatIPv4(borealTransit), meta: { kind: 'address', role: 'gateway', deviceId: 'atlas', routeId: 'atlas-lan-b', prefix: transitSegment.prefix } },
    { id: editableField('boreal', 'routes', 'boreal-lan-a', 'destination'), value: formatIPv4(lanA.network), meta: { kind: 'address', role: 'route-destination', deviceId: 'boreal', routeId: 'boreal-lan-a', prefix: lanAPrefix } },
    { id: editableField('boreal', 'routes', 'boreal-lan-a', 'gateway'), value: formatIPv4(atlasTransit), meta: { kind: 'address', role: 'gateway', deviceId: 'boreal', routeId: 'boreal-lan-a', prefix: transitSegment.prefix } },
  ];
  const count = difficulty >= 3 ? 9 : difficulty === 2 ? 5 : 3;
  const fields = allFields.slice(0, count);
  setEditable(devices, fields);
  const values = makeInitialAndSolution(fields);

  return withExerciseCheck({
    id: `mission-${seed}`,
    seed: String(seed),
    type: 'mission',
    concept: 'routing-mission',
    difficulty,
    devices,
    links: [
      { a: 'internet-uplink', b: 'atlas-wan' },
      { a: 'atlas-transit', b: 'boreal-transit' },
      { a: 'atlas-lan-a', b: 'orme-atlas' },
      { a: 'orme-alpha', b: 'alpha-lan' },
      { a: 'boreal-lan-b', b: 'beta-lan' },
    ],
    goals: [
      { sourceId: 'alpha', destinationId: 'beta' },
      { sourceId: 'beta', destinationId: 'alpha' },
    ],
    editableFields: fields.map((field) => field.id),
    ...values,
    facts: {
      segments: { internet: internetSegment, transit: transitSegment, lanA, lanB },
      gateways: { atlasLan, borealLan, atlasTransit, borealTransit },
    },
  });
}

export function generateMission({ seed, difficulty = 3 }) {
  const random = createRandom(seed);
  const secondOctet = random.integer(16, 200);
  const lanAThird = random.integer(1, 120);
  const lanBThird = random.integer(130, 220);
  const lanAPrefix = random.pick([26, 27, 28]);
  const lanBPrefix = random.pick([27, 28]);
  return buildOriginalMission({
    seed,
    difficulty,
    secondOctet,
    lanAThird,
    lanBThird,
    lanAPrefix,
    lanBPrefix,
    random,
  });
}
