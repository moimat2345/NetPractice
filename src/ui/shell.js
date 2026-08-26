import { element, replace } from './dom.js';

function completedCount(progress, sections) {
  const completions = progress?.completed && typeof progress.completed === 'object'
    ? Object.keys(progress.completed)
    : [];
  return Math.min(completions.length, sections.length);
}

function isSectionComplete(progress, section) {
  return Boolean(progress?.completed?.[section.workshopId]);
}

export function createShell({ i18n, progress, sections = [], onNavigate = () => {} }) {
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
    max: sections.length,
    value: completedCount(progress, sections),
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
  const sidebar = element('aside', { className: 'curriculum-sidebar' }, [navigation]);
  const outlet = element('main', { className: 'route-outlet', id: 'main-content', tabindex: '-1' });
  const footerNote = element('p');
  const footerDescription = element('p');
  const footer = element('footer', { className: 'site-footer' }, [
    element('div', { className: 'footer-inner' }, [footerNote, footerDescription]),
  ]);

  frame.append(banner, element('div', { className: 'app-body' }, [sidebar, outlet]), footer);

  function renderNavigation() {
    navigation.setAttribute('aria-label', i18n.t('nav.curriculum'));
    const heading = element('p', { className: 'sidebar-heading' }, [i18n.t('nav.curriculum')]);
    const list = element('ol', { className: 'curriculum-list' });
    const firstPending = sections.findIndex((section) => !isSectionComplete(progress, section));

    sections.forEach((section, index) => {
      const complete = isSectionComplete(progress, section);
      const current = !complete && index === (firstPending === -1 ? 0 : firstPending);
      const stateKey = complete ? 'course.completed' : current ? 'course.next' : 'course.locked';
      const link = element('a', {
        className: `curriculum-link${current ? ' is-current' : ''}${complete ? ' is-complete' : ''}`,
        href: `#/workshops/${section.workshopId}`,
        onClick: (event) => {
          event.preventDefault();
          onNavigate(`/workshops/${section.workshopId}`);
        },
      }, [
        element('span', { className: 'curriculum-index', 'aria-hidden': 'true' }, [String(index + 1).padStart(2, '0')]),
        element('span', { className: 'curriculum-copy' }, [
          element('strong', {}, [i18n.t(section.titleKey)]),
          element('small', {}, [i18n.t(stateKey)]),
        ]),
        element('span', { className: 'curriculum-state', 'aria-hidden': 'true' }, [complete ? '✓' : current ? '→' : '·']),
      ]);
      list.append(element('li', {}, [link]));
    });

    replace(navigation, [heading, list]);
  }

  function renderChrome() {
    const complete = completedCount(progress, sections);
    document.documentElement.lang = i18n.locale;
    wordmark.textContent = i18n.t('app.name');
    wordmark.setAttribute('aria-label', i18n.t('home.backHome'));
    progressLabel.textContent = i18n.t('nav.progress');
    progressValue.textContent = `${complete} / ${sections.length}`;
    progressMeter.value = complete;
    progressMeter.setAttribute('aria-label', i18n.t('progress.summary', {
      completed: complete,
      total: sections.length,
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
    setView,
    destroy() {
      unsubscribe();
      frame.remove();
    },
  };
}
