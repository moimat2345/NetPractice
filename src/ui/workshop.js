import { formatIPv4 } from '../core/ipv4.js';
import { generateFocusedExercise, generateMission } from '../exercises/generators.js';
import { getHint } from '../exercises/hints.js';
import { validateSubmission } from '../exercises/validators.js';
import { element, replace } from './dom.js';
import { renderCorrection, renderDiagnostic, renderHint } from './feedback.js';

function makeExercise(definition, seed) {
  if (definition.concept === 'routing-mission') {
    return generateMission({ seed, difficulty: definition.difficulty });
  }
  return generateFocusedExercise({ seed, concept: definition.concept, difficulty: definition.difficulty });
}

function fieldLabelKey(field, meta) {
  const role = meta?.role;
  const keys = {
    network: 'field.network',
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
  const networkInterface = exercise.devices
    .flatMap((device) => device.interfaces)
    .find((entry) => Number.isInteger(entry.address) && Number.isInteger(entry.prefix));
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

export function renderWorkshop({ i18n, definition, seed, onComplete = () => {} }) {
  if (!definition) throw new TypeError('A workshop definition is required');
  const root = element('article', { className: 'workshop-view' });
  let variation = 0;
  let exercise = makeExercise(definition, String(seed));
  let recordedSeed = null;
  const state = {
    phase: 'ready',
    hintLevel: 0,
    attempts: 0,
    seed: exercise.seed,
    submission: { ...exercise.initial },
    validation: null,
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
    render();
    root.querySelector('input')?.focus({ preventScroll: true });
  }

  function renderFields() {
    const fields = element('div', { className: 'workshop-fields' });
    exercise.editableFields.forEach((field, index) => {
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
    return fields;
  }

  function render() {
    root.dataset.exerciseSeed = state.seed;
    root.dataset.workshopPhase = state.phase;
    const hint = state.hintLevel > 0 ? getHint(exercise, state.validation, state.hintLevel) : null;
    const lesson = element('section', { className: 'workshop-lesson', 'aria-labelledby': 'workshop-title' }, [
      element('div', {}, [
        element('p', { className: 'eyebrow' }, [i18n.t(`course.${definition.stageId}.eyebrow`)]),
        element('h1', { id: 'workshop-title' }, [i18n.t(definition.titleKey)]),
        element('p', { className: 'workshop-intro' }, [i18n.t(`course.${definition.stageId}.lesson`)]),
      ]),
      element('aside', { className: 'exercise-note' }, [
        element('span', {}, [i18n.t('course.practice')]),
        element('strong', {}, [i18n.t('workshop.clue', { value: exerciseClue(exercise) })]),
        element('small', {}, [i18n.t('workshop.seed', { seed: state.seed })]),
      ]),
    ]);
    const form = element('form', {
      className: 'workshop-form',
      onSubmit: (event) => {
        event.preventDefault();
        check();
      },
    }, [
      element('div', { className: 'workshop-form-heading' }, [
        element('p', { className: 'note-label' }, [i18n.t('course.objective')]),
        element('h2', {}, [i18n.t(`course.${definition.stageId}.objective`)]),
      ]),
      renderFields(),
      element('div', { className: 'workshop-actions' }, [
        element('button', { className: 'button button-primary', type: 'submit' }, [i18n.t('action.check')]),
        state.hintLevel < 3 && element('button', {
          className: 'button button-secondary',
          type: 'button',
          onClick: revealHint,
        }, [i18n.t('action.hint', { level: state.hintLevel + 1 })]),
        state.validation && !state.validation.ok && element('button', {
          className: 'button button-text',
          type: 'button',
          onClick: toggleCorrection,
        }, [i18n.t(state.phase === 'correction' ? 'action.hideSolution' : 'action.showSolution')]),
        state.attempts > 0 && element('button', {
          className: 'button button-secondary',
          type: 'button',
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
      root.remove();
    },
  };
}
