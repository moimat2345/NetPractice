import { formatIPv4 } from '../core/ipv4.js';
import { broadcastOf, networkOf, usableRange } from '../core/subnet.js';
import { element } from './dom.js';
import { describeField, deviceLabel, entryLabel } from './exercise-labels.js';

function editedRouteContext(exercise) {
  const routeFields = exercise.editableFields
    .map((field) => exercise.fieldMeta?.[field])
    .filter((meta) => meta?.deviceId && meta?.routeId);
  const meta = routeFields.find((candidate) =>
    ['route-destination', 'route-prefix'].includes(candidate.role)) ?? routeFields[0];
  if (!meta) return null;
  const device = exercise.devices.find((candidate) => candidate.id === meta.deviceId);
  const route = device?.routes.find((candidate) => candidate.id === meta.routeId);
  if (!route || !Number.isInteger(route.destination) || !Number.isInteger(route.prefix)) return null;
  const network = networkOf(route.destination, route.prefix);
  const localInterface = device.interfaces.find((entry) => Number.isInteger(entry.address)
    && Number.isInteger(entry.prefix)
    && Number.isInteger(route.gateway)
    && networkOf(entry.address, entry.prefix) === networkOf(route.gateway, entry.prefix));
  const localNetwork = localInterface ? networkOf(localInterface.address, localInterface.prefix) : null;
  return {
    meta,
    device,
    route,
    localInterface,
    localSegment: localInterface ? {
      network: localNetwork,
      prefix: localInterface.prefix,
      broadcast: broadcastOf(localNetwork, localInterface.prefix),
      usable: usableRange(localNetwork, localInterface.prefix),
    } : null,
    segment: {
      network,
      prefix: route.prefix,
      broadcast: broadcastOf(network, route.prefix),
      usable: usableRange(network, route.prefix),
    },
  };
}

function firstSegment(exercise) {
  const routeContext = editedRouteContext(exercise);
  if (routeContext) {
    return ['route-destination', 'route-prefix'].includes(routeContext.meta.role)
      ? routeContext.segment
      : routeContext.localSegment;
  }
  if (Number.isInteger(exercise.facts?.network)) {
    return {
      network: exercise.facts.network,
      prefix: exercise.facts.prefix,
      broadcast: exercise.facts.broadcast,
      usable: exercise.facts.usable,
    };
  }
  return exercise.facts?.segments?.lanA ?? Object.values(exercise.facts?.segments ?? {})[0] ?? null;
}

function firstGateway(exercise) {
  const routeContext = editedRouteContext(exercise);
  if (Number.isInteger(routeContext?.route.gateway)) return routeContext.route.gateway;
  const gateway = Object.values(exercise.facts?.gateways ?? {})[0];
  if (Number.isInteger(gateway)) return gateway;
  return exercise.devices.flatMap((device) => device.routes).find((route) => Number.isInteger(route.gateway))?.gateway ?? null;
}

export function correctionSteps(exercise) {
  const routeContext = editedRouteContext(exercise);
  const segment = firstSegment(exercise);
  const gateway = firstGateway(exercise);
  const firstGoal = exercise.goals[0] ?? { sourceId: '?', destinationId: '?' };
  const reverseGoal = { sourceId: firstGoal.destinationId, destinationId: firstGoal.sourceId };
  const values = {
    network: Number.isInteger(segment?.network) ? formatIPv4(segment.network) : '—',
    prefix: segment?.prefix ?? '—',
    broadcast: Number.isInteger(segment?.broadcast) ? formatIPv4(segment.broadcast) : '—',
    first: Number.isInteger(segment?.usable?.first) ? formatIPv4(segment.usable.first) : '—',
    last: Number.isInteger(segment?.usable?.last) ? formatIPv4(segment.usable.last) : '—',
    gateway: Number.isInteger(gateway) ? formatIPv4(gateway) : '—',
    localAddress: Number.isInteger(routeContext?.localInterface?.address)
      ? formatIPv4(routeContext.localInterface.address) : '—',
    source: firstGoal.sourceId,
    destination: firstGoal.destinationId,
    returnSource: reverseGoal.sourceId,
    returnDestination: reverseGoal.destinationId,
    expected: Object.entries(exercise.solution)
      .map(([field, value]) => `${field}: ${value}`)
      .join(' · '),
  };
  const strategyKeys = {
    'ipv4-format': ['correction.ipv4Shape', 'correction.octetBounds', 'correction.expectedFields'],
    'octet-boundaries': ['correction.ipv4Shape', 'correction.octetBounds', 'correction.expectedFields'],
    'mask-conversion': ['correction.maskBits', 'correction.octetBounds', 'correction.expectedFields'],
    'subnet-boundaries': ['correction.identify', 'correction.boundaries', 'correction.expectedFields'],
    'usable-hosts': ['correction.identify', 'correction.boundaries', 'correction.usable', 'correction.expectedFields'],
    'compare-networks': ['correction.identify', 'correction.boundaries', 'correction.expectedFields'],
    'switch-segment': ['correction.identify', 'correction.boundaries', 'correction.expectedFields'],
    'connected-interface': ['correction.identify', 'correction.usable', 'correction.expectedFields'],
    'gateway-membership': ['correction.identify', 'correction.boundaries', 'correction.gateway', 'correction.expectedFields'],
    'connected-network': ['correction.identify', 'correction.boundaries', 'correction.expectedFields'],
    'route-components': ['correction.identify', 'correction.gateway', 'correction.forward', 'correction.expectedFields'],
    'default-route': ['correction.gateway', 'correction.defaultRoute', 'correction.forward', 'correction.expectedFields'],
    'forward-trace': ['correction.gateway', 'correction.forward', 'correction.expectedFields'],
    'return-trace': ['correction.forward', 'correction.return', 'correction.expectedFields'],
    'packet-round-trip': ['correction.identify', 'correction.boundaries', 'correction.usable', 'correction.gateway', 'correction.forward', 'correction.return'],
    'branch-round-trip': ['correction.identify', 'correction.gateway', 'correction.forward', 'correction.return', 'correction.expectedFields'],
    'timed-round-trip': ['correction.identify', 'correction.gateway', 'correction.forward', 'correction.return', 'correction.expectedFields'],
  };
  const keys = strategyKeys[exercise.correctionStrategy]
    ?? ['correction.identify', 'correction.boundaries', 'correction.expectedFields'];
  return keys.map((key) => ({
    key,
    params: key === 'correction.gateway' && routeContext?.localSegment ? {
      ...values,
      network: formatIPv4(routeContext.localSegment.network),
      prefix: routeContext.localSegment.prefix,
      broadcast: formatIPv4(routeContext.localSegment.broadcast),
      first: formatIPv4(routeContext.localSegment.usable.first),
      last: formatIPv4(routeContext.localSegment.usable.last),
    } : values,
  }));
}

