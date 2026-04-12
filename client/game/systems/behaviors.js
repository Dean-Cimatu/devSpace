// weapon attack behaviors
import { BurnZone, FollowZone, LightningFallStrike, OrbitingBlade } from './zones.js';

// line damage attack
function lineDamage(scene, player, enemies, x, y, angle, length, width, damage, damageType, sourceKey = 'melee', invulnMs = 140) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const endX = x + dx * length, endY = y + dy * length;
  const g = scene.add.graphics();
  g.lineStyle(Math.max(width, 6), 0xffffff, 0.80);
  g.beginPath(); g.moveTo(x, y); g.lineTo(endX, endY); g.strokePath();
  g.setDepth(90);
  scene.tweens.add({ targets: g, alpha: 0, duration: 140, ease: 'Sine.easeIn', onComplete: () => g.destroy() });
  // Tip impact ring
  const ring = scene.add.circle(endX, endY, 6, 0xffffff, 0.70);
  ring.setDepth(91);
  scene.tweens.add({ targets: ring, scaleX: 2.0, scaleY: 2.0, alpha: 0, duration: 180, ease: 'Sine.easeOut', onComplete: () => ring.destroy() });
  enemies.forEach(e => {
    if (!e.isAlive) return;
    // project point onto line and check distance to segment
    const vx = e.sprite.x - x, vy = e.sprite.y - y;
    const t = Math.max(0, Math.min(1, (vx*dx + vy*dy) / (length)));
    const px = x + dx * length * t, py = y + dy * length * t;
    const dist = Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, px, py);
    if (dist <= width * 0.6) {
      if (e.tryTakeDamage) {
        e.tryTakeDamage(damage, damageType, sourceKey, invulnMs);
      } else {
        e.takeDamage(damage, damageType);
      }
      if (damageType && e.applyDebuff) e.applyDebuff(damageType, 1 + (player?.debuffPower || 0));
      // Show floating damage text
      if (player && player.showFloatingDamage) player.showFloatingDamage(e, damage);
    }
  });
}

function coneDamage(scene, player, enemies, x, y, angle, radius, arcRadians, damage, damageType, sourceKey = 'melee', invulnMs = 140) {
  const start = angle - arcRadians/2, end = angle + arcRadians/2;
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 0.18);
  g.lineStyle(4, 0xffffff, 0.75);
  g.beginPath();
  g.moveTo(x, y);
  g.arc(x, y, radius, start, end);
  g.closePath();
  g.fillPath();
  g.strokePath();
  g.setDepth(90);
  scene.tweens.add({ targets: g, alpha: 0, duration: 160, ease: 'Sine.easeIn', onComplete: () => g.destroy() });
  // Impact pulse at swing origin
  const ring = scene.add.circle(x, y, 7, 0xffffff, 0.75);
  ring.setDepth(91);
  scene.tweens.add({ targets: ring, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 200, ease: 'Sine.easeOut', onComplete: () => ring.destroy() });
  enemies.forEach(e => {
    if (!e.isAlive) return;
    const ang = Phaser.Math.Angle.Between(x, y, e.sprite.x, e.sprite.y);
    const dist = Phaser.Math.Distance.Between(x, y, e.sprite.x, e.sprite.y);
    const inArc = Phaser.Math.Angle.ShortestBetween(Phaser.Math.RadToDeg(angle), Phaser.Math.RadToDeg(ang));
    if (Math.abs(inArc) <= Phaser.Math.RadToDeg(arcRadians/2) && dist <= radius) {
      if (e.tryTakeDamage) {
        e.tryTakeDamage(damage, damageType, sourceKey, invulnMs);
      } else {
        e.takeDamage(damage, damageType);
      }
      if (damageType && e.applyDebuff) e.applyDebuff(damageType, 1 + (player?.debuffPower || 0));
      // Show floating damage text
      if (player && player.showFloatingDamage) player.showFloatingDamage(e, damage);
    }
  });
}

