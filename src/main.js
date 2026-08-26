import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import { createApp } from './app.js';
import { createI18n } from './i18n/index.js';
import { loadProgress } from './storage/progress.js';

const root = document.querySelector('#app');
const progress = loadProgress(localStorage);

createApp(root, {
  i18n: createI18n(progress.locale),
  progress,
  storage: localStorage,
});
