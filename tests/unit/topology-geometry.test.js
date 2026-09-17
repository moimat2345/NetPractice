import { describe, expect, it } from 'vitest';

import { layoutTopology, nearestEdgePoints } from '../../src/ui/topology.js';
import { getWorkshopGenerator } from '../../src/exercises/generators.js';

describe('layoutTopology', () => {
  const exercise = getWorkshopGenerator('guided-mission-2')({ seed: 'responsive' });

  it.each([480, 560, 720, 900])('contains every branch device without collisions at %i pixels', (width) => {
    const sizes = new Map(exercise.devices.map((device) => [device.id, { height: device.id === 'grove' ? 112 : 84 }]));
    const layout = layoutTopology(exercise.devices, exercise.links, width, sizes);
    expect(layout.mode).toBe('diagram');
    expect(layout.positions.size).toBe(8);
    const positions = [...layout.positions.values()];
    for (const [index, node] of positions.entries()) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.x + node.width).toBeLessThanOrEqual(width);
      expect(node.y + node.height).toBeLessThanOrEqual(layout.height);
      for (const other of positions.slice(index + 1)) {
        const overlaps = node.x < other.x + other.width && node.x + node.width > other.x
          && node.y < other.y + other.height && node.y + node.height > other.y;
        expect(overlaps).toBe(false);
      }
    }
  });

  it('adapts to the container and uses neighbor cards when a diagram cannot fit', () => {
    expect(layoutTopology(exercise.devices, exercise.links, 320).mode).toBe('stacked');
    const wide = layoutTopology(exercise.devices, exercise.links, 900);
    const narrow = layoutTopology(exercise.devices, exercise.links, 560);
    expect(narrow.positions.get('cloud').x).toBeLessThan(wide.positions.get('cloud').x);
    expect(narrow.positions.get('grove').y).toBeLessThan(narrow.positions.get('delta').y);
  });
});

describe('nearestEdgePoints', () => {
  it('anchors a horizontal link to the actual node edges', () => {
    const canvas = { left: 100, top: 50 };
    const a = { left: 130, right: 230, top: 100, bottom: 160, width: 100, height: 60 };
    const b = { left: 430, right: 530, top: 100, bottom: 160, width: 100, height: 60 };

    expect(nearestEdgePoints(a, b, canvas)).toEqual({
      start: { x: 130, y: 80 },
      end: { x: 330, y: 80 },
    });
  });

  it('anchors a vertical link to the closest top and bottom edges', () => {
    const canvas = { left: 20, top: 40 };
    const a = { left: 100, right: 180, top: 80, bottom: 140, width: 80, height: 60 };
    const b = { left: 110, right: 190, top: 300, bottom: 360, width: 80, height: 60 };

    expect(nearestEdgePoints(a, b, canvas)).toEqual({
      start: { x: 120, y: 100 },
      end: { x: 130, y: 260 },
    });
  });
});
