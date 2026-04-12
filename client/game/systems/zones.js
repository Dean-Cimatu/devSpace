// area damage zones
export class BurnZone {
  constructor(scene, x, y, radius, dps, durationMs, tint = 0xff6600) {
    this.scene = scene;
    this.x = x; this.y = y;
    this.radius = radius;
    this.dps = dps;
    this.remaining = durationMs;
    this.isAlive = true;
    this.graphics = scene.add.graphics();
    this.graphics.fillStyle(tint, 0.25);
    this.graphics.fillCircle(x, y, radius);
    this.graphics.setDepth(25);
    this._acc = 0;
    this._perEnemyHitAt = new Map(); // throttle per-enemy zone ticks to avoid pathological overlaps
  }
  update(dt, enemies) {
    if (!this.isAlive) return;
    this.remaining -= dt;
    if (this.remaining <= 0) { this.destroy(); return; }
    this._acc += dt;
    if (this._acc >= 250) { // tick every 250ms
      this._acc = 0;
      enemies.forEach(e => {
        if (!e.isAlive) return;
        const dist = Phaser.Math.Distance.Between(this.x, this.y, e.sprite.x, e.sprite.y);
        if (dist <= this.radius) {
          const now = this.scene.time.now || Date.now();
          const last = this._perEnemyHitAt.get(e.id) || 0;
          if ((now - last) >= 180) {
            this._perEnemyHitAt.set(e.id, now);
            if (e.tryTakeDamage) {
              e.tryTakeDamage(this.dps, 'burn', 'weapon_torch', 180);
            } else {
              e.takeDamage(this.dps, 'burn');
            }
            if (e.applyDebuff) e.applyDebuff('burn', 1);
          }
        }
      });
    }
  }
  destroy() { if (this.isAlive) { this.isAlive = false; this.graphics.destroy(); } }
}

export class FollowZone {
  constructor(scene, owner, radius, dps, durationMs, tint = 0xffa500, options = {}) {
    this.scene = scene; this.owner = owner;
    this.radius = radius; this.dps = dps;
    this.remaining = durationMs; this.isAlive = true;
    this.graphics = scene.add.graphics();
    this.tint = tint;
    // Draw below characters, similar to shadows but visible
    this.graphics.setDepth(0.6);
    this._acc = 0;
    this._pushAcc = 0;
    this.pushIntervalMs = options.pushIntervalMs || 0; // 0 disables pushback
    this.pushForce = options.pushForce || 140;
    this._perEnemyHitAt = new Map();
  }
  update(dt, enemies) {
    if (!this.isAlive) return;
    this.remaining -= dt;
    if (this.remaining <= 0) { this.destroy(); return; }
    const x = this.owner.sprite.x; const y = this.owner.sprite.y;
    this.graphics.clear();
    // Fill and border to indicate zone clearly
    this.graphics.fillStyle(this.tint, 0.15);
    this.graphics.fillCircle(x, y, this.radius);
    this.graphics.lineStyle(3, this.tint, 0.85);
    this.graphics.strokeCircle(x, y, this.radius);
    this._acc += dt;
    if (this._acc >= 300) {
      this._acc = 0;
      enemies.forEach(e => {
        if (!e.isAlive) return;
        const dist = Phaser.Math.Distance.Between(x, y, e.sprite.x, e.sprite.y);
        if (dist <= this.radius) {
          const now = this.scene.time.now || Date.now();
          const last = this._perEnemyHitAt.get(e.id) || 0;
          if ((now - last) >= 180) {
            this._perEnemyHitAt.set(e.id, now);
            if (e.tryTakeDamage) {
              e.tryTakeDamage(this.dps, 'burn', 'weapon_lantern', 180);
            } else {
              e.takeDamage(this.dps, 'burn');
            }
          }
        }
      });
    }
    if (this.pushIntervalMs > 0) {
      this._pushAcc += dt;
      if (this._pushAcc >= this.pushIntervalMs) {
        this._pushAcc = 0;
        enemies.forEach(e => {
          if (!e.isAlive) return;
          const dist = Phaser.Math.Distance.Between(x, y, e.sprite.x, e.sprite.y);
          if (dist <= this.radius) {
            const ang = Phaser.Math.Angle.Between(x, y, e.sprite.x, e.sprite.y);
            e.sprite.x += Math.cos(ang) * this.pushForce;
            e.sprite.y += Math.sin(ang) * this.pushForce;
          }
        });
      }
    }
  }
  destroy() { if (this.isAlive) { this.isAlive = false; this.graphics.destroy(); } }
}

export class LightningStrike {
  constructor(scene, x, y, radius, damage) {
    this.scene = scene; this.x = x; this.y = y; this.radius = radius; this.damage = damage;
    this.isAlive = true; this._done = false;
    this.sprite = scene.add.sprite(x, y, 'bluefire_effect');
    this.sprite.play('bluefire_effect_anim');
    this.sprite.setScale(1.3);
    this.sprite.on('animationcomplete', () => this.destroy());
  }
  update(dt, enemies) {
    if (this._done || !this.isAlive) return;
    enemies.forEach(e => {
      if (!e.isAlive) return;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, e.sprite.x, e.sprite.y);
  if (dist <= this.radius) { if (e.tryTakeDamage) { e.tryTakeDamage(this.damage, 'lightning', 'weapon_staff', 140); } else { e.takeDamage(this.damage, 'lightning'); } if (e.applyDebuff) e.applyDebuff('armor_weaken', 1); }
    });
    this._done = true;
  }
  destroy() { if (this.isAlive) { this.isAlive = false; this.sprite.destroy(); } }
}

