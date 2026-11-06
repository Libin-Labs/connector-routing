import {
  NoRouteError,
  routeOrthogonal,
  segmentIntersectsRect,
  type OrthogonalRoute,
  type Point,
  type Rect,
  type RouteOptions,
} from '@lp-labs/connector-routing';

const start: Point = { x: 0, y: 0 };
const end: Point = { x: 2, y: 2 };
const obstacles: Rect[] = [];
const options: RouteOptions = { bendPenalty: 1 };
const route: OrthogonalRoute = routeOrthogonal(start, end, obstacles, options);
console.log(route, segmentIntersectsRect(start, end, { x: 5, y: 5, width: 1, height: 1 }));
try {
  routeOrthogonal(start, end, [{ x: 0, y: 0, width: 1, height: 1 }]);
} catch (error) {
  if (error instanceof NoRouteError) console.log(error.message);
}
