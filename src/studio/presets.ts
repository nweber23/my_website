import { type Scene, defaultMat, emptyScene, newId } from './scene';

const sphere = (x: number, y: number, z: number, r: number, color: [number, number, number], extra: Partial<ReturnType<typeof defaultMat>> = {}) =>
  ({ id: newId(), kind: 'sphere' as const, center: [x, y, z] as [number, number, number], radius: r, mat: { ...defaultMat(color), ...extra } });
const plane = (p: [number, number, number], n: [number, number, number], color: [number, number, number], extra: Partial<ReturnType<typeof defaultMat>> = {}) =>
  ({ id: newId(), kind: 'plane' as const, point: p, normal: n, mat: { ...defaultMat(color), ...extra } });
const cyl = (x: number, y: number, z: number, axis: [number, number, number], r: number, h: number, color: [number, number, number], extra: Partial<ReturnType<typeof defaultMat>> = {}) =>
  ({ id: newId(), kind: 'cylinder' as const, center: [x, y, z] as [number, number, number], axis, radius: r, height: h, mat: { ...defaultMat(color), ...extra } });
const light = (x: number, y: number, z: number, brightness: number, color: [number, number, number] = [255, 255, 255]) =>
  ({ id: newId(), kind: 'light' as const, pos: [x, y, z] as [number, number, number], brightness, color });

export interface Preset { name: string; note: string; build: () => Scene }

export const PRESETS: Preset[] = [
  {
    name: 'Showcase',
    note: 'Spheres, a cylinder, a mirror ball and a checkered floor',
    build: () => ({
      ...emptyScene(),
      ambient: { ratio: 0.18, color: [255, 255, 255] },
      camera: { pos: [0, 2.6, -9], dir: [0, -0.16, 1], fov: 62 },
      look: { specular: 0.45, shine: 64, bounces: 3 },
      lights: [light(-5, 8, -5, 0.75), light(6, 5, -3, 0.35, [255, 200, 150])],
      shapes: [
        plane([0, 0, 0], [0, 1, 0], [235, 235, 235], { checker: true, reflect: 0.12 }),
        sphere(0, 1.2, 0, 1.2, [230, 70, 70]),
        sphere(-2.9, 0.8, -1.2, 0.8, [70, 150, 235]),
        sphere(2.6, 1, -0.6, 1, [240, 240, 245], { reflect: 0.85 }),
        cyl(-1.2, 0.9, 3.2, [0, 1, 0], 0.7, 1.8, [120, 220, 130]),
        cyl(1.9, 0.5, 3.5, [1, 0, 0.3], 0.45, 2.4, [250, 200, 70]),
      ],
    }),
  },
  {
    name: 'Cornell box',
    note: 'Five planes, two coloured walls and a ceiling light',
    build: () => ({
      ...emptyScene(),
      ambient: { ratio: 0.1, color: [255, 255, 255] },
      camera: { pos: [0, 2.5, -9.5], dir: [0, 0, 1], fov: 52 },
      look: { specular: 0.2, shine: 24, bounces: 0 },
      lights: [light(0, 4.6, 2, 0.85)],
      shapes: [
        plane([0, 0, 0], [0, 1, 0], [215, 215, 215]),
        plane([0, 5, 0], [0, -1, 0], [215, 215, 215]),
        plane([0, 0, 6], [0, 0, -1], [215, 215, 215]),
        plane([-3.5, 0, 0], [1, 0, 0], [200, 50, 50]),
        plane([3.5, 0, 0], [-1, 0, 0], [60, 170, 80]),
        sphere(-1.2, 1, 2.5, 1, [240, 240, 240], { reflect: 0.6 }),
        cyl(1.4, 1.2, 3.6, [0, 1, 0], 0.9, 2.4, [235, 235, 235]),
      ],
    }),
  },
  {
    name: 'Mirror hall',
    note: 'Two facing mirrors, an endless corridor of reflections',
    build: () => ({
      ...emptyScene(),
      ambient: { ratio: 0.2, color: [255, 255, 255] },
      camera: { pos: [0, 2.2, -7], dir: [0, -0.1, 1], fov: 75 },
      look: { specular: 0.4, shine: 64, bounces: 8 },
      lights: [light(0, 6, 0, 0.8), light(0, 4, 8, 0.4, [200, 215, 255])],
      shapes: [
        plane([0, 0, 0], [0, 1, 0], [225, 225, 225], { checker: true }),
        plane([-4, 0, 0], [1, 0, 0], [255, 255, 255], { reflect: 0.95 }),
        plane([4, 0, 0], [-1, 0, 0], [255, 255, 255], { reflect: 0.95 }),
        sphere(-1.2, 1, 1, 1, [230, 70, 70]),
        sphere(1.4, 0.8, 3.5, 0.8, [70, 150, 235]),
        cyl(0.4, 1.2, 6.5, [0, 1, 0], 0.7, 2.4, [250, 200, 70]),
      ],
    }),
  },
  {
    name: 'Mandatory',
    note: 'One ambient, one camera, one light, one of each shape. The 42 baseline',
    build: () => ({
      ...emptyScene(),
      ambient: { ratio: 0.2, color: [255, 255, 255] },
      camera: { pos: [0, 2, -8], dir: [0, -0.1, 1], fov: 70 },
      look: { specular: 0, shine: 32, bounces: 0 },
      lights: [light(-4, 6, -5, 0.7)],
      shapes: [
        plane([0, 0, 0], [0, 1, 0], [180, 180, 200]),
        sphere(-2, 1, 1, 1, [255, 90, 90]),
        cyl(0.4, 1, 2, [0, 1, 0], 0.8, 2, [90, 220, 120]),
        sphere(2.4, 0.7, 0, 0.7, [90, 150, 255]),
      ],
    }),
  },
  {
    name: 'Cylinder garden',
    note: 'Axis rotation and capped ends, in every direction',
    build: () => ({
      ...emptyScene(),
      ambient: { ratio: 0.2, color: [255, 255, 255] },
      camera: { pos: [0, 4, -10], dir: [0, -0.22, 1], fov: 60 },
      look: { specular: 0.35, shine: 48, bounces: 0 },
      lights: [light(-6, 9, -6, 0.8), light(7, 4, 0, 0.3, [180, 200, 255])],
      shapes: [
        plane([0, 0, 0], [0, 1, 0], [225, 225, 225], { checker: true }),
        cyl(-3.4, 1.5, 2, [0, 1, 0], 0.6, 3, [235, 90, 90]),
        cyl(-1.2, 1.1, 2, [0, 1, 0], 0.6, 2.2, [240, 160, 70]),
        cyl(1, 0.7, 2, [0, 1, 0], 0.6, 1.4, [230, 220, 80]),
        cyl(3.2, 1.2, 2, [0.5, 1, 0], 0.5, 2.6, [80, 200, 120]),
        cyl(0, 0.5, -1.4, [1, 0, 0], 0.5, 6, [90, 140, 240]),
      ],
    }),
  },
  {
    name: 'Empty',
    note: 'A floor and a light. Build from here',
    build: () => ({
      ...emptyScene(),
      lights: [light(-4, 7, -4, 0.75)],
      shapes: [plane([0, 0, 0], [0, 1, 0], [225, 225, 225], { checker: true })],
    }),
  },
];
