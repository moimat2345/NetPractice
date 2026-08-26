import { describe, expect, it } from 'vitest';
import { getHint } from '../../src/exercises/hints.js';
import { createI18n, flattenKeys } from '../../src/i18n/index.js';
import { en } from '../../src/i18n/en.js';
import { fr } from '../../src/i18n/fr.js';
import { curriculum } from '../../src/content/curriculum.js';
import { getWorkshopGenerator } from '../../src/exercises/generators.js';
import { validateSubmission } from '../../src/exercises/validators.js';
import { formatIPv4 } from '../../src/core/ipv4.js';

const taskSixDiagnosticKeys = [
  'diagnostic.invalid-ip',
  'diagnostic.invalid-mask',
  'diagnostic.incorrect-calculation',
  'diagnostic.network-address',
  'diagnostic.broadcast-address',
  'diagnostic.different-subnet',
  'diagnostic.overlapping-subnets',
  'diagnostic.duplicate-address',
  'diagnostic.unreachable-gateway',
  'diagnostic.unreachable-next-hop',
  'diagnostic.missing-default-route',
  'diagnostic.wrong-route-destination',
  'diagnostic.unreachable-destination',
  'diagnostic.missing-return-path',
];

const taskSixHintKeys = [
  'hint.defaultRoute.observe',
  'hint.defaultRoute.method',
  'hint.defaultRoute.nearSolution',
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

  it('localizes semantic diagnostic and hint parameters instead of exposing implementation tokens', () => {
    const french = createI18n('fr');
    const english = createI18n('en');

    expect(french.t('diagnostic.incorrect-calculation', {
      role: { messageKey: 'semantic.role.network' },
    })).toContain('adresse réseau');
    expect(french.t('diagnostic.unreachable-destination', {
      reason: { messageKey: 'semantic.traceReason.missing-link' },
    })).toContain('lien physique manquant');
    expect(french.t('hint.generic.nearSolution', {
      expectedShape: { messageKey: 'semantic.shape.address' },
    })).toContain('adresse IP');
    expect(english.t('diagnostic.unreachable-destination', {
      reason: { messageKey: 'semantic.traceReason.missing-link' },
    })).toContain('missing physical link');
  });

  it('renders localized device labels from real validation and hint producers', () => {
    const exercise = getWorkshopGenerator('same-subnet-3')({ seed: 'localized-devices' });
    const field = exercise.editableFields[0];
    const validation = validateSubmission(exercise, { ...exercise.solution, [field]: '10.0.0.1' });
    const diagnostic = validation.diagnostics.find((entry) => entry.code === 'different-subnet');
    const hint = getHint(exercise, { ...validation, diagnostics: [diagnostic] }, 1);
    const french = createI18n('fr');

    expect(french.t(diagnostic.messageKey, diagnostic.params)).toBe(
      'Cet appareil et l’appareil « Routeur local » ne sont pas dans le même sous-réseau /27.',
    );
    expect(french.t(diagnostic.messageKey, diagnostic.params)).not.toContain('router');
    expect(french.t(hint.key, hint.params)).toBe(
      'Compare les deux extrémités du lien autour de l’appareil « Hôte Alpha ».',
    );
    expect(french.t(hint.key, hint.params)).not.toContain('host-a');
  });

  it('places real generated device labels in grammatical French sentence contexts', () => {
    const french = createI18n('fr');
    const route = getWorkshopGenerator('packet-path-3')({ seed: 'localized-route-context' });
    const gateway = getWorkshopGenerator('valid-gateway-2')({ seed: 'localized-gateway-context' });
    const returnPath = getWorkshopGenerator('return-path-4')({ seed: 'localized-return-context' });
    const routeHint = getHint(route, null, 1);
    const gatewayHint = getHint(gateway, null, 1);
    const returnHint = getHint(returnPath, {
      diagnostics: [{ code: 'missing-return-path', deviceId: 'boreal', field: null, params: {} }],
    }, 1);

    expect(french.t(routeHint.key, routeHint.params)).toBe(
      'Suis l’objectif entre les appareils « Hôte Alpha » et « Hôte Bêta », puis repère la route modifiable sur l’appareil « Routeur Atlas ».',
    );
    expect(french.t(gatewayHint.key, gatewayHint.params)).toBe(
      'Observe la passerelle configurée sur l’appareil « Hôte Alpha ». Elle doit appartenir au même sous-réseau que l’hôte.',
    );
    expect(french.t(returnHint.key, returnHint.params)).toBe(
      'Le problème se situe du côté de l’appareil « Routeur Boréal », après le trajet aller.',
    );
  });

  it('keeps generated duplicate-address and missing-route diagnostics grammatical in French', () => {
    const french = createI18n('fr');
    const local = getWorkshopGenerator('same-subnet-3')({ seed: 'localized-diagnostic-context' });
    const localField = local.editableFields[0];
    const routerAddress = local.devices.find((device) => device.id === 'router').interfaces[0].address;
    const duplicate = validateSubmission(local, {
      ...local.solution,
      [localField]: formatIPv4(routerAddress),
    }).diagnostics.find((entry) => entry.code === 'duplicate-address');
    const routed = getWorkshopGenerator('packet-path-3')({ seed: 'localized-diagnostic-context' });
    routed.devices.find((device) => device.id === 'alpha').routes = [];
    const missingDefault = validateSubmission(routed, routed.solution).diagnostics
      .find((entry) => entry.code === 'missing-default-route');

    expect(french.t(duplicate.messageKey, duplicate.params)).toBe(
      'L’adresse 10.19.166.1 est déjà utilisée par l’appareil « Routeur local » (interface router-lan).',
    );
    expect(french.t(missingDefault.messageKey, missingDefault.params)).toBe(
      'Aucune route par défaut ne permet à cet hôte de joindre l’appareil « Hôte Bêta ».',
    );
  });

  it('keeps semantic field-shape articles grammatical in both locales', () => {
    const french = createI18n('fr');
    const english = createI18n('en');

    expect(french.t('hint.gateway.nearSolution', {
      network: '10.0.0.0',
      broadcast: '10.0.0.255',
      expectedShape: { messageKey: 'semantic.shape.prefix' },
    })).toContain('un préfixe CIDR utilisable');
    expect(english.t('hint.generic.nearSolution', {
      expectedShape: { messageKey: 'semantic.shape.network' },
    })).toContain('expects a network value');
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

  it('translates every device label emitted by the curriculum generators', () => {
    const workshopIds = curriculum.flatMap((stage) => stage.workshops);
    for (const locale of ['fr', 'en']) {
      const i18n = createI18n(locale);
      for (const id of workshopIds) {
        const exercise = getWorkshopGenerator(id)({ seed: `labels-${id}` });
        for (const device of exercise.devices) {
          expect(() => i18n.t(device.labelKey)).not.toThrow();
          expect(() => i18n.t(`device.${device.kind}`)).not.toThrow();
        }
      }
    }
  });
});
