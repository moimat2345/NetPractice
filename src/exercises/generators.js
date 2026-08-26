import { formatIPv4, parseIPv4 } from '../core/ipv4.js';
import { broadcastOf, networkOf, usableRange } from '../core/subnet.js';
import { getWorkshopDefinition } from '../content/curriculum.js';
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
    { id: editableField('alpha', 'interfaces', 'alpha-lan', 'prefix'), value: `/${lanAPrefix}`, meta: { kind: 'prefix', role: 'mask', deviceId: 'alpha', interfaceId: 'alpha-lan', prefix: lanAPrefix } },
    { id: editableField('alpha', 'routes', 'alpha-default', 'gateway'), value: formatIPv4(atlasLan), meta: { kind: 'address', role: 'gateway', deviceId: 'alpha', routeId: 'alpha-default', prefix: lanAPrefix } },
    { id: editableField('beta', 'routes', 'beta-default', 'gateway'), value: formatIPv4(borealLan), meta: { kind: 'address', role: 'gateway', deviceId: 'beta', routeId: 'beta-default', prefix: lanBPrefix } },
    { id: editableField('atlas', 'routes', 'atlas-lan-b', 'destination'), value: formatIPv4(lanB.network), meta: { kind: 'address', role: 'route-destination', deviceId: 'atlas', routeId: 'atlas-lan-b', prefix: lanBPrefix } },
    { id: editableField('atlas', 'routes', 'atlas-lan-b', 'prefix'), value: `/${lanBPrefix}`, meta: { kind: 'prefix', role: 'route-prefix', deviceId: 'atlas', routeId: 'atlas-lan-b', prefix: lanBPrefix } },
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

function modelField(exercise, deviceId, section, entryId, property, role, extra = {}) {
  const device = exercise.devices.find((candidate) => candidate.id === deviceId);
  const entries = section === 'interfaces' ? device?.interfaces : device?.routes;
  const entry = entries?.find((candidate) => candidate.id === entryId);
  if (!entry) throw new TypeError(`Unknown generated field: ${deviceId}.${section}.${entryId}`);
  const id = editableField(deviceId, section, entryId, property);
  let prefix = entry.prefix;
  if (section === 'routes' && property === 'gateway') {
    prefix = device.interfaces.find((candidate) =>
      Number.isInteger(candidate.address)
      && Number.isInteger(entry.gateway)
      && networkOf(candidate.address, candidate.prefix) === networkOf(entry.gateway, candidate.prefix))?.prefix;
  }
  return {
    id,
    value: property === 'prefix' ? `/${entry[property]}` : formatIPv4(entry[property]),
    meta: {
      kind: property === 'prefix' ? 'prefix' : 'address',
      role,
      deviceId,
      [section === 'interfaces' ? 'interfaceId' : 'routeId']: entryId,
      prefix,
      ...extra,
    },
  };
}

function configureWorkshop(exercise, definition, fields) {
  setEditable(exercise.devices, fields);
  const values = makeInitialAndSolution(fields);
  return withExerciseCheck({
    ...exercise,
    id: `${definition.id}-${exercise.seed}`,
    workshopId: definition.id,
    concept: definition.concept,
    difficulty: definition.difficulty,
    objective: definition.objective,
    correctionStrategy: definition.correctionStrategy,
    editableFields: fields.map((field) => field.id),
    ...values,
  });
}