export function executeWeaponAttack(scene, player, weapon, target, enemies, projectiles, zones) {
  const px = player.sprite.x, py = player.sprite.y;
  const damage = weapon.instanceDamage || (typeof weapon.damage === 'function' ? weapon.damage() : weapon.damage) || 5;
  const angle = target
    ? Phaser.Math.Angle.Between(px, py, target.sprite.x, target.sprite.y)
    : (player.lastFacingAngle || 0);

  switch (weapon.id) {
    case 'weapon_longsword': { // Broadsword: 180° swing around the player, about half of flail reach
      const baseDam = damage + player.baseDamage;
      // Use half of a typical flail reach; fall back to weapon.attackRange if present
      const approxFlail = 75; // midpoint of flail reach (~65..85)
      const radius = Math.max(38, Math.floor((weapon.attackRange || approxFlail) * 0.5));
      const arc = Math.PI; // 180 degrees
      // Single swing in facing direction
      coneDamage(scene, player, enemies, px, py, angle, radius, arc, baseDam, weapon.damageType, 'weapon_longsword');
      if (weapon.maxMode) {
        // At max, follow up with a quick reverse sweep for coverage
        scene.time.delayedCall(140, () => {
          coneDamage(scene, player, enemies, px, py, angle + Math.PI, radius, arc, Math.floor(baseDam * 0.9), weapon.damageType, 'weapon_longsword');
        });
      }
      return true;
    }
    case 'weapon_flail': {
      // Heavy sweeping arcs; size scales slightly with level, reaching just over player size at level 10.
      const baseDam = damage + player.baseDamage;
      const lvl = weapon.level || (player.weaponLevels?.[weapon.id] || 1);
      // Grow only on even levels: steps over levels 2,4,6,8,10 -> 5 steps
      const steps = Math.max(0, Math.floor((Math.min(lvl, 10) - 1) / 2));
      const progress = steps / 5; // 0..1 across 5 even-level steps
      // Make flail smaller overall
      const minLen = 50; // closer to player
      const maxLen = 65; // modest growth at level 10
      const radius = Math.floor(minLen + (maxLen - minLen) * progress);
      const sweepArc = Math.PI * 0.95; // slightly under 180°
      // Two quick opposite-direction sweeps
      coneDamage(scene, player, enemies, px, py, angle, radius, sweepArc, baseDam, weapon.damageType, 'weapon_flail');
      scene.time.delayedCall(160, () => {
        coneDamage(scene, player, enemies, px, py, angle + Math.PI, radius, sweepArc, Math.floor(baseDam*0.9), weapon.damageType, 'weapon_flail');
      });
      if (weapon.maxMode) {
        // Whirlwind: pulse damage in a full circle for a short duration
        const pulses = 4; // total pulses across ~800ms
        for (let i = 0; i < pulses; i++) {
          scene.time.delayedCall(200 * i, () => {
            coneDamage(scene, player, enemies, px, py, angle + (i * Math.PI/2), radius + 10, Math.PI * 2, Math.floor(baseDam * 0.7), weapon.damageType, 'weapon_flail');
          });
        }
      }
      return true;
    }
    case 'weapon_crystalsword': {
      // Swinging arc similar to a whip, with lightning damage flavor
      const baseDam = Math.floor((damage + player.baseDamage) * (weapon.maxMode ? 1.15 : 1.0));
      const radius = Math.floor((weapon.attackRange || 100) * (weapon.maxMode ? 1.1 : 1.0));
      const arc = weapon.maxMode ? (Math.PI * 1.0) : (Math.PI * 0.8); // up to ~180° at max
      coneDamage(scene, player, enemies, px, py, angle, radius, arc, baseDam, weapon.damageType, 'weapon_crystalsword');
      return true;
    }
    case 'weapon_whip': {
      // Make whip function as a swinging arc, similar to the crystal blade
      const radius = (weapon.attackRange || 170);
      const arc = weapon.maxMode ? (Math.PI * 1.0) : (Math.PI * 0.85); // ~153° base, up to 180° at max
      coneDamage(scene, player, enemies, px, py, angle, radius, arc, damage + player.baseDamage, weapon.damageType, 'weapon_whip');
      return true;
    }
    case 'weapon_claymore': { // persistent orbiting blades
      const lvl = weapon.level || (player.weaponLevels?.[weapon.id] || 1);
      const desiredCount = 1 + Math.floor((lvl - 1) / 2); // +1 blade every 2 levels
      player._claymoreBlades = (player._claymoreBlades || []).filter(b => b && b.isAlive);
      const radius = weapon.attackRange || 100;
      const speed = 2.0; // radians per second
      const bladeDamage = (damage + player.baseDamage);
      // Update existing blades' parameters
      player._claymoreBlades.forEach((b, i) => {
        b.radius = radius;
        b.speed = speed;
        b.damage = bladeDamage;
      });
      // Create additional blades if needed
      const current = player._claymoreBlades.length;
      for (let i = current; i < desiredCount; i++) {
        const phase = (Math.PI * 2) * (i / desiredCount);
        const blade = new OrbitingBlade(scene, player, radius, speed, phase, bladeDamage, weapon.damageType);
        zones.push(blade);
        player._claymoreBlades.push(blade);
      }
      // If too many (shouldn't usually happen), remove extras
      if (player._claymoreBlades.length > desiredCount) {
        const extras = player._claymoreBlades.splice(desiredCount);
        extras.forEach(b => b.destroy());
      }
      return true;
    }
    case 'weapon_shield': {
      // Push enemies in front arc, or around if max
      const rad = (weapon.attackRange||70);
      enemies.forEach(e => {
        const dist = Phaser.Math.Distance.Between(px, py, e.sprite.x, e.sprite.y);
        if (dist <= rad) {
          const ang = Phaser.Math.Angle.Between(px, py, e.sprite.x, e.sprite.y);
          const push = weapon.maxMode ? 120 : 60;
          e.sprite.x += Math.cos(ang) * push;
          e.sprite.y += Math.sin(ang) * push;
          if (e.tryTakeDamage) {
            e.tryTakeDamage(Math.floor((damage+player.baseDamage)*0.6), weapon.damageType, 'weapon_shield');
          } else {
            e.takeDamage(Math.floor((damage+player.baseDamage)*0.6), weapon.damageType);
          }
        }
      });
      // Max: brief impervious window to attacks
      if (weapon.maxMode && player && player.scene && player.isAlive) {
        const now = player.scene.time.now || Date.now();
        player.imperviousUntil = Math.max(player.imperviousUntil || 0, now + 1200);
        // Flash player white to signal invulnerability window
        if (player.sprite) {
          player.sprite.setTintFill(0xffffff);
          player.scene.time.delayedCall(300, () => {
            if (player.isAlive && player.sprite) player.sprite.clearTint();
          });
        }
      }
      return true;
    }
    case 'weapon_doubleaxe': {
      // Now treated as a slow projectile; fall back to default projectile handling
      return false;
    }
    case 'weapon_torch': {
      const radius = weapon.maxMode ? 140 : 70;
      // Ensure near-100% uptime at max by using a long duration that overlaps the cooldown
      const dur = weapon.maxMode ? 6000 : 2000;
      const dps = Math.max(2, Math.floor((damage+player.baseDamage)*0.2));
      const rx = px + (Math.random()*2-1) * (weapon.attackRange||220);
      const ry = py + (Math.random()*2-1) * (weapon.attackRange||220);
      zones.push(new BurnZone(scene, rx, ry, radius, dps, dur));
      return true;
    }
    case 'weapon_spear': {
      // piercing projectile
      weapon.piercing = true;
      return false; // fall back to default projectile path
    }
    case 'weapon_stone': {
      // Only allow split at max level; at lower levels, it's a single-hit rock with no split
      weapon.special = weapon.maxMode ? 'stone_split' : undefined;
      return false;
    }
    case 'weapon_staff': {
      const tx = target ? target.sprite.x : (px + Math.cos(angle)*120);
      const ty = target ? target.sprite.y : (py + Math.sin(angle)*120);
      // Primary strike: fall from sky then explode
      zones.push(new LightningFallStrike(scene, tx, ty, 70, damage + player.baseDamage, 1 + (player?.debuffPower || 0)));
      if (weapon.maxMode) {
        // Max: also center a strike on the player
        zones.push(new LightningFallStrike(scene, px, py, 90, Math.floor((damage+player.baseDamage)*1.2), 1 + (player?.debuffPower || 0)));
        // Apply a short self-buff: small attack speed and defense boost for a few seconds
        player._staffBuffs = player._staffBuffs || 0;
        if (player._staffBuffs === 0) {
          player.applyStatBonus('attackSpeed', 15);
          player.applyStatBonus('defense', 2);
          const clearBuff = () => {
            // revert by subtracting the same amount if still alive
            if (!player || !player.isAlive) return;
            player.attackSpeed -= 15;
            player.defense -= 2;
            player._staffBuffs = 0;
          };
          player._staffBuffs = 1;
          scene.time.delayedCall(4000, clearBuff);
        }
      }
      return true;
    }
    case 'magic_wand': {
      weapon.piercing = true;
      weapon.special = weapon.maxMode ? 'wand_burn_trail' : undefined;
      return false;
    }
    case 'weapon_rose': {
      weapon.special = weapon.maxMode ? 'rose_poison_aoe' : undefined;
      return false;
    }
    case 'weapon_lantern': {
      const radius = (weapon.attackRange||80) * (weapon.maxMode ? 2 : 1);
      const dps = Math.max(1, Math.floor((damage+player.baseDamage)*0.2));
      const options = weapon.maxMode ? { pushIntervalMs: 2000, pushForce: 160 } : {};
      // Use orange tint for clear zone indication
      zones.push(new FollowZone(scene, player, radius, dps, 2500, 0xffa500, options));
      return true;
    }
    case 'weapon_claws': {
      const baseDam = damage + player.baseDamage;
      const len = weapon.attackRange || 60;
      const arc = Math.PI/3;
      coneDamage(scene, player, enemies, px, py, angle, len, arc, baseDam, weapon.damageType, 'weapon_claws');
      if (weapon.maxMode) {
        coneDamage(scene, player, enemies, px, py, angle - Math.PI/2, len*1.2, arc*1.3, Math.floor(baseDam*1.1), weapon.damageType, 'weapon_claws');
        coneDamage(scene, player, enemies, px, py, angle + Math.PI/2, len*1.2, arc*1.3, Math.floor(baseDam*1.1), weapon.damageType, 'weapon_claws');
      }
      return true;
    }
  }
  return false; // not handled, use default attack
}
