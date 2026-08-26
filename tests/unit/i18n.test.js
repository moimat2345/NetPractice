import { describe, expect, it } from 'vitest';
import { getHint } from '../../src/exercises/hints.js';
import { createI18n, flattenKeys } from '../../src/i18n/index.js';
import { en } from '../../src/i18n/en.js';
import { fr } from '../../src/i18n/fr.js';

const taskSixDiagnosticKeys = [
  'diagnostic.invalid-ip',
  'diagnostic.invalid-mask',
  'diagnostic.incorrect-calculation',
  'diagnostic.network-address',
  'diagnostic.broadcast-address',
  'diagnostic.different-subnet',
  'diagnostic.overlapping-subnets',
  'diagnostic.unreachable-gateway',
  'diagnostic.unreachable-next-hop',
  'diagnostic.missing-default-route',
  'diagnostic.wrong-route-destination',
  'diagnostic.unreachable-destination',
  'diagnostic.missing-return-path',
];

const taskSixHintKeys = [
  'hint.gateway.observe',
  'hint.gateway.method',
  'hint.gateway.nearSolution',
  'hint.subnet.observe',
  'hint.subnet.method',
  'hint.subnet.nearSolution',
  'hint.return.observe',
  'hint.return.method',
  'hint.return.nearSolution',
  'hint.generic.observe',
  'hint.generic.method',
  'hint.generic.nearSolution',
];

describe('i18n', () => {
  it('keeps French and English key sets identical', () => {
    expect(flattenKeys(fr)).toEqual(flattenKeys(en));
  });

  it('contains every Task 6 diagnostic and hint message key in both bundles', () => {
    const frenchKeys = new Set(flattenKeys(fr));
    const englishKeys = new Set(flattenKeys(en));
    const emittedHintKeys = [
      ...taskSixHintKeys,
      getHint({ solution: {} }, { diagnostics: [] }, 1).key,
    ];

    for (const key of [...taskSixDiagnosticKeys, ...emittedHintKeys]) {
      expect(frenchKeys).toContain(key);
      expect(englishKeys).toContain(key);
    }
  });

  it('interpolates diagnostic values and switches without a reload', () => {
    const i18n = createI18n('fr');
    const locales = [];
    i18n.subscribe((locale) => locales.push(locale));

    expect(i18n.t('diagnostic.invalid-ip', { value: '999.1.1.1' })).toContain('999.1.1.1');
    i18n.setLocale('en');

    expect(i18n.locale).toBe('en');
    expect(locales).toEqual(['en']);
    expect(i18n.t('diagnostic.invalid-ip', { value: '999.1.1.1' })).toMatch(/invalid/i);
  });

  it('keeps missing interpolation placeholders visible and stringifies supplied values safely', () => {
    const i18n = createI18n('en');

    expect(i18n.t('diagnostic.invalid-ip', { value: '$&{name}' })).toContain('$&{name}');
    expect(i18n.t('action.hint')).toContain('{level}');
  });

  it('falls back from inherited and unknown locale names', () => {
    expect(createI18n('toString').locale).toBe('fr');
    expect(createI18n('not-a-locale').locale).toBe('fr');

    const i18n = createI18n('fr');
    i18n.setLocale('toString');
    i18n.setLocale('not-a-locale');

    expect(i18n.locale).toBe('fr');
    expect(i18n.t('app.name')).toBe('Subnet Notes');
  });

  it('updates the document and notifies once before an unsubscribe', () => {
    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const documentElement = { lang: 'fr' };
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { documentElement },
    });

    try {
      const i18n = createI18n('fr');
      const locales = [];
      const unsubscribe = i18n.subscribe((locale) => locales.push(locale));

      i18n.setLocale('en');
      expect(locales).toEqual(['en']);
      expect(documentElement.lang).toBe('en');

      unsubscribe();
      i18n.setLocale('en');
      i18n.setLocale('toString');
      i18n.setLocale('not-a-locale');

      expect(locales).toEqual(['en']);
      expect(documentElement.lang).toBe('en');
      expect(i18n.locale).toBe('en');
    } finally {
      if (documentDescriptor) {
        Object.defineProperty(globalThis, 'document', documentDescriptor);
      } else {
        delete globalThis.document;
      }
    }
  });
});
