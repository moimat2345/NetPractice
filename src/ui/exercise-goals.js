import { element } from './dom.js';
import { deviceLabel } from './exercise-labels.js';

export function renderExerciseGoals(i18n, exercise) {
  const goals = exercise.goals ?? [];
  if (!goals.length) return null;
  return element('div', { className: 'exercise-goals', 'data-exercise-goals': '' }, [
    element('p', { className: 'note-label' }, [i18n.t('workspace.goals')]),
    element('ul', {}, goals.map((goal) => element('li', {}, [i18n.t('workspace.connection', {
      source: deviceLabel(i18n, exercise.devices.find((device) => device.id === goal.sourceId)),
      target: deviceLabel(i18n, exercise.devices.find((device) => device.id === goal.destinationId)),
    })]))),
  ]);
}
