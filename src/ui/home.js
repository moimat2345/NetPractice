import { element } from './dom.js';
import { lessonsEn } from '../content/lessons.en.js';
import { lessonsFr } from '../content/lessons.fr.js';
import {
  nextWorkshopId,
  nextWorkshopInSection,
  sectionCompleted,
  sectionStarted,
} from './learning-progress.js';

let examAttemptCounter = 0;

function createExamAttemptSeed() {
  examAttemptCounter += 1;
  return `mock-${Date.now().toString(36)}-${examAttemptCounter.toString(36)}`;
}

function routeLink(label, route, className, onNavigate, attributes = {}) {
  return element('a', {
    className,
    href: `#${route}`,
    ...attributes,
    onClick: (event) => {
      event.preventDefault();
      onNavigate(route);
    },
  }, [label]);
}

export function renderHome({ i18n, progress, sections = [], onNavigate = () => {} }) {
  const examAttemptSeed = createExamAttemptSeed();
  const nextWorkshop = nextWorkshopId(sections, progress);
  const pathStarted = sections.some((section) => sectionStarted(section, progress));
  const current = progress.current;
  const resumeRoute = current?.kind === 'exam' && !progress.exams.some((exam) => exam.seed === current.seed)
    ? `/exam?seed=${encodeURIComponent(current.seed)}`
    : current?.kind === 'workshop' && sections.some((section) => section.workshops.includes(current.id)) && !progress.completed[current.id]
      ? `/workshops/${current.id}?seed=${encodeURIComponent(current.seed)}` : null;
  const heroLabel = resumeRoute ? i18n.t('workspace.resume') : nextWorkshop
    ? i18n.t(pathStarted ? 'action.continue' : 'home.startFirst')
    : i18n.t('action.startExam');
  const heroRoute = resumeRoute ?? (nextWorkshop
    ? `/workshops/${nextWorkshop}`
    : `/exam?seed=${encodeURIComponent(examAttemptSeed)}`);
  const home = element('div', { className: 'home-view' });
  const heroCopy = element('div', { className: 'hero-copy' }, [
    element('p', { className: 'eyebrow' }, [i18n.t('course.eyebrow')]),
    element('h1', { id: 'home-title' }, [i18n.t('course.title')]),
    element('p', { className: 'hero-intro' }, [i18n.t('course.intro')]),
    routeLink(
      heroLabel,
      heroRoute,
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
  const lessons = i18n.locale === 'en' ? lessonsEn : lessonsFr;
  const firstPendingIndex = sections.findIndex((section) => !sectionCompleted(section, progress));
  sections.forEach((section, index) => {
    const complete = sectionCompleted(section, progress);
    const started = sectionStarted(section, progress);
    const current = !complete && index === (firstPendingIndex === -1 ? 0 : firstPendingIndex);
    const stateKey = complete
      ? 'course.completed'
      : started ? 'course.inProgress' : current ? 'course.next' : 'course.locked';
    const targetWorkshop = nextWorkshopInSection(section, progress) ?? section.workshops[0];
    ledger.append(element('li', { className: `ledger-row${current ? ' is-current' : ''}${complete ? ' is-complete' : ''}${started && !complete ? ' is-started' : ''}` }, [
      element('span', { className: 'ledger-index', 'aria-hidden': 'true' }, [String(index + 1).padStart(2, '0')]),
      element('div', { className: 'ledger-copy' }, [
        element('p', { className: 'ledger-status' }, [i18n.t(stateKey)]),
        element('h3', {}, [i18n.t(section.titleKey)]),
        element('p', {}, [i18n.t(section.summaryKey)]),
        element('ol', { className: 'workshop-index' }, section.workshops.map((workshopId, workshopIndex) =>
          element('li', {}, [routeLink(
            `${workshopIndex + 1}. ${lessons[workshopId].title}`,
            `/workshops/${workshopId}`,
            'workshop-index-link',
            onNavigate,
            { 'data-workshop-link': workshopId },
          )]))),
      ]),
      element('div', { className: 'ledger-actions' }, [
        routeLink(
          i18n.t((current || started) && !complete ? 'action.continue' : 'home.openStage'),
          `/workshops/${targetWorkshop}`,
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

  const workshopDirectory = element('nav', { 'aria-label': i18n.t('home.workshopDirectory') }, [ledger]);
  const path = element('section', { className: 'path-section', 'aria-labelledby': 'path-title' }, [
    element('div', { className: 'section-heading' }, [
      element('p', { className: 'eyebrow' }, [i18n.t('home.pathLabel')]),
      element('h2', { id: 'path-title' }, [i18n.t('home.pathTitle')]),
      element('p', {}, [i18n.t('home.pathIntro')]),
    ]),
    workshopDirectory,
  ]);

  home.append(hero, path);
  return home;
}
