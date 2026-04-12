// collectible items
export const ITEM_TYPES = {
  'berry01blue': {
    sprite: 'berry01blue',
    name: 'Frost Berry',
    category: 'berry',
    rarity: 'common',
    description: 'Provides steady health and minor speed',
    effects: { health: () => 20, speed: () => 2 }
  },
  'sword_sharpener': { sprite: 'weapon_longsword', name: 'Sword Sharpener', category: 'item', rarity: 'common', description: '+5 flat attack damage', effects: { damage: () => 5 } },
  'arrow_quiver': { sprite: 'weapon_bow', name: 'Arrow Quiver', category: 'item', rarity: 'common', description: '+10% attack speed', effects: { attackSpeed: () => 10 } },
  'leather_handle': { sprite: 'weapon_dagger', name: 'Leather Handle', category: 'item', rarity: 'common', description: '+8% attack speed', effects: { attackSpeed: () => 8 } },
  'null_magic_rock': { sprite: 'gem01orange', name: 'Null Magic Rock', category: 'item', rarity: 'uncommon', description: '+10 flat attack damage', effects: { damage: () => 10 } },
  'iron_handle': { sprite: 'gem02blue', name: 'Iron Handle', category: 'item', rarity: 'uncommon', description: '+6 defense', effects: { defense: () => 6 } },
  'leather_vest': { sprite: 'berry03purple', name: 'Leather Vest', category: 'item', rarity: 'common', description: '+6 flat attack damage', effects: { damage: () => 6 } },
  'oil_jar': { sprite: 'glass01orange', name: 'Oil Jar', category: 'item', rarity: 'uncommon', description: '+15% weapon size', effects: { weaponSize: () => 0.15 } },
  'glove': { sprite: 'berry04red', name: 'Glove', category: 'item', rarity: 'common', description: '+10% weapon size', effects: { weaponSize: () => 0.1 } },
  'rock_bag': { sprite: 'gem03yellow', name: 'Rock Bag', category: 'item', rarity: 'common', description: '+10% attack speed', effects: { attackSpeed: () => 10 } },
  'magic_book': { sprite: 'gem04purple', name: 'Magic Book', category: 'item', rarity: 'rare', description: '+1 debuff power (stronger status effects)', effects: { debuffPower: () => 1 } },
  'wizard_robe': { sprite: 'gem05red', name: 'Wizard Robe', category: 'item', rarity: 'rare', description: '+15% weapon size, +4 damage', effects: { weaponSize: () => 0.15, damage: () => 4 } },
  'seeds': { sprite: 'berry01blue', name: 'Seeds', category: 'item', rarity: 'common', description: '+5 flat damage, +1 debuff power', effects: { damage: () => 5, debuffPower: () => 1 } },
  'health_vile': { sprite: 'glass02blue', name: 'Health Vile', category: 'item', rarity: 'common', description: '+3 HP/sec regeneration', effects: { regeneration: () => 3 } }
};

export const ENHANCED_ITEM_TYPES = {
  'blueshroom': {
    sprite: 'blueshroom',
    name: 'Blue Mushroom',
    category: 'consumable',
    rarity: 'common',
    description: 'Mysterious fungus with healing properties',
    effects: {
      health: () => Math.floor(25 + Math.random() * 20),
      regeneration: () => Math.floor(1 + Math.random() * 2),
    }
  },
  'bongo': {
    sprite: 'bongo',
    name: 'Battle Bongo',
    category: 'artifact',
    rarity: 'uncommon',
    description: 'Rhythmic drums that boost combat performance',
    effects: {
      attackSpeed: () => Math.floor(15 + Math.random() * 20),
      speed: () => Math.floor(8 + Math.random() * 12),
    }
  },
  'clock': {
    sprite: 'clock',
    name: 'Time Keeper',
    category: 'artifact',
    rarity: 'rare',
    description: 'Ancient timepiece that manipulates temporal flow',
    effects: {
      attackSpeed: () => Math.floor(20 + Math.random() * 25),
      critChance: () => Math.floor(8 + Math.random() * 15),
    }
  },
  'crown': {
    sprite: 'crown',
    name: 'Royal Crown',
    category: 'artifact',
    rarity: 'epic',
    description: 'Majestic headpiece that enhances all abilities',
    effects: {
      maxHealth: () => Math.floor(30 + Math.random() * 40),
      damage: () => Math.floor(8 + Math.random() * 15),
      speed: () => Math.floor(10 + Math.random() * 15),
    }
  },
  'diamond': {
    sprite: 'diamond',
    name: 'Perfect Diamond',
    category: 'gem',
    rarity: 'legendary',
    description: 'Flawless crystal that amplifies inner power',
    effects: {
      critChance: () => Math.floor(15 + Math.random() * 20),
      critDamage: () => Math.floor(25 + Math.random() * 35),
      damage: () => Math.floor(12 + Math.random() * 20),
    }
  },
  'goldencup': {
    sprite: 'goldencup',
    name: 'Golden Chalice',
    category: 'artifact',
    rarity: 'epic',
    description: 'Sacred vessel that overflows with life energy',
    effects: {
      maxHealth: () => Math.floor(50 + Math.random() * 50),
      regeneration: () => Math.floor(3 + Math.random() * 5),
      health: () => Math.floor(60 + Math.random() * 80),
    }
  },
  'lantern': {
    sprite: 'lantern',
    name: 'Guiding Lantern',
    category: 'tool',
    rarity: 'uncommon',
    description: 'Illuminating beacon that reveals hidden potential',
    effects: {
      speed: () => Math.floor(12 + Math.random() * 18),
      critChance: () => Math.floor(5 + Math.random() * 10),
      defense: () => Math.floor(3 + Math.random() * 7),
    }
  }
};
