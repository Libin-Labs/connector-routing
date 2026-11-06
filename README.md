# @lp-labs/connector-routing

Bounded orthogonal routing around axis-aligned rectangular obstacles. The visibility-grid search
minimizes Manhattan length plus an optional bend penalty and either returns a checked route or
throws an explicit no-route error.

## Install

```sh
npm install @lp-labs/connector-routing
```

```js
import { routeOrthogonal } from '@lp-labs/connector-routing';

const route = routeOrthogonal(
  { x: 0, y: 5 },
  { x: 20, y: 5 },
  [{ x: 8, y: 0, width: 4, height: 10 }],
  { clearance: 1, bendPenalty: 2 },
);
console.log(route.points, route.length, route.bends);
```

## API and types

- `routeOrthogonal(start, end, obstacles, options?)` returns an `OrthogonalRoute` with orthogonal
  `points`, total Manhattan `length`, and `bends`.
- `RouteOptions.clearance` (default `0`) expands obstacle avoidance; `bendPenalty` (default `0`)
  adds a cost for each turn; `maxObstacles` (default `64`, maximum `64`) bounds work.
- `segmentIntersectsRect(start, end, rect)` tests a closed segment against a closed rectangle,
  including boundary contact.
- `NoRouteError` indicates that an endpoint is blocked or no route was found in the visibility grid.
- Exported types: `Point`, `Rect`, `RouteOptions`, and `OrthogonalRoute`.

Endpoints must be finite and outside every obstacle expanded by clearance. Coordinates and
clearance are bounded to 1e12; obstacle dimensions are nonnegative. Capacity, malformed data, and
invalid options throw `RangeError` or `TypeError`; blocked endpoints and failed searches throw
`NoRouteError`. Successful routes are verified against the expanded obstacles, including boundary
contact.

This is a deterministic bounded visibility-grid algorithm, not a universal routing guarantee.
It supports only axis-aligned rectangular obstacles and orthogonal routes; it does not model ports,
bundling, labels, curves, dynamic route stability, or arbitrary polygons. Grid candidates are the
endpoints and clearance-offset obstacle sides; an optimal route for a richer geometry model is not
claimed.

## Module formats and customization

ESM, CommonJS (`require('@lp-labs/connector-routing')`), and TypeScript declarations are included.
Tune the clearance and bend penalty for the host diagram, and re-check the route if application
geometry changes. There are no runtime or peer dependencies; TypeScript and Prettier are
development-only.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
