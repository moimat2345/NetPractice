import { curriculum, getWorkshopDefinition } from './content/curriculum.js';
import { completeWorkshop, recordExam, saveProgress } from './storage/progress.js';
import { renderHome } from './ui/home.js';
import { createShell } from './ui/shell.js';
import { renderExam } from './ui/exam.js';
import { renderWorkshop } from './ui/workshop.js';
import { completedWorkshopCount } from './ui/learning-progress.js';
import { createAttemptStore } from './storage/attempts.js';

const LEARNING_PATH = curriculum.map((stage) => ({
  id: stage.id,
  workshops: [...stage.workshops],
  titleKey: stage.titleKey,
  summaryKey: `path.${stage.id}.summary`,
}));
const WORKSHOP_ORDER = LEARNING_PATH.flatMap((stage) => stage.workshops);

function nextWorkshopTarget(workshopId) {
  const index = WORKSHOP_ORDER.indexOf(workshopId);
  if (index === -1) return null;
  if (index < WORKSHOP_ORDER.length - 1) {
    return {
      route: `/workshops/${WORKSHOP_ORDER[index + 1]}`,
      labelKey: 'action.nextWorkshop',
    };
  }
  return {
    route: `/exam?seed=mock-${Date.now().toString(36)}`,
    labelKey: 'action.startExam',
  };
}

