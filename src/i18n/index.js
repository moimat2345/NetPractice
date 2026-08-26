import { en } from './en.js';
import { fr } from './fr.js';

const bundles = { en, fr };

function isSupportedLocale(locale) {
  return typeof locale === 'string' && Object.hasOwn(bundles, locale);
}

export function flattenKeys(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child !== null && typeof child === 'object' ? flattenKeys(child, path) : [path];
  }).sort();
}

function lookup(bundle, key) {
  return key.split('.').reduce((value, segment) => value?.[segment], bundle);
}

function interpolationValue(bundle, value) {
  if (value !== null && typeof value === 'object' && typeof value.messageKey === 'string') {
    const translated = lookup(bundle, value.messageKey);
    return typeof translated === 'string' ? translated : `{${value.messageKey}}`;
  }
  return String(value);
}

function syncDocument(bundle, locale) {
  if (!globalThis.document) return;
  if (globalThis.document.documentElement) globalThis.document.documentElement.lang = locale;
  const title = lookup(bundle, 'app.documentTitle');
  if (typeof title === 'string') globalThis.document.title = title;
}

export function createI18n(initialLocale) {
  let locale = isSupportedLocale(initialLocale) ? initialLocale : 'fr';
  const listeners = new Set();
  syncDocument(bundles[locale], locale);

  return {
    get locale() {
      return locale;
    },
    setLocale(next) {
      if (!isSupportedLocale(next) || next === locale) return;
      locale = next;
      syncDocument(bundles[locale], locale);
      listeners.forEach((listener) => listener(next));
    },
    t(key, params = {}) {
      const template = lookup(bundles[locale], key);
      if (typeof template !== 'string') {
        throw new Error(`Missing translation: ${locale}.${key}`);
      }
      return template.replace(/\{(\w+)\}/g, (_, name) =>
        interpolationValue(bundles[locale], params?.[name] ?? `{${name}}`));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
