import { saveProgress } from './storage/progress.js';
import { renderHome } from './ui/home.js';
import { createShell } from './ui/shell.js';

const LEARNING_PATH = [
  { id: 'ipv4', workshopId: 'ipv4-validity-1', titleKey: 'path.ipv4.title', summaryKey: 'path.ipv4.summary' },
  { id: 'subnets', workshopId: 'subnet-range-1', titleKey: 'path.subnets.title', summaryKey: 'path.subnets.summary' },
  { id: 'local', workshopId: 'neighbors-1', titleKey: 'path.local.title', summaryKey: 'path.local.summary' },
  { id: 'gateways', workshopId: 'valid-gateway-2', titleKey: 'path.gateways.title', summaryKey: 'path.gateways.summary' },
  { id: 'routing', workshopId: 'route-parts-1', titleKey: 'path.routing.title', summaryKey: 'path.routing.summary' },
  { id: 'exam', workshopId: 'guided-mission-1', titleKey: 'path.exam.title', summaryKey: 'path.exam.summary' },
];

function routeFromHash() {
  const route = globalThis.location?.hash?.replace(/^#/, '');
  return route || '/';
}

export function createApp(root, dependencies) {
  if (!(root instanceof Element)) throw new TypeError('An application root element is required');

  const { i18n, storage } = dependencies;
  const progress = dependencies.progress;
  let currentRoute = routeFromHash();

  function navigate(route) {
    const nextHash = `#${route}`;
    if (globalThis.location.hash === nextHash) return;
    globalThis.location.hash = nextHash;
  }

  const shell = createShell({ i18n, progress, sections: LEARNING_PATH, onNavigate: navigate });
  root.replaceChildren(shell.element);

  function renderRoute() {
    currentRoute = routeFromHash();
    const workshopView = currentRoute.startsWith('/workshops/');
    shell.setView(workshopView ? 'workshop' : 'home');
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
    progress.locale = locale;
    saveProgress(storage, progress);
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
      shell.destroy();
      root.replaceChildren();
    },
  };
}
