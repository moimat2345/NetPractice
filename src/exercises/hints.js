import { formatIPv4, parseIPv4 } from '../core/ipv4.js';
import { broadcastOf, networkOf, parseMask } from '../core/subnet.js';

const hintKeys = {
  'unreachable-gateway': ['hint.gateway.observe', 'hint.gateway.method', 'hint.gateway.nearSolution'],
  'different-subnet': ['hint.subnet.observe', 'hint.subnet.method', 'hint.subnet.nearSolution'],
  'missing-return-path': ['hint.return.observe', 'hint.return.method', 'hint.return.nearSolution'],
};

const familyKeys = Object.fromEntries(['ipv4', 'mask', 'range', 'route', 'defaultRoute', 'gateway', 'subnet', 'return', 'generic']
  .map((family) => [family, [
    `hint.${family}.observe`,
    `hint.${family}.method`,
    `hint.${family}.nearSolution`,
  ]]));

const rangeRoles = new Set(['network', 'broadcast', 'first-host', 'last-host', 'direct-network']);
const routeRoles = new Set(['route-destination', 'route-prefix']);

function fieldMeta(exercise, diagnostic) {
  return exercise.fieldMeta?.[diagnostic?.field]
    ?? exercise.editableFields?.map((field) => exercise.fieldMeta?.[field]).find(Boolean)
    ?? null;
}

function hintFamily(exercise, diagnostic) {
  if (diagnostic?.code === 'unreachable-gateway') return 'gateway';
  if (diagnostic?.code === 'different-subnet') return 'subnet';
  if (diagnostic?.code === 'missing-return-path') return 'return';
  if (exercise.correctionStrategy === 'default-route') return 'defaultRoute';
  if (exercise.correctionStrategy === 'return-trace') return 'return';
  if (['wrong-route-destination', 'wrong-default-gateway'].includes(diagnostic?.code)) return 'route';

  const meta = fieldMeta(exercise, diagnostic);
  if (meta?.role === 'valid-ipv4' || meta?.role === 'octet-boundary') return 'ipv4';
  if (meta?.role === 'mask') return 'mask';
  if (rangeRoles.has(meta?.role)) return 'range';
  if (routeRoles.has(meta?.role)) return 'route';

  const byStrategy = {
    'ipv4-format': 'ipv4',
    'octet-boundaries': 'ipv4',
    'mask-conversion': 'mask',
    'subnet-boundaries': 'range',
    'usable-hosts': 'range',
    'connected-network': 'range',
    'compare-networks': 'subnet',
    'switch-segment': 'subnet',
    'connected-interface': 'subnet',
    'gateway-membership': 'gateway',
    'route-components': 'route',
    'default-route': 'route',
    'forward-trace': 'route',
    'return-trace': 'return',
    'packet-round-trip': 'route',
    'branch-round-trip': 'route',
    'timed-round-trip': 'route',
  };
  return byStrategy[exercise.correctionStrategy] ?? 'generic';
}

function routeFieldMeta(exercise) {
  const entries = exercise.editableFields?.map((field) => exercise.fieldMeta?.[field]).filter(Boolean) ?? [];
  return entries.find((meta) => routeRoles.has(meta.role))
    ?? entries.find((meta) => meta.routeId)
    ?? null;
}

function compactParams(params) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null));
}

function localAddressForMeta(exercise, meta) {
  const device = exercise.devices?.find((candidate) => candidate.id === meta?.deviceId);
  if (!device) return undefined;
  const route = device.routes?.find((candidate) => candidate.id === meta?.routeId);
  const localInterface = route
    ? device.interfaces.find((entry) => Number.isInteger(entry.address)
      && networkOf(entry.address, entry.prefix) === networkOf(route.gateway, entry.prefix))
    : device.interfaces.find((entry) => Number.isInteger(entry.address));
  return Number.isInteger(localInterface?.address) ? formatIPv4(localInterface.address) : undefined;
}

