import { describe, expect, it } from 'vitest';
import { formatIPv4, parseIPv4 } from '../../src/core/ipv4.js';
import {
  broadcastOf,
  isUsableHost,
  networkOf,
  sameSubnet,
  usableRange,
} from '../../src/core/subnet.js';
import { validateRoundTrip } from '../../src/core/routing.js';
import { generateFocusedExercise, generateMission } from '../../src/exercises/generators.js';
import { assertExercise } from '../../src/exercises/schema.js';

function generatedEditableFields(exercise) {
  return exercise.devices.flatMap((device) => [
    ...device.interfaces.flatMap((entry) => [
      ...(entry.editable.address ? [`${device.id}.interfaces.${entry.id}.address`] : []),
      ...(entry.editable.prefix ? [`${device.id}.interfaces.${entry.id}.prefix`] : []),
    ]),
    ...device.routes.flatMap((route) => [
      ...(route.editable.destination ? [`${device.id}.routes.${route.id}.destination`] : []),
      ...(route.editable.prefix ? [`${device.id}.routes.${route.id}.prefix`] : []),
      ...(route.editable.gateway ? [`${device.id}.routes.${route.id}.gateway`] : []),
    ]),
  ]);
}

function assertModelEditableField(exercise, field) {
  const [deviceId, section, entryId, property] = field.split('.');
  const device = exercise.devices.find((candidate) => candidate.id === deviceId);
  const meta = exercise.fieldMeta[field];
  const isInterface = section === 'interfaces';
  const entries = isInterface ? device?.interfaces : device?.routes;
  const entry = entries?.find((candidate) => candidate.id === entryId);

  expect(device).toBeDefined();
  expect(['interfaces', 'routes']).toContain(section);
  expect(entry).toBeDefined();
  expect(meta.deviceId).toBe(deviceId);
  expect(meta[isInterface ? 'interfaceId' : 'routeId']).toBe(entryId);
  expect(meta[isInterface ? 'routeId' : 'interfaceId']).toBeUndefined();
  expect(meta.kind).toBe(property === 'prefix' ? 'prefix' : 'address');
  expect(meta.role).toBe(isInterface
    ? (property === 'prefix' ? 'mask' : 'host')
    : ({ destination: 'route-destination', prefix: 'route-prefix', gateway: 'gateway' }[property]));
  expect(exercise.solution[field]).toBe(property === 'prefix'
    ? `/${entry.prefix}`
    : formatIPv4(entry[property]));

  if (isInterface || property !== 'gateway') {
    expect(meta.prefix).toBe(entry.prefix);
  } else {
    const gatewayInterface = device.interfaces.find((candidate) =>
      Number.isInteger(candidate.address)
      && sameSubnet(candidate.address, entry.gateway, candidate.prefix));
    expect(gatewayInterface).toBeDefined();
    expect(meta.prefix).toBe(gatewayInterface.prefix);
  }
}

function assertRangeAnswerSemantics(exercise) {
  const { prefix, network, broadcast } = exercise.facts;
  const usable = usableRange(network, prefix);
  const expected = {
    'range.network': { role: 'network', value: networkOf(network, prefix) },
    'range.broadcast': { role: 'broadcast', value: broadcastOf(network, prefix) },
    'range.first-host': { role: 'first-host', value: usable.first },
    'range.last-host': { role: 'last-host', value: usable.last },
  };

  expect(broadcast).toBe(expected['range.broadcast'].value);
  for (const field of exercise.editableFields) {
    const answer = expected[field];
    expect(answer).toBeDefined();
    expect(exercise.fieldMeta[field]).toMatchObject({
      kind: 'address',
      role: answer.role,
      prefix,
    });
    expect(exercise.solution[field]).toBe(formatIPv4(answer.value));
  }
}

describe('exercise generators', () => {
  it('reproduces the same mission from the same seed', () => {
    expect(generateMission({ seed: 'atlas-42', difficulty: 3 }))
      .toEqual(generateMission({ seed: 'atlas-42', difficulty: 3 }));
  });

  it('changes address data for another seed', () => {
    expect(generateMission({ seed: 'atlas-42', difficulty: 3 }).solution)
      .not.toEqual(generateMission({ seed: 'cedar-43', difficulty: 3 }).solution);
  });

  it('preserves focused-exercise contracts across many seeds and concepts', () => {
    for (let index = 0; index < 250; index += 1) {
      for (const concept of ['host-range', 'same-subnet', 'gateway', 'subnet-range']) {
        const exercise = generateFocusedExercise({
          seed: `${concept}-${index}`,
          concept,
          difficulty: 2,
        });

        expect(() => assertExercise(exercise)).not.toThrow();
        expect(exercise.editableFields.length).toBeGreaterThan(0);
        if (concept === 'host-range' || concept === 'subnet-range') {
          assertRangeAnswerSemantics(exercise);
        } else {
          const field = exercise.editableFields[0];
          assertModelEditableField(exercise, field);
          const host = exercise.devices.find((device) => device.id === 'host-a').interfaces[0];
          const router = exercise.devices.find((device) => device.id === 'router').interfaces[0];
          const answer = parseIPv4(exercise.solution[field]);

          expect(answer).not.toBeNull();
          expect(isUsableHost(answer, host.prefix)).toBe(true);
          if (concept === 'same-subnet') {
            expect(sameSubnet(answer, router.address, host.prefix)).toBe(true);
          } else {
            expect(sameSubnet(host.address, answer, host.prefix)).toBe(true);
            expect(router.address).toBe(answer);
          }
        }
      }
    }
  });

  it('keeps original missions routable, disjoint, and internally consistent across many seeds', () => {
    for (let index = 0; index < 250; index += 1) {
      const exercise = generateMission({ seed: `mission-${index}`, difficulty: 3 });
      const segments = Object.values(exercise.facts.segments);

      expect(() => assertExercise(exercise)).not.toThrow();
      expect(exercise.editableFields.length).toBeGreaterThanOrEqual(6);
      expect(exercise.editableFields.length).toBeLessThanOrEqual(10);
      expect(generatedEditableFields(exercise).sort()).toEqual(exercise.editableFields.slice().sort());

      for (const device of exercise.devices) {
        for (const entry of device.interfaces) {
          if (entry.address !== null) {
            expect(isUsableHost(entry.address, entry.prefix)).toBe(true);
          }
        }
      }
      for (let first = 0; first < segments.length; first += 1) {
        for (let second = first + 1; second < segments.length; second += 1) {
          expect(segments[first].network <= segments[second].broadcast
            && segments[second].network <= segments[first].broadcast).toBe(false);
        }
      }
      for (const goal of exercise.goals) {
        expect(validateRoundTrip(exercise, goal.sourceId, goal.destinationId).ok).toBe(true);
      }
      for (const field of exercise.editableFields) {
        expect(exercise.initial[field]).toBe('');
        assertModelEditableField(exercise, field);
      }
    }
  });
});
