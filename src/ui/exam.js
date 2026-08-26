import { generateMission } from '../exercises/generators.js';
import { validateSubmission } from '../exercises/validators.js';
import { renderDeviceConfig } from './device-config.js';
import { element, replace } from './dom.js';
import { createTopology } from './topology.js';

const EXAM_MISSION_COUNT = 3;
const ANNOUNCEMENT_THRESHOLDS = [
  { seconds: 300, code: 'five-minutes' },
  { seconds: 60, code: 'one-minute' },
];

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  Object.values(value).forEach((nested) => deepFreeze(nested, seen));
  return Object.freeze(value);
}

function immutableCopy(value) {
  return deepFreeze(structuredClone(value));
}

function captureFocus(root) {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !root.contains(active) || !active.dataset.focusKey) return null;
  const snapshot = { key: active.dataset.focusKey, selection: null };
  if (active instanceof HTMLInputElement) {
    snapshot.selection = {
      start: active.selectionStart,
      end: active.selectionEnd,
      direction: active.selectionDirection,
    };
  }
  return snapshot;
}

function restoreFocus(root, snapshot) {
  if (!snapshot) return false;
  const target = [...root.querySelectorAll('[data-focus-key]')]
    .find((node) => node.dataset.focusKey === snapshot.key);
  if (!(target instanceof HTMLElement)) return false;
  target.focus({ preventScroll: true });
  if (target instanceof HTMLInputElement && snapshot.selection) {
    try {
      target.setSelectionRange(
        snapshot.selection.start,
        snapshot.selection.end,
        snapshot.selection.direction,
      );
    } catch {
      // Focus continuity still applies to controls without text selection.
    }
  }
  return true;
}

function diagnosticCodes(validation) {
  const codes = validation?.diagnostics
    ?.map((diagnostic) => diagnostic?.code)
    .filter((code) => typeof code === 'string' && code.length > 0) ?? [];
  return [...new Set(codes)];
}

function missionResult(missionSeed, passed, codes = []) {
  return { missionSeed, passed, diagnosticCodes: passed ? [] : codes };
}

