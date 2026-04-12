// Wave management utilities
// Keep this module stateless; pass in the scene, player, arrays and parameters.

export function getRandomEnemyType(currentDifficulty) {
  const tiers = [
    ['slime', 'bat', 'spider', 'snake', 'worm'],
    ['lereon_knight', 'wolf', 'skeleton_sword', 'orc', 'burning_demon_imp'],
    ['werewolf', 'viking_warrior', 'baby_dragon', 'big_skeleton'],
    ['burning_demon', 'skeleton_king', 'death_angel', 'legendary_dragon']
  ];
  const tierIndex = Math.min(3, Math.floor(currentDifficulty / 2));
  const pool = [];
  for (let i = 0; i <= tierIndex; i++) pool.push(...tiers[i]);
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

export function spawnSingleEnemy(scene, player, enemies, EnemyClass, currentDifficulty) {
  const angle = Math.random() * Math.PI * 2;
  const distance = 300 + Math.random() * 200;
  const x = player.sprite.x + Math.cos(angle) * distance;
  const y = player.sprite.y + Math.sin(angle) * distance;
  const type = getRandomEnemyType(currentDifficulty);
  const enemy = new EnemyClass(scene, player, x, y, type, currentDifficulty);
  enemies.push(enemy);
  return enemy;
}

export function spawnEnemies(scene, player, enemies, EnemyClass, count, currentDifficulty) {
  let spawned = 0;
  for (let i = 0; i < count; i++) {
    spawnSingleEnemy(scene, player, enemies, EnemyClass, currentDifficulty);
    spawned++;
  }
  return spawned;
}

export function maintainEnemyLimit(scene, player, enemies, EnemyClass, currentEnemyCount, maxEnemies, currentDifficulty) {
  if (currentEnemyCount >= maxEnemies) return 0;
  const toSpawn = Math.min(maxEnemies - currentEnemyCount, 2);
  spawnEnemies(scene, player, enemies, EnemyClass, toSpawn, currentDifficulty);
  return toSpawn;
}

export function startDifficultyProgression(scene, updateDifficultyFn) {
  return scene.time.addEvent({ delay: 30000, callback: updateDifficultyFn, loop: true });
}