function routeFromHash() {
  const route = globalThis.location?.hash?.replace(/^#/, '');
  return route || '/';
}

function workshopRoute(route) {
  const [path, query = ''] = route.split('?');
  const match = path.match(/^\/workshops\/([^/]+)$/);
  if (!match) return null;
  return {
    id: decodeURIComponent(match[1]),
    seed: new URLSearchParams(query).get('seed'),
  };
}

function examRoute(route) {
  const [path, query = ''] = route.split('?');
  if (path !== '/exam') return null;
  return { seed: new URLSearchParams(query).get('seed') || 'mock-exam' };
}

export function createApp(root, dependencies) {
  if (!(root instanceof Element)) throw new TypeError('An application root element is required');

  const { i18n, storage } = dependencies;
  let progress = dependencies.progress;
  const attempts = createAttemptStore(storage);
  const workshopSeeds = Object.fromEntries(WORKSHOP_ORDER.flatMap((id) => {
    const seed = progress.current?.workshops?.[id];
    return typeof seed === 'string' && seed.length <= 256 ? [[id, seed]] : [];
  }));
  let currentRoute = routeFromHash();
  let workshopController = null;
  let activeWorkshopKey = null;
  let examController = null;
  let activeExamKey = null;

  const progressView = new Proxy({}, {
    get(_target, property) {
      return progress[property];
    },
  });

  function navigate(route) {
    const nextHash = `#${route}`;
    if (globalThis.location.hash === nextHash) return;
    globalThis.location.hash = nextHash;
  }

  const shell = createShell({ i18n, progress: progressView, sections: LEARNING_PATH, onNavigate: navigate });
  root.replaceChildren(shell.element);

  function refreshShellProgress() {
    const complete = completedWorkshopCount(LEARNING_PATH, progress);
    const value = shell.element.querySelector('.progress-value');
    const meter = shell.element.querySelector('.progress-meter');
    if (value) value.textContent = `${complete} / ${WORKSHOP_ORDER.length}`;
    if (meter) {
      meter.value = complete;
      meter.setAttribute('aria-label', i18n.t('workspace.progress', {
        completed: complete,
        total: WORKSHOP_ORDER.length,
      }));
    }
    shell.renderNavigation();
  }

  function recordCompletion(result) {
    progress = completeWorkshop(progress, result.workshopId, {
      attempts: result.attempts,
      hints: result.hints,
      seed: result.seed,
    });
    saveProgress(storage, progress);
    refreshShellProgress();
  }

  function closeWorkshop() {
    workshopController?.destroy();
    workshopController = null;
    activeWorkshopKey = null;
  }

  function closeExam() {
    examController?.destroy();
    examController = null;
    activeExamKey = null;
  }

  function recordExamResult(result) {
    progress = recordExam(progress, result);
    saveProgress(storage, progress);
    refreshShellProgress();
  }

  function renderRoute() {
    currentRoute = routeFromHash();
    const requestedExam = examRoute(currentRoute);
    const requestedWorkshop = workshopRoute(currentRoute);
    const definition = requestedWorkshop ? getWorkshopDefinition(requestedWorkshop.id) : null;
    shell.setView(definition || requestedExam ? 'workshop' : 'home');
    shell.setActiveStage(definition?.stageId ?? (requestedExam ? 'exam' : null), definition?.id ?? null);

    if (requestedExam) {
      closeWorkshop();
      if (examController && activeExamKey === requestedExam.seed) return;
      closeExam();
      const attemptKey = `exam:${requestedExam.seed}`;
      progress = { ...progress, current: { kind: 'exam', seed: requestedExam.seed, workshops: workshopSeeds } };
      saveProgress(storage, progress);
      examController = renderExam({ i18n, seed: requestedExam.seed, onFinalize: recordExamResult,
        savedAttempt: attempts.get(attemptKey), onSave: (snapshot) => attempts.set(attemptKey, snapshot), onNavigate: navigate });
      activeExamKey = requestedExam.seed;
      shell.outlet.replaceChildren(examController.element);
      return;
    }

    if (definition) {
      closeExam();
      const effectiveSeed = requestedWorkshop.seed || workshopSeeds[definition.id] || `${definition.id}-practice`;
      const workshopKey = `${definition.id}\u0000${effectiveSeed}`;
      if (workshopController && activeWorkshopKey === workshopKey) return;
      closeWorkshop();
      const nextTarget = nextWorkshopTarget(definition.id);
      const previousId = WORKSHOP_ORDER[WORKSHOP_ORDER.indexOf(definition.id) - 1];
      const attemptKey = `workshop:${definition.id}:${effectiveSeed}`;
      workshopSeeds[definition.id] = effectiveSeed;
      progress = { ...progress, current: { kind: 'workshop', id: definition.id, seed: effectiveSeed, workshops: workshopSeeds } };
      saveProgress(storage, progress);
      workshopController = renderWorkshop({
        i18n,
        definition,
        seed: effectiveSeed,
        onComplete: recordCompletion,
        onNavigate: navigate,
        nextTarget,
        previousTarget: previousId ? { route: `/workshops/${previousId}` } : null,
        savedAttempt: attempts.get(attemptKey),
        onSave: (snapshot) => attempts.set(attemptKey, snapshot),
      });
      activeWorkshopKey = workshopKey;
      shell.outlet.replaceChildren(workshopController.element);
      return;
    }

    closeWorkshop();
    closeExam();
    shell.outlet.replaceChildren(renderHome({
      i18n,
      progress,
      sections: LEARNING_PATH,
      onNavigate: navigate,
    }));
  }

  function onHashChange() {
    renderRoute();
    globalThis.scrollTo?.(0, 0);
    shell.outlet.focus({ preventScroll: true });
  }

  const unsubscribeLocale = i18n.subscribe((locale) => {
    progress = { ...progress, locale };
    saveProgress(storage, progress);
    refreshShellProgress();
    renderRoute();
  });
  globalThis.addEventListener('hashchange', onHashChange);
  document.documentElement.lang = i18n.locale;
  renderRoute();

  return {
    navigate,
    get route() {
      return currentRoute;
    },
    getProgress() {
      return progress;
    },
    destroy() {
      unsubscribeLocale();
      globalThis.removeEventListener('hashchange', onHashChange);
      closeWorkshop();
      closeExam();
      shell.destroy();
      root.replaceChildren();
    },
  };
}
