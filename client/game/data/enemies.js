// enemy stats and types
export const ENEMY_TYPES = {
  'slime': { sprite: 'slime', size: 32, health: 40, damage: 8, baseSpeed: 90 },
  'bat': { sprite: 'bat', size: 28, health: 30, damage: 6, baseSpeed: 95 },
  'spider': { sprite: 'spider', size: 24, health: 25, damage: 5, baseSpeed: 100 },
  'snake': { sprite: 'snake', size: 40, health: 50, damage: 10, baseSpeed: 85 },
  'worm': { sprite: 'worm', size: 36, health: 45, damage: 7, baseSpeed: 88 },
  'lereon_knight': { sprite: 'lereon_knight', size: 64, health: 100, damage: 15, baseSpeed: 75, resistances: { physical: 1 } },
  'wolf': { sprite: 'wolf', size: 48, health: 70, damage: 12, baseSpeed: 80 },
  'skeleton_sword': { sprite: 'skeleton_sword', size: 52, health: 75, damage: 13, baseSpeed: 82, resistances: { physical: 2 } },
  'orc': { sprite: 'orc', size: 56, health: 85, damage: 14, baseSpeed: 78, resistances: { physical: 1 } },
  'burning_demon_imp': { sprite: 'burning_demon_imp', size: 44, health: 60, damage: 11, baseSpeed: 83, resistances: { burn: 2 } },
  'werewolf': { sprite: 'werewolf', size: 60, health: 90, damage: 16, baseSpeed: 76, resistances: { poison: 1 } },
  'viking_warrior': { sprite: 'viking_warrior', size: 68, health: 110, damage: 18, baseSpeed: 73 },
  'baby_dragon': { sprite: 'baby_dragon', size: 72, health: 120, damage: 20, baseSpeed: 70 },
  'big_skeleton': { sprite: 'big_skeleton', size: 80, health: 150, damage: 25, baseSpeed: 65, resistances: { physical: 2 } },
  'burning_demon': { sprite: 'burning_demon', size: 84, health: 160, damage: 28, baseSpeed: 62, resistances: { burn: 3 } },
  'skeleton_king': { sprite: 'skeleton_king', size: 88, health: 180, damage: 30, baseSpeed: 60, resistances: { physical: 2 } },
  'death_angel': { sprite: 'death_angel', size: 92, health: 200, damage: 35, baseSpeed: 55, resistances: { lightning: 1 } },
  'legendary_dragon': { sprite: 'legendary_dragon', size: 120, health: 300, damage: 50, baseSpeed: 45, resistances: { physical: 2, burn: 2, poison: 2, lightning: 2 } }
};
