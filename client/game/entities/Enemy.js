import { ENEMY_TYPES } from '../data/enemies.js';
import { DAMAGE_TYPES } from '../data/weapons.js';

// enemy ai and combat
export class Enemy {
  constructor(scene, playerRef, x, y, enemyType = 'lereon_knight', difficulty = 1) {
    this.scene = scene;
    this.player = playerRef;
    const enemyData = ENEMY_TYPES[enemyType] || ENEMY_TYPES['lereon_knight'];
    this.enemyType = enemyType;
    this.enemyData = enemyData;
    this.id = `enemy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // sprite and shadow
    this.shadow = scene.add.ellipse(x, y + 35, 50, 25, 0x000000, 0.8);
    this.shadow.setDepth(0.5);
    this.sprite = scene.physics.add.sprite(x, y, enemyData.sprite);
    this.sprite.setDepth(1);
    this.sprite.name = this.id;
  const difficultyMultiplier = 1 + ((difficulty - 1) * 0.20);
    const waveMult = (window.waveMultiplier || 1);
    const baseScale = 1.0;
    const densityFactor = (enemyData.health + enemyData.size) / 100;
    const scaleBonus = densityFactor > 1.5 ? 0.5 : 0;
    const finalScale = baseScale + scaleBonus;
    const scaledSize = enemyData.size * finalScale * 1.3; // ~30% larger
    this.sprite.setDisplaySize(scaledSize, scaledSize);
    const sizeSpeedModifier = Math.max(0.5, 1 - (enemyData.size - 24) / 200);
    const randomSpeedVariation = 0.8 + Math.random() * 0.4;
  const speedDifficultyBonus = 1 + ((difficulty - 1) * 0.06);
    this.speed = ((enemyData.baseSpeed * sizeSpeedModifier * randomSpeedVariation * speedDifficultyBonus) + (window.globalEnemySpeedBonus || 0)) * 0.7;
  this.health = Math.floor(enemyData.health * difficultyMultiplier * waveMult);
    this.maxHealth = this.health;
  this.damage = Math.floor(enemyData.damage * difficultyMultiplier * waveMult);
    this.damageTakenMultiplier = 1.0;
    this.resistances = { physical: 0, burn: 0, poison: 0, lightning: 0, armor_weaken: 0 };
    if (enemyData.resistances && typeof enemyData.resistances === 'object') {
      this.resistances = { ...this.resistances, ...enemyData.resistances };
    }
    this.debuffs = {
      poison: { time: 0, tick: 0.2, acc: 0 },
      burn: { time: 0, tick: 1.0, acc: 0 },
      armorWeaken: { time: 0, mult: 1.15 }
    };
    this.direction = Math.random() * Math.PI * 2;
    const shadowSize = Math.max(30, scaledSize * 0.6);
    this.collisionRadius = shadowSize * 0.75;
    this.hurtboxRadius = Math.max(25, scaledSize * 0.45);
    this.shadow.setSize(shadowSize, shadowSize * 0.5);
    this.isAlive = true;
  // Per-weapon/source invulnerability timers: enemy can be hit by the same weapon only after a short cooldown,
  // but different weapons can still deal damage in the same timeframe.
  this._invulnBySource = new Map(); // key: weaponId or source key, value: last hit timestamp (ms)
    this.createHPBar();
    if (enemyData.animated) {
      this.createAnimations();
      this.sprite.play(`${enemyType}_walk`);
    }
  }
  
  // Prevents same weapon from hitting multiple times too fast
  tryTakeDamage(damage, damageType, sourceKey = 'generic', invulnMs = 140) {
    const now = this.scene?.time?.now || Date.now();
    const last = this._invulnBySource.get(sourceKey) || 0;
    if ((now - last) < invulnMs) {
      return false;
    }
    this._invulnBySource.set(sourceKey, now);
    this.takeDamage(damage, damageType);
    return true;
  }
  createHPBar() {
    this.hpBarBg = this.scene.add.rectangle(0, -40, 50, 6, 0x000000);
    this.hpBarBg.setDepth(999);
    this.hpBarFill = this.scene.add.rectangle(0, -40, 50, 6, 0xff0000);
    this.hpBarFill.setDepth(1000);
  }
  createAnimations() {
    const animPrefix = this.enemyData.animations;
    if (animPrefix?.walk) {
      const walkKey = `${this.enemyType}_walk`;
      if (!this.scene.anims.exists(walkKey)) {
        this.scene.anims.create({
          key: walkKey,
          frames: [
            { key: `${animPrefix.walk}_1` },
            { key: `${animPrefix.walk}_2` },
            { key: `${animPrefix.walk}_3` },
            { key: `${animPrefix.walk}_4` },
            { key: `${animPrefix.walk}_5` },
            { key: `${animPrefix.walk}_6` }
          ],
          frameRate: 8,
          repeat: -1
        });
      }
    }
    if (animPrefix?.attack) {
      const attackKey = `${this.enemyType}_attack`;
      if (!this.scene.anims.exists(attackKey)) {
        this.scene.anims.create({
          key: attackKey,
          frames: [
            { key: `${animPrefix.attack}_1` },
            { key: `${animPrefix.attack}_2` },
            { key: `${animPrefix.attack}_3` },
            { key: `${animPrefix.attack}_4` },
            { key: `${animPrefix.attack}_5` },
            { key: `${animPrefix.attack}_6` }
          ],
          frameRate: 12,
          repeat: 0
        });
      }
    }
  }
  update(playerRef, allEnemies) {
    const p = playerRef || this.player || (this.scene && this.scene.playerRef);
    // shadow follow
    if (this.shadow && this.sprite) {
      this.shadow.x = this.sprite.x;
      this.shadow.y = this.sprite.y + 35;
    }
    if (this.isAlive && p && p.isAlive) {
      this.updateDebuffs();
      this.updateDirectionToPlayer(p, allEnemies);
      const currentDirection = (this.lockedDirection !== null && this.lockedDirection !== undefined) ? this.lockedDirection : this.direction;
      const moveX = Math.cos(currentDirection) * this.speed;
      const moveY = Math.sin(currentDirection) * this.speed;
      if (this.sprite.body) {
        this.sprite.setVelocity(moveX, moveY);
      }
      if (moveX < -5) this.sprite.setFlipX(true); else if (moveX > 5) this.sprite.setFlipX(false);
      if (this.enemyData.animated) {
        const isMoving = Math.abs(moveX) > 5 || Math.abs(moveY) > 5;
        const walkAnimKey = `${this.enemyType}_walk`;
        if (isMoving && (!this.sprite.anims.isPlaying || this.sprite.anims.currentAnim.key !== walkAnimKey)) {
          if (this.scene.anims.exists(walkAnimKey)) this.sprite.play(walkAnimKey);
        }
      }
      this.updateHPBar();
    } else if (this.isAlive) {
      if (this.sprite.body) {
        this.sprite.setVelocity(0, 0);
      }
      this.updateHPBar();
    }
  }
  updateHPBar() {
    if (this.hpBarBg && this.hpBarFill) {
      this.hpBarBg.x = this.sprite.x;
      this.hpBarBg.y = this.sprite.y - 40;
      this.hpBarFill.x = this.sprite.x;
      this.hpBarFill.y = this.sprite.y - 40;
      const healthPercent = this.health / this.maxHealth;
      this.hpBarFill.scaleX = healthPercent;
    }
  }
  updateDirectionToPlayer(playerRef, allEnemies) {
    const p = playerRef || this.player || (this.scene && this.scene.playerRef);
    if (!p || !p.isAlive) return;
    const distanceToPlayer = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, p.sprite.x, p.sprite.y);
    const shadowDistance = 50;
    if (distanceToPlayer <= shadowDistance) {
      if (!this.lockedDirection) this.lockedDirection = this.direction;
      return;
    } else {
      this.lockedDirection = null;
    }
    const angleToPlayer = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, p.sprite.x, p.sprite.y);
    let separationForceX = 0, separationForceY = 0;
    const separationDistance = 60;
    if (allEnemies && Array.isArray(allEnemies)) {
      allEnemies.forEach(otherEnemy => {
        if (otherEnemy !== this && otherEnemy.isAlive) {
          const distance = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, otherEnemy.sprite.x, otherEnemy.sprite.y);
          if (distance < separationDistance && distance > 0) {
            const separationStrength = (separationDistance - distance) / separationDistance;
            const angleAway = Phaser.Math.Angle.Between(otherEnemy.sprite.x, otherEnemy.sprite.y, this.sprite.x, this.sprite.y);
            separationForceX += Math.cos(angleAway) * separationStrength;
            separationForceY += Math.sin(angleAway) * separationStrength;
          }
        }
      });
    }
    const playerForceX = Math.cos(angleToPlayer) * 0.7;
    const playerForceY = Math.sin(angleToPlayer) * 0.7;
    const totalForceX = playerForceX + separationForceX * 0.5;
    const totalForceY = playerForceY + separationForceY * 0.5;
    this.direction = Math.atan2(totalForceY, totalForceX);
    const randomOffset = (Math.random() - 0.5) * 0.2;
    this.direction += randomOffset;
  }
  
  // Applies poison, burn, or armor weaken effects
  applyDebuff(type, power = 1) {
    switch (type) {
      case DAMAGE_TYPES.POISON:
        this.debuffs.poison.time = Math.min(6, (this.debuffs.poison.time || 0) + 2 * power);
        break;
      case DAMAGE_TYPES.BURN:
        this.debuffs.burn.time = Math.min(6, (this.debuffs.burn.time || 0) + 2 * power);
        break;
      case DAMAGE_TYPES.LIGHTNING:
      case DAMAGE_TYPES.ARMOR_WEAKEN:
        this.debuffs.armorWeaken.time = Math.min(5, (this.debuffs.armorWeaken.time || 0) + 2 * power);
        break;
      default:
        break;
    }
  }
  updateDebuffs() {
    const dt = (this.scene && this.scene.game && this.scene.game.loop) ? (this.scene.game.loop.delta / 1000) : (1/60);
    if (this.debuffs.armorWeaken.time > 0) {
      this.debuffs.armorWeaken.time -= dt;
      this.damageTakenMultiplier = this.debuffs.armorWeaken.mult;
      if (this.debuffs.armorWeaken.time <= 0) this.damageTakenMultiplier = 1.0;
    }
    if (this.debuffs.poison.time > 0) {
      this.debuffs.poison.time -= dt;
      this.debuffs.poison.acc += dt;
      if (this.debuffs.poison.acc >= this.debuffs.poison.tick) {
        this.debuffs.poison.acc = 0;
        const dmg = Math.max(1, Math.floor(2 + (window.currentDifficulty || 2) * 0.5));
        if (this.health > 1) {
          this.health = Math.max(1, this.health - dmg);
          this.updateHPBar();
        }
      }
    }
    if (this.debuffs.burn.time > 0) {
      this.debuffs.burn.time -= dt;
      this.debuffs.burn.acc += dt;
      if (this.debuffs.burn.acc >= this.debuffs.burn.tick) {
        this.debuffs.burn.acc = 0;
        const dmg = Math.max(1, Math.floor(3 + (window.currentDifficulty || 2)));
        this.takeDamage(dmg, DAMAGE_TYPES.BURN);
      }
    }
  }
  // Push the enemy away from (sourceX, sourceY) on hit
  knockback(sourceX, sourceY, force = 60) {
    if (!this.sprite || !this.sprite.body) return;
    const angle = Phaser.Math.Angle.Between(sourceX, sourceY, this.sprite.x, this.sprite.y);
    this.sprite.body.velocity.x += Math.cos(angle) * force;
    this.sprite.body.velocity.y += Math.sin(angle) * force;
  }

  takeDamage(damage, damageType) {
    const mult = (this.damageTakenMultiplier || 1.0);
    const typeKey = (typeof damageType === 'string') ? damageType.toLowerCase() : null;
    const flatRes = typeKey && this.resistances ? (this.resistances[typeKey] || 0) : 0;
    const scaled = Math.max(1, Math.floor(damage * mult) - flatRes);
    this.health -= scaled;
    this.sprite.setTint(0xff4444);
    this.scene.time.delayedCall(150, () => { if (this.isAlive && this.sprite) this.sprite.clearTint(); });
    if (this.health <= 0) this.die();
    this.updateHPBar();
  }
  die() {
    this.isAlive = false;
    this.sprite.setTint(0x666666);
    if (this.sprite.body) this.sprite.setVelocity(0, 0);

    const giveXPTo = this.player || (this.scene && (this.scene.player || this.scene.playerRef));
    const xp = 25 + ((window.currentDifficulty || 2) * 10);

    if (giveXPTo) {
      giveXPTo.incrementKillCount();
      this._spawnXPOrb(giveXPTo, xp);
    }

    if (this.hpBarBg)   this.hpBarBg.destroy();
    if (this.hpBarFill) this.hpBarFill.destroy();
    this.scene.tweens.add({
      targets: [this.sprite, this.shadow],
      alpha: 0, scaleY: 0.1,
      duration: 400,
      onComplete: () => this.destroy()
    });
  }

  _spawnXPOrb(player, xpAmount) {
    const ox = this.sprite.x, oy = this.sprite.y;
    const orb = this.scene.add.circle(ox, oy, 7, 0x44ffaa, 1);
    orb.setDepth(500);
    // Brief pop before flying to player
    this.scene.tweens.add({
      targets: orb,
      scaleX: 1.6, scaleY: 1.6,
      duration: 120,
      yoyo: true,
      onComplete: () => {
        this.scene.tweens.add({
          targets: orb,
          x: player.sprite.x,
          y: player.sprite.y,
          scaleX: 0.4, scaleY: 0.4,
          alpha: 0.6,
          duration: 550,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            orb.destroy();
            if (player.isAlive) player.gainExperience(xpAmount);
          }
        });
      }
    });
  }
  destroy() {
    if (this.hpBarBg) this.hpBarBg.destroy();
    if (this.hpBarFill) this.hpBarFill.destroy();
    if (this.shadow) this.shadow.destroy();
    if (this.sprite) this.sprite.destroy();
    this.isAlive = false;
  }
}
