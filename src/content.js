// Content is data. Coordinates are tiles; simulation units are 16 per tile.
export const TITLE = 'The Gilded Goner';
export const ID = 'TheGildedGoner-F3';
export const TILE = 16;
export const point = (x, y) => ({ x: (x + .5) * TILE, y: (y + .5) * TILE });
export const WEAPONS = {
  sword: { name: 'Pilgrim’s blade', description: 'A quick, reliable blade. Three strikes form a flowing chain.', damage: 23, reach: 32, cost: 17, wind: .14, active: .16, recover: .23, color: '#d8d4b2' },
  glaive: { name: 'Vesper glaive', description: 'A slower, far-reaching blade. Heavy strikes break a guard.', damage: 32, reach: 42, cost: 25, wind: .25, active: .2, recover: .36, color: '#dcb76d' }
};
export const ENEMIES = {
  pilgrim: { name: 'Hollow pilgrim', hp: 72, damage: 17, speed: 28, range: 31, wind: .76, recover: .9, reward: 24, posture: 45, size: 1.05, move: 'slash', color: '#6d7774' },
  lancer: { name: 'Thorn lancer', hp: 100, damage: 23, speed: 33, range: 45, wind: .95, recover: 1.1, reward: 35, posture: 65, size: 1.25, move: 'thrust', color: '#846f4f' },
  warden: { name: 'Bronze warden', hp: 150, damage: 27, speed: 22, range: 37, wind: 1.1, recover: 1.35, reward: 55, posture: 85, size: 1.4, move: 'overhead', color: '#9a7d4e', guard: true },
  cantor: { name: 'Veiled cantor', hp: 66, damage: 20, speed: 20, range: 145, wind: 1.25, recover: 1.5, reward: 30, posture: 40, size: 1.15, move: 'cast', color: '#7b778d', ranged: true },
  boss: { name: 'AUREL, THE LAST BELLKEEPER', hp: 660, damage: 30, speed: 29, range: 57, wind: 1.05, recover: 1.25, reward: 400, posture: 145, size: 2.1, move: 'twohand', color: '#ae8950', boss: true }
};

export const SANCTUM = {
  id: 'bellwether', name: 'The Bellwether Sanctum', width: 52, height: 54,
  rooms: [
    { id: 'court', name: 'The Quiet Approach', x: 15, y: 35, w: 19, h: 16, floor: 'stone' },
    { id: 'west-road', name: 'Pilgrim’s Steps', x: 11, y: 29, w: 8, h: 12, floor: 'stone' },
    { id: 'garden', name: 'Garden of Names', x: 4, y: 20, w: 17, h: 14, floor: 'grass' },
    { id: 'north-road', name: 'The Fallen Choir', x: 13, y: 16, w: 29, h: 7, floor: 'stone' },
    { id: 'cloister', name: 'The Amber Cloister', x: 33, y: 21, w: 15, h: 14, floor: 'stone' },
    { id: 'east-road', name: 'Lantern Walk', x: 29, y: 30, w: 8, h: 12, floor: 'stone' },
    { id: 'shortcut', name: 'The Pilgrim’s Gate', x: 23, y: 21, w: 5, h: 16, floor: 'stone' },
    { id: 'vestibule', name: 'Bellkeeper’s Threshold', x: 25, y: 12, w: 7, h: 7, floor: 'stone' },
    { id: 'arena', name: 'The Unrung Cathedral', x: 19, y: 2, w: 20, h: 13, floor: 'marble' }
  ],
  start: point(24, 45),
  checkpoints: [
    { id: 'hearth', name: 'Pilgrim’s Rest', ...point(24, 44) },
    { id: 'choir', name: 'The Fallen Choir', ...point(23, 18) }
  ],
  gates: [
    { id: 'shortcut', cells: [[23, 29], [24, 29], [25, 29], [26, 29], [27, 29]], ...point(25, 28), label: 'Unbar the pilgrim’s gate' },
    { id: 'seal', cells: [[25, 14], [26, 14], [27, 14], [28, 14], [29, 14], [30, 14], [31, 14]], ...point(28, 15), label: 'Enter the silent cathedral' }
  ],
  enemies: [
    ['pilgrim', 17, 37], ['pilgrim', 13, 31], ['lancer', 17, 25], ['warden', 9, 24],
    ['pilgrim', 18, 19], ['cantor', 37, 25], ['lancer', 41, 29], ['warden', 37, 19],
    ['boss', 28, 8]
  ].map(([type, x, y], i) => ({ id: `foe-${i}`, type, ...point(x, y) })),
  objects: [
    { id: 'keeper', type: 'npc', name: 'Iona, keeper of names', ...point(21, 43) },
    { id: 'key', type: 'chest', name: 'The voiceless clapper', ...point(7, 23), item: 'key' },
    { id: 'glaive', type: 'chest', name: 'Vesper glaive', ...point(44, 27), item: 'glaive' },
    { id: 'flask', type: 'pickup', name: 'An amber tear', ...point(40, 32), item: 'flask' },
    { id: 'embers', type: 'pickup', name: 'A pilgrim’s last embers', ...point(6, 30), item: 'embers' },
    { id: 'memory', type: 'lore', name: 'A weathered epitaph', ...point(12, 21) },
    { id: 'bell', type: 'bell', name: 'Ring the dawn bell', ...point(28, 4) }
  ],
  obstacles: [[22, 5], [35, 5], [22, 11], [35, 11], [34, 23], [46, 23], [34, 32], [46, 32], [16, 46], [32, 46]]
};

export const TRIAL = {
  id: 'trial', name: 'The Ashen Proving Ground', width: 26, height: 26,
  rooms: [{ id: 'trial', name: 'The Ashen Proving Ground', x: 2, y: 2, w: 22, h: 22, floor: 'marble' }],
  start: point(12, 19), checkpoints: [{ id: 'hearth', name: 'Trial rest', ...point(12, 21) }], gates: [], obstacles: [],
  enemies: [['pilgrim', 7, 13], ['lancer', 18, 13], ['warden', 7, 6], ['cantor', 18, 6]].map(([type, x, y], i) => ({ id: `trial-${i}`, type, ...point(x, y) })),
  objects: [{ id: 'glaive', type: 'chest', name: 'Vesper glaive', item: 'glaive', ...point(15, 20) }]
};

export const LORE = [
  'Here lie those who mistook gold for dawn.',
  'Aurel rang the bell until the sun forgot to rise. In the silence, the sanctuary learned to hunger.',
  'One small voice may yet be enough.'
];

// Register more authored levels here. An exit object with `destination` connects them.
export const LEVELS = { bellwether: SANCTUM, trial: TRIAL };
