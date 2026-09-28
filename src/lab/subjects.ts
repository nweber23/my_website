export interface Subject {
  id: string;
  anchor: string;
  index: string;
  title: string;
  short: string;
  kind: string;
  blurb: string;
  /** Distance from the sensor plane, mm. */
  distance: number;
  color: number;
  metrics: [string, string][];
  links: { label: string; href: string }[];
}

export const SUBJECTS: Subject[] = [
  {
    id: 'transcendence',
    anchor: 'project-transcendence',
    index: '01',
    title: 'Transcendence Casino',
    short: 'Casino',
    kind: 'Real-time multiplayer casino',
    blurb:
      'Blackjack, Poker and slots spanning Go, C++ and React — bridged by gRPC and a hand-rolled WebSocket hub, with exact decimal money math.',
    distance: 600,
    color: 0xff5a1f,
    metrics: [
      ['Games', '3 live'],
      ['Architecture', '3-tier gRPC'],
      ['Monitoring', '6 dashboards'],
    ],
    links: [
      { label: 'Live', href: 'https://transcendence.nweber.me' },
      { label: 'Source', href: 'https://github.com/nweber23/transcendence' },
    ],
  },
  {
    id: 'go-renderer',
    anchor: 'project-go-renderer',
    index: '02',
    title: '3D Go Renderer',
    short: 'Go Renderer',
    kind: 'From-scratch OpenGL renderer',
    blurb:
      'Custom .obj/.mtl parsing, ear-clipping over Newell-normal planes and an OpenGL 4.1 pipeline with zero steady-state heap allocations.',
    distance: 1100,
    color: 0x6fd3e8,
    metrics: [
      ['Allocs/frame', '0.06'],
      ['Parser', 'Concurrent'],
      ['UV modes', '3'],
    ],
    links: [{ label: 'Source', href: 'https://github.com/nweber23/3D-Go-Renderer' }],
  },
  {
    id: 'elo',
    anchor: 'project-elo',
    index: '03',
    title: '42 ELO Leaderboard',
    short: 'ELO Leaderboard',
    kind: 'Competitive rankings, Go + PostgreSQL',
    blurb:
      'Row-locked rating updates so concurrent match reports never clobber each other; composite indexes and Redis for a 30 ms average response.',
    distance: 2000,
    color: 0xe9b65b,
    metrics: [
      ['Avg response', '30 ms'],
      ['Uptime', '99.9%'],
      ['Status', 'Archived'],
    ],
    links: [
      { label: 'Demo', href: 'https://eloleaderboard.de' },
      { label: 'Source', href: 'https://github.com/nweber23/42_ELO_Leaderboard' },
    ],
  },
  {
    id: 'minirt',
    anchor: 'project-minirt',
    index: '04',
    title: 'miniRT',
    short: 'miniRT',
    kind: 'SIMD raytracer in C',
    blurb:
      'SSE/AVX intrinsics, structure-of-arrays memory layout and tile-based threading took it from 1–5 FPS to 120+ FPS — an 80× speed-up.',
    distance: 3800,
    color: 0xd8d2c8,
    metrics: [
      ['Frame rate', '120+ fps'],
      ['Speed-up', '80×'],
      ['SIMD', 'SSE/AVX'],
    ],
    links: [{ label: 'Source', href: 'https://github.com/nweber23/miniRT' }],
  },
  {
    id: 'minishell',
    anchor: 'project-minishell',
    index: '05',
    title: 'minishell',
    short: 'minishell',
    kind: 'POSIX shell in C',
    blurb:
      'A hand-written lexer and recursive-descent parser over raw fork/execve, dup2 pipelines, here-docs and sigaction — no system(), no shortcuts.',
    distance: 9000,
    color: 0x9be37a,
    metrics: [
      ['Standard', 'POSIX'],
      ['Primitives', 'fork/exec'],
      ['Signals', 'sigaction'],
    ],
    links: [{ label: 'Source', href: 'https://github.com/nweber23/minishell' }],
  },
];
