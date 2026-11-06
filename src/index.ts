export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RouteOptions {
  clearance?: number;
  bendPenalty?: number;
  maxObstacles?: number;
}

export interface OrthogonalRoute {
  points: Point[];
  length: number;
  bends: number;
}

export class NoRouteError extends Error {
  constructor(message = 'No orthogonal route exists within the bounded visibility grid.') {
    super(message);
    this.name = 'NoRouteError';
  }
}

const COORDINATE_LIMIT = 1e12;
const MAX_OBSTACLES = 64;

interface QueueItem {
  state: number;
  cost: number;
}

class MinHeap {
  private items: QueueItem[] = [];

  push(item: QueueItem): void {
    this.items.push(item);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent]!.cost <= item.cost) break;
      this.items[index] = this.items[parent]!;
      index = parent;
    }
    this.items[index] = item;
  }

  pop(): QueueItem | undefined {
    if (this.items.length === 0) return undefined;
    const first = this.items[0]!;
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.items.length) break;
        const child =
          right < this.items.length && this.items[right]!.cost < this.items[left]!.cost
            ? right
            : left;
        if (this.items[child]!.cost >= last.cost) break;
        this.items[index] = this.items[child]!;
        index = child;
      }
      this.items[index] = last;
    }
    return first;
  }
}

function normalizedPoint(value: Point, label: string): Point {
  if (!value || typeof value !== 'object') throw new TypeError(`${label} must be a point.`);
  for (const [component, name] of [
    [value.x, `${label} x`],
    [value.y, `${label} y`],
  ] as const) {
    if (
      typeof component !== 'number' ||
      !Number.isFinite(component) ||
      Math.abs(component) > COORDINATE_LIMIT
    ) {
      throw new RangeError(`${name} must be finite and within ±${COORDINATE_LIMIT}.`);
    }
  }
  return { x: value.x, y: value.y };
}

function normalizedRect(value: Rect): Rect {
  if (!value || typeof value !== 'object') throw new TypeError('Obstacle must be a rectangle.');
  const { x, y, width, height } = value;
  for (const [component, label] of [
    [x, 'Obstacle x'],
    [y, 'Obstacle y'],
    [width, 'Obstacle width'],
    [height, 'Obstacle height'],
  ] as const) {
    if (typeof component !== 'number' || !Number.isFinite(component)) {
      throw new TypeError(`${label} must be finite.`);
    }
  }
  if (
    width < 0 ||
    height < 0 ||
    Math.abs(x) > COORDINATE_LIMIT ||
    Math.abs(y) > COORDINATE_LIMIT ||
    Math.abs(x + width) > COORDINATE_LIMIT ||
    Math.abs(y + height) > COORDINATE_LIMIT
  ) {
    throw new RangeError('Obstacle coordinates must be bounded and dimensions nonnegative.');
  }
  return { x, y, width, height };
}

function inRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function segmentIntersectsRect(start: Point, end: Point, rect: Rect): boolean {
  const a = normalizedPoint(start, 'Segment start');
  const b = normalizedPoint(end, 'Segment end');
  const box = normalizedRect(rect);
  if (inRect(a, box) || inRect(b, box)) return true;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let low = 0;
  let high = 1;
  const slabs: readonly [number, number, number, number][] = [
    [a.x, dx, box.x, box.x + box.width],
    [a.y, dy, box.y, box.y + box.height],
  ];
  for (const [origin, delta, minimum, maximum] of slabs) {
    if (delta === 0) {
      if (origin < minimum || origin > maximum) return false;
      continue;
    }
    const first = (minimum - origin) / delta;
    const second = (maximum - origin) / delta;
    low = Math.max(low, Math.min(first, second));
    high = Math.min(high, Math.max(first, second));
    if (low > high) return false;
  }
  return true;
}

