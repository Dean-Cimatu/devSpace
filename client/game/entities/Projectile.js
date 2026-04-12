import { BurnZone } from '../systems/zones.js';
import { DAMAGE_TYPES } from '../data/weapons.js';

// Ranged projectile — flies toward a target and checks enemy collisions each frame
export class Projectile {
    constructor(scene, x, y, targetX, targetY, weapon, damage) {
        this.scene = scene;
        this.startX = x;
        this.startY = y;
        this.targetX = targetX;
        this.targetY = targetY;
        this.weapon = weapon;
        this.damage = damage;
        this.speed = (weapon && weapon.projectileSpeed) ? weapon.projectileSpeed : 300;
        this.isAlive = true;
        this.hitTargets = new Set();
        this.angle = Phaser.Math.Angle.Between(x, y, targetX, targetY);
        this.velocityX = Math.cos(this.angle) * this.speed;
        this.velocityY = Math.sin(this.angle) * this.speed;
        this.rotationOffset = 0;
        this.createProjectileSprite();
    }

    createProjectileSprite() {
        let usedKey = null;
        let needsFireballAnim = false;
        let needsOrbAnim = false;
        if (this.weapon.projectileSprite) {
            usedKey = this.weapon.projectileSprite;
            this.sprite = this.scene.add.sprite(this.startX, this.startY, usedKey);
        } else {
            switch (this.weapon.category) {
                case 'bow':
                    usedKey = 'arrow_move';
                    this.sprite = this.scene.add.sprite(this.startX, this.startY, usedKey);
                    this.sprite.setScale(0.8);
                    break;
                case 'magic':
                    if (this.weapon.name.includes('Orb')) {
                        usedKey = 'fireball3';
                        this.sprite = this.scene.add.sprite(this.startX, this.startY, usedKey);
                        needsOrbAnim = true;
                    } else {
                        usedKey = 'fireball1';
                        this.sprite = this.scene.add.sprite(this.startX, this.startY, usedKey);
                        needsFireballAnim = true;
                    }
                    break;
                default:
                    usedKey = 'fireball1';
                    this.sprite = this.scene.add.sprite(this.startX, this.startY, usedKey);
                    break;
            }
        }
        const key = usedKey || (this.sprite && this.sprite.texture && this.sprite.texture.key) || '';
        const player = this.scene.player;
        const sizeBuff = (player && player.weaponSizeScale) ? player.weaponSizeScale : 1.0;
        if (key.startsWith('fireball')) {
            const BASE_FIREBALL_SCALE = 0.12;
            this.sprite.setScale(BASE_FIREBALL_SCALE * sizeBuff);
        }
        if (this.weapon && typeof this.weapon.projectileScale === 'number') {
            const scale = key.startsWith('fireball') ? (this.weapon.projectileScale * sizeBuff) : this.weapon.projectileScale;
            this.sprite.setScale(scale);
        }
        if (needsFireballAnim) this.animateFireball();
        if (needsOrbAnim) this.animateOrb();
        this.sprite.setDepth(50);
        if ((this.weapon && (this.weapon.id === 'weapon_dagger' || this.weapon.name === 'Swift Dagger')) || key === 'weapon_dagger') {
            this.rotationOffset = -Math.PI / 4;
        }
        if (this.weapon && this.weapon.id === 'weapon_doubleaxe') {
            this.spinSprite = true;
            this.spinSpeed = 8.0;
            this.sprite.setOrigin(0.5, 0.5);
            this._spinAngle = 0;
        }
        this.sprite.setRotation(this.angle + (this.rotationOffset || 0));
    }

    animateFireball() {
        let frame = 1;
        this.fireballTimer = this.scene.time.addEvent({
            delay: 100,
            callback: () => {
                if (this.sprite && this.isAlive) {
                    frame = (frame % 5) + 1;
                    this.sprite.setTexture(`fireball${frame}`);
                }
            },
            loop: true
        });
    }

    animateOrb() {
        const s = this.sprite.scaleX;
        this.scene.tweens.add({
            targets: this.sprite,
            scaleX: s * 1.35,
            scaleY: s * 1.35,
            duration: 300,
            yoyo: true,
            repeat: -1
        });
    }

