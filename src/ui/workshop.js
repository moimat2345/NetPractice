import { formatIPv4 } from '../core/ipv4.js';
import { lessonsEn } from '../content/lessons.en.js';
import { lessonsFr } from '../content/lessons.fr.js';
import { getWorkshopGenerator } from '../exercises/generators.js';
import { getHint } from '../exercises/hints.js';
import { validateSubmission } from '../exercises/validators.js';
import { renderDeviceConfig } from './device-config.js';
import { element, replace } from './dom.js';
import { renderCorrection, renderDiagnostic, renderHint } from './feedback.js';
import { createTopology } from './topology.js';

function makeExercise(definition, seed) {
  const generate = getWorkshopGenerator(definition.id);
  if (!generate) throw new RangeError(`No generator for workshop: ${definition.id}`);
  return generate({ seed });
}

function workshopLesson(locale, workshopId) {
  const lessons = locale === 'en' ? lessonsEn : lessonsFr;
  const lesson = lessons[workshopId];
  if (!lesson) throw new RangeError(`No ${locale} lesson for workshop: ${workshopId}`);
  return lesson;
}

function fieldLabelKey(field, meta) {
  const role = meta?.role;
  const keys = {
    network: 'field.network',
    'direct-network': 'field.network',
    broadcast: 'field.broadcast',
    'first-host': 'field.firstHost',
    'last-host': 'field.lastHost',
    gateway: 'field.gateway',
    mask: 'field.prefix',
    'route-prefix': 'field.prefix',
    'route-destination': 'field.destination',
  };
  if (keys[role]) return keys[role];
  if (field.endsWith('.prefix')) return 'field.prefix';
  if (field.endsWith('.gateway')) return 'field.gateway';
  if (field.endsWith('.destination')) return 'field.destination';
  return 'field.address';
}

function exerciseClue(exercise) {
  if (typeof exercise.facts?.clue === 'string') return exercise.facts.clue;
  const networkInterface = exercise.devices
    .flatMap((device) => device.interfaces)
    .find((entry) => Number.isInteger(entry.address)
      && Number.isInteger(entry.prefix)
      && !entry.editable.address
      && !entry.editable.prefix);
  if (!networkInterface) return '—';
  return `${formatIPv4(networkInterface.address)}/${networkInterface.prefix}`;
}

function copyState(state) {
  return {
    ...state,
    submission: { ...state.submission },
    validation: state.validation ? structuredClone(state.validation) : null,
  };
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
  if (!snapshot) return;
  const target = [...root.querySelectorAll('[data-focus-key]')]
    .find((node) => node.dataset.focusKey === snapshot.key);
  if (!(target instanceof HTMLElement)) return;
  target.focus({ preventScroll: true });
  if (target instanceof HTMLInputElement && snapshot.selection) {
    try {
      target.setSelectionRange(
        snapshot.selection.start,
        snapshot.selection.end,
        snapshot.selection.direction,
      );
    } catch {
      // Some input types do not expose a text selection. Focus restoration
      // still remains useful for those controls.
    }
  }
}

