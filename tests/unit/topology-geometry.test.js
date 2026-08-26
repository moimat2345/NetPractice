import { describe, expect, it } from 'vitest';

import { nearestEdgePoints } from '../../src/ui/topology.js';

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