function generateBasicWorkshop(definition, seed) {
  const base = generateFocusedExercise({ seed, concept: 'same-subnet', difficulty: 2 });
  const host = base.devices.find((device) => device.id === 'host-a');
  const hostInterface = host.interfaces[0];
  const router = base.devices.find((device) => device.id === 'router');
  const routerInterface = router.interfaces[0];
  const hostAddress = (role, extra = {}) => modelField(
    base, 'host-a', 'interfaces', 'host-a-lan', 'address', role, extra,
  );

  switch (definition.id) {
    case 'ipv4-validity-1':
      return configureWorkshop(base, definition, [hostAddress('valid-ipv4')]);
    case 'ipv4-octets-2': {
      const random = createRandom(`${seed}-octet`);
      const prefix = 24;
      const thirdOctet = random.integer(1, 220);
      routerInterface.address = address(`10.255.${thirdOctet}.1`);
      routerInterface.prefix = prefix;
      hostInterface.address = address(`10.255.${thirdOctet}.${random.integer(2, 240)}`);
      hostInterface.prefix = prefix;
      host.routes[0].gateway = routerInterface.address;
      base.facts = {
        prefix,
        network: networkOf(hostInterface.address, prefix),
        broadcast: broadcastOf(hostInterface.address, prefix),
        usable: usableRange(hostInterface.address, prefix),
        octetBounds: { minimum: 0, maximum: 255 },
      };
      return configureWorkshop(base, definition, [hostAddress('octet-boundary', { octetIndex: 2 })]);
    }
    case 'mask-conversion-1': {
      const maskField = modelField(base, 'host-a', 'interfaces', 'host-a-lan', 'prefix', 'mask', {
          dottedMask: formatIPv4(((0xffffffff << (32 - hostInterface.prefix)) >>> 0)),
      });
      base.facts.clue = maskField.meta.dottedMask;
      return configureWorkshop(base, definition, [maskField]);
    }
    case 'same-subnet-3':
      return configureWorkshop(base, definition, [hostAddress('host')]);
    case 'neighbors-1':
      return configureWorkshop(base, definition, [hostAddress('neighbor')]);
    case 'router-interface-1':
      return configureWorkshop(base, definition, [
        modelField(base, 'router', 'interfaces', 'router-lan', 'address', 'router-interface'),
      ]);
    case 'valid-gateway-2':
      return configureWorkshop(base, definition, [
        modelField(base, 'host-a', 'routes', 'host-a-default', 'gateway', 'gateway'),
      ]);
    default:
      throw new RangeError(`Unsupported basic workshop: ${definition.id}`);
  }
}

function generateRangeWorkshop(definition, seed) {
  const base = generateFocusedExercise({ seed, concept: 'host-range', difficulty: 2 });
  base.facts.blockSize = 2 ** (32 - base.facts.prefix);
  const fields = rangeFields(
    base.facts.prefix,
    base.facts.network,
    base.facts.broadcast,
    base.facts.usable,
  );
  if (definition.id === 'subnet-range-1') {
    return configureWorkshop(base, definition, fields.slice(0, 2));
  }
  if (definition.id === 'usable-host-2') {
    return configureWorkshop(base, definition, fields.slice(2, 4));
  }
  if (definition.id === 'direct-network-3') {
    return configureWorkshop(base, definition, [{
      id: 'direct.network',
      value: formatIPv4(base.facts.network),
      meta: { kind: 'address', role: 'direct-network', prefix: base.facts.prefix, relatedDeviceId: 'router' },
    }]);
  }
  throw new RangeError(`Unsupported range workshop: ${definition.id}`);
}

function generateSwitchWorkshop(definition, seed) {
  const random = createRandom(seed);
  const prefix = random.pick([26, 27, 28]);
  const lan = segment(`10.${random.integer(16, 200)}.${random.integer(1, 220)}.0`, prefix);
  const hostA = chooseHost(lan.network, prefix, random);
  const hostB = chooseHost(lan.network, prefix, random, [hostA]);
  const devices = [
    {
      id: 'willow', kind: 'switch', labelKey: 'device.willow',
      interfaces: [
        { id: 'willow-a', address: null, prefix: null, editable: { address: false, prefix: false } },
        { id: 'willow-b', address: null, prefix: null, editable: { address: false, prefix: false } },
      ],
      routes: [], position: { x: 50, y: 45 },
    },
    {
      id: 'host-a', kind: 'host', labelKey: 'device.focusedHostA',
      interfaces: [{ id: 'host-a-lan', address: hostA, prefix, editable: { address: false, prefix: false } }],
      routes: [], position: { x: 20, y: 45 },
    },
    {
      id: 'host-b', kind: 'host', labelKey: 'device.focusedHostB',
      interfaces: [{ id: 'host-b-lan', address: hostB, prefix, editable: { address: false, prefix: false } }],
      routes: [], position: { x: 80, y: 45 },
    },
  ];
  const exercise = {
    id: `switch-${seed}`, seed: String(seed), type: 'focused', concept: 'switch-segment', difficulty: 2,
    devices,
    links: [{ a: 'host-a-lan', b: 'willow-a' }, { a: 'willow-b', b: 'host-b-lan' }],
    goals: [{ sourceId: 'host-a', destinationId: 'host-b' }],
    facts: { prefix, network: lan.network, broadcast: lan.broadcast, usable: lan.usable },
  };
  return configureWorkshop(exercise, definition, [
    modelField(exercise, 'host-b', 'interfaces', 'host-b-lan', 'address', 'switch-host'),
  ]);
}