    update() {
        if (!this.isAlive || !this.sprite) return;
        const dt = (this.scene && this.scene.game && this.scene.game.loop) ? (this.scene.game.loop.delta / 1000) : (1 / 60);
        if (this.weapon && this.weapon.special === 'wand_burn_trail') {
            this._trailAcc = (this._trailAcc || 0) + (dt * 1000);
            if (this._trailAcc >= 120) {
                this._trailAcc = 0;
                const dps = Math.max(1, Math.floor(this.damage * 0.15));
                this.scene.zones.push(new BurnZone(this.scene, this.sprite.x, this.sprite.y, 40, dps, 600));
            }
        }
        this.sprite.x += this.velocityX * dt;
        this.sprite.y += this.velocityY * dt;
        const distanceToTarget  = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.targetX, this.targetY);
        const distanceTraveled  = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.startX, this.startY);
        if (this.weapon && this.weapon.travelToEdge) {
            const cam = this.scene.cameras.main;
            const offLeft   = this.sprite.x < (cam.scrollX - 60);
            const offRight  = this.sprite.x > (cam.scrollX + cam.width + 60);
            const offTop    = this.sprite.y < (cam.scrollY - 60);
            const offBottom = this.sprite.y > (cam.scrollY + cam.height + 60);
            if (offLeft || offRight || offTop || offBottom) { this.explode(); return; }
        } else {
            if (distanceToTarget < 30 || distanceTraveled > this.weapon.attackRange) {
                this.explode();
                return;
            }
        }
        if (this.sprite) {
            if (this.spinSprite) {
                this._spinAngle = (this._spinAngle || 0) + (this.spinSpeed || 0) * dt;
                this.sprite.setRotation(this._spinAngle);
            } else {
                this.sprite.setRotation(this.angle + (this.rotationOffset || 0));
            }
        }
        this._tickCounter = (this._tickCounter || 0) + 1;
        const isDagger = !!(this.weapon && (this.weapon.id === 'weapon_dagger' || this.weapon.name === 'Swift Dagger'));
        const isStone  = !!(this.weapon && this.weapon.id === 'weapon_stone');
        if (isDagger || isStone || ((this._tickCounter & 1) === 0)) {
            this.checkEnemyCollision();
        }
    }

    checkEnemyCollision() {
        if (!this.sprite) return;
        const player  = this.scene.player;
        const enemies = this.scene.enemies;
        enemies.forEach(enemy => {
            if (!this.sprite || !this.isAlive) return;
            if (enemy.isAlive && !this.hitTargets.has(enemy.id)) {
                const distance = Phaser.Math.Distance.Between(
                    this.sprite.x, this.sprite.y,
                    enemy.sprite.x, enemy.sprite.y
                );
                const spriteW = (this.sprite && (this.sprite.displayWidth || this.sprite.width)) || 24;
                let dynamicRadius = Math.max(18, Math.floor(14 + spriteW * 0.22));
                if (this.weapon && (this.weapon.id === 'weapon_dagger' || this.weapon.id === 'weapon_stone')) {
                    dynamicRadius = Math.max(dynamicRadius, 24);
                }
                if (distance < dynamicRadius) {
                    this.hitTargets.add(enemy.id);
                    const sourceKey = (this.weapon && this.weapon.id) ? this.weapon.id : 'projectile';
                    enemy.tryTakeDamage(this.damage, this.weapon?.damageType, sourceKey, 140);
                    if (this.weapon && this.weapon.special === 'rose_poison_aoe') {
                        enemies.forEach(e => {
                            if (!e.isAlive) return;
                            const d = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, e.sprite.x, e.sprite.y);
                            if (d <= 70) {
                                e.takeDamage(Math.floor(this.damage * 0.5), DAMAGE_TYPES.POISON);
                                if (e.applyDebuff) e.applyDebuff(DAMAGE_TYPES.POISON, 1 + (player?.debuffPower || 0));
                            }
                        });
                    }
                    if (this.weapon && this.weapon.special === 'stone_split') {
                        for (let i = 0; i < 2; i++) {
                            const ang  = (Math.PI / 4) * (i === 0 ? 1 : -1);
                            const endX = this.sprite.x + Math.cos(this.angle + ang) * 120;
                            const endY = this.sprite.y + Math.sin(this.angle + ang) * 120;
                            const p = new Projectile(this.scene, this.sprite.x, this.sprite.y, endX, endY, { ...this.weapon }, Math.floor(this.damage * 0.6));
                            this.scene.projectiles.push(p);
                        }
                        this.weapon.special = undefined;
                    }
                    if (this.weapon && this.weapon.damageType && enemy.applyDebuff) {
                        enemy.applyDebuff(this.weapon.damageType, 1 + (player?.debuffPower || 0));
                    }
                    this.showHitEffect(enemy);
                    if (player) player.showFloatingDamage(enemy, this.damage);
                    if (!this.weapon.piercing) {
                        this.explode();
                        return;
                    } else {
                        if (!enemy.isAlive && this.weapon.id === 'weapon_spear' && this.weapon.maxMode) {
                            this.damage = Math.floor(this.damage * 1.2);
                        }
                    }
                }
            }
        });
    }

    showHitEffect(enemy) {
        const s = enemy.sprite;
        if (!s || !s.setTintFill) return;
        s.setTintFill(0xffffff);
        this.scene.time.delayedCall(80, () => {
            if (s && s.clearTint) s.clearTint();
        });
    }

    explode() {
        this.isAlive = false;
        if (this.fireballTimer) this.fireballTimer.destroy();
        if (this.sprite) {
            const proj = this.sprite;
            this.scene.tweens.add({
                targets: proj,
                alpha: 0,
                scaleX: proj.scaleX * 0.9,
                scaleY: proj.scaleY * 0.9,
                duration: 120,
                onComplete: () => { if (proj && proj.destroy) proj.destroy(); }
            });
            this.sprite = null;
        }
    }
}
