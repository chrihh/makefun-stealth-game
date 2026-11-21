// Night Ledger — the three floors of the Meridian Archive.
// Each floor is thirteen strings of twenty tiles:
//   #  stone wall        C  crate (solid cover)    P  pillar (solid cover)
//   ~  moonshadow (dark floor: harder to be seen standing in it)
//   S  intruder start    K  brass keycard          X  exit stair
//   .  plain flagstone floor
// Guards patrol between waypoints given in tile coordinates; a waypoint path
// is walked as straight legs, so waypoints are chosen on clear rows/columns.

export const TILE_WALL = '#';
export const TILE_CRATE = 'C';
export const TILE_PILLAR = 'P';
export const TILE_SHADOW = '~';
export const TILE_START = 'S';
export const TILE_KEY = 'K';
export const TILE_EXIT = 'X';
export const TILE_FLOOR = '.';

export const SOLID_TILES = new Set([TILE_WALL, TILE_CRATE, TILE_PILLAR]);

export const LEVELS = [
  {
    name: 'Floor I — Gatehouse Yard',
    hint: 'Cross the yard, lift the brass keycard, slip down the east stair.',
    map: [
      '####################',
      '#S.......##........#',
      '#..CC....##....K...#',
      '#..CC..............#',
      '#......P....~~.....#',
      '###....P....~~..C..#',
      '#........##........#',
      '#..~~....##....P...#',
      '#..~~..........P...#',
      '#....C.....###.....#',
      '#....C.............#',
      '#..........~~.....X#',
      '####################',
    ],
    guards: [
      { waypoints: [[2, 1], [8, 1]], phase: 0 },
      { waypoints: [[18, 2], [18, 9]], phase: 0.4 },
      { waypoints: [[7, 10], [17, 10]], phase: 0.7 },
    ],
  },
  {
    name: 'Floor II — Archive Wing',
    hint: 'Stacks and reading desks break every sightline. Use them.',
    map: [
      '####################',
      '#S....#.....#......#',
      '#.....#..C..#..##..#',
      '#..P......C......K.#',
      '#.....#.....#......#',
      '#..C..#..##.#..P...#',
      '###.####..##.###.###',
      '#......#.......#...#',
      '#..~~..#..C....#..C#',
      '#..~~......C.......#',
      '#....P.....##......#',
      '#..........##.....X#',
      '####################',
    ],
    guards: [
      { waypoints: [[2, 4], [2, 1]], phase: 0.1 },
      { waypoints: [[7, 4], [11, 4]], phase: 0.5 },
      { waypoints: [[5, 9], [10, 9]], phase: 0.8 },
      { waypoints: [[17, 10], [17, 7]], phase: 0.3 },
    ],
  },
  {
    name: 'Floor III — The Vault Floor',
    hint: 'Five wardens, one keycard, one stair. Leave no story behind.',
    map: [
      '####################',
      '#S..#......#.......#',
      '#...#..C...#..C..K.#',
      '#..........#.......#',
      '#.##....P..##......#',
      '#....C.....##..P...#',
      '#....C..~~.....#...#',
      '##.#####~~.#####.###',
      '#......#....#......#',
      '#..P...#..C.#..##..#',
      '#......#..C.#......#',
      '#..~~......#......X#',
      '####################',
    ],
    guards: [
      { waypoints: [[2, 3], [8, 3]], phase: 0.2 },
      { waypoints: [[13, 1], [18, 1]], phase: 0.6 },
      { waypoints: [[5, 9], [5, 11]], phase: 0.9 },
      { waypoints: [[13, 8], [18, 8]], phase: 0.45 },
      { waypoints: [[13, 11], [17, 11]], phase: 0.05 },
    ],
  },
];

/** Parse a level definition into tiles plus the special positions it names. */
export function parseLevel(definition) {
  const tiles = [];
  let start = null;
  let key = null;
  let exit = null;
  for (let row = 0; row < definition.map.length; row += 1) {
    const line = definition.map[row];
    const cells = [];
    for (let col = 0; col < line.length; col += 1) {
      const mark = line[col];
      if (mark === TILE_START) {
        start = { col, row };
        cells.push(TILE_FLOOR);
      } else if (mark === TILE_KEY) {
        key = { col, row };
        cells.push(TILE_FLOOR);
      } else if (mark === TILE_EXIT) {
        exit = { col, row };
        cells.push(TILE_EXIT);
      } else {
        cells.push(mark);
      }
    }
    tiles.push(cells);
  }
  return { tiles, start, key, exit, guards: definition.guards, name: definition.name, hint: definition.hint };
}