function missionRouteFields(exercise, definition) {
  const field = (deviceId, routeId, property, role, extra) =>
    modelField(exercise, deviceId, 'routes', routeId, property, role, extra);
  if (definition.id === 'route-parts-1' || definition.id === 'packet-path-3') {
    const extra = definition.id === 'packet-path-3' ? { pathDirection: 'forward' } : {};
    return [
      field('atlas', 'atlas-lan-b', 'destination', 'route-destination', extra),
      field('atlas', 'atlas-lan-b', 'prefix', 'route-prefix', extra),
      field('atlas', 'atlas-lan-b', 'gateway', 'gateway', extra),
    ];
  }
  if (definition.id === 'default-route-2') {
    return [
      field('atlas', 'atlas-default', 'destination', 'route-destination', { isDefault: true }),
      field('atlas', 'atlas-default', 'prefix', 'route-prefix', { isDefault: true }),
      field('atlas', 'atlas-default', 'gateway', 'gateway', { isDefault: true }),
    ];
  }
  if (definition.id === 'return-path-4') {
    const extra = { pathDirection: 'return' };
    return [
      field('boreal', 'boreal-lan-a', 'destination', 'route-destination', extra),
      field('boreal', 'boreal-lan-a', 'prefix', 'route-prefix', extra),
      field('boreal', 'boreal-lan-a', 'gateway', 'gateway', extra),
    ];
  }
  return exercise.editableFields.map((id) => ({
    id,
    value: exercise.solution[id],
    meta: { ...exercise.fieldMeta[id] },
  }));
}

function generateRouteWorkshop(definition, seed) {
  const base = generateMission({ seed, difficulty: 3 });
  return configureWorkshop(base, definition, missionRouteFields(base, definition));
}

// The device names, layouts, address families, and editable patterns below were
// authored specifically for Subnet Notes and are deterministic from their seed.
function generateGuidedMissionOne(definition, seed) {
  const base = generateMission({ seed: `${seed}-orchard`, difficulty: 3 });
  base.seed = String(seed);
  const random = createRandom(`${seed}-gamma`);
  const lanA = base.facts.segments.lanA;
  const alphaAddress = base.devices.find((device) => device.id === 'alpha').interfaces[0].address;
  const gammaAddress = chooseHost(lanA.network, lanA.prefix, random, [base.facts.gateways.atlasLan, alphaAddress]);
  const switchDevice = base.devices.find((device) => device.id === 'orme');
  switchDevice.interfaces.push({ id: 'orme-gamma', address: null, prefix: null, editable: { address: false, prefix: false } });
  base.devices.push({
    id: 'gamma', kind: 'host', labelKey: 'device.gamma',
    interfaces: [{ id: 'gamma-lan', address: gammaAddress, prefix: lanA.prefix, editable: { address: false, prefix: false } }],
    routes: [{ id: 'gamma-default', destination: 0, prefix: 0, gateway: base.facts.gateways.atlasLan, editable: { destination: false, prefix: false, gateway: false } }],
    position: { x: 88, y: 38 },
  });
  base.links.push({ a: 'orme-gamma', b: 'gamma-lan' });
  base.goals.push(
    { sourceId: 'gamma', destinationId: 'beta' },
    { sourceId: 'beta', destinationId: 'gamma' },
  );
  const fields = [
    modelField(base, 'alpha', 'interfaces', 'alpha-lan', 'address', 'host'),
    modelField(base, 'gamma', 'routes', 'gamma-default', 'gateway', 'gateway'),
    modelField(base, 'atlas', 'routes', 'atlas-lan-b', 'destination', 'route-destination'),
    modelField(base, 'atlas', 'routes', 'atlas-lan-b', 'prefix', 'route-prefix'),
    modelField(base, 'atlas', 'routes', 'atlas-lan-b', 'gateway', 'gateway'),
  ];
  return configureWorkshop(base, definition, fields);
}

