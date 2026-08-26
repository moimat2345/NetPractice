import { element } from './dom.js';

let examAttemptCounter = 0;

function createExamAttemptSeed() {
  examAttemptCounter += 1;
  return `mock-${Date.now().toString(36)}-${examAttemptCounter.toString(36)}`;
}

function isComplete(progress, workshopId) {
  return Boolean(progress?.completed?.[workshopId]);
}

function routeLink(label, route, className, onNavigate) {
  return element('a', {
    className,
    href: `#${route}`,
    onClick: (event) => {
      event.preventDefault();
      onNavigate(route);
    },
  }, [label]);
}

export function renderHome({ i18n, progress, sections = [], onNavigate = () => {} }) {
  const firstPending = sections.find((section) => !isComplete(progress, section.workshopId)) ?? sections[0];
  const examAttemptSeed = createExamAttemptSeed();
  const home = element('div', { className: 'home-view' });
  const heroCopy = element('div', { className: 'hero-copy' }, [
    element('p', { className: 'eyebrow' }, [i18n.t('course.eyebrow')]),
    element('h1', { id: 'home-title' }, [i18n.t('course.title')]),
    element('p', { className: 'hero-intro' }, [i18n.t('course.intro')]),
    firstPending && routeLink(
      i18n.t('home.startFirst'),
      `/workshops/${firstPending.workshopId}`,
      'button button-primary',
      onNavigate,
    ),
  ]);
  const methodList = element('ol', { className: 'packet-method' });
  ['local', 'gateway', 'route', 'return'].forEach((step, index) => {
    methodList.append(element('li', {}, [
      element('span', { className: 'method-index', 'aria-hidden': 'true' }, [String(index + 1)]),
      element('span', {}, [i18n.t(`home.method.${step}`)]),
    ]));
  });
  const methodNote = element('aside', { className: 'method-note', 'aria-labelledby': 'method-title' }, [
    element('p', { className: 'note-label' }, [i18n.t('home.method.label')]),
    element('h2', { id: 'method-title' }, [i18n.t('home.method.title')]),
    methodList,
  ]);
  const hero = element('section', { className: 'home-hero', 'aria-labelledby': 'home-title' }, [heroCopy, methodNote]);

  const ledger = element('ol', { className: 'learning-ledger' });
  const firstPendingIndex = sections.findIndex((section) => !isComplete(progress, section.workshopId));
  sections.forEach((section, index) => {
    const complete = isComplete(progress, section.workshopId);
    const current = !complete && index === (firstPendingIndex === -1 ? 0 : firstPendingIndex);
    const stateKey = complete ? 'course.completed' : current ? 'course.next' : 'course.locked';
    ledger.append(element('li', { className: `ledger-row${current ? ' is-current' : ''}${complete ? ' is-complete' : ''}` }, [
      element('span', { className: 'ledger-index', 'aria-hidden': 'true' }, [String(index + 1).padStart(2, '0')]),
      element('div', { className: 'ledger-copy' }, [
        element('p', { className: 'ledger-status' }, [i18n.t(stateKey)]),
        element('h3', {}, [i18n.t(section.titleKey)]),
        element('p', {}, [i18n.t(section.summaryKey)]),
      ]),
      element('div', { className: 'ledger-actions' }, [
        routeLink(
          i18n.t(current ? 'action.continue' : 'home.openStage'),
          `/workshops/${section.workshopId}`,
          'ledger-link',
          onNavigate,
        ),
        section.id === 'exam' && routeLink(
          i18n.t('action.startExam'),
          `/exam?seed=${encodeURIComponent(examAttemptSeed)}`,
          'ledger-link ledger-exam-link',
          onNavigate,
        ),
      ]),
    ]));
  });

  const path = element('section', { className: 'path-section', 'aria-labelledby': 'path-title' }, [
    element('div', { className: 'section-heading' }, [
      element('p', { className: 'eyebrow' }, [i18n.t('home.pathLabel')]),
      element('h2', { id: 'path-title' }, [i18n.t('home.pathTitle')]),
      element('p', {}, [i18n.t('home.pathIntro')]),
    ]),
    ledger,
  ]);

  home.append(hero, path);
  return home;
}
