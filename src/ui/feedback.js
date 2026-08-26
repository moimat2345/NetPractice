import { formatIPv4 } from '../core/ipv4.js';
import { element } from './dom.js';

function firstSegment(exercise) {
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
  const gateway = Object.values(exercise.facts?.gateways ?? {})[0];
  if (Number.isInteger(gateway)) return gateway;
  return exercise.devices.flatMap((device) => device.routes).find((route) => Number.isInteger(route.gateway))?.gateway ?? null;
}

export function correctionSteps(exercise) {
  const segment = firstSegment(exercise);
  const gateway = firstGateway(exercise);
  const firstGoal = exercise.goals[0] ?? { sourceId: '?', destinationId: '?' };
  const reverseGoal = exercise.goals[1] ?? { sourceId: firstGoal.destinationId, destinationId: firstGoal.sourceId };
  const values = {
    network: Number.isInteger(segment?.network) ? formatIPv4(segment.network) : '—',
    prefix: segment?.prefix ?? '—',
    broadcast: Number.isInteger(segment?.broadcast) ? formatIPv4(segment.broadcast) : '—',
    first: Number.isInteger(segment?.usable?.first) ? formatIPv4(segment.usable.first) : '—',
    last: Number.isInteger(segment?.usable?.last) ? formatIPv4(segment.usable.last) : '—',
    gateway: Number.isInteger(gateway) ? formatIPv4(gateway) : '—',
    source: firstGoal.sourceId,
    destination: firstGoal.destinationId,
    returnSource: reverseGoal.sourceId,
    returnDestination: reverseGoal.destinationId,
  };

  return [
    { key: 'correction.identify', params: values },
    { key: 'correction.boundaries', params: values },
    { key: 'correction.usable', params: values },
    { key: 'correction.gateway', params: values },
    { key: 'correction.forward', params: values },
    { key: 'correction.return', params: values },
  ];
}

export function renderDiagnostic(i18n, validation) {
  const diagnostic = validation?.diagnostics?.[0];
  if (!diagnostic) return null;
  return element('div', { className: 'feedback feedback-error', role: 'alert' }, [
    element('strong', {}, [i18n.t('feedback.incorrect')]),
    element('p', {}, [i18n.t(diagnostic.messageKey, diagnostic.params)]),
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
  correctionSteps(exercise).forEach((step) => {
    list.append(element('li', {}, [i18n.t(step.key, step.params)]));
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