export function routeOrthogonal(
  startValue: Point,
  endValue: Point,
  obstacleValues: readonly Rect[],
  options: RouteOptions = {},
): OrthogonalRoute {
  const start = normalizedPoint(startValue, 'Start');
  const end = normalizedPoint(endValue, 'End');
  if (!Array.isArray(obstacleValues)) throw new TypeError('Obstacles must be an array.');
  const maxObstacles = options.maxObstacles ?? MAX_OBSTACLES;
  if (!Number.isSafeInteger(maxObstacles) || maxObstacles < 0 || maxObstacles > MAX_OBSTACLES) {
    throw new RangeError(`maxObstacles must be an integer from 0 to ${MAX_OBSTACLES}.`);
  }
  if (obstacleValues.length > maxObstacles) throw new RangeError('Obstacle capacity exceeded.');
  const clearance = options.clearance ?? 0;
  const bendPenalty = options.bendPenalty ?? 0;
  for (const [value, name] of [
    [clearance, 'clearance'],
    [bendPenalty, 'bendPenalty'],
  ] as const) {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > COORDINATE_LIMIT
    ) {
      throw new RangeError(`${name} must be finite, nonnegative, and bounded.`);
    }
  }
  const obstacles = obstacleValues.map(normalizedRect);
  const maxCoordinate = Math.max(
    1,
    Math.abs(start.x),
    Math.abs(start.y),
    Math.abs(end.x),
    Math.abs(end.y),
    ...obstacles.flatMap((rect) => [
      Math.abs(rect.x),
      Math.abs(rect.y),
      Math.abs(rect.x + rect.width),
      Math.abs(rect.y + rect.height),
    ]),
  );
  const epsilon = Math.max(1e-7, Number.EPSILON * maxCoordinate * 16);
  const expanded = obstacles.map((rect) => ({
    x: rect.x - clearance,
    y: rect.y - clearance,
    width: rect.width + clearance * 2,
    height: rect.height + clearance * 2,
  }));
  const isBlocked = (point: Point): boolean => expanded.some((rect) => inRect(point, rect));
  if (isBlocked(start) || isBlocked(end)) {
    throw new NoRouteError('Start or end point lies inside an obstacle or its clearance area.');
  }
  if (start.x === end.x && start.y === end.y) {
    return { points: [start], length: 0, bends: 0 };
  }

  const xs = new Set([start.x, end.x]);
  const ys = new Set([start.y, end.y]);
  for (const rect of obstacles) {
    const margin = clearance + epsilon;
    xs.add(rect.x - margin);
    xs.add(rect.x + rect.width + margin);
    ys.add(rect.y - margin);
    ys.add(rect.y + rect.height + margin);
  }
  const xValues = [...xs].sort((a, b) => a - b);
  const yValues = [...ys].sort((a, b) => a - b);
  const width = xValues.length;
  const height = yValues.length;
  const vertexAt: Int32Array[] = [];
  const points: Point[] = [];
  for (let yi = 0; yi < height; yi += 1) {
    const row = new Int32Array(width);
    row.fill(-1);
    for (let xi = 0; xi < width; xi += 1) {
      const candidate = { x: xValues[xi]!, y: yValues[yi]! };
      if (isBlocked(candidate)) continue;
      row[xi] = points.length;
      points.push(candidate);
    }
    vertexAt.push(row);
  }
  const startX = xValues.indexOf(start.x);
  const endX = xValues.indexOf(end.x);
  const startY = yValues.indexOf(start.y);
  const endY = yValues.indexOf(end.y);
  const startVertex = vertexAt[startY]![startX]!;
  const endVertex = vertexAt[endY]![endX]!;
  if (startVertex < 0 || endVertex < 0) throw new NoRouteError();

  const stateCount = points.length * 3;
  const costs = new Float64Array(stateCount);
  costs.fill(Number.POSITIVE_INFINITY);
  const previous = new Int32Array(stateCount);
  previous.fill(-1);
  const startState = startVertex * 3;
  costs[startState] = 0;
  const queue = new MinHeap();
  queue.push({ state: startState, cost: 0 });
  let finalState = -1;

  const relax = (fromState: number, vertex: number, direction: 1 | 2): void => {
    const from = Math.floor(fromState / 3);
    const priorDirection = fromState % 3;
    const a = points[from]!;
    const b = points[vertex]!;
    if (expanded.some((rect) => segmentIntersectsRect(a, b, rect))) return;
    const edgeLength = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    const cost =
      costs[fromState]! +
      edgeLength +
      (priorDirection !== 0 && priorDirection !== direction ? bendPenalty : 0);
    const nextState = vertex * 3 + direction;
    if (cost < costs[nextState]!) {
      costs[nextState] = cost;
      previous[nextState] = fromState;
      queue.push({ state: nextState, cost });
    }
  };

  while (true) {
    const current = queue.pop();
    if (!current) break;
    if (current.cost !== costs[current.state]) continue;
    const vertex = Math.floor(current.state / 3);
    if (vertex === endVertex) {
      finalState = current.state;
      break;
    }
    const xi = xValues.indexOf(points[vertex]!.x);
    const yi = yValues.indexOf(points[vertex]!.y);
    for (let nextX = xi - 1; nextX >= 0; nextX -= 1) {
      const target = vertexAt[yi]![nextX]!;
      if (target >= 0) {
        relax(current.state, target, 1);
        break;
      }
    }
    for (let nextX = xi + 1; nextX < width; nextX += 1) {
      const target = vertexAt[yi]![nextX]!;
      if (target >= 0) {
        relax(current.state, target, 1);
        break;
      }
    }
    for (let nextY = yi - 1; nextY >= 0; nextY -= 1) {
      const target = vertexAt[nextY]![xi]!;
      if (target >= 0) {
        relax(current.state, target, 2);
        break;
      }
    }
    for (let nextY = yi + 1; nextY < height; nextY += 1) {
      const target = vertexAt[nextY]![xi]!;
      if (target >= 0) {
        relax(current.state, target, 2);
        break;
      }
    }
  }
  if (finalState < 0) throw new NoRouteError();

  const reversed: Point[] = [];
  for (let state = finalState; state >= 0; state = previous[state]!) {
    reversed.push(points[Math.floor(state / 3)]!);
    if (state === startState) break;
  }
  const path = reversed.reverse();
  const simplified: Point[] = [];
  for (const candidate of path) {
    const last = simplified[simplified.length - 1];
    const before = simplified[simplified.length - 2];
    if (
      last &&
      before &&
      ((before.x === last.x && last.x === candidate.x) ||
        (before.y === last.y && last.y === candidate.y))
    ) {
      simplified[simplified.length - 1] = candidate;
    } else {
      simplified.push(candidate);
    }
  }
  let length = 0;
  for (let index = 1; index < simplified.length; index += 1) {
    const first = simplified[index - 1]!;
    const second = simplified[index]!;
    length += Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
  }
  return {
    points: simplified,
    length,
    bends: Math.max(0, simplified.length - 2),
  };
}
