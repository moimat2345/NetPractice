import { element, replace } from './dom.js';
import { lessonsFr } from '../content/lessons.fr.js';
import { lessonsEn } from '../content/lessons.en.js';
import {
  completedWorkshopCount,
  nextWorkshopInSection,
  sectionCompleted,
  sectionStarted,
} from './learning-progress.js';

export function createShell({ i18n, progress, sections = [], onNavigate = () => {} }) {
  let activeStageId = null;
  let activeWorkshopId = null;
  const totalWorkshops = sections.flatMap((section) => section.workshops).length;
  const skipLink = document.querySelector('.skip-link');
  const frame = element('div', { className: 'app-frame', 'data-view': 'home' });
  const wordmark = element('a', {
    className: 'wordmark',
    href: '#/',
    onClick: (event) => {
      event.preventDefault();
      onNavigate('/');
    },
  });
  const progressLabel = element('span', { className: 'progress-copy' });
  const progressValue = element('strong', { className: 'progress-value' });
  const progressMeter = element('progress', {
    className: 'progress-meter',
    max: totalWorkshops,
    value: completedWorkshopCount(sections, progress),
  });
  const progressBlock = element('div', { className: 'header-progress' }, [
    element('span', { className: 'status-mark', 'aria-hidden': 'true' }),
    element('span', { className: 'progress-text' }, [progressLabel, progressValue]),
    progressMeter,
  ]);
  const languageGroup = element('div', { className: 'language-toggle', role: 'group' });
  const frenchButton = element('button', {
    className: 'language-option',
    type: 'button',
    onClick: () => i18n.setLocale('fr'),
  });
  const divider = element('span', { className: 'language-divider', 'aria-hidden': 'true' }, ['|']);
  const englishButton = element('button', {
    className: 'language-option',
    type: 'button',
    onClick: () => i18n.setLocale('en'),
  });
  languageGroup.append(frenchButton, divider, englishButton);

  const banner = element('header', { className: 'site-header' }, [
    element('div', { className: 'header-inner' }, [wordmark, progressBlock, languageGroup]),
  ]);
  const navigation = element('nav', { className: 'curriculum-nav' });
  const mobileNavigation = element('details', { className: 'mobile-curriculum' });
  const sidebar = element('aside', { className: 'curriculum-sidebar' }, [navigation]);
  const outlet = element('main', { className: 'route-outlet', id: 'main-content', tabindex: '-1' });
  const focusOutlet = (event) => {
    event.preventDefault();
    outlet.focus({ preventScroll: true });
    outlet.scrollIntoView({ block: 'start' });
  };
  skipLink?.addEventListener('click', focusOutlet);
  const footerNote = element('p');
  const footerDescription = element('p');
  const footer = element('footer', { className: 'site-footer' }, [
    element('div', { className: 'footer-inner' }, [footerNote, footerDescription]),
  ]);

  frame.append(banner, element('div', { className: 'app-body' }, [sidebar, element('div', { className: 'content-column' }, [mobileNavigation, outlet])]), footer);

  function renderNavigation() {
    navigation.setAttribute('aria-label', i18n.t('nav.curriculum'));
    const heading = element('p', { className: 'sidebar-heading' }, [i18n.t('nav.curriculum')]);
    const list = element('ol', { className: 'curriculum-list' });
    const firstPending = sections.findIndex((section) => !sectionCompleted(section, progress));

    sections.forEach((section, index) => {
      const complete = sectionCompleted(section, progress);
      const started = sectionStarted(section, progress);
      const current = section.id === activeStageId;
      const next = !complete && index === (firstPending === -1 ? 0 : firstPending);
      const stateKey = complete
        ? 'course.completed'
        : started ? 'course.inProgress' : next ? 'course.next' : 'course.locked';
      const targetWorkshop = nextWorkshopInSection(section, progress) ?? section.workshops[0];
      const link = element('a', {
        className: `curriculum-link${current ? ' is-current' : ''}${complete ? ' is-complete' : ''}${started && !complete ? ' is-started' : ''}`,
        'data-stage-id': section.id,
        'aria-current': current ? 'step' : null,
        href: `#/workshops/${targetWorkshop}`,
        onClick: (event) => {
          event.preventDefault();
          onNavigate(`/workshops/${targetWorkshop}`);
        },
      }, [
        element('span', { className: 'curriculum-index', 'aria-hidden': 'true' }, [String(index + 1).padStart(2, '0')]),
        element('span', { className: 'curriculum-copy' }, [
          element('strong', {}, [i18n.t(section.titleKey)]),
          element('small', {}, [i18n.t(stateKey) + ' · ' + i18n.t('workspace.chapterProgress', { completed: completedWorkshopCount([section], progress), total: section.workshops.length })]),
        ]),
        element('span', { className: 'curriculum-state', 'aria-hidden': 'true' }, [complete ? '✓' : current ? '→' : '·']),
      ]);
      list.append(element('li', {}, [link, current && workshopList(section)]));
    });

    replace(navigation, [heading, list]);
    replace(mobileNavigation, [element('summary', {}, [i18n.t('workspace.menu')]),
      element('nav', { 'aria-label': i18n.t('workspace.menu') }, sections.map((section) =>
        element('section', {}, [element('p', { className: 'note-label' }, [i18n.t(section.titleKey)]), workshopList(section)]))),
    ]);
  }

  function workshopList(section) {
    const lessons = i18n.locale === 'fr' ? lessonsFr : lessonsEn;
    return element('ol', { className: 'curriculum-workshops' }, section.workshops.map((id) => element('li', {}, [
      element('a', { href: `#/workshops/${id}`, 'data-curriculum-workshop': id, 'aria-current': activeWorkshopId === id ? 'page' : null,
        onClick: (event) => { event.preventDefault(); mobileNavigation.open = false; onNavigate(`/workshops/${id}`); } }, [
        lessons[id].title, progress.completed?.[id] && element('span', { 'aria-label': i18n.t('course.completed') }, [' ✓']),
      ]),
    ])));

  }

  function renderChrome() {
    const complete = completedWorkshopCount(sections, progress);
    document.documentElement.lang = i18n.locale;
    wordmark.textContent = i18n.t('app.name');
    wordmark.setAttribute('aria-label', i18n.t('home.backHome'));
    progressLabel.textContent = i18n.t('nav.progress');
    progressValue.textContent = `${complete} / ${totalWorkshops}`;
    progressMeter.value = complete;
    progressMeter.setAttribute('aria-label', i18n.t('workspace.progress', {
      completed: complete,
      total: totalWorkshops,
    }));
    languageGroup.setAttribute('aria-label', i18n.t('accessibility.languageToggle'));
    frenchButton.textContent = i18n.t('nav.french');
    frenchButton.setAttribute('aria-pressed', String(i18n.locale === 'fr'));
    englishButton.textContent = i18n.t('nav.english');
    englishButton.setAttribute('aria-pressed', String(i18n.locale === 'en'));
    footerNote.textContent = i18n.t('app.nonOfficial');
    footerDescription.textContent = i18n.t('app.description');
    if (skipLink) {
      skipLink.href = '#main-content';
      skipLink.textContent = i18n.t('accessibility.skipToContent');
    }
    renderNavigation();
  }

  function setView(view) {
    frame.dataset.view = view === 'workshop' ? 'workshop' : 'home';
  }

  const unsubscribe = i18n.subscribe(renderChrome);
  renderChrome();

  return {
    element: frame,
    outlet,
    renderNavigation,
    setActiveStage(stageId, workshopId = null) {
      const nextStageId = sections.some((section) => section.id === stageId) ? stageId : null;
      if (activeStageId === nextStageId && activeWorkshopId === workshopId) return;
      activeWorkshopId = workshopId;
      activeStageId = nextStageId;
      renderNavigation();
    },
    setView,
    destroy() {
      unsubscribe();
      skipLink?.removeEventListener('click', focusOutlet);
      frame.remove();
    },
  };
}
