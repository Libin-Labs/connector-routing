import routing = require('@lp-labs/connector-routing');

const path: routing.OrthogonalRoute = routing.routeOrthogonal({ x: 0, y: 0 }, { x: 1, y: 1 }, []);
console.log(path.points);
