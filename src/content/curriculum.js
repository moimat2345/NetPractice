export const curriculum = [
  { id: 'ipv4', titleKey: 'course.ipv4.title', workshops: ['ipv4-validity-1', 'ipv4-octets-2'] },
  { id: 'subnets', titleKey: 'course.subnets.title', workshops: ['mask-conversion-1', 'subnet-range-1', 'usable-host-2', 'same-subnet-3'] },
  { id: 'local', titleKey: 'course.local.title', workshops: ['neighbors-1', 'switch-segment-2'] },
  { id: 'gateways', titleKey: 'course.gateways.title', workshops: ['router-interface-1', 'valid-gateway-2', 'direct-network-3'] },
  { id: 'routing', titleKey: 'course.routing.title', workshops: ['route-parts-1', 'default-route-2', 'packet-path-3', 'return-path-4', 'routing-mission-5'] },
  { id: 'exam', titleKey: 'course.exam.title', workshops: ['guided-mission-1', 'guided-mission-2', 'mock-exam'] },
];

const definitions = {
  'ipv4-validity-1': { concept: 'same-subnet', difficulty: 1 },
  'ipv4-octets-2': { concept: 'same-subnet', difficulty: 2 },
  'mask-conversion-1': { concept: 'subnet-range', difficulty: 1 },
  'subnet-range-1': { concept: 'subnet-range', difficulty: 1 },
  'usable-host-2': { concept: 'subnet-range', difficulty: 2 },
  'same-subnet-3': { concept: 'same-subnet', difficulty: 2 },
  'neighbors-1': { concept: 'same-subnet', difficulty: 1 },
  'switch-segment-2': { concept: 'same-subnet', difficulty: 2 },
  'router-interface-1': { concept: 'gateway', difficulty: 1 },
  'valid-gateway-2': { concept: 'gateway', difficulty: 2 },
  'direct-network-3': { concept: 'gateway', difficulty: 2 },
  'route-parts-1': { concept: 'routing-mission', difficulty: 1 },
  'default-route-2': { concept: 'routing-mission', difficulty: 1 },
  'packet-path-3': { concept: 'routing-mission', difficulty: 2 },
  'return-path-4': { concept: 'routing-mission', difficulty: 2 },
  'routing-mission-5': { concept: 'routing-mission', difficulty: 3 },
  'guided-mission-1': { concept: 'routing-mission', difficulty: 2 },
  'guided-mission-2': { concept: 'routing-mission', difficulty: 3 },
  'mock-exam': { concept: 'routing-mission', difficulty: 3 },
};

export function getWorkshopDefinition(workshopId) {
  const stage = curriculum.find((candidate) => candidate.workshops.includes(workshopId));
  const definition = definitions[workshopId];
  if (!stage || !definition) return null;
  return { id: workshopId, stageId: stage.id, titleKey: stage.titleKey, ...definition };
}