export function renderDiagnostic(i18n, validation, { exercise, submission, onFocusField, headingKey = 'feedback.incorrect' } = {}) {
  const diagnostic = validation?.diagnostics?.[0];
  if (!diagnostic) return null;
  const field = exercise?.editableFields.includes(diagnostic.field) ? diagnostic.field : null;
  const label = field ? describeField(i18n, exercise, field) : null;
  const value = submission ? submission[field] : diagnostic.params?.value;
  const missing = field && ['invalid-ip', 'invalid-mask'].includes(diagnostic.code)
    && (value === undefined || value === null || String(value).trim() === '');
  return element('div', { className: 'feedback feedback-error', role: 'alert' }, [
    element('strong', {}, [i18n.t(headingKey)]),
    label && !missing && element('p', {}, [i18n.t('practice.targetField', { field: label })]),
    element('p', {}, [missing
      ? i18n.t('practice.missingValue', { field: label })
      : i18n.t(diagnostic.messageKey, diagnostic.params)]),
    field && typeof onFocusField === 'function' && element('button', {
      type: 'button',
      className: 'button button-secondary',
      onClick: () => onFocusField(field),
    }, [i18n.t('practice.focusField', { field: label })]),
  ]);
}

export function renderHint(i18n, hintLevel, hint) {
  if (hintLevel === 0 || !hint) return null;
  return element('div', { className: 'feedback feedback-hint', role: 'status' }, [
    element('strong', {}, [i18n.t('feedback.hintUsed', { level: hintLevel })]),
    element('p', {}, [i18n.t(hint.key, hint.params)]),
  ]);
}

export function renderCorrection(i18n, exercise) {
  const list = element('ol', { className: 'correction-steps' });
  const routeContext = editedRouteContext(exercise);
  const labelForDevice = (id) => deviceLabel(i18n, exercise.devices.find((device) => device.id === id));
  correctionSteps(exercise).forEach((step) => {
    if (step.key === 'correction.expectedFields') {
      list.append(element('li', {}, [
        i18n.t('practice.correction.expectedIntro'),
        element('ul', {}, Object.entries(exercise.solution).map(([field, value]) =>
          element('li', {}, [`${describeField(i18n, exercise, field)} : ${value}`]))),
      ]));
      return;
    }
    let key = step.key;
    const params = {
      ...step.params,
      source: labelForDevice(step.params.source),
      destination: labelForDevice(step.params.destination),
      returnSource: labelForDevice(step.params.returnSource),
      returnDestination: labelForDevice(step.params.returnDestination),
    };
    if (routeContext) {
      params.device = deviceLabel(i18n, routeContext.device);
      params.route = entryLabel(i18n, routeContext.device, 'routes', routeContext.route,
        routeContext.device.routes.indexOf(routeContext.route));
      if (key === 'correction.identify') {
        key = ['route-destination', 'route-prefix'].includes(routeContext.meta.role)
          ? 'practice.correction.routeDestination' : 'practice.correction.localSubnet';
      }
      if (key === 'correction.gateway' && routeContext.localInterface) key = 'practice.correction.gatewayLocal';
    }
    if (key === 'correction.maskBits' && exercise.facts?.clue) {
      key = 'practice.correction.maskBits';
      params.mask = exercise.facts.clue;
    }
    list.append(element('li', {}, [i18n.t(key, params)]));
  });
  return element('section', {
    className: 'correction-panel',
    role: 'region',
    'aria-label': i18n.t('correction.title'),
  }, [
    element('p', { className: 'note-label' }, [i18n.t('course.method')]),
    element('h2', {}, [i18n.t('correction.title')]),
    element('p', {}, [i18n.t('correction.intro')]),
    list,
  ]);
}