function exerciseParams(exercise, diagnostic) {
  const meta = fieldMeta(exercise, diagnostic);
  const routeMeta = routeFieldMeta(exercise);
  const firstGoal = exercise.goals?.[0];
  return compactParams({
    deviceId: diagnostic?.deviceId ?? meta?.deviceId ?? meta?.relatedDeviceId ?? routeMeta?.deviceId,
    role: meta?.role,
    prefix: diagnostic?.params?.prefix ?? meta?.prefix ?? exercise.facts?.prefix,
    blockSize: exercise.facts?.blockSize,
    dottedMask: meta?.dottedMask ?? (exercise.correctionStrategy === 'mask-conversion' ? exercise.facts?.clue : undefined),
    privateRange: meta?.privateRange ?? exercise.facts?.privateRange,
    clue: exercise.facts?.clue,
    localAddress: diagnostic?.params?.localAddress
      ?? (meta?.role === 'gateway' ? localAddressForMeta(exercise, meta) : undefined),
    source: firstGoal?.sourceId,
    destination: firstGoal?.destinationId,
    expectedShape: describeExpectedShape(exercise, diagnostic?.field ?? exercise.editableFields?.[0]),
  });
}

function describeExpectedShape(exercise, field) {
  const meta = exercise.fieldMeta?.[field];
  if (meta?.kind === 'prefix' || field?.endsWith('.prefix')) return { messageKey: 'semantic.shape.prefix' };
  if (meta?.kind === 'address' || field?.endsWith('.address') || field?.endsWith('.gateway')) {
    return { messageKey: 'semantic.shape.address' };
  }
  return { messageKey: 'semantic.shape.network' };
}

function deriveNearSolutionParams(diagnostic) {
  const params = diagnostic.params ?? {};
  const localAddress = parseIPv4(params.localAddress);
  if (!Number.isInteger(params.prefix) || localAddress === null) return params;
  return {
    ...params,
    network: formatIPv4(networkOf(localAddress, params.prefix)),
    broadcast: formatIPv4(broadcastOf(localAddress, params.prefix)),
  };
}

function answerDescriptors(exercise) {
  return Object.entries(exercise.solution ?? {}).map(([field, answer]) => {
    const kind = exercise.fieldMeta?.[field]?.kind;
    if (kind === 'prefix') return { kind, value: parseMask(answer)?.prefix };
    if (kind === 'address') return { kind, value: parseIPv4(answer) };
    return { kind: 'value', value: answer };
  }).filter(({ value }) => value !== null && value !== undefined);
}

function isAnswerEquivalent(candidate, answer) {
  if (answer.kind === 'prefix') {
    if (typeof candidate === 'number') return candidate === answer.value;
    const normalized = typeof candidate === 'string' ? candidate.trim() : '';
    return /^\/?(?:0|[1-9]|[12]\d|3[0-2])$/.test(normalized)
      && Number(normalized.replace(/^\//, '')) === answer.value;
  }
  if (answer.kind === 'address') {
    if (typeof candidate === 'number') return candidate === answer.value;
    return typeof candidate === 'string' && parseIPv4(candidate.trim()) === answer.value;
  }
  return candidate === answer.value;
}

const omitted = Symbol('omitted-hint-answer');

function withoutAnswerValues(value, answers) {
  if (answers.some((answer) => isAnswerEquivalent(value, answer))) return omitted;
  if (Array.isArray(value)) {
    return value.map((entry) => withoutAnswerValues(entry, answers)).filter((entry) => entry !== omitted);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => {
      if (answers.some((answer) => isAnswerEquivalent(key, answer))) return [];
      const safeEntry = withoutAnswerValues(entry, answers);
      return safeEntry === omitted ? [] : [[key, safeEntry]];
    }));
  }
  return value;
}

export function getHint(exercise, validation, level) {
  if (![1, 2, 3].includes(level)) throw new RangeError('Hint level must be 1, 2, or 3');
  const diagnostic = validation?.diagnostics?.[0];
  const legacyKeys = diagnostic ? hintKeys[diagnostic.code] : null;
  const family = hintFamily(exercise, diagnostic);
  const keys = legacyKeys ?? familyKeys[family];
  let params;
  if (legacyKeys) {
    params = level === 1
      ? { deviceId: diagnostic.deviceId }
      : level === 2
        ? diagnostic.params
        : { ...deriveNearSolutionParams(diagnostic), expectedShape: describeExpectedShape(exercise, diagnostic.field) };
  } else {
    const context = exerciseParams(exercise, diagnostic);
    params = level === 1
      ? context
      : level === 2
        ? { ...(diagnostic?.params ?? {}), ...context }
        : {
          ...(family === 'gateway'
            ? deriveNearSolutionParams(diagnostic ?? {
              params: { localAddress: context.localAddress, prefix: context.prefix },
            })
            : diagnostic?.params ?? {}),
          ...context,
        };
  }
  return {
    key: keys[level - 1],
    params: withoutAnswerValues(params, answerDescriptors(exercise)),
  };
}