export function createExamState({
  seed,
  clock = Date,
  durationSeconds = 900,
  missionCount = EXAM_MISSION_COUNT,
  onFinalize = () => {},
} = {}) {
  if (typeof seed !== 'string' || seed.length === 0) throw new TypeError('An exam seed is required');
  if (missionCount !== EXAM_MISSION_COUNT) throw new RangeError('A mock exam contains exactly three missions');
  if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) throw new RangeError('Exam duration must be positive');
  if (!clock || typeof clock.now !== 'function') throw new TypeError('A clock with now() is required');

  const startedAt = clock.now();
  const missions = immutableCopy(Array.from({ length: EXAM_MISSION_COUNT }, (_, index) =>
    generateMission({ seed: `${seed}:${index}`, difficulty: 3 })));
  const submissions = missions.map((mission) => ({ ...mission.initial }));
  const results = Array(EXAM_MISSION_COUNT).fill(null);
  const lastDiagnosticCodes = Array.from({ length: EXAM_MISSION_COUNT }, () => []);
  const announcements = [];
  const announced = new Set();
  let currentIndex = 0;
  let previousRemaining = durationSeconds;
  let status = 'running';
  let finalizedElapsed = null;
  let finalRecord = null;

  function elapsedSeconds() {
    if (finalizedElapsed !== null) return finalizedElapsed;
    return Math.min(durationSeconds, Math.max(0, Math.floor((clock.now() - startedAt) / 1000)));
  }

  function remainingSeconds() {
    return Math.max(0, durationSeconds - elapsedSeconds());
  }

  function finalize(nextStatus) {
    if (status !== 'running') return finalRecord;
    finalizedElapsed = elapsedSeconds();
    status = nextStatus;
    for (let index = 0; index < results.length; index += 1) {
      if (results[index] === null) {
        const codes = lastDiagnosticCodes[index].length > 0
          ? lastDiagnosticCodes[index]
          : ['not-submitted'];
        results[index] = missionResult(missions[index].seed, false, codes);
      }
    }
    const score = results.filter((result) => result.passed).length;
    finalRecord = immutableCopy({
      id: `exam:${seed}`,
      seed,
      passed: score === EXAM_MISSION_COUNT,
      seconds: finalizedElapsed,
      score,
      status,
      missions: results,
    });
    onFinalize(finalRecord);
    return finalRecord;
  }

  function synchronize() {
    if (status !== 'running') return;
    const remaining = remainingSeconds();
    if (remaining > 0) {
      for (const threshold of ANNOUNCEMENT_THRESHOLDS) {
        if (previousRemaining > threshold.seconds
          && remaining <= threshold.seconds
          && !announced.has(threshold.code)) {
          announced.add(threshold.code);
          announcements.push(threshold.code);
        }
      }
    }
    previousRemaining = remaining;
    if (remaining === 0) finalize('expired');
  }

  function nextUnfinished(afterIndex) {
    for (let offset = 1; offset <= results.length; offset += 1) {
      const index = (afterIndex + offset) % results.length;
      if (results[index] === null) return index;
    }
    return afterIndex;
  }

  return {
    missions,
    select(index) {
      synchronize();
      if (status !== 'running' || !Number.isInteger(index) || index < 0 || index >= missions.length) return false;
      currentIndex = index;
      return true;
    },
    update(field, value, index = currentIndex) {
      synchronize();
      if (status !== 'running' || results[index] !== null || !missions[index]?.editableFields.includes(field)) return false;
      submissions[index][field] = String(value);
      return true;
    },
    submit(index = currentIndex, validation = null) {
      synchronize();
      if (status !== 'running' || index !== currentIndex || results[index] !== null) {
        return { accepted: false, passed: false };
      }
      const passed = validation?.ok === true;
      lastDiagnosticCodes[index] = diagnosticCodes(validation);
      if (passed) {
        results[index] = missionResult(missions[index].seed, true);
        if (results.every(Boolean)) finalize('complete');
        else currentIndex = nextUnfinished(index);
      }
      return { accepted: true, passed };
    },
    submission(index = currentIndex) {
      synchronize();
      return immutableCopy(submissions[index] ?? {});
    },
    takeAnnouncements() {
      synchronize();
      return announcements.splice(0, announcements.length);
    },
    snapshot() {
      synchronize();
      return immutableCopy({
        seed,
        index: currentIndex,
        remainingSeconds: remainingSeconds(),
        elapsedSeconds: elapsedSeconds(),
        status,
        results,
        submissions,
      });
    },
  };
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function remediationFor(codes) {
  const stages = new Set();
  for (const code of codes) {
    if (['invalid-ip'].includes(code)) stages.add('ipv4');
    else if (['invalid-mask', 'network-address', 'broadcast-address', 'incorrect-calculation'].includes(code)) stages.add('subnets');
    else if (['different-subnet', 'overlapping-subnets'].includes(code)) stages.add('local');
    else if (['unreachable-gateway', 'wrong-default-gateway'].includes(code)) stages.add('gateways');
    else if (code !== 'not-submitted') stages.add('routing');
  }
  if (stages.size === 0) stages.add('routing');
  return [...stages];
}

const REMEDIATION_ROUTES = {
  ipv4: 'ipv4-validity-1',
  subnets: 'subnet-range-1',
  local: 'neighbors-1',
  gateways: 'valid-gateway-2',
  routing: 'route-parts-1',
};