function generateGuidedMissionTwo(definition, seed) {
  const random = createRandom(`${seed}-branch`);
  const secondOctet = random.integer(30, 190);
  const wan = segment(`172.${secondOctet}.240.0`, 30);
  const transit = segment(`172.${secondOctet}.244.0`, 30);
  const hubLan = segment(`10.${secondOctet}.24.0`, 27);
  const branchLan = segment(`10.${secondOctet}.184.0`, 28);
  assertDistinctSegments([wan, transit, hubLan, branchLan]);

  const edgeWan = wan.usable.first;
  const cloudWan = wan.usable.last;
  const edgeTransit = transit.usable.first;
  const relayTransit = transit.usable.last;
  const edgeHub = hubLan.usable.first;
  const relayBranch = branchLan.usable.first;
  const coveAddress = chooseHost(hubLan.network, hubLan.prefix, random, [edgeHub]);
  const deltaAddress = chooseHost(branchLan.network, branchLan.prefix, random, [relayBranch]);
  const echoAddress = chooseHost(branchLan.network, branchLan.prefix, random, [relayBranch, deltaAddress]);
  const fixed = { address: false, prefix: false };
  const fixedRoute = { destination: false, prefix: false, gateway: false };
  const devices = [
    {
      id: 'cloud', kind: 'internet', labelKey: 'device.internet',
      interfaces: [{ id: 'cloud-uplink', address: cloudWan, prefix: 30, editable: { ...fixed } }],
      routes: [
        { id: 'cloud-hub', destination: hubLan.network, prefix: hubLan.prefix, gateway: edgeWan, editable: { ...fixedRoute } },
        { id: 'cloud-branch', destination: branchLan.network, prefix: branchLan.prefix, gateway: edgeWan, editable: { ...fixedRoute } },
      ], position: { x: 8, y: 18 },
    },
    {
      id: 'harbor', kind: 'router', labelKey: 'device.harbor',
      interfaces: [
        { id: 'harbor-wan', address: edgeWan, prefix: 30, editable: { ...fixed } },
        { id: 'harbor-transit', address: edgeTransit, prefix: 30, editable: { ...fixed } },
        { id: 'harbor-hub', address: edgeHub, prefix: hubLan.prefix, editable: { ...fixed } },
      ],
      routes: [
        { id: 'harbor-branch', destination: branchLan.network, prefix: branchLan.prefix, gateway: relayTransit, editable: { ...fixedRoute } },
        { id: 'harbor-default', destination: 0, prefix: 0, gateway: cloudWan, editable: { ...fixedRoute } },
      ], position: { x: 34, y: 34 },
    },
    {
      id: 'relay', kind: 'router', labelKey: 'device.relay',
      interfaces: [
        { id: 'relay-transit', address: relayTransit, prefix: 30, editable: { ...fixed } },
        { id: 'relay-branch', address: relayBranch, prefix: branchLan.prefix, editable: { ...fixed } },
      ],
      routes: [
        { id: 'relay-hub', destination: hubLan.network, prefix: hubLan.prefix, gateway: edgeTransit, editable: { ...fixedRoute } },
        { id: 'relay-default', destination: 0, prefix: 0, gateway: edgeTransit, editable: { ...fixedRoute } },
      ], position: { x: 60, y: 58 },
    },
    {
      id: 'dock', kind: 'switch', labelKey: 'device.dock',
      interfaces: [
        { id: 'dock-harbor', address: null, prefix: null, editable: { ...fixed } },
        { id: 'dock-cove', address: null, prefix: null, editable: { ...fixed } },
      ], routes: [], position: { x: 58, y: 16 },
    },
    {
      id: 'grove', kind: 'switch', labelKey: 'device.grove',
      interfaces: [
        { id: 'grove-relay', address: null, prefix: null, editable: { ...fixed } },
        { id: 'grove-delta', address: null, prefix: null, editable: { ...fixed } },
        { id: 'grove-echo', address: null, prefix: null, editable: { ...fixed } },
      ], routes: [], position: { x: 78, y: 58 },
    },
    {
      id: 'cove', kind: 'host', labelKey: 'device.cove',
      interfaces: [{ id: 'cove-lan', address: coveAddress, prefix: hubLan.prefix, editable: { ...fixed } }],
      routes: [{ id: 'cove-default', destination: 0, prefix: 0, gateway: edgeHub, editable: { ...fixedRoute } }],
      position: { x: 84, y: 14 },
    },
    {
      id: 'delta', kind: 'host', labelKey: 'device.delta',
      interfaces: [{ id: 'delta-lan', address: deltaAddress, prefix: branchLan.prefix, editable: { ...fixed } }],
      routes: [{ id: 'delta-default', destination: 0, prefix: 0, gateway: relayBranch, editable: { ...fixedRoute } }],
      position: { x: 92, y: 48 },
    },
    {
      id: 'echo', kind: 'host', labelKey: 'device.echo',
      interfaces: [{ id: 'echo-lan', address: echoAddress, prefix: branchLan.prefix, editable: { ...fixed } }],
      routes: [{ id: 'echo-default', destination: 0, prefix: 0, gateway: relayBranch, editable: { ...fixedRoute } }],
      position: { x: 92, y: 76 },
    },
  ];
  const exercise = {
    id: `branch-${seed}`, seed: String(seed), type: 'mission', concept: 'guided-mission', difficulty: 3,
    devices,
    links: [
      { a: 'cloud-uplink', b: 'harbor-wan' },
      { a: 'harbor-transit', b: 'relay-transit' },
      { a: 'harbor-hub', b: 'dock-harbor' },
      { a: 'dock-cove', b: 'cove-lan' },
      { a: 'relay-branch', b: 'grove-relay' },
      { a: 'grove-delta', b: 'delta-lan' },
      { a: 'grove-echo', b: 'echo-lan' },
    ],
    goals: [
      { sourceId: 'cove', destinationId: 'delta' },
      { sourceId: 'echo', destinationId: 'cove' },
    ],
    facts: {
      segments: { wan, transit, lanA: hubLan, lanB: branchLan },
      gateways: { edgeHub, relayBranch, edgeTransit, relayTransit },
    },
  };
  const fields = [
    modelField(exercise, 'harbor', 'interfaces', 'harbor-transit', 'address', 'router-interface'),
    modelField(exercise, 'harbor', 'interfaces', 'harbor-transit', 'prefix', 'mask'),
    modelField(exercise, 'delta', 'routes', 'delta-default', 'gateway', 'gateway'),
    modelField(exercise, 'cloud', 'routes', 'cloud-branch', 'destination', 'route-destination'),
    modelField(exercise, 'cloud', 'routes', 'cloud-branch', 'prefix', 'route-prefix'),
    modelField(exercise, 'relay', 'routes', 'relay-hub', 'gateway', 'gateway'),
  ];
  return configureWorkshop(exercise, definition, fields);
}

