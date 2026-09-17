import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getWorkshopGenerator } from '../../src/exercises/generators.js';
import { validateSubmission } from '../../src/exercises/validators.js';
import { createI18n } from '../../src/i18n/index.js';
import { correctionSteps, renderCorrection, renderDiagnostic } from '../../src/ui/feedback.js';
import { describeField, entryLabel } from '../../src/ui/exercise-labels.js';

// Only the DOM boundary is replaced; the real renderer and translations run in Node.
class TestNode {
  constructor(tag, text = '') {
    this.tag = tag;
    this.text = text;
    this.children = [];
    this.attributes = {};
    this.events = {};
  }
  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { this.events[name] = callback; }
  get textContent() { return this.text + this.children.map((child) => child.textContent).join(' '); }
  find(tag) { return this.tag === tag ? this : this.children.map((child) => child.find(tag)).find(Boolean); }
}

beforeEach(() => {
  vi.stubGlobal('Node', TestNode);
  vi.stubGlobal('document', {
    createElement: (tag) => new TestNode(tag),
    createTextNode: (text) => new TestNode('#text', text),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('correction context', () => {
  it.each([
    ['gateway-0', '10.83.197.0', 26, '10.83.197.63', '10.83.197.7'],
    ['gateway-1', '10.194.217.0', 27, '10.194.217.31', '10.194.217.6'],
    ['gateway-2', '10.153.76.0', 27, '10.153.76.31', '10.153.76.15'],
    ['gateway-3', '10.95.82.0', 27, '10.95.82.31', '10.95.82.26'],
    ['gateway-4', '10.118.138.0', 28, '10.118.138.15', '10.118.138.11'],
  ])('uses the host subnet instead of the default destination for %s', (seed, network, prefix, broadcast, localAddress) => {
    const exercise = getWorkshopGenerator('valid-gateway-2')({ seed });
    const steps = correctionSteps(exercise);
    for (const key of ['correction.identify', 'correction.boundaries', 'correction.gateway']) {
      expect(steps.find((step) => step.key === key).params).toMatchObject({
        network, prefix, broadcast, localAddress,
      });
    }
  });

  it('calculates a route destination separately from its outgoing gateway subnet', () => {
    const exercise = getWorkshopGenerator('route-parts-1')({ seed: 'route-context-audit' });
    const steps = correctionSteps(exercise);
    expect(steps.find((step) => step.key === 'correction.identify').params).toMatchObject({
      network: '10.189.167.0', prefix: 28,
    });
    expect(steps.find((step) => step.key === 'correction.gateway').params).toMatchObject({
      network: '172.189.253.0', prefix: 30, gateway: '172.189.253.2', localAddress: '172.189.253.1',
    });
  });
});

describe('readable feedback', () => {
  it.each(['fr', 'en'])('localizes solution field labels and route endpoints in %s', (locale) => {
    const i18n = createI18n(locale);
    for (const workshopId of ['valid-gateway-2', 'route-parts-1', 'guided-mission-2', 'subnet-range-1']) {
      const exercise = getWorkshopGenerator(workshopId)({ seed: 'readable-correction' });
      const text = renderCorrection(i18n, exercise).textContent;
      for (const field of exercise.editableFields) expect(text).not.toContain(field);
      for (const answer of Object.values(exercise.solution)) expect(text).toContain(answer);
      expect(text).not.toMatch(/\b(host-a|host-b|atlas|boreal|cove|delta)\b/);
      expect(text).not.toMatch(/\{\w+\}/);
    }
  });

  it.each(['fr', 'en'])('explains the actual local interface and prefix in %s', (locale) => {
    const exercise = getWorkshopGenerator('valid-gateway-2')({ seed: 'gateway-0' });
    const text = renderCorrection(createI18n(locale), exercise).textContent;
    expect(text).toContain('10.83.197.7/26');
    expect(text).toContain('10.83.197.0/26');
    expect(text).not.toContain('0.0.0.0/0');
  });

  it.each(['fr', 'en'])('identifies an empty field and focuses it without exposing its answer in %s', (locale) => {
    const exercise = getWorkshopGenerator('valid-gateway-2')({ seed: 'missing-field' });
    const validation = validateSubmission(exercise, exercise.initial);
    const i18n = createI18n(locale);
    const focused = [];
    const output = renderDiagnostic(i18n, validation, {
      exercise, submission: exercise.initial, onFocusField: (field) => focused.push(field),
    });
    expect(output.textContent).toContain(i18n.t('field.gateway'));
    expect(output.textContent).toContain(i18n.t('device.focusedHostA'));
    expect(output.textContent).not.toContain('null');
    expect(output.textContent).not.toContain(Object.values(exercise.solution)[0]);
    expect(output.textContent).not.toContain(exercise.editableFields[0]);
    const button = output.find('button');
    expect(button).toBeTruthy();
    button.events.click();
    expect(focused).toEqual([exercise.editableFields[0]]);
  });

  it('keeps the first diagnostic and names a malformed field without revealing a correction', () => {
    const exercise = getWorkshopGenerator('route-parts-1')({ seed: 'bad-field' });
    const submission = { ...exercise.initial, [exercise.editableFields[0]]: '999.1.1.1' };
    const output = renderDiagnostic(createI18n('en'), validateSubmission(exercise, submission), {
      exercise, submission,
    });
    expect(output.textContent).toContain('999.1.1.1');
    expect(output.textContent).toContain('Destination');
    expect(output.textContent).toContain('Atlas router');
    expect(output.textContent).not.toContain(Object.values(exercise.solution)[0]);
    expect(output.find('button')).toBeUndefined();
  });

  it('names the interface’s actual connected peer on a router with multiple interfaces', () => {
    const exercise = getWorkshopGenerator('route-parts-1')({ seed: 'interface-label' });
    const atlas = exercise.devices.find((device) => device.id === 'atlas');
    const i18n = createI18n('en');
    const label = entryLabel(i18n, atlas, 'interfaces', atlas.interfaces[1], 1, exercise.devices, exercise.links);
    expect(label).toContain('Boreal router');
    expect(label).not.toContain('Internet');
    expect(label).not.toContain('atlas-transit');
    expect(describeField(i18n, exercise, 'atlas.interfaces.atlas-transit.prefix')).toContain(label);
  });

  it('keeps hidden route destinations and gateways out of field labels', () => {
    const exercise = getWorkshopGenerator('default-route-2')({ seed: 'hidden-route-label' });
    const i18n = createI18n('en');
    const label = describeField(i18n, exercise, exercise.editableFields[0]);
    expect(label).toContain('Route 2');
    expect(label).toContain('Destination');
    expect(label).not.toContain('default route');
    for (const value of Object.values(exercise.solution)) expect(label).not.toContain(value);
  });

  it('names calculated fields using their role instead of the storage key', () => {
    const exercise = getWorkshopGenerator('usable-host-2')({ seed: 'calculated-label' });
    expect(describeField(createI18n('en'), exercise, 'range.first-host')).toBe('First host');
    expect(describeField(createI18n('fr'), exercise, 'range.last-host')).toBe('Dernier hôte');
  });
});
