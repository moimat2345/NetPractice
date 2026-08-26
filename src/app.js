import { curriculum, getWorkshopDefinition } from './content/curriculum.js';
import { completeWorkshop, saveProgress } from './storage/progress.js';
import { renderHome } from './ui/home.js';
import { createShell } from './ui/shell.js';
import { renderWorkshop } from './ui/workshop.js';

const stageEntryWorkshops = {
  ipv4: 'ipv4-validity-1',
  subnets: 'subnet-range-1',
  local: 'neighbors-1',
  gateways: 'valid-gateway-2',
  routing: 'route-parts-1',
  exam: 'guided-mission-1',
};

const LEARNING_PATH = curriculum.map((stage) => ({
  id: stage.id,
  workshopId: stageEntryWorkshops[stage.id] ?? stage.workshops[0],
  titleKey: stage.titleKey,
  summaryKey: `path.${stage.id}.summary`,
}));

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

export function createApp(root, dependencies) {
  if (!(root instanceof Element)) throw new TypeError('An application root element is required');

  const { i18n, storage } = dependencies;
  let progress = dependencies.progress;
  let currentRoute = routeFromHash();
  let workshopController = null;
  let activeWorkshopId = null;

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
    const complete = LEARNING_PATH.filter((section) => Boolean(progress.completed?.[section.workshopId])).length;
    const value = shell.element.querySelector('.progress-value');
    const meter = shell.element.querySelector('.progress-meter');
    if (value) value.textContent = `${complete} / ${LEARNING_PATH.length}`;
    if (meter) {
      meter.value = complete;
      meter.setAttribute('aria-label', i18n.t('progress.summary', {
        completed: complete,
        total: LEARNING_PATH.length,
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
    activeWorkshopId = null;
  }

  function renderRoute() {
    currentRoute = routeFromHash();
    const requestedWorkshop = workshopRoute(currentRoute);
    const definition = requestedWorkshop ? getWorkshopDefinition(requestedWorkshop.id) : null;
    shell.setView(definition ? 'workshop' : 'home');

    if (definition) {
      if (workshopController && activeWorkshopId === definition.id) return;
      closeWorkshop();
      workshopController = renderWorkshop({
        i18n,
        definition,
        seed: requestedWorkshop.seed || `${definition.id}-practice`,
        onComplete: recordCompletion,
      });
      activeWorkshopId = definition.id;
      shell.outlet.replaceChildren(workshopController.element);
      return;
    }

    closeWorkshop();
    shell.outlet.replaceChildren(renderHome({
      i18n,
      progress,
      sections: LEARNING_PATH,
      onNavigate: navigate,
    }));
  }

  function onHashChange() {
    renderRoute();
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
      shell.destroy();
      root.replaceChildren();
    },
  };
}