function generateMockWorkshop(definition, seed) {
  const baseDefinition = {
    ...definition,
    id: 'guided-mission-2',
    concept: 'guided-mission',
    objective: 'repair-cascaded-branch',
    correctionStrategy: 'branch-round-trip',
  };
  const base = generateGuidedMissionTwo(baseDefinition, `${seed}-mock`);
  base.seed = String(seed);
  const fields = [
    modelField(base, 'delta', 'routes', 'delta-default', 'gateway', 'gateway'),
    modelField(base, 'cloud', 'routes', 'cloud-branch', 'destination', 'route-destination'),
    modelField(base, 'cloud', 'routes', 'cloud-branch', 'prefix', 'route-prefix'),
  ];
  return configureWorkshop(base, definition, fields);
}

const workshopBuilders = {
  'ipv4-validity-1': generateBasicWorkshop,
  'ipv4-octets-2': generateBasicWorkshop,
  'mask-conversion-1': generateBasicWorkshop,
  'subnet-range-1': generateRangeWorkshop,
  'usable-host-2': generateRangeWorkshop,
  'same-subnet-3': generateBasicWorkshop,
  'neighbors-1': generateBasicWorkshop,
  'switch-segment-2': generateSwitchWorkshop,
  'router-interface-1': generateBasicWorkshop,
  'valid-gateway-2': generateBasicWorkshop,
  'direct-network-3': generateRangeWorkshop,
  'route-parts-1': generateRouteWorkshop,
  'default-route-2': generateRouteWorkshop,
  'packet-path-3': generateRouteWorkshop,
  'return-path-4': generateRouteWorkshop,
  'routing-mission-5': generateRouteWorkshop,
  'guided-mission-1': generateGuidedMissionOne,
  'guided-mission-2': generateGuidedMissionTwo,
  'mock-exam': generateMockWorkshop,
};

export function getWorkshopGenerator(workshopId) {
  const definition = getWorkshopDefinition(workshopId);
  const build = workshopBuilders[workshopId];
  if (!definition || !build) return null;
  return ({ seed = `${workshopId}-practice` } = {}) => build(definition, String(seed));
}