// Sky-falling lightning that impacts and explodes on landing
export class LightningFallStrike {
  constructor(scene, x, y, radius, damage, debuffPower = 1, opts = {}) {
    this.scene = scene; this.x = x; this.y = y; this.radius = radius; this.damage = damage;
    this.debuffPower = debuffPower; this.isAlive = true; this._impactReady = false; this._done = false;
    this._bolt = scene.add.graphics();
    this._bolt.setDepth(1400);
    this._currentY = y - (opts.startOffset || 300);
    const duration = opts.duration || 180;
    // Animate descent
    scene.tweens.add({
      targets: this,
      _currentY: y,
      duration,
      ease: 'Sine.easeIn',
      onUpdate: () => this._drawBolt(),
      onComplete: () => { this._clearBolt(); this._impactReady = true; }
    });
  }
  _drawBolt() {
    if (!this._bolt) return;
    this._bolt.clear();
    // Draw a jagged vertical bolt
    this._bolt.lineStyle(4, 0x99e0ff, 1);
    this._bolt.beginPath();
    const segments = 6; const amp = 14; const step = (this.y - this._currentY) / segments;
    for (let i = 0; i <= segments; i++) {
      const yy = this._currentY + step * i;
      const xx = this.x + ((i % 2 === 0) ? -1 : 1) * (Math.random() * amp);
      if (i === 0) this._bolt.moveTo(xx, yy); else this._bolt.lineTo(xx, yy);
    }
    this._bolt.strokePath();
  }
  _clearBolt() { if (this._bolt) { this._bolt.clear(); this._bolt.destroy(); this._bolt = null; } }
  _explode(enemies) {
    if (this._done) return;
    // Explosion flash
    const g = this.scene.add.graphics();
    g.fillStyle(0x99e0ff, 0.25);
    g.fillCircle(this.x, this.y, this.radius);
    g.setDepth(1300);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
    // Optional animated effect
    const fx = this.scene.add.sprite(this.x, this.y, 'bluefire_effect');
    fx.setDepth(1301);
    fx.play('bluefire_effect_anim');
    fx.once('animationcomplete', () => fx.destroy());
    // Apply damage and armor weaken
    enemies.forEach(e => {
      if (!e.isAlive) return;
      const d = Phaser.Math.Distance.Between(this.x, this.y, e.sprite.x, e.sprite.y);
      if (d <= this.radius) {
  if (e.tryTakeDamage) { e.tryTakeDamage(this.damage, 'lightning', 'weapon_staff', 140); } else { e.takeDamage(this.damage, 'lightning'); }
        if (e.applyDebuff) e.applyDebuff('armor_weaken', this.debuffPower);
      }
    });
    this._done = true;
  }
  update(dt, enemies) {
    if (!this.isAlive) return;
    if (this._impactReady && !this._done) {
      this._explode(enemies);
    }
    if (this._done) {
      this.destroy();
    }
  }
  destroy() {
    if (!this.isAlive) return;
    this.isAlive = false;
    this._clearBolt();
  }
}

// Persistent orbiting blade that circles an owner and damages on contact
export class OrbitingBlade {
  constructor(scene, owner, radius, speedRadPerSec, phase, damage, damageType) {
    this.scene = scene; this.owner = owner;
    this.radius = radius; this.speed = speedRadPerSec; this.phase = phase;
    this.damage = damage; this.damageType = damageType;
    this.isAlive = true; this.angle = 0; this._hitCooldown = 220; // ms between hits per enemy
    this._perEnemyHitAt = new Map();
    this.sprite = scene.add.sprite(owner.sprite.x, owner.sprite.y, 'weapon_longsword');
    this.sprite.setOrigin(0.15, 0.5);
    this.sprite.setDepth(80);
    this.sprite.setAlpha(0.9);
    this.sprite.setScale(1.3);
  }
  update(dt, enemies) {
    if (!this.isAlive || !this.owner || !this.owner.isAlive) { this.destroy(); return; }
    const px = this.owner.sprite.x, py = this.owner.sprite.y;
    this.angle += (this.speed * (dt/1000));
    const a = this.angle + this.phase;
    const x = px + Math.cos(a) * this.radius;
    const y = py + Math.sin(a) * this.radius;
    this.sprite.x = x; this.sprite.y = y;
    this.sprite.setRotation(a + Math.PI/2);
    // damage check
    enemies.forEach(e => {
      if (!e.isAlive) return;
      const d = Phaser.Math.Distance.Between(x, y, e.sprite.x, e.sprite.y);
      if (d <= 28) {
        const now = this.scene.time.now || Date.now();
        const last = this._perEnemyHitAt.get(e.id) || 0;
        if (now - last >= this._hitCooldown) {
          this._perEnemyHitAt.set(e.id, now);
          if (e.tryTakeDamage) {
            e.tryTakeDamage(this.damage, this.damageType || 'physical', 'weapon_claymore', this._hitCooldown);
          } else {
            e.takeDamage(this.damage, this.damageType || 'physical');
          }
          if (this.damageType && e.applyDebuff) e.applyDebuff(this.damageType, 1);
        }
      }
    });
  }
  destroy() {
    if (!this.isAlive) return;
    this.isAlive = false;
    if (this.sprite) this.sprite.destroy();
  }
}
