import { en } from './en.js';
import { fr } from './fr.js';

const bundles = { en, fr };

export function flattenKeys(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child !== null && typeof child === 'object' ? flattenKeys(child, path) : [path];
  }).sort();
}

function lookup(bundle, key) {
  return key.split('.').reduce((value, segment) => value?.[segment], bundle);
}

export function createI18n(initialLocale) {
  let locale = initialLocale in bundles ? initialLocale : 'fr';
  const listeners = new Set();

  return {
    get locale() {
      return locale;
    },
    setLocale(next) {
      if (!(next in bundles) || next === locale) return;
      locale = next;
      if (globalThis.document?.documentElement) {
        globalThis.document.documentElement.lang = next;
      }
      listeners.forEach((listener) => listener(next));
    },
    t(key, params = {}) {
      const template = lookup(bundles[locale], key);
      if (typeof template !== 'string') {
        throw new Error(`Missing translation: ${locale}.${key}`);
      }
      return template.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? `{${name}}`));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
