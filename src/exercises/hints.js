import { formatIPv4, parseIPv4 } from '../core/ipv4.js';
import { broadcastOf, networkOf } from '../core/subnet.js';

const hintKeys = {
  'unreachable-gateway': ['hint.gateway.observe', 'hint.gateway.method', 'hint.gateway.nearSolution'],
  'different-subnet': ['hint.subnet.observe', 'hint.subnet.method', 'hint.subnet.nearSolution'],
  'missing-return-path': ['hint.return.observe', 'hint.return.method', 'hint.return.nearSolution'],
};

function describeExpectedShape(exercise, field) {
  const meta = exercise.fieldMeta?.[field];
  if (meta?.kind === 'prefix' || field?.endsWith('.prefix')) return 'CIDR prefix';
  if (meta?.kind === 'address' || field?.endsWith('.address') || field?.endsWith('.gateway')) return 'IPv4 address';
  return 'network value';
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

export function getHint(exercise, validation, level) {
  if (![1, 2, 3].includes(level)) throw new RangeError('Hint level must be 1, 2, or 3');
  const diagnostic = validation?.diagnostics?.[0];
  if (!diagnostic) {
    return { key: 'hint.generic.observe', params: {} };
  }
  const keys = hintKeys[diagnostic.code]
    ?? ['hint.generic.observe', 'hint.generic.method', 'hint.generic.nearSolution'];
  const params = level === 1
    ? { deviceId: diagnostic.deviceId }
    : level === 2
      ? diagnostic.params
      : { ...deriveNearSolutionParams(diagnostic), expectedShape: describeExpectedShape(exercise, diagnostic.field) };
  return { key: keys[level - 1], params };
}
