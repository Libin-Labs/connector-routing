import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as esm from '../dist/esm/index.js';

const require = createRequire(import.meta.url);
const cjs = require('../dist/cjs/index.js');

test('ESM and CommonJS surfaces agree', () => {
  assert.deepEqual(Object.keys(esm).sort(), Object.keys(cjs).sort());
});

test('routes around an obstacle and every segment avoids its closed rectangle', () => {
  const obstacle = { x: 8, y: -2, width: 4, height: 12 };
  const route = esm.routeOrthogonal({ x: 0, y: 4 }, { x: 20, y: 4 }, [obstacle], { clearance: 1 });
  assert.deepEqual(route.points[0], { x: 0, y: 4 });
  assert.deepEqual(route.points.at(-1), { x: 20, y: 4 });
  assert.ok(route.bends >= 2);
  assert.ok(route.length >= 20);
  for (let index = 1; index < route.points.length; index += 1) {
    const first = route.points[index - 1];
    const second = route.points[index];
    assert.ok(first.x === second.x || first.y === second.y);
    assert.equal(
      esm.segmentIntersectsRect(first, second, {
        x: obstacle.x - 1,
        y: obstacle.y - 1,
        width: obstacle.width + 2,
        height: obstacle.height + 2,
      }),
      false,
    );
  }
});

test('direct, same-point, multiple-obstacle and deterministic routing cases', () => {
  const direct = esm.routeOrthogonal({ x: -2, y: 0 }, { x: 4, y: 0 }, []);
  assert.deepEqual(direct.points, [
    { x: -2, y: 0 },
    { x: 4, y: 0 },
  ]);
  assert.equal(direct.length, 6);
  assert.deepEqual(esm.routeOrthogonal({ x: 1, y: 1 }, { x: 1, y: 1 }, []), {
    points: [{ x: 1, y: 1 }],
    length: 0,
    bends: 0,
  });
  const obstacles = [
    { x: 4, y: -1, width: 2, height: 2 },
    { x: 10, y: 2, width: 2, height: 3 },
  ];
  assert.deepEqual(
    esm.routeOrthogonal({ x: 0, y: 0 }, { x: 16, y: 0 }, obstacles),
    esm.routeOrthogonal({ x: 0, y: 0 }, { x: 16, y: 0 }, obstacles),
  );
});

test('no-route and malformed/capacity inputs have explicit failures', () => {
  assert.throws(
    () =>
      esm.routeOrthogonal({ x: 1, y: 1 }, { x: 8, y: 1 }, [{ x: 0, y: 0, width: 4, height: 4 }]),
    esm.NoRouteError,
  );
  assert.throws(() => esm.routeOrthogonal({ x: 0, y: 0 }, { x: Infinity, y: 0 }, []), RangeError);
  assert.throws(
    () =>
      esm.routeOrthogonal({ x: 0, y: 0 }, { x: 1, y: 0 }, [], {
        maxObstacles: 65,
      }),
    RangeError,
  );
  assert.throws(
    () =>
      esm.routeOrthogonal({ x: 0, y: 0 }, { x: 1, y: 0 }, [{ x: 0, y: 0, width: -1, height: 1 }]),
    RangeError,
  );
});

test('segment rectangle oracle covers boundary, crossing, parallel, and disjoint segments', () => {
  const box = { x: 2, y: 2, width: 3, height: 4 };
  assert.equal(esm.segmentIntersectsRect({ x: 0, y: 3 }, { x: 8, y: 3 }, box), true);
  assert.equal(esm.segmentIntersectsRect({ x: 2, y: 2 }, { x: 2, y: 8 }, box), true);
  assert.equal(esm.segmentIntersectsRect({ x: 0, y: 1 }, { x: 8, y: 1 }, box), false);
  assert.equal(esm.segmentIntersectsRect({ x: 0, y: 0 }, { x: 1, y: 1 }, box), false);
});

test('generated routes around rectangular barriers always pass the obstacle oracle', () => {
  for (let index = 0; index < 24; index += 1) {
    const obstacle = {
      x: 5 + index,
      y: -3 - (index % 4),
      width: 2 + (index % 3),
      height: 8 + (index % 5),
    };
    const start = { x: 0, y: 0 };
    const end = { x: obstacle.x + obstacle.width + 10, y: 0 };
    const route = esm.routeOrthogonal(start, end, [obstacle], { clearance: 0.25 });
    for (let segment = 1; segment < route.points.length; segment += 1) {
      const first = route.points[segment - 1];
      const second = route.points[segment];
      assert.ok(first.x === second.x || first.y === second.y);
      assert.equal(
        esm.segmentIntersectsRect(first, second, {
          x: obstacle.x - 0.25,
          y: obstacle.y - 0.25,
          width: obstacle.width + 0.5,
          height: obstacle.height + 0.5,
        }),
        false,
      );
    }
  }
});