function resultSummary(i18n, result, index) {
  const codes = result.diagnosticCodes.length > 0 ? result.diagnosticCodes : ['not-submitted'];
  return element('article', {
    className: `exam-result-card${result.passed ? ' is-passed' : ''}`,
    'data-mission-result': String(index),
    'data-passed': String(result.passed),
  }, [
    element('header', {}, [
      element('span', { className: 'exam-mission-number' }, [i18n.t('exam.missionNumber', { number: index + 1 })]),
      element('strong', {}, [i18n.t(result.passed ? 'result.passed' : 'result.incomplete')]),
    ]),
    !result.passed && element('ul', { className: 'exam-diagnostics' }, codes.map((code) =>
      element('li', {}, [i18n.t(`exam.diagnostic.${code}`)]))),
    !result.passed && element('div', { className: 'exam-remediation' }, [
      element('span', {}, [i18n.t('exam.practiceAgain')]),
      ...remediationFor(codes).map((stage) => element('a', {
        href: `#/workshops/${REMEDIATION_ROUTES[stage]}`,
      }, [i18n.t(`course.${stage}.title`)])),
    ]),
  ]);
}

export function renderExam({ i18n, seed, clock = Date, onFinalize = () => {} }) {
  const root = element('article', {
    className: 'exam-view',
    'data-exam-seed': seed,
  });
  const state = createExamState({ seed, clock, onFinalize });
  const selectedDevices = state.missions.map((mission) => mission.devices[0]?.id ?? null);
  let topologyController = null;
  let timerText = null;
  let liveRegion = null;
  let interval = null;
  let destroyed = false;
  let renderedStatus = null;

  function renderNavigation(snapshot) {
    return element('nav', {
      className: 'exam-mission-nav',
      'aria-label': i18n.t('exam.missionNavigation'),
    }, state.missions.map((mission, index) => {
      const result = snapshot.results[index];
      const statusKey = result?.passed ? 'exam.statusPassed' : index === snapshot.index ? 'exam.statusActive' : 'exam.statusPending';
      const missionStatus = result?.passed ? 'passed' : index === snapshot.index ? 'active' : 'pending';
      return element('button', {
        className: 'exam-mission-tab',
        type: 'button',
        'aria-current': index === snapshot.index ? 'step' : null,
        'data-mission-status': missionStatus,
        'data-focus-key': `exam:mission:${index}`,
        disabled: snapshot.status !== 'running' || result?.passed === true,
        onClick: () => {
          if (!state.select(index)) return;
          render();
        },
      }, [
        element('span', {}, [i18n.t('exam.missionNumber', { number: index + 1 })]),
        element('small', {}, [i18n.t(statusKey)]),
      ]);
    }));
  }

  function renderRunning(snapshot) {
    const mission = state.missions[snapshot.index];
    topologyController = createTopology({
      i18n,
      devices: mission.devices,
      links: mission.links,
      selectedDeviceId: selectedDevices[snapshot.index],
      onSelect: (deviceId) => {
        selectedDevices[snapshot.index] = deviceId;
        render();
      },
    });
    const selectedDevice = mission.devices.find((device) => device.id === selectedDevices[snapshot.index]);
    const form = element('form', {
      className: 'exam-form workshop-form',
      onSubmit: (event) => {
        event.preventDefault();
        const current = state.snapshot();
        if (current.status !== 'running') {
          render();
          return;
        }
        const validation = validateSubmission(mission, current.submissions[current.index]);
        state.submit(current.index, validation);
        render();
      },
    }, [
      element('div', { className: 'workshop-form-heading' }, [
        element('p', { className: 'note-label' }, [i18n.t('course.objective')]),
        element('h2', {}, [i18n.t('exam.objective')]),
      ]),
      topologyController.element,
      renderDeviceConfig({
        i18n,
        device: selectedDevice,
        devices: mission.devices,
        links: mission.links,
        submission: snapshot.submissions[snapshot.index],
        onChange: (field, value) => state.update(field, value),
      }),
      element('div', { className: 'workshop-actions' }, [
        element('button', {
          className: 'button button-primary',
          type: 'submit',
          'data-focus-key': 'exam:submit',
        }, [i18n.t('action.submitMission')]),
      ]),
    ]);
    return form;
  }

  function renderResults(snapshot) {
    return element('section', { className: 'exam-results', 'aria-labelledby': 'exam-result-title' }, [
      element('p', { className: 'eyebrow' }, [i18n.t(snapshot.status === 'complete' ? 'exam.completed' : 'exam.expired')]),
      element('h2', {
        id: 'exam-result-title',
        tabindex: '-1',
        'data-focus-key': 'exam:result',
      }, [i18n.t('result.title')]),
      element('div', { className: 'exam-result-overview' }, [
        element('strong', {}, [i18n.t('result.score', {
          score: snapshot.results.filter((result) => result.passed).length,
          total: snapshot.results.length,
        })]),
        element('span', {}, [i18n.t('exam.elapsed', { time: formatTime(snapshot.elapsedSeconds) })]),
      ]),
      element('div', { className: 'exam-result-list' }, snapshot.results.map((result, index) =>
        resultSummary(i18n, result, index))),
      element('p', { className: 'exam-saved-note' }, [i18n.t('result.saved')]),
    ]);
  }

  function render() {
    if (destroyed) return;
    const previousStatus = renderedStatus;
    const focusSnapshot = captureFocus(root);
    topologyController?.destroy();
    topologyController = null;
    const snapshot = state.snapshot();
    root.dataset.examStatus = snapshot.status;
    root.dataset.activeMission = String(snapshot.index);
    renderedStatus = snapshot.status;
    timerText = element('strong', { className: 'exam-timer-value' }, [formatTime(snapshot.remainingSeconds)]);
    liveRegion = element('div', {
      className: 'visually-hidden',
      'aria-live': 'polite',
      'aria-atomic': 'true',
    }, snapshot.status === 'running' ? [] : [i18n.t('exam.resultAnnouncement')]);
    const header = element('header', { className: 'exam-header' }, [
      element('div', {}, [
        element('p', { className: 'eyebrow' }, [i18n.t('course.exam.eyebrow')]),
        element('h1', {}, [i18n.t('exam.title')]),
        element('p', {}, [i18n.t('exam.intro')]),
      ]),
      snapshot.status === 'running' && element('div', {
        className: 'exam-timer',
        role: 'timer',
        'aria-label': i18n.t('exam.timerLabel'),
      }, [
        element('span', {}, [i18n.t('exam.timeLabel')]),
        timerText,
      ]),
    ]);
    replace(root, [
      header,
      liveRegion,
      snapshot.status === 'running' && renderNavigation(snapshot),
      snapshot.status === 'running' ? renderRunning(snapshot) : renderResults(snapshot),
    ]);
    const finalizedNow = previousStatus === 'running' && snapshot.status !== 'running';
    if (finalizedNow) {
      root.querySelector('[data-focus-key="exam:result"]')?.focus({ preventScroll: true });
    } else {
      restoreFocus(root, focusSnapshot);
    }
    if (snapshot.status !== 'running' && interval !== null) {
      clearInterval(interval);
      interval = null;
    }
  }

  function tick() {
    if (destroyed) return;
    const snapshot = state.snapshot();
    const announcements = state.takeAnnouncements();
    if (announcements.length > 0 && liveRegion) {
      liveRegion.textContent = announcements.map((code) => i18n.t(`exam.announcement.${code}`)).join(' ');
    }
    if (snapshot.status !== renderedStatus) {
      render();
      return;
    }
    if (timerText) timerText.textContent = formatTime(snapshot.remainingSeconds);
  }

  const unsubscribe = i18n.subscribe(render);
  render();
  interval = setInterval(tick, 1_000);

  return {
    element: root,
    getState: () => state.snapshot(),
    destroy() {
      destroyed = true;
      unsubscribe();
      topologyController?.destroy();
      if (interval !== null) clearInterval(interval);
      root.remove();
    },
  };
}
