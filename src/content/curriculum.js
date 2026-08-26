export const curriculum = [
  { id: 'ipv4', titleKey: 'course.ipv4.title', workshops: ['ipv4-validity-1', 'ipv4-octets-2'] },
  { id: 'subnets', titleKey: 'course.subnets.title', workshops: ['mask-conversion-1', 'subnet-range-1', 'usable-host-2', 'same-subnet-3'] },
  { id: 'local', titleKey: 'course.local.title', workshops: ['neighbors-1', 'switch-segment-2'] },
  { id: 'gateways', titleKey: 'course.gateways.title', workshops: ['router-interface-1', 'valid-gateway-2', 'direct-network-3'] },
  { id: 'routing', titleKey: 'course.routing.title', workshops: ['route-parts-1', 'default-route-2', 'packet-path-3', 'return-path-4', 'routing-mission-5'] },
  { id: 'exam', titleKey: 'course.exam.title', workshops: ['guided-mission-1', 'guided-mission-2', 'mock-exam'] },
];

const definitions = {
  'ipv4-validity-1': { concept: 'ipv4-validity', difficulty: 1, objective: 'enter-valid-ipv4', correctionStrategy: 'ipv4-format' },
  'ipv4-octets-2': { concept: 'ipv4-octets', difficulty: 2, objective: 'respect-octet-boundaries', correctionStrategy: 'octet-boundaries' },
  'mask-conversion-1': { concept: 'mask-conversion', difficulty: 1, objective: 'convert-dotted-mask-to-cidr', correctionStrategy: 'mask-conversion' },
  'subnet-range-1': { concept: 'subnet-range', difficulty: 1, objective: 'calculate-network-and-broadcast', correctionStrategy: 'subnet-boundaries' },
  'usable-host-2': { concept: 'usable-host-range', difficulty: 2, objective: 'calculate-usable-host-range', correctionStrategy: 'usable-hosts' },
  'same-subnet-3': { concept: 'same-subnet', difficulty: 2, objective: 'place-host-in-same-subnet', correctionStrategy: 'compare-networks' },
  'neighbors-1': { concept: 'direct-neighbors', difficulty: 1, objective: 'configure-direct-neighbor', correctionStrategy: 'compare-networks' },
  'switch-segment-2': { concept: 'switch-segment', difficulty: 2, objective: 'configure-switched-segment', correctionStrategy: 'switch-segment' },
  'router-interface-1': { concept: 'router-interface', difficulty: 1, objective: 'address-connected-router-interface', correctionStrategy: 'connected-interface' },
  'valid-gateway-2': { concept: 'gateway', difficulty: 2, objective: 'choose-reachable-gateway', correctionStrategy: 'gateway-membership' },
  'direct-network-3': { concept: 'direct-network', difficulty: 2, objective: 'calculate-directly-connected-network', correctionStrategy: 'connected-network' },
  'route-parts-1': { concept: 'route-parts', difficulty: 1, objective: 'complete-route-components', correctionStrategy: 'route-components' },
  'default-route-2': { concept: 'default-route', difficulty: 1, objective: 'configure-default-route', correctionStrategy: 'default-route' },
  'packet-path-3': { concept: 'forward-packet', difficulty: 2, objective: 'restore-forward-packet-path', correctionStrategy: 'forward-trace' },
  'return-path-4': { concept: 'return-path', difficulty: 2, objective: 'restore-return-packet-path', correctionStrategy: 'return-trace' },
  'routing-mission-5': { concept: 'routing-mission', difficulty: 3, objective: 'restore-multiple-round-trips', correctionStrategy: 'packet-round-trip' },
  'guided-mission-1': { concept: 'guided-mission', difficulty: 2, objective: 'connect-three-hosts-through-two-routers', correctionStrategy: 'packet-round-trip' },
  'guided-mission-2': { concept: 'guided-mission', difficulty: 3, objective: 'repair-cascaded-branch', correctionStrategy: 'branch-round-trip' },
  'mock-exam': { concept: 'mock-exam', difficulty: 3, objective: 'solve-timed-advanced-mission', correctionStrategy: 'timed-round-trip' },
};

export function getWorkshopDefinition(workshopId) {
  const stage = curriculum.find((candidate) => candidate.workshops.includes(workshopId));
  const definition = definitions[workshopId];
  if (!stage || !definition) return null;
  return { id: workshopId, stageId: stage.id, titleKey: stage.titleKey, ...definition };
}