export function renderWorkshop({ i18n, definition, seed, onComplete = () => {} }) {
  if (!definition) throw new TypeError('A workshop definition is required');
  const root = element('article', { className: 'workshop-view', 'data-workshop': definition.id });
  let variation = 0;
  let exercise = makeExercise(definition, String(seed));
  let recordedSeed = null;
  let topologyController = null;
  const state = {
    phase: 'ready',
    hintLevel: 0,
    attempts: 0,
    seed: exercise.seed,
    submission: { ...exercise.initial },
    validation: null,
    selectedDeviceId: exercise.devices[0]?.id ?? null,
  };

  function check() {
    state.attempts += 1;
    state.validation = validateSubmission(exercise, state.submission);
    state.phase = state.validation.ok ? 'correct' : 'incorrect';
    if (state.validation.ok && recordedSeed !== state.seed) {
      recordedSeed = state.seed;
      onComplete({
        workshopId: definition.id,
        attempts: state.attempts,
        hints: state.hintLevel,
        seed: state.seed,
      });
    }
    render();
  }

  function revealHint() {
    state.hintLevel = Math.min(3, state.hintLevel + 1);
    render();
  }

  function toggleCorrection() {
    state.phase = state.phase === 'correction' ? 'incorrect' : 'correction';
    render();
  }

  function newExercise() {
    variation += 1;
    exercise = makeExercise(definition, `${seed}-next-${variation}`);
    state.phase = 'ready';
    state.hintLevel = 0;
    state.attempts = 0;
    state.seed = exercise.seed;
    state.submission = { ...exercise.initial };
    state.validation = null;
    state.selectedDeviceId = exercise.devices[0]?.id ?? null;
    render();
    root.querySelector('input')?.focus({ preventScroll: true });
  }

  function renderFields() {
    const fields = element('div', { className: 'workshop-fields' });
    exercise.editableFields
      .filter((field) => !exercise.fieldMeta?.[field]?.deviceId)
      .forEach((field, index) => {
        const labelKey = fieldLabelKey(field, exercise.fieldMeta?.[field]);
        const inputId = `workshop-field-${index}`;
        const input = element('input', {
          id: inputId,
          name: field,
          type: 'text',
          value: state.submission[field] ?? '',
          autocomplete: 'off',
          spellcheck: 'false',
          'aria-describedby': `${inputId}-note`,
          'data-focus-key': `field:${field}`,
          onInput: (event) => {
            state.submission[field] = event.currentTarget.value;
          },
        });
        fields.append(element('div', { className: 'workshop-field' }, [
          element('label', { for: inputId }, [i18n.t(labelKey)]),
          input,
          element('small', { id: `${inputId}-note` }, [i18n.t('workshop.editable')]),
        ]));
      });
    return fields.childElementCount > 0 ? fields : null;
  }

  function render() {
    const focusSnapshot = captureFocus(root);
    topologyController?.destroy();
    root.dataset.exerciseSeed = state.seed;
    root.dataset.workshopPhase = state.phase;
    const hint = state.hintLevel > 0 ? getHint(exercise, state.validation, state.hintLevel) : null;
    const lessonContent = workshopLesson(i18n.locale, definition.id);
    const lesson = element('section', {
      className: 'workshop-lesson',
      'aria-labelledby': 'workshop-title',
      'data-workshop-lesson': definition.id,
    }, [
      element('div', {}, [
        element('p', { className: 'eyebrow' }, [i18n.t(`course.${definition.stageId}.eyebrow`)]),
        element('h1', { id: 'workshop-title' }, [lessonContent.title]),
        element('p', { className: 'workshop-intro', 'data-micro-lesson': '' }, [lessonContent.microLesson]),
        element('p', { className: 'note-label' }, [i18n.t('course.method')]),
        element('ol', { className: 'workshop-method' }, lessonContent.methodSteps.map((step) =>
          element('li', {}, [step]))),
        element('p', { className: 'workshop-readiness' }, [lessonContent.readinessLabel]),
      ]),
      element('aside', { className: 'exercise-note' }, [
        element('span', {}, [i18n.t('course.practice')]),
        element('strong', {}, [i18n.t('workshop.clue', { value: exerciseClue(exercise) })]),
        element('small', {}, [i18n.t('workshop.seed', { seed: state.seed })]),
      ]),
    ]);
    topologyController = createTopology({
      i18n,
      devices: exercise.devices,
      links: exercise.links,
      selectedDeviceId: state.selectedDeviceId,
      onSelect: (deviceId) => {
        state.selectedDeviceId = deviceId;
        render();
      },
    });
    const selectedDevice = exercise.devices.find((device) => device.id === state.selectedDeviceId);
    const form = element('form', {
      className: 'workshop-form',
      onSubmit: (event) => {
        event.preventDefault();
        check();
      },
    }, [
      element('div', { className: 'workshop-form-heading' }, [
        element('p', { className: 'note-label' }, [i18n.t('course.objective')]),
        element('h2', {}, [lessonContent.objective]),
      ]),
      topologyController.element,
      renderDeviceConfig({
        i18n,
        device: selectedDevice,
        devices: exercise.devices,
        links: exercise.links,
        submission: state.submission,
        onChange: (field, value) => {
          state.submission[field] = value;
        },
      }),
      renderFields(),
      element('div', { className: 'workshop-actions' }, [
        element('button', {
          className: 'button button-primary',
          type: 'submit',
          'data-focus-key': 'action:check',
        }, [i18n.t('action.check')]),
        state.hintLevel < 3 && element('button', {
          className: 'button button-secondary',
          type: 'button',
          'data-focus-key': 'action:hint',
          onClick: revealHint,
        }, [i18n.t('action.hint', { level: state.hintLevel + 1 })]),
        state.validation && !state.validation.ok && element('button', {
          className: 'button button-text',
          type: 'button',
          'data-focus-key': 'action:correction',
          onClick: toggleCorrection,
        }, [i18n.t(state.phase === 'correction' ? 'action.hideSolution' : 'action.showSolution')]),
        state.attempts > 0 && element('button', {
          className: 'button button-secondary',
          type: 'button',
          'data-focus-key': 'action:new-exercise',
          onClick: newExercise,
        }, [i18n.t('action.newExercise')]),
      ]),
    ]);
    const feedback = element('div', { className: 'workshop-feedback' }, [
      state.validation && !state.validation.ok && renderDiagnostic(i18n, state.validation),
      renderHint(i18n, state.hintLevel, hint),
      state.phase === 'correct' && element('div', { className: 'feedback feedback-success', role: 'status' }, [
        element('strong', {}, [i18n.t('feedback.correct')]),
        element('p', {}, [i18n.t('result.saved')]),
      ]),
    ]);

    replace(root, [lesson, form, feedback, state.phase === 'correction' && renderCorrection(i18n, exercise)]);
    restoreFocus(root, focusSnapshot);
  }

  const unsubscribe = i18n.subscribe(render);
  render();

  return {
    element: root,
    getState() {
      return copyState(state);
    },
    destroy() {
      unsubscribe();
      topologyController?.destroy();
      root.remove();
    },
  };
}
