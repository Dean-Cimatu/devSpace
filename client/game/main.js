import { DAMAGE_TYPES, WEAPON_TYPES } from './data/weapons.js';
import { ITEM_TYPES, ENHANCED_ITEM_TYPES } from './data/items.js';
import { ENEMY_TYPES } from './data/enemies.js';
import { Enemy } from './entities/Enemy.js';
import { getRandomEnemyType as wavesGetRandomEnemyType, spawnSingleEnemy as wavesSpawnSingleEnemy, spawnEnemies as wavesSpawnEnemies, maintainEnemyLimit as wavesMaintainEnemyLimit, startDifficultyProgression as wavesStartDifficulty } from './systems/waves.js';
import { executeWeaponAttack } from './systems/behaviors.js';
import { BurnZone } from './systems/zones.js';

const DEBUG = false;
// wave banners disabled
const SHOW_WAVE_BANNER = false;
// minimum wave duration
const MIN_WAVE_DURATION_MS = 60000;

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight - 50,
    parent: 'gameContainer',
    render: {
        antialias: false,
        pixelArt: false,
        roundPixels: false
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

// game state flow
let GAME_STATE = 'intro'; // 'intro' | 'choice' | 'playing'

class Projectile {
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
        // Prefer an explicit projectile sprite when provided
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
        // Unify fireball sizes: use a common base scale, only modified by player's item buffs
        const key = usedKey || (this.sprite && this.sprite.texture && this.sprite.texture.key) || '';
        const sizeBuff = (typeof player !== 'undefined' && player && player.weaponSizeScale) ? player.weaponSizeScale : 1.0;
        if (key.startsWith('fireball')) {
            const BASE_FIREBALL_SCALE = 0.12;
            this.sprite.setScale(BASE_FIREBALL_SCALE * sizeBuff);
        }
        // Allow explicit projectile scaling from weapon data (e.g., dagger). For fireballs, include sizeBuff.
        if (this.weapon && typeof this.weapon.projectileScale === 'number') {
            const scale = key.startsWith('fireball') ? (this.weapon.projectileScale * sizeBuff) : this.weapon.projectileScale;
            this.sprite.setScale(scale);
        }
        // Start animations after scale is applied so relative tweens use the correct base scale
        if (needsFireballAnim) this.animateFireball();
        if (needsOrbAnim) this.animateOrb();
        this.sprite.setDepth(50);
        // Correct dagger sprite lean by rotating -45 degrees
        if ((this.weapon && (this.weapon.id === 'weapon_dagger' || this.weapon.name === 'Swift Dagger')) || key === 'weapon_dagger') {
            this.rotationOffset = -Math.PI / 4;
        }
        // Double Axe spins during flight
        if (this.weapon && this.weapon.id === 'weapon_doubleaxe') {
            this.spinSprite = true;
            this.spinSpeed = 8.0; // radians per second
            // Center origin for clean spin
            this.sprite.setOrigin(0.5, 0.5);
            // Start with some rotation to feel dynamic
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
        const dt = (this.scene && this.scene.game && this.scene.game.loop) ? (this.scene.game.loop.delta / 1000) : (1/60);
        // Wand max: leave a burn trail along the path
        if (this.weapon && this.weapon.special === 'wand_burn_trail') {
            this._trailAcc = (this._trailAcc || 0) + (dt*1000);
            if (this._trailAcc >= 120) {
                this._trailAcc = 0;
                // small burn zone with short duration
                const dps = Math.max(1, Math.floor(this.damage * 0.15));
                zones.push(new BurnZone(this.scene, this.sprite.x, this.sprite.y, 40, dps, 600));
            }
        }
        this.sprite.x += this.velocityX * dt;
        this.sprite.y += this.velocityY * dt;
        const distanceToTarget = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.targetX, this.targetY);
        const distanceTraveled = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.startX, this.startY);
        if (this.weapon && this.weapon.travelToEdge) {
            const cam = this.scene.cameras.main;
            const offLeft = this.sprite.x < (cam.scrollX - 60);
            const offRight = this.sprite.x > (cam.scrollX + cam.width + 60);
            const offTop = this.sprite.y < (cam.scrollY - 60);
            const offBottom = this.sprite.y > (cam.scrollY + cam.height + 60);
            if (offLeft || offRight || offTop || offBottom) {
                this.explode();
                return;
            }
        } else {
            if (distanceToTarget < 30 || distanceTraveled > this.weapon.attackRange) {
                this.explode();
                return; // prevent collision checks after sprite is destroyed
            }
        }
        // Keep rotation aligned, except for spinning projectiles like Double Axe
        if (this.sprite) {
            if (this.spinSprite) {
                this._spinAngle = (this._spinAngle || 0) + (this.spinSpeed || 0) * dt;
                this.sprite.setRotation(this._spinAngle);
            } else {
                this.sprite.setRotation(this.angle + (this.rotationOffset || 0));
            }
        }
        // Collision checks: always check for dagger and stone to ensure all hits register; others throttle every other frame
        this._tickCounter = (this._tickCounter || 0) + 1;
        const isDagger = !!(this.weapon && (this.weapon.id === 'weapon_dagger' || this.weapon.name === 'Swift Dagger'));
        const isStone = !!(this.weapon && this.weapon.id === 'weapon_stone');
        if (isDagger || isStone || ((this._tickCounter & 1) === 0)) {
            this.checkEnemyCollision();
        }
    }
    checkEnemyCollision() {
        if (!this.sprite) return;
        enemies.forEach(enemy => {
            // If this projectile already exploded mid-iteration, skip further processing safely
            if (!this.sprite || !this.isAlive) return;
            if (enemy.isAlive && !this.hitTargets.has(enemy.id)) {
                const distance = Phaser.Math.Distance.Between(
                    this.sprite.x, this.sprite.y,
                    enemy.sprite.x, enemy.sprite.y
                );
                // Collision radius scales with projectile visual size so large projectiles register reliably
                const spriteW = (this.sprite && (this.sprite.displayWidth || this.sprite.width)) || 24;
                let dynamicRadius = Math.max(18, Math.floor(14 + spriteW * 0.22));
                // Ensure small, fast projectiles like dagger and stone still register hits consistently
                if (this.weapon && (this.weapon.id === 'weapon_dagger' || this.weapon.id === 'weapon_stone')) {
                    dynamicRadius = Math.max(dynamicRadius, 24);
                }
                if (distance < dynamicRadius) {
                    this.hitTargets.add(enemy.id);
                    // Use per-weapon invulnerability so different weapons can stack damage properly
                    const sourceKey = (this.weapon && this.weapon.id) ? this.weapon.id : 'projectile';
                    enemy.tryTakeDamage(this.damage, this.weapon?.damageType, sourceKey, 140);
                    // Rose max: poison AOE around hit target
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
                    // Special interactions per weapon
                    if (this.weapon && this.weapon.special === 'stone_split') {
                        // Spawn smaller rocks on first hit
                        const splits = 2;
                        for (let i = 0; i < splits; i++) {
                            const ang = (Math.PI/4) * (i===0 ? 1 : -1);
                            const endX = this.sprite.x + Math.cos(this.angle + ang) * 120;
                            const endY = this.sprite.y + Math.sin(this.angle + ang) * 120;
                            const p = new Projectile(this.scene, this.sprite.x, this.sprite.y, endX, endY, {...this.weapon}, Math.floor(this.damage*0.6));
                            projectiles.push(p);
                        }
                        this.weapon.special = undefined; // only once per projectile
                    }
                    // Apply debuff from projectile's weapon type
                    if (this.weapon && this.weapon.damageType && enemy.applyDebuff) {
                        enemy.applyDebuff(this.weapon.damageType, 1 + (player?.debuffPower || 0));
                    }
                    this.showHitEffect(enemy);
                    player.showFloatingDamage(enemy, this.damage);
                    if (!this.weapon.piercing) {
                        this.explode();
                        return; // stop processing more enemies this tick; guard forEach
                    } else {
                        // spear max mode: increase damage when kill happens via projectile
                        if (!enemy.isAlive && this.weapon.id === 'weapon_spear' && this.weapon.maxMode) {
                            this.damage = Math.floor(this.damage * 1.2);
                        }
                    }
                }
            }
        });
    }
    showHitEffect(enemy) {
        // Remove sparkly hit effect; use a subtle white tint flash instead
        const s = enemy.sprite;
        if (!s || !s.setTintFill) return;
        s.setTintFill(0xffffff);
        this.scene.time.delayedCall(80, () => {
            if (s && s.clearTint) s.clearTint();
        });
    }
    explode() {
        this.isAlive = false;
        if (this.fireballTimer) {
            this.fireballTimer.destroy();
        }
        if (this.sprite) {
            // Remove sparkly explosion effect; just fade the projectile out quickly
            const proj = this.sprite;
            this.scene.tweens.add({
                targets: proj,
                alpha: 0,
                scaleX: proj.scaleX * 0.9,
                scaleY: proj.scaleY * 0.9,
                duration: 120,
                onComplete: () => {
                    if (proj && proj.destroy) proj.destroy();
                }
            });
            this.sprite = null;
        }
    }
}
class Entity {
    constructor(scene, x, y, texture) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.shadow = scene.add.ellipse(x, y + 35, 50, 25, 0x000000, 0.8);
        this.shadow.setDepth(0.5);
        this.sprite = scene.physics.add.sprite(x, y, texture);
        this.sprite.setDepth(1);
        this.hitbox = this.sprite.body;
        if (this.hitbox) {
            const w = this.sprite.displayWidth || this.sprite.width;
            const h = this.sprite.displayHeight || this.sprite.height;
            this.hitbox.setSize(w * 0.6, h * 0.8);
            this.hitbox.setOffset(w * 0.2, h * 0.2);
        }
        this.isAlive = true;
    }
    update() {
        if (this.shadow && this.sprite) {
            this.shadow.x = this.sprite.x;
            this.shadow.y = this.sprite.y + 35;
        }
    }
    destroy() {
        if (this.shadow) this.shadow.destroy();
        if (this.sprite) this.sprite.destroy();
        this.isAlive = false;
    }
    setPosition(x, y) {
        this.sprite.x = x;
        this.sprite.y = y;
        this.shadow.x = x;
        this.shadow.y = y + 35;
    }
    checkCollisionWith(otherEntity) {
        if (!this.isAlive || !otherEntity.isAlive) return false;
        if (!this.sprite || !otherEntity.sprite) return false;
        const distance = Phaser.Math.Distance.Between(
            this.sprite.x, this.sprite.y,
            otherEntity.sprite.x, otherEntity.sprite.y
        );
        const minDistance = 60;
        return distance < minDistance;
    }
}
class WeaponEntity extends Entity {
    constructor(scene, player, weaponData, attackAngle) {
        super(scene, player.sprite.x, player.sprite.y, weaponData.sprite);
        this.player = player;
        this.weaponData = weaponData;
        this.attackAngle = attackAngle;
    // Length of the swing; if weapon defines a swingDuration use it, else default slower than before
    this.attackDuration = (weaponData && weaponData.swingDuration) ? weaponData.swingDuration : 900;
        this.createdTime = scene.time.now;
        // Orbit parameters: radius around player and current orbital angle
        this.orbitRadius = (weaponData && weaponData.attackRange ? weaponData.attackRange : 80) * 1.0;
        // Define the orbital sweep from bottom -> top relative to the attack direction
        this.startOrbitAngle = this.attackAngle - Math.PI / 2; // bottom
        this.endOrbitAngle = this.attackAngle + Math.PI / 2;   // top
        this.currentOrbitAngle = this.startOrbitAngle;

        this.positionWeapon();
        // Pivot near the handle for a more natural swing
    this.sprite.setOrigin(0.15, 0.5);
    // Make sword visual 50% smaller
    this.sprite.setScale(1.5);
        this.sprite.setDepth(50);
        this.sprite.setTint(0xFFD700);
        this.sprite.setAlpha(0); // fade-in for smoother appearance
        if (this.shadow) {
            this.shadow.destroy();
            this.shadow = null;
        }
        this.performAttackAnimation();
        
    }
    positionWeapon() {
        // Bind position to player's current position, orbiting around the player
        const px = this.player.sprite.x;
        const py = this.player.sprite.y;
        const x = px + Math.cos(this.currentOrbitAngle) * this.orbitRadius;
        const y = py + Math.sin(this.currentOrbitAngle) * this.orbitRadius;
        this.sprite.x = x;
        this.sprite.y = y;
        // Orient the sword along the tangent of the orbit (no spinning in place)
        // Tangent at angle theta is theta + PI/2
        this.sprite.setRotation(this.currentOrbitAngle + Math.PI / 2);
    }
    performAttackAnimation() {
        // Fade in quickly for smooth appearance
        this.scene.tweens.add({
            targets: this.sprite,
            alpha: 1,
            duration: 150,
            ease: 'Sine.easeOut'
        });
        // Tween the orbital angle from bottom -> top while following the player
        const orbitObj = { angle: this.startOrbitAngle };
        this.orbitTween = this.scene.tweens.add({
            targets: orbitObj,
            angle: this.endOrbitAngle,
            duration: this.attackDuration,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
                this.currentOrbitAngle = orbitObj.angle;
                // Re-position each tween step to keep perfectly bound to the player
                this.positionWeapon();
            },
            onComplete: () => {
                
                // Soft fade-out before destroying for smoother end
                this.scene.tweens.add({
                    targets: this.sprite,
                    alpha: 0,
                    duration: 180,
                    ease: 'Sine.easeIn',
                    onComplete: () => this.destroy()
                });
            }
        });
        // Removed traveling yellow slash effect per feedback
    }
    createSlashEffect() {
        const slashEffect = this.scene.add.graphics();
        slashEffect.lineStyle(12, 0xFFD700, 1);
        slashEffect.setDepth(100);
        const radius = this.orbitRadius;
        const startAngle = this.startOrbitAngle;
        const endAngle = this.endOrbitAngle;
        slashEffect.beginPath();
        slashEffect.arc(this.player.sprite.x, this.player.sprite.y, radius, startAngle, endAngle);
        slashEffect.strokePath();
        // Smooth glow-in followed by a gentle fade to create a trail feeling
        this.scene.tweens.add({ targets: slashEffect, alpha: 0.85, duration: 120, ease: 'Sine.easeOut' });
        this.scene.tweens.add({
            targets: slashEffect,
            alpha: 0,
            scaleX: 1.25,
            scaleY: 1.25,
            duration: Math.max(650, Math.floor(this.attackDuration * 0.9)),
            ease: 'Sine.easeIn',
            onComplete: () => slashEffect.destroy()
        });
    }
    update() {
        if (!this.isAlive) return;
        // Continuously bind to the player's current position while orbiting
        this.positionWeapon();
        if (this.scene.time.now - this.createdTime > this.attackDuration) {
            this.destroy();
        }
    }
    destroy() {
        
        if (this.orbitTween) {
            this.orbitTween.remove();
            this.orbitTween = null;
        }
        // Clear player's active melee reference for this weapon if this was the active one
        if (this.player && this.weaponData && this.weaponData.id) {
            const wId = this.weaponData.id;
            if (this.player.activeMeleeAttacks && this.player.activeMeleeAttacks.get(wId) === this) {
                this.player.activeMeleeAttacks.delete(wId);
            }
        }
        super.destroy();
    }
}

// player character class
class Player extends Entity {
    constructor(scene, x, y) {
        super(scene, x, y, 'idle_0');
        this.sprite.setDisplaySize(72, 72);
        this.sprite.setCollideWorldBounds(false);
        this.speed = 150;
        this.isMoving = false;
        this.level = 1;
        this.experience = 0;
        this.experienceToNext = 100;
        this.maxHealth = 100;
        this.currentHealth = 100;
        this.killCount = 0;
        this.baseDamage = 10;
        this.defense = 0;
        this.critChance = 5;
    this.critDamage = 150;
        this.regeneration = 0;
    this.attackSpeed = 100;
    // Size scaling for weapons/projectiles via item buffs
    this.weaponSizeScale = 1.0;
    this.debuffPower = 0; // boosts strength/duration of applied debuffs
        this.score = 0;
        this.inventory = [];
        this.maxInventorySize = 10;
        this.weapons = [];
        this.maxWeapons = 6;
    this.weaponLevels = {}; // track weapon levels by id
    this.maxWeaponLevel = 10;
        this.autoAttackEnabled = true;
        this.lastAttackTime = -5000;
        this.currentWeapon = null;
        this.attackTarget = null;
        this.lastFacingAngle = 0;
    // Per-weapon attack state and active melee gating
    this.weaponAttackState = new Map(); // key: weaponId, value: { lastAttackTime: number }
    this.activeMeleeAttacks = new Map(); // key: weaponId, value: WeaponEntity
    this.lastTrailAt = new Map(); // throttle trail drawing per-weapon
    // Pause flag for level-up / modal overlays
    this.isUpgradeOpen = false;
        this.collisionCooldowns = new Map();
        this.createAnimations();
        this.sprite.play('idle');
        this.createUI();
        this.scene.time.delayedCall(50, () => {
            if (this.levelText && this.killCountText) {
                this.updateUI();
            }
        });
    }
    createUI() {
        this.hpBarBg = this.scene.add.rectangle(0, 0, 60, 8, 0x000000);
        this.hpBarBg.setDepth(999);
        this.hpBarFill = this.scene.add.rectangle(0, 0, 60, 8, 0x00ff00);
        this.hpBarFill.setDepth(1000);
        this.hpBarBg.setVisible(true);
        this.hpBarFill.setVisible(true);
        this.scene.time.delayedCall(50, () => {
            this.updateHPBar();
        });
        this.levelText = this.scene.add.text(16, 82, `Level: ${this.level}`, {
            fontSize: '16px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            fontFamily: '"Inter", "Roboto", sans-serif'
        });
        this.levelText.setScrollFactor(0);
        this.levelText.setDepth(1000);

        this.killCountText = this.scene.add.text(16, 102, `Kills: ${this.killCount}`, {
            fontSize: '16px',
            fill: '#00ff00',
            stroke: '#000000',
            strokeThickness: 2,
            fontFamily: '"Inter", "Roboto", sans-serif'
        });
        this.killCountText.setScrollFactor(0);
        this.killCountText.setDepth(1000);

        this.waveText = this.scene.add.text(16, 122, `Wave: 1`, {
            fontSize: '16px',
            fill: '#88ccff',
            stroke: '#000000',
            strokeThickness: 2,
            fontFamily: '"Inter", "Roboto", sans-serif'
        });
        this.waveText.setScrollFactor(0);
        this.waveText.setDepth(1000);

        this.scoreText = this.scene.add.text(16, 142, `Score: 0`, {
            fontSize: '16px',
            fill: '#ffdd44',
            stroke: '#000000',
            strokeThickness: 2,
            fontFamily: '"Inter", "Roboto", sans-serif'
        });
        this.scoreText.setScrollFactor(0);
        this.scoreText.setDepth(1000);

        this.createInventoryUI();

        this.scene.gameTimer = 0;
        this.timerText = this.scene.add.text(16, 212, `Time: 0s`, {
            fontSize: '14px',
            fill: '#aaaaaa',
            stroke: '#000000',
            strokeThickness: 2,
            fontFamily: '"Inter", "Roboto", sans-serif'
        });
        this.timerText.setScrollFactor(0);
        this.timerText.setDepth(1000);
        const screenWidth = this.scene.cameras.main.width;
        this.xpBarBg = this.scene.add.rectangle(screenWidth / 2, 20, screenWidth - 40, 20, 0x000000);
        this.xpBarBg.setScrollFactor(0);
        this.xpBarBg.setDepth(1000);
        this.xpBar = this.scene.add.rectangle(screenWidth / 2, 20, screenWidth - 40, 20, 0x00ff00);
        this.xpBar.setScrollFactor(0);
        this.xpBar.setDepth(1001);
        this.xpBar.scaleX = 0;
        this.xpText = this.scene.add.text(screenWidth / 2, 20, `XP: ${this.experience}/${this.experienceToNext}`, {
            fontSize: '14px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            fontFamily: '"Inter", "Roboto", sans-serif'
        });
        this.xpText.setOrigin(0.5);
        this.xpText.setScrollFactor(0);
        this.xpText.setDepth(1002);
        this._timerEvent = this.scene.time.addEvent({
            delay: 1000,
            callback: () => {
                this.scene.gameTimer++;
                this.timerText.setText(`Time: ${this.scene.gameTimer}s`);
            },
            loop: true
        });
    }

    createInventoryUI() {
        this.inventorySlots = [];
        this.inventoryBgs = [];
        this.inventoryLevelTexts = [];
        
        const startX = 16;
        const startY = 168;
        const slotSize = 32;
        const slotSpacing = 36;
        
        for (let i = 0; i < this.maxWeapons; i++) {
            const x = startX + (i * slotSpacing);
            const y = startY;
            
            const bg = this.scene.add.rectangle(x + slotSize/2, y + slotSize/2, slotSize, slotSize, 0x444444);
            bg.setStrokeStyle(2, 0x888888);
            bg.setScrollFactor(0);
            bg.setDepth(1000);
            this.inventoryBgs.push(bg);
            
            const slot = this.scene.add.image(x + slotSize/2, y + slotSize/2, '');
            slot.setDisplaySize(24, 24);
            slot.setScrollFactor(0);
            slot.setDepth(1001);
            slot.setVisible(false);
            this.inventorySlots.push(slot);

            // Level indicator at bottom-right of the slot
            const lvl = this.scene.add.text(x + slotSize - 2, y + slotSize - 2, '', {
                fontSize: '11px',
                fill: '#ffffff',
                fontStyle: 'bold'
            });
            lvl.setOrigin(1, 1);
            lvl.setScrollFactor(0);
            lvl.setDepth(1002);
            lvl.setVisible(false);
            this.inventoryLevelTexts.push(lvl);
        }
        
        this.updateInventoryUI();
    }

    updateInventoryUI() {
        if (!this.inventorySlots) return;
        
        for (let i = 0; i < this.maxWeapons; i++) {
            const slot = this.inventorySlots[i];
            const bg = this.inventoryBgs[i];
            const lvlText = this.inventoryLevelTexts[i];
            
            if (i < this.weapons.length) {
                const weapon = this.weapons[i];
                
                slot.setTexture(weapon.sprite);
                slot.setVisible(true);
                slot.setDisplaySize(24, 24);
                
                // Neutral styling (no green highlight for the first/active item)
                bg.setFillStyle(0x444444);
                bg.setStrokeStyle(2, 0x888888);

                const wId = weapon.id || weapon.name;
                const wLevel = this.weaponLevels[wId] || weapon.level || 1;
                lvlText.setText(`Lv ${wLevel}`);
                lvlText.setVisible(true);
                lvlText.setColor('#ffffff');
            } else {
                slot.setVisible(false);
                bg.setFillStyle(0x222222);
                bg.setStrokeStyle(2, 0x444444);
                if (lvlText) lvlText.setVisible(false);
            }
        }
    }

    updateHPBar() {
        if (this.hpBarBg && this.hpBarFill && this.sprite) {
            const playerX = this.sprite.x;
            const playerY = this.sprite.y;
            const hpBarY = playerY - 50;
            this.hpBarBg.x = playerX;
            this.hpBarBg.y = hpBarY;
            this.hpBarFill.x = playerX;
            this.hpBarFill.y = hpBarY;
            const healthPercent = this.currentHealth / this.maxHealth;
            this.hpBarFill.scaleX = healthPercent;
            this.hpBarBg.setVisible(true);
            this.hpBarFill.setVisible(true);
        }
    }
    updateUI() {
        this.updateHPBar();
        const xpPercent = this.experience / this.experienceToNext;
        this.xpBar.scaleX = xpPercent;
        this.xpBar.x = (this.scene.cameras.main.width / 2) + ((this.scene.cameras.main.width - 40) * (xpPercent - 1) / 2);
        this.xpText.setText(`XP: ${this.experience}/${this.experienceToNext}`);
        this.levelText.setText(`Level: ${this.level}`);
        this.killCountText.setText(`Kills: ${this.killCount}`);
        if (this.waveText) this.waveText.setText(`Wave: ${currentWave}`);
        if (this.scoreText) this.scoreText.setText(`Score: ${this.score.toLocaleString()}`);
    }
    gainExperience(amount) {
        this.experience += amount;
        if (this.experience >= this.experienceToNext) {
            this.levelUp();
        }
        this.updateUI();
    }
    incrementKillCount() {
        this.killCount++;
        this.score += Math.max(1, 10 + Math.floor(currentDifficulty * 5) + currentWave * 2);
        this.updateUI();
    }
    addWeapon(weapon) {
        // Ensure weapon has an id
        const weaponId = weapon.id || weapon.name;
        // Level up if already owned
        const existing = this.weapons.find(w => (w.id || w.name) === weaponId);
        if (existing) {
            const currentLevel = this.weaponLevels[weaponId] || existing.level || 1;
            if (currentLevel >= this.maxWeaponLevel) {
                // Already max level, lightly buff damage a bit
                existing.instanceDamage = Math.floor(existing.instanceDamage * 1.05);
                // Ensure UI reflects any state changes
                this.updateInventoryUI();
                return;
            }
            const nextLevel = currentLevel + 1;
            this.weaponLevels[weaponId] = nextLevel;
            existing.level = nextLevel;
            // Custom upgrade path: only one stat per level, and duplicates every second level (even levels)
            this.upgradeWeaponCustom(existing, nextLevel);
            // Apply max behavior when hitting level 10
            if (nextLevel >= this.maxWeaponLevel) {
                this.applyMaxWeaponBehavior(existing);
            }
            // Refresh inventory to update "Lv X" badge immediately
            this.updateInventoryUI();
            return;
        }

        // Add new weapon instance
        if (this.weapons.length >= this.maxWeapons) {
            
            return;
        }
        const baseDamage = (typeof weapon.damage === 'function') ? weapon.damage() : weapon.damage;
        const weaponInstance = {
            ...weapon,
            id: weaponId,
            level: 1,
            baseDamage: baseDamage,
            baseAttackRange: weapon.attackRange || 80,
            baseAttackSpeed: weapon.attackSpeed || 1000,
            instanceDamage: baseDamage
        };
        // Normal starting level for all weapons (including Stone)
        this.weaponLevels[weaponId] = 1;
        this.weapons.push(weaponInstance);
        // Initialize per-weapon state - use current time to prevent immediate attack
        const currentTime = this.scene.time.now;
        this.weaponAttackState.set(weaponId, { lastAttackTime: currentTime });
        if (this.weapons.length === 1 || !this.currentWeapon) {
            this.currentWeapon = weaponInstance;
            this.updateInventoryUI();
        }
        this.applyWeaponEffects(weaponInstance);
        // Always refresh inventory so the new slot appears immediately
        this.updateInventoryUI();
    }

    // Upgrade logic that honors: only one stat per level, and duplicate shots/blades every second level
    upgradeWeaponCustom(weaponInstance, level) {
        const isProjectile = !!weaponInstance.projectile;
        // Even levels: add a duplicate effect
        if (level % 2 === 0) {
            if (isProjectile) {
                // Add one extra shot from a different degree
                weaponInstance.spreadShots = (weaponInstance.spreadShots || 1) + 1;
                // Ensure there is at least some spread to fan the shots
                weaponInstance.spreadAngleDeg = Math.max(weaponInstance.spreadAngleDeg || 0, 20);
            } else if ((weaponInstance.id || weaponInstance.name) === 'weapon_claymore') {
                // Claymore blade count is derived from level in behaviors; nothing to set here
            } else {
                // For other melee, increase attack arc/range slightly to simulate a wider sweep
                weaponInstance.attackRange = Math.floor((weaponInstance.attackRange || weaponInstance.baseAttackRange || 80) * 1.06);
            }
            return;
        }
        // Odd levels: rotate a single stat buff among size, damage, and attack speed
        const seq = ['size', 'damage', 'attackSpeed'];
        const idx = Math.floor((level - 1) / 2) % seq.length; // 1->0,3->1,5->2,7->0,9->1
        const stat = seq[idx];
        if (stat === 'size') {
            if (isProjectile) {
                weaponInstance.projectileScale = (weaponInstance.projectileScale || 1.0) * 1.08;
            } else {
                weaponInstance.attackRange = Math.floor((weaponInstance.attackRange || weaponInstance.baseAttackRange || 80) * 1.08);
            }
        } else if (stat === 'damage') {
            weaponInstance.instanceDamage = Math.max(1, Math.floor((weaponInstance.instanceDamage || weaponInstance.baseDamage || 5) * 1.12));
        } else if (stat === 'attackSpeed') {
            if (isProjectile) {
                const base = weaponInstance.attackSpeed || weaponInstance.baseAttackSpeed || 1000;
                weaponInstance.attackSpeed = Math.max(200, Math.floor(base * 0.92));
            } else {
                const swing = weaponInstance.swingDuration || 1000;
                weaponInstance.swingDuration = Math.max(350, Math.floor(swing * 0.95));
            }
        }
    }

    scaleWeaponStats(weaponInstance) {
        // Generic scaling: +10% damage per level, +4 range per level, -2% cooldown for ranged
        const lvl = weaponInstance.level || 1;
        const dmg = Math.max(1, Math.floor(weaponInstance.baseDamage * (1 + 0.10 * (lvl - 1))));
        weaponInstance.instanceDamage = dmg;
        weaponInstance.attackRange = Math.floor((weaponInstance.baseAttackRange || 80) + 4 * (lvl - 1));
        if (weaponInstance.projectile) {
            const baseCd = weaponInstance.baseAttackSpeed || weaponInstance.attackSpeed || 1000;
            const newCd = Math.max(200, Math.floor(baseCd * Math.pow(0.98, (lvl - 1))));
            weaponInstance.attackSpeed = newCd;
        } else {
            // Slightly faster swings at higher levels
            const swing = weaponInstance.swingDuration || 1000;
            weaponInstance.swingDuration = Math.max(400, Math.floor(swing * Math.pow(0.97, (lvl - 1))));
        }
    }

    applyMaxWeaponBehavior(weaponInstance) {
        if (!weaponInstance.maxBehavior) return;
        switch (weaponInstance.maxBehavior) {
            case 'giant_thrust':
                // Much larger arc and heavier damage
                weaponInstance.attackRange = Math.max(weaponInstance.attackRange, 180);
                weaponInstance.instanceDamage = Math.floor(weaponInstance.instanceDamage * 1.6);
                weaponInstance.swingDuration = Math.max(weaponInstance.swingDuration, 1200);
                weaponInstance.restAfterSwing = Math.max(weaponInstance.restAfterSwing || 1000, 1000);
                weaponInstance.maxMode = true;
                break;
            case 'spread_shot':
                // Fire a small spread of arrows
                weaponInstance.spreadShots = 5; // total shots
                weaponInstance.spreadAngleDeg = 30; // total cone
                weaponInstance.maxMode = true;
                break;
            case 'rapid_flurry':
                // Faster dagger cadence and slightly longer reach
                weaponInstance.attackRange = Math.max(weaponInstance.attackRange, 70);
                weaponInstance.swingDuration = Math.max(350, Math.floor((weaponInstance.swingDuration || 700) * 0.75));
                weaponInstance.restAfterSwing = Math.max(400, Math.floor((weaponInstance.restAfterSwing || 900) * 0.75));
                weaponInstance.instanceDamage = Math.floor(weaponInstance.instanceDamage * 1.2);
                weaponInstance.maxMode = true;
                break;
            case 'whirlwind':
                // Broad sweeping arcs for axes/flails
                weaponInstance.attackRange = Math.max(weaponInstance.attackRange, 140);
                weaponInstance.swingDuration = Math.max(1200, Math.floor((weaponInstance.swingDuration || 1200) * 1.1));
                weaponInstance.instanceDamage = Math.floor(weaponInstance.instanceDamage * 1.3);
                weaponInstance.maxMode = true;
                break;
            case 'impale':
                // Longer spear thrusts with more damage
                weaponInstance.attackRange = Math.max(weaponInstance.attackRange, 160);
                weaponInstance.instanceDamage = Math.floor(weaponInstance.instanceDamage * 1.4);
                weaponInstance.maxMode = true;
                break;
            case 'inferno_spread':
                // Magic spreads to multiple motes
                weaponInstance.spreadShots = Math.max(weaponInstance.spreadShots || 1, 3);
                weaponInstance.spreadAngleDeg = Math.max(weaponInstance.spreadAngleDeg || 0, 20);
                weaponInstance.maxMode = true;
                break;
            case 'center_strike':
                // Staff: enable centered strike behavior at max
                weaponInstance.maxMode = true;
                break;
            case 'split_rocks':
                weaponInstance.maxMode = true;
                break;
            case 'huge_burn':
                weaponInstance.maxMode = true;
                break;
            case 'poison_aoe':
                weaponInstance.maxMode = true;
                break;
            case 'double_zone':
                weaponInstance.maxMode = true;
                break;
            case 'top_bottom_aoe':
                weaponInstance.maxMode = true;
                break;
            case 'spin_orbit':
                weaponInstance.maxMode = true;
                break;
            case 'cone_whip':
                weaponInstance.maxMode = true;
                break;
            case 'impervious':
                weaponInstance.maxMode = true;
                break;
        }
    }
    applyWeaponEffects(weapon) {
        if (!weapon.effects) return;
        for (const [effectType, valueFunc] of Object.entries(weapon.effects)) {
            const value = valueFunc();
            this.applyStatBonus(effectType, value);
        }
        this.updateUI();
    }
    applyStatBonus(effectType, value) {
        switch (effectType) {
            case 'health':
                this.currentHealth = Math.min(this.currentHealth + value, this.maxHealth);
                break;
            case 'maxHealth':
                this.maxHealth += value;
                this.currentHealth = Math.min(this.currentHealth + value, this.maxHealth);
                break;
            case 'speed':
                this.speed += value;
                const enemySpeedBonus = Math.floor(value * 0.25);
                globalEnemySpeedBonus += enemySpeedBonus;
                window.globalEnemySpeedBonus = globalEnemySpeedBonus;
                enemies.forEach(enemy => {
                    if (enemy.isAlive) {
                        enemy.speed += enemySpeedBonus;
                    }
                });
                break;
            case 'damage':
                this.baseDamage += value;
                break;
            case 'defense':
                this.defense += value;
                break;
            case 'critChance':
                this.critChance += value;
                break;
            case 'critDamage':
                this.critDamage += value;
                break;
            case 'regeneration':
                this.regeneration += value;
                break;
            case 'attackSpeed':
                this.attackSpeed += value;
                break;
            case 'debuffPower':
                this.debuffPower += value;
                break;
            case 'weaponSize':
                // value is expected as +0.1 for +10%
                this.weaponSizeScale *= (1 + value);
                break;
        }
    }
    
    // Increases level and shows upgrade choices
    levelUp() {
        this.level++;
        this.experience = 0;
        this.experienceToNext = Math.floor(this.experienceToNext * 1.5);
        this.maxHealth += 20;
        // Do not fully heal on level-up; keep current health but cap at new max
        this.currentHealth = Math.min(this.currentHealth, this.maxHealth);
        this.showLevelUpSelection();
        this.updateUI();
    }
    showLevelUpSelection() {
        this.isUpgradeOpen = true;
        // Pause physics, tweens, and animations so combat stops during upgrade selection
        this.scene.physics.pause();
        if (this.scene.tweens) this.scene.tweens.pauseAll();
        if (this.scene.anims) this.scene.anims.pauseAll();
        const screenWidth = this.scene.cameras.main.width;
        const screenHeight = this.scene.cameras.main.height;
        const overlay = this.scene.add.rectangle(
            this.scene.cameras.main.centerX,
            this.scene.cameras.main.centerY,
            screenWidth * 0.9, screenHeight * 0.8, 0x000000, 0.85
        );
        overlay.setScrollFactor(0);
        overlay.setDepth(2000);
        const title = this.scene.add.text(
            this.scene.cameras.main.centerX,
            this.scene.cameras.main.centerY - (screenHeight * 0.3),
            'LEVEL UP! Choose an Upgrade:',
            { fontSize: '32px', fill: '#ffffff', fontStyle: 'bold' }
        );
        title.setOrigin(0.5);
        title.setScrollFactor(0);
        title.setDepth(2001);
        const items = this.getRandomItems(3);
        const uiElements = [overlay, title];
        let choiceMade = false;
        const rarityColors = {
            'common': 0x808080,
            'uncommon': 0x00ff00,
            'rare': 0x0080ff,
            'epic': 0x8000ff,
            'legendary': 0xff8000
        };
        const rarityBorderColors = {
            'common': 0xa0a0a0,
            'uncommon': 0x40ff40,
            'rare': 0x4080ff,
            'epic': 0xa040ff,
            'legendary': 0xff9040
        };
    items.forEach((item, index) => {
            const baseX = this.scene.cameras.main.centerX + (index - 1) * 280;
            const baseY = this.scene.cameras.main.centerY;
            const bgColor = rarityColors[item.rarity] || rarityColors.common;
            const borderColor = rarityBorderColors[item.rarity] || rarityBorderColors.common;
            const itemContainer = this.scene.add.rectangle(baseX, baseY, 240, 320, bgColor, 0.15);
            itemContainer.setScrollFactor(0);
            itemContainer.setDepth(2001);
            itemContainer.setStrokeStyle(3, borderColor);
            itemContainer.setInteractive();
            const itemSprite = this.scene.add.image(baseX, baseY - 80, item.sprite);
            itemSprite.setScrollFactor(0);
            itemSprite.setDepth(2003);
            itemSprite.setScale(2);
            const nameText = this.scene.add.text(baseX, baseY - 20, item.name, {
                fontSize: '18px',
                fill: '#ffffff',
                fontStyle: 'bold',
                align: 'center'
            });
            nameText.setOrigin(0.5);
            nameText.setScrollFactor(0);
            nameText.setDepth(2003);
            const rarityText = this.scene.add.text(baseX, baseY + 5, item.rarity.toUpperCase(), {
                fontSize: '14px',
                fill: `#${borderColor.toString(16).padStart(6, '0')}`,
                fontStyle: 'bold',
                align: 'center'
            });
            rarityText.setOrigin(0.5);
            rarityText.setScrollFactor(0);
            rarityText.setDepth(2003);
            const descText = this.scene.add.text(baseX, baseY + 40, item.description, {
                fontSize: '12px',
                fill: '#cccccc',
                align: 'center',
                wordWrap: { width: 200 }
            });
            descText.setOrigin(0.5);
            descText.setScrollFactor(0);
            descText.setDepth(2003);
            const effectText = this.scene.add.text(baseX, baseY + 80, item.effectSummary, {
                fontSize: '11px',
                fill: '#aaffaa',
                align: 'center',
                wordWrap: { width: 200 }
            });
            effectText.setOrigin(0.5);
            effectText.setScrollFactor(0);
            effectText.setDepth(2003);
            itemContainer.on('pointerover', () => {
                if (!choiceMade) {
                    itemContainer.setFillStyle(bgColor, 0.3);
                    itemContainer.setStrokeStyle(4, borderColor);
                    itemSprite.setScale(2.2);
                }
            });
            itemContainer.on('pointerout', () => {
                if (!choiceMade) {
                    itemContainer.setFillStyle(bgColor, 0.15);
                    itemContainer.setStrokeStyle(3, borderColor);
                    itemSprite.setScale(2);
                }
            });
            uiElements.push(itemContainer, itemSprite, nameText, rarityText, descText, effectText);
            const handlePick = () => {
                if (choiceMade) return;
                choiceMade = true;
                itemContainer.setFillStyle(0x00ff00, 0.4);
                itemContainer.setStrokeStyle(5, 0x00ff00);
                this.addToInventory(item);
                // Close UI immediately for responsiveness
                uiElements.forEach(element => {
                    if (element && element.destroy) {
                        try { element.destroy(); } catch (e) { /* ignore */ }
                    } else if (element && element.setVisible) {
                        element.setVisible(false);
                    }
                });
                if (this.scene.tweens) this.scene.tweens.resumeAll();
                if (this.scene.anims) this.scene.anims.resumeAll();
                this.scene.physics.resume();
                this.isUpgradeOpen = false;
            };
            itemContainer.on('pointerdown', handlePick);
            itemSprite.setInteractive({ useHandCursor: true });
            itemSprite.on('pointerdown', handlePick);
        });
    }
    showInitialWeaponChoice(onComplete) {
        this.isUpgradeOpen = true;
        this.scene.physics.pause();
        if (this.scene.tweens) this.scene.tweens.pauseAll();
        if (this.scene.anims) this.scene.anims.pauseAll();
        const screenWidth = this.scene.cameras.main.width;
        const screenHeight = this.scene.cameras.main.height;
        const overlay = this.scene.add.rectangle(
            this.scene.cameras.main.centerX,
            this.scene.cameras.main.centerY,
            screenWidth * 0.9, screenHeight * 0.8, 0x000000, 0.85
        );
        overlay.setScrollFactor(0);
        overlay.setDepth(2000);
        const title = this.scene.add.text(
            this.scene.cameras.main.centerX,
            this.scene.cameras.main.centerY - (screenHeight * 0.3),
            'Choose Your Weapon',
            { fontSize: '32px', fill: '#ffffff', fontStyle: 'bold' }
        );
        title.setOrigin(0.5);
        title.setScrollFactor(0);
        title.setDepth(2001);
        const weaponKeys = Object.keys(WEAPON_TYPES);
        const picks = Phaser.Utils.Array.Shuffle(weaponKeys).slice(0, 3);
        const items = picks.map(key => ({ ...WEAPON_TYPES[key], id: key, isWeapon: true, weaponData: { ...WEAPON_TYPES[key], id: key } }));
        const uiElements = [overlay, title];
        let choiceMade = false;
        const rarityColors = {
            'common': 0x808080,
            'uncommon': 0x00ff00,
            'rare': 0x0080ff,
            'epic': 0x8000ff,
            'legendary': 0xff8000
        };
        const rarityBorderColors = {
            'common': 0xa0a0a0,
            'uncommon': 0x40ff40,
            'rare': 0x4080ff,
            'epic': 0xa040ff,
            'legendary': 0xff9040
        };
    items.forEach((item, index) => {
            const baseX = this.scene.cameras.main.centerX + (index - 1) * 280;
            const baseY = this.scene.cameras.main.centerY;
            const bgColor = rarityColors[item.rarity] || rarityColors.common;
            const borderColor = rarityBorderColors[item.rarity] || rarityBorderColors.common;
            const itemContainer = this.scene.add.rectangle(baseX, baseY, 240, 300, bgColor, 0.15);
            itemContainer.setScrollFactor(0);
            itemContainer.setDepth(2001);
            itemContainer.setStrokeStyle(3, borderColor);
            itemContainer.setInteractive();
            const itemSprite = this.scene.add.image(baseX, baseY - 80, item.sprite);
            itemSprite.setScrollFactor(0);
            itemSprite.setDepth(2003);
            itemSprite.setScale(2);
            const nameText = this.scene.add.text(baseX, baseY - 20, item.name, {
                fontSize: '18px',
                fill: '#ffffff',
                fontStyle: 'bold',
                align: 'center'
            });
            nameText.setOrigin(0.5);
            nameText.setScrollFactor(0);
            nameText.setDepth(2003);
            const stats = `${Math.floor(item.damage())} DMG • ${item.attackRange} Range`;
            const descText = this.scene.add.text(baseX, baseY + 40, stats, {
                fontSize: '12px',
                fill: '#cccccc',
                align: 'center',
                wordWrap: { width: 200 }
            });
            descText.setOrigin(0.5);
            descText.setScrollFactor(0);
            descText.setDepth(2003);
            itemContainer.on('pointerover', () => {
                if (!choiceMade) {
                    itemContainer.setFillStyle(bgColor, 0.3);
                    itemContainer.setStrokeStyle(4, borderColor);
                    itemSprite.setScale(2.2);
                }
            });
            itemContainer.on('pointerout', () => {
                if (!choiceMade) {
                    itemContainer.setFillStyle(bgColor, 0.15);
                    itemContainer.setStrokeStyle(3, borderColor);
                    itemSprite.setScale(2);
                }
            });
            uiElements.push(itemContainer, itemSprite, nameText, descText);
            const handlePick = () => {
                if (choiceMade) return;
                choiceMade = true;
                this.addWeapon(item.weaponData);
                // Close UI immediately
                uiElements.forEach(el => {
                    if (el && el.destroy) {
                        try { el.destroy(); } catch (e) { /* ignore */ }
                    } else if (el && el.setVisible) {
                        el.setVisible(false);
                    }
                });
                if (this.scene.tweens) this.scene.tweens.resumeAll();
                if (this.scene.anims) this.scene.anims.resumeAll();
                this.scene.physics.resume();
                this.isUpgradeOpen = false;
                if (onComplete) onComplete();
            };
            itemContainer.on('pointerdown', handlePick);
            itemSprite.setInteractive({ useHandCursor: true });
            itemSprite.on('pointerdown', handlePick);
        });
    }
    getRandomItems(count = 3) {
        const rarityWeights = {
            'common': 50,
            'uncommon': 30,
            'rare': 15,
            'epic': 4,
            'legendary': 1
        };
        // Build loot pool: items always; weapons depend on capacity and ownership
        const includeNewWeapons = (this.weapons.length < this.maxWeapons);
        const itemsPool = { ...ITEM_TYPES, ...ENHANCED_ITEM_TYPES };
        // Owned weapons eligible for level-up offers ONLY if not maxed
        const ownedWeapons = (this.weapons || []);
        const ownedWeaponIds = new Set(ownedWeapons.map(w => w.id || w.name));
        const nonMaxedOwnedIds = new Set(
            ownedWeapons
                .filter(w => (this.weaponLevels[w.id || w.name] || w.level || 1) < this.maxWeaponLevel)
                .map(w => w.id || w.name)
        );
        const ownedWeaponsPool = {};
        nonMaxedOwnedIds.forEach(id => { if (WEAPON_TYPES[id]) ownedWeaponsPool[id] = WEAPON_TYPES[id]; });
        // New weapons only when below max weapon slots
        const newWeaponsPool = includeNewWeapons ? WEAPON_TYPES : {};
        const allItems = { ...itemsPool, ...(includeNewWeapons ? newWeaponsPool : {}), ...ownedWeaponsPool };
        const allItemKeys = Object.keys(allItems);
        const selectedItems = [];
        for (let i = 0; i < count; i++) {
            let attempts = 0;
            let selectedItem = null;
            while (!selectedItem && attempts < 30) {
                const randomKey = allItemKeys[Math.floor(Math.random() * allItemKeys.length)];
                const itemData = allItems[randomKey];
                const rarityWeight = rarityWeights[itemData.rarity] || 1;
                const chance = Math.random() * 100;
                if (chance < rarityWeight) {
                    const isWeapon = WEAPON_TYPES[randomKey] !== undefined;
                    // If at max weapons, only offer weapons the player already owns
                    if (isWeapon && !includeNewWeapons && !ownedWeaponIds.has(randomKey)) { attempts++; continue; }
                    // Never offer maxed weapons
                    if (isWeapon) {
                        const lvl = this.weaponLevels[randomKey] || ((this.weapons || []).find(w => (w.id || w.name) === randomKey)?.level) || 0;
                        if (lvl >= this.maxWeaponLevel) { attempts++; continue; }
                        // If not owned and not allowed to add new (no slots), skip
                        if (!includeNewWeapons && !ownedWeaponIds.has(randomKey)) { attempts++; continue; }
                        // If owned but maxed (defensive double-check), skip
                        if (ownedWeaponIds.has(randomKey) && !nonMaxedOwnedIds.has(randomKey)) { attempts++; continue; }
                    }
                    const randomizedItem = {
                        id: randomKey,
                        sprite: itemData.sprite,
                        name: itemData.name,
                        category: itemData.category,
                        rarity: itemData.rarity,
                        effects: {},
                        description: '',
                        isWeapon: isWeapon,
                        weaponData: isWeapon ? { ...itemData, id: randomKey } : null
                    };
                    const effectDescriptions = [];
                    if (itemData.effects) {
                        for (const [effectType, effectFunc] of Object.entries(itemData.effects)) {
                            const value = effectFunc();
                            randomizedItem.effects[effectType] = value;
                            const sign = value > 0 ? '+' : '';
                            switch (effectType) {
                                case 'health': effectDescriptions.push(`${sign}${value} Health`); break;
                                case 'maxHealth': effectDescriptions.push(`${sign}${value} Max Health`); break;
                                case 'speed': effectDescriptions.push(`${sign}${value} Speed`); break;
                                case 'damage': effectDescriptions.push(`${sign}${value} Damage`); break;
                                case 'defense': effectDescriptions.push(`${sign}${value} Defense`); break;
                                case 'critChance': effectDescriptions.push(`${sign}${value}% Crit Chance`); break;
                                case 'critDamage': effectDescriptions.push(`${sign}${value}% Crit Damage`); break;
                                case 'regeneration': effectDescriptions.push(`${sign}${value} HP/sec Regen`); break;
                                case 'attackSpeed': effectDescriptions.push(`${sign}${value}% Attack Speed`); break;
                            }
                        }
                    }
                    if (isWeapon) {
                        const weaponStats = [];
                        const dmgVal = (typeof itemData.damage === 'function') ? itemData.damage() : itemData.damage;
                        weaponStats.push(`${Math.floor(dmgVal)} DMG`);
                        if (itemData.attackRange) weaponStats.push(`${itemData.attackRange} Range`);
                        // Compute APS for melee from swing+rest if attackSpeed missing
                        let aps = null;
                        if (itemData.attackSpeed) {
                            aps = 1000 / itemData.attackSpeed;
                        } else if (itemData.swingDuration || itemData.restAfterSwing) {
                            const swing = itemData.swingDuration || 1000;
                            const rest = itemData.restAfterSwing || 1000;
                            aps = 1000 / (swing + rest);
                        }
                        if (aps) weaponStats.push(`${aps.toFixed(2)} APS`);
                        effectDescriptions.unshift(weaponStats.join(' • '));
                    }
                    randomizedItem.description = itemData.description || effectDescriptions.join(', ');
                    randomizedItem.effectSummary = effectDescriptions.join(' | ');
                    selectedItem = randomizedItem;
                }
                attempts++;
            }
            if (selectedItem) {
                selectedItems.push(selectedItem);
            } else {
                const fallbackKey = 'berry01blue';
                const itemData = ITEM_TYPES[fallbackKey];
                const fallbackItem = {
                    id: fallbackKey,
                    sprite: itemData.sprite,
                    name: itemData.name,
                    category: itemData.category,
                    rarity: itemData.rarity,
                    effects: { health: 20 },
                    description: '+20 Health'
                };
                selectedItems.push(fallbackItem);
            }
        }
        return selectedItems;
    }
    addToInventory(item) {
        if (item.isWeapon) {
            this.addWeapon(item.weaponData);
        } else {
            if (this.inventory.length < this.maxInventorySize) {
                this.inventory.push(item);
                this.applyItemEffect(item);
            }
        }
    }
    applyItemEffect(item) {
        if (!item.effects) return;
        for (const [effectType, value] of Object.entries(item.effects)) {
            switch (effectType) {
                case 'health':
                    this.currentHealth = Math.min(this.currentHealth + value, this.maxHealth);
                    break;
                case 'maxHealth':
                    this.maxHealth += value;
                    this.currentHealth = Math.min(this.currentHealth + value, this.maxHealth);
                    break;
                case 'speed':
                    this.applyStatBonus('speed', value);
                    break;
                case 'damage':
                    this.baseDamage += value;
                    break;
                case 'defense':
                    this.defense += value;
                    break;
                case 'critChance':
                    this.critChance += value;
                    break;
                case 'critDamage':
                    this.critDamage += value;
                    break;
                case 'regeneration':
                    this.regeneration += value;
                    break;
                case 'attackSpeed':
                    this.attackSpeed += value;
                    break;
                case 'weaponSize':
                    this.weaponSizeScale *= (1 + value);
                    break;
            }
        }
        this.updateUI();
    }
    update() {
        super.update();
        if (this.isAlive) {
            this.updateHPBar();
            
            // Apply regeneration every second
            if (!this.lastRegenTime) this.lastRegenTime = Date.now();
            const now = Date.now();
            if (now - this.lastRegenTime >= 1000 && this.regeneration > 0) {
                this.currentHealth = Math.min(this.currentHealth + this.regeneration, this.maxHealth);
                this.updateUI();
                this.lastRegenTime = now;
            }
            
            if (this.currentWeapon) {
                if (!this.frameCount) this.frameCount = 0;
                this.frameCount++;
                this.autoAttack();
            } else {
                // no current weapon; nothing to log
            }
        }
    }
    findNearestEnemy() {
        if (!enemies || enemies.length === 0) return null;
        let nearestEnemy = null;
        let nearestDistance = Infinity;
        enemies.forEach(enemy => {
            if (enemy.isAlive) {
                const distance = Phaser.Math.Distance.Between(
                    this.sprite.x, this.sprite.y,
                    enemy.sprite.x, enemy.sprite.y
                );
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestEnemy = enemy;
                }
            }
        });
        return nearestEnemy;
    }
    autoAttack() {
        // Block attacks when an upgrade modal is open
        if (this.isUpgradeOpen || !this.autoAttackEnabled) return;
        if (!this.weapons || this.weapons.length === 0) return;
        const currentTime = this.scene.time.now;
        const target = this.findNearestEnemy();
        // Iterate all weapons and trigger if their own cooldown has elapsed
        for (const weapon of this.weapons) {
            if (!weapon) continue;
            const wId = weapon.id || weapon.name;
            let state = this.weaponAttackState.get(wId);
            if (!state) {
                state = { lastAttackTime: -99999 };
                this.weaponAttackState.set(wId, state);
            }
            const attackCooldown = this.getWeaponCooldown(weapon);
            const timeSince = currentTime - state.lastAttackTime;
            if (timeSince < attackCooldown) continue;
            // For melee, prevent overlap per-weapon
            if (!weapon.projectile) {
                const activeSwing = this.activeMeleeAttacks.get(wId);
                if (activeSwing && activeSwing.isAlive) continue;
            }
            this.performContinuousAttackFor(weapon, target);
            state.lastAttackTime = currentTime;
        }
    }

    getWeaponCooldown(weapon) {
        if (!weapon) return 1000;
        if (!weapon.projectile) {
            const swing = weapon.swingDuration || 1000;
            const rest = weapon.restAfterSwing || 1000;
            return swing + rest;
        }
        const baseCooldown = weapon.attackSpeed || 800;
        return Math.max(200, Math.floor(baseCooldown * 100 / (100 + this.attackSpeed)));
    }
    performContinuousAttack(target) {
        // Backward-compatible: use current weapon
        if (!this.currentWeapon) return;
        this.performContinuousAttackFor(this.currentWeapon, target);
    }

    performContinuousAttackFor(weapon, target) {
        // Try weapon-specific behaviors first; fall back to generic
        const handled = executeWeaponAttack(this.scene, this, weapon, target, enemies, projectiles, zones);
        if (handled) return;
        if (weapon.projectile) {
            if (target) {
                this.performWeaponAttack(weapon, target);
            }
        } else {
            let attackAngle = target
                ? Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, target.sprite.x, target.sprite.y)
                : (this.lastFacingAngle || 0);
            this.createWeaponAttackFor(weapon, attackAngle);
            this.createAttackHitboxFor(weapon, attackAngle);
        }
    }
    showWeaponSwingAtAngle(angle, weaponOverride = null) {
        // Restore simple travel trail (no sparkles): a clean arc that fades out smoothly
        // Throttle trail draws to avoid excessive Graphics allocations
        const w = weaponOverride || this.currentWeapon;
        const wid = (w && (w.id || w.name)) || 'default';
        const now = this.scene.time.now;
        const last = this.lastTrailAt.get(wid) || 0;
        if (now - last < 120) return;
        this.lastTrailAt.set(wid, now);
        const slashEffect = this.scene.add.graphics();
        slashEffect.lineStyle(6, 0xFFD700, 0.8);
        slashEffect.setDepth(200);
        const radius = w && w.attackRange ? w.attackRange : 80;
        const arcStartAngle = angle - Math.PI / 2;
        const arcEndAngle = angle + Math.PI / 2;
        slashEffect.beginPath();
        slashEffect.arc(this.sprite.x, this.sprite.y, radius, arcStartAngle, arcEndAngle);
        slashEffect.strokePath();
        this.scene.tweens.add({
            targets: slashEffect,
            alpha: 0,
            duration: 300,
            ease: 'Sine.easeOut',
            onComplete: () => slashEffect.destroy()
        });
    }
    createWeaponAttack(angle) {
        if (!this.currentWeapon) {
            return;
        }
        
        // For melee, ensure only a single active instance is present
        if (this.currentWeapon && !this.currentWeapon.projectile) {
            const wId = this.currentWeapon.id || this.currentWeapon.name;
            const active = this.activeMeleeAttacks.get(wId);
            if (active && active.isAlive) return;
        }
        const weaponEntity = new WeaponEntity(this.scene, this, this.currentWeapon, angle);
        if (this.currentWeapon && !this.currentWeapon.projectile) {
            const wId = this.currentWeapon.id || this.currentWeapon.name;
            this.activeMeleeAttacks.set(wId, weaponEntity);
        }
    }
    createAttackHitbox(angle) {
    
        const hitboxDistance = 50;
        const hitboxX = this.sprite.x + Math.cos(angle) * hitboxDistance;
        const hitboxY = this.sprite.y + Math.sin(angle) * hitboxDistance;
        const slashEffect = this.scene.add.graphics();
        slashEffect.lineStyle(6, 0xFFFFFF, 1);
        slashEffect.setDepth(100);
    const slashLength = this.currentWeapon && this.currentWeapon.attackRange ? this.currentWeapon.attackRange : 60;
        const slashAngle = Math.PI / 3;
        const startAngle = angle - slashAngle / 2;
        const endAngle = angle + slashAngle / 2;
        slashEffect.beginPath();
        slashEffect.arc(this.sprite.x, this.sprite.y, slashLength, startAngle, endAngle);
        slashEffect.strokePath();
        this.checkEnemiesInAttackArea(hitboxX, hitboxY, slashLength, this.currentWeapon);
        this.scene.tweens.add({
            targets: slashEffect,
            alpha: 0,
            duration: 300,
            onComplete: () => {
                slashEffect.destroy();
            }
        });
    }
    createWeaponAttackFor(weapon, angle) {
        if (!weapon) return;
        if (weapon && !weapon.projectile) {
            const wId = weapon.id || weapon.name;
            const active = this.activeMeleeAttacks.get(wId);
            if (active && active.isAlive) return;
            const weaponEntity = new WeaponEntity(this.scene, this, weapon, angle);
            this.activeMeleeAttacks.set(wId, weaponEntity);
        }
    }
    // Create a melee hitbox using the provided weapon (used by auto-attack per-weapon loop)
    createAttackHitboxFor(weapon, angle) {
        if (!weapon) return;
        const hitboxDistance = 50;
        const hitboxX = this.sprite.x + Math.cos(angle) * hitboxDistance;
        const hitboxY = this.sprite.y + Math.sin(angle) * hitboxDistance;
        const slashLength = weapon && weapon.attackRange ? weapon.attackRange : 60;
        // Draw a lightweight arc and apply damage via shared area check
        const g = this.scene.add.graphics();
        g.lineStyle(4, 0xFFFFFF, 0.7);
        g.setDepth(100);
        const slashAngle = Math.PI / 3;
        const startAngle = angle - slashAngle / 2;
        const endAngle = angle + slashAngle / 2;
        g.beginPath();
        g.arc(this.sprite.x, this.sprite.y, slashLength, startAngle, endAngle);
        g.strokePath();
        this.checkEnemiesInAttackArea(hitboxX, hitboxY, slashLength, weapon);
        this.scene.tweens.add({
            targets: g,
            alpha: 0,
            duration: 220,
            onComplete: () => g.destroy()
        });
    }
    checkEnemiesInAttackArea(centerX, centerY, radius, weaponOverride = null) {
        enemies.forEach(enemy => {
            if (enemy.isAlive) {
                const distance = Phaser.Math.Distance.Between(
                    centerX, centerY,
                    enemy.sprite.x, enemy.sprite.y
                );
                if (distance <= radius) {
                    const w = weaponOverride || this.currentWeapon;
                    let damage = w.instanceDamage || (typeof w.damage === 'function' ? w.damage() : w.damage);
                    damage += this.baseDamage;
                    const critRoll = Math.random() * 100;
                    if (critRoll < this.critChance) {
                        damage = Math.floor(damage * (this.critDamage / 100));
                    }
                    enemy.takeDamage(damage, w?.damageType);
                    // Apply debuff based on weapon damage type
                    if (w && w.damageType && enemy.applyDebuff) {
                        enemy.applyDebuff(w.damageType, 1 + (this.debuffPower || 0));
                    }
                    this.showFloatingDamage(enemy, damage);
                    this.showAttackEffect(enemy);
                }
            }
        });
    }
    performAttack(target) {
        // Backward-compatible: use current weapon
        if (!this.currentWeapon || !target) return;
        this.performWeaponAttack(this.currentWeapon, target);
    }

    performWeaponAttack(weapon, target) {
        if (!weapon || !target) return;
        let damage = weapon.instanceDamage || (typeof weapon.damage === 'function' ? weapon.damage() : weapon.damage);
        damage += this.baseDamage;
        const critRoll = Math.random() * 100;
        if (critRoll < this.critChance) {
            damage = Math.floor(damage * (this.critDamage / 100));
        }
        if (weapon.projectile) {
            this.launchProjectileWithWeapon(weapon, target, damage);
        } else {
            this.performMeleeAttackWithWeapon(weapon, target, damage);
        }
    }
    performMeleeAttack(target, damage) {
        // Backward-compatible for current weapon
        if (!this.currentWeapon || !target) return;
        this.performMeleeAttackWithWeapon(this.currentWeapon, target, damage);
    }

    performMeleeAttackWithWeapon(weapon, target, damage) {
        if (target) {
            const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, target.sprite.x, target.sprite.y);
            this.showWeaponSwingAtAngle(angle, weapon);
        }
        this.createSlashHitboxFor(weapon, target, damage);
        this.showAttackEffect(target);
        this.applyWeaponUniqueEffectFor(weapon, target, damage);
    }
    createSlashHitbox(target, damage) {
        // Backward-compatible; use current weapon
        if (!this.currentWeapon) return;
        this.createSlashHitboxFor(this.currentWeapon, target, damage);
    }

    createSlashHitboxFor(weapon, target, damage) {
        const angle = Phaser.Math.Angle.Between(
            this.sprite.x, this.sprite.y,
            target.sprite.x, target.sprite.y
        );
        const hitboxDistance = 50;
        const hitboxX = this.sprite.x + Math.cos(angle) * hitboxDistance;
        const hitboxY = this.sprite.y + Math.sin(angle) * hitboxDistance;
        // Throttle only the visual trail; damage still applies instantly
        let allowTrail = true;
        const wid = (weapon && (weapon.id || weapon.name)) || 'default_melee';
        const now = this.scene.time.now;
        const last = this.lastTrailAt.get(wid) || 0;
        if (now - last < 120) {
            allowTrail = false;
        } else {
            this.lastTrailAt.set(wid, now);
        }
        const slashLength = weapon && weapon.attackRange ? weapon.attackRange : 60;
        const slashAngle = Math.PI / 3;
        const startAngle = angle - slashAngle / 2;
        const endAngle = angle + slashAngle / 2;
        let slashEffect = null;
        if (allowTrail) {
            slashEffect = this.scene.add.graphics();
            slashEffect.lineStyle(3, 0xFFFFFF, 0.9);
            slashEffect.setDepth(100);
            slashEffect.beginPath();
            slashEffect.arc(this.sprite.x, this.sprite.y, slashLength, startAngle, endAngle);
            slashEffect.strokePath();
        }
        target.takeDamage(damage, weapon?.damageType);
        if (weapon && weapon.damageType && target.applyDebuff) {
            target.applyDebuff(weapon.damageType, 1 + (this.debuffPower || 0));
        }
        this.showFloatingDamage(target, damage);
        if (slashEffect) {
            this.scene.tweens.add({
                targets: slashEffect,
                alpha: 0,
                duration: 200,
                onComplete: () => {
                    slashEffect.destroy();
                }
            });
        }
    }
    showFloatingDamage(target, damage) {
        // Throttle floating damage texts per enemy to avoid text spam and GC spikes
        this.damageTextCooldowns = this.damageTextCooldowns || new Map();
        const now = this.scene.time.now || Date.now();
        const id = target.id || target.sprite?.name || `${target.sprite.x}_${target.sprite.y}`;
        const lastAt = this.damageTextCooldowns.get(id) || 0;
        if (now - lastAt < 200) {
            return; // skip frequent texts
        }
        this.damageTextCooldowns.set(id, now);
        const damageText = this.scene.add.text(
            target.sprite.x,
            target.sprite.y - 20,
            `-${Math.floor(damage)}`,
            {
                fontSize: '16px',
                fontFamily: '"Inter", "Roboto", sans-serif',
                fill: '#ff4444',
                fontStyle: 'bold'
            }
        );
        damageText.setDepth(1000);
        this.scene.tweens.add({
            targets: damageText,
            y: target.sprite.y - 60,
            alpha: 0,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => {
                damageText.destroy();
            }
        });
    }
    launchProjectile(target, damage) {
        // Backward-compatible; use current weapon
        if (!this.currentWeapon) return;
        this.launchProjectileWithWeapon(this.currentWeapon, target, damage);
    }

    launchProjectileWithWeapon(weapon, target, damage) {
        const baseAngle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, target.sprite.x, target.sprite.y);
        const shots = (weapon && weapon.spreadShots) ? weapon.spreadShots : 1;
        const spread = (weapon && weapon.spreadAngleDeg) ? weapon.spreadAngleDeg : 0;
        const half = Math.floor(shots / 2);
        for (let i = 0; i < shots; i++) {
            let offsetDeg = 0;
            if (shots > 1) {
                // Distribute evenly across spread cone
                offsetDeg = (-spread / 2) + (i * (spread / (shots - 1)));
            }
            const angle = baseAngle + Phaser.Math.DEG_TO_RAD * offsetDeg;
            const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, target.sprite.x, target.sprite.y);
            const endX = this.sprite.x + Math.cos(angle) * dist;
            const endY = this.sprite.y + Math.sin(angle) * dist;
            const projectile = new Projectile(
                this.scene,
                this.sprite.x,
                this.sprite.y,
                endX,
                endY,
                weapon,
                damage
            );
            projectiles.push(projectile);
        }
        if (weapon.category === 'magic') {
            this.showCastingEffect();
        }
    }
    showCastingEffect() {
        const castEffect = this.scene.add.sprite(this.sprite.x, this.sprite.y, 'magic_effect');
        castEffect.setDepth(1500);
        castEffect.setScale(1.2);
        castEffect.play('magic_effect_anim');
        castEffect.on('animationcomplete', () => {
            castEffect.destroy();
        });
    }
    applyWeaponUniqueEffect(target, damage) {
        // Backward-compatible: use current weapon
        if (!this.currentWeapon) return;
        this.applyWeaponUniqueEffectFor(this.currentWeapon, target, damage);
    }
    applyWeaponUniqueEffectFor(weapon, target, damage) {
        switch (weapon.name) {
            case 'Swift Dagger':
                if (Math.random() < 0.25) {
                    this.scene.time.delayedCall(200, () => {
                        if (target.isAlive) {
                            target.takeDamage(Math.floor(damage * 0.5), DAMAGE_TYPES.PHYSICAL);
                            this.showAttackEffect(target);
                        }
                    });
                }
                break;
            case 'Double Axe':
                enemies.forEach(enemy => {
                    if (enemy !== target && enemy.isAlive) {
                        const distance = Phaser.Math.Distance.Between(
                            target.sprite.x, target.sprite.y,
                            enemy.sprite.x, enemy.sprite.y
                        );
                        if (distance < 80) {
                            enemy.takeDamage(Math.floor(damage * 0.4), DAMAGE_TYPES.PHYSICAL);
                            this.showAttackEffect(enemy);
                        }
                    }
                });
                break;
            case 'Crystal Sword':
                if (Math.random() < 0.3) {
                    this.chainLightning(target, damage);
                }
                break;
            case 'Shield': {
                // Push enemies away a short distance
                const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, target.sprite.x, target.sprite.y);
                const pushDist = 40;
                const destX = target.sprite.x + Math.cos(angle) * pushDist;
                const destY = target.sprite.y + Math.sin(angle) * pushDist;
                this.scene.tweens.add({
                    targets: target.sprite,
                    x: destX,
                    y: destY,
                    duration: 120,
                    ease: 'Sine.easeOut'
                });
                break;
            }
        }
    }
    chainLightning(startTarget, baseDamage) {
        let currentTarget = startTarget;
        let chainCount = 0;
        const maxChains = 3;
        const chainNext = () => {
            if (chainCount >= maxChains) return;
            let nearestEnemy = null;
            let nearestDistance = Infinity;
            enemies.forEach(enemy => {
                if (enemy !== currentTarget && enemy.isAlive) {
                    const distance = Phaser.Math.Distance.Between(
                        currentTarget.sprite.x, currentTarget.sprite.y,
                        enemy.sprite.x, enemy.sprite.y
                    );
                    if (distance < 120 && distance < nearestDistance) {
                        nearestDistance = distance;
                        nearestEnemy = enemy;
                    }
                }
            });
            if (nearestEnemy) {
                this.createLightningEffect(currentTarget, nearestEnemy);
                const chainDamage = Math.floor(baseDamage * (0.6 - chainCount * 0.1));
                nearestEnemy.takeDamage(chainDamage, DAMAGE_TYPES.LIGHTNING);
                currentTarget = nearestEnemy;
                chainCount++;
                this.scene.time.delayedCall(150, chainNext);
            }
        };
        this.scene.time.delayedCall(100, chainNext);
    }
    createLightningEffect(from, to) {
        const lightning = this.scene.add.line(
            0, 0,
            from.sprite.x, from.sprite.y,
            to.sprite.x, to.sprite.y,
            0x00ffff, 0.8
        );
        lightning.setDepth(1500);
        lightning.setLineWidth(3);
        this.scene.time.delayedCall(100, () => {
            if (lightning) lightning.destroy();
        });
    }
    showAttackEffect(target) {
        if (!target || !target.sprite) return;
        const w = this.currentWeapon;
        const dmgType = (w && w.damageType) ? w.damageType : 'physical';
        let texKey, animKey;
        if (dmgType === 'burn') {
            texKey = 'fire_effect'; animKey = 'fire_effect_anim';
        } else if (dmgType === 'lightning' || dmgType === 'armor_weaken') {
            texKey = 'bluefire_effect'; animKey = 'bluefire_effect_anim';
        } else if (dmgType === 'poison') {
            texKey = 'magic_effect'; animKey = 'magic_effect_anim';
        } else {
            texKey = 'weaponhit_effect'; animKey = 'weaponhit_effect_anim';
        }
        const effect = this.scene.add.sprite(target.sprite.x, target.sprite.y, texKey);
        effect.setDepth(1500);
        effect.setScale(1.0);
        effect.play(animKey);
        effect.on('animationcomplete', () => effect.destroy());
    }
    takeDamage(amount) {
        if (!this.isAlive) return;
        // Shield max: brief impervious window support
        const now = this.scene.time.now || Date.now();
        if (this.imperviousUntil && now < this.imperviousUntil) {
            return;
        }
        this.currentHealth -= amount;
        if (this.currentHealth < 0) this.currentHealth = 0;
        this.sprite.setTint(0xff0000);
        this.scene.time.delayedCall(100, () => {
            if (this.isAlive) {
                this.sprite.setTint(0xffffff);
            }
        });
        if (this.currentHealth <= 0) {
            this.die();
        }
        this.updateHPBar();
        this.updateUI();
    }
    die() {
        if (this.isDying) return;
        this.isDying = true;
        this.isAlive = false;
        // Stop the game timer when the player dies
        if (this._timerEvent && this._timerEvent.remove) {
            try { this._timerEvent.remove(false); } catch (e) {}
            this._timerEvent = null;
        }
        this.sprite.setVelocity(0, 0);
        this.sprite.clearTint();
        this.playDeathAnimation();
        this.scene.time.delayedCall(100, () => {
            this.scene.physics.pause();
        });
    }
    playDeathAnimation() {
        if (this.deathAnimationStarted) return;
        this.deathAnimationStarted = true;
        this.sprite.stop();
        this.sprite.setVelocity(0, 0);
        let deathFrame = 0;
        const maxFrames = 10;
        const playNextFrame = () => {
            if (deathFrame < maxFrames) {
                this.sprite.setTexture(`death_${deathFrame}`);
                deathFrame++;
                this.scene.time.delayedCall(200, playNextFrame);
            } else {
                this.scene.time.delayedCall(500, () => {
                    this.showGameOverScreen();
                });
            }
        };
        playNextFrame();
    }
    showGameOverScreen() {
        // SFX + fade BGM
        try { this.scene.sound.play('sfx_gameover', { volume: 1.0 }); } catch (e) {}
        if (bgmMusic) {
            try {
                this.scene.tweens.add({
                    targets: bgmMusic, volume: 0, duration: 800, ease: 'Sine.easeInOut',
                    onComplete: () => { try { bgmMusic.stop(); bgmMusic.destroy(); } catch (_) {} bgmMusic = null; }
                });
            } catch (_) { try { bgmMusic.stop(); bgmMusic.destroy(); } catch (_) {} bgmMusic = null; }
        }

        const timeSec = this.scene.gameTimer || 0;
        const finalScore = this.score + Math.floor(timeSec * 3);
        const wave = currentWave;

        // Phaser overlay
        const overlay = this.scene.add.rectangle(
            this.scene.cameras.main.centerX, this.scene.cameras.main.centerY,
            this.scene.cameras.main.width, this.scene.cameras.main.height, 0x000000, 0.82
        );
        overlay.setScrollFactor(0).setDepth(3000);

        const gameOverText = this.scene.add.text(
            this.scene.cameras.main.centerX, this.scene.cameras.main.centerY - 130,
            'GAME OVER',
            { fontSize: '54px', fill: '#ff2222', stroke: '#000000', strokeThickness: 5, fontFamily: '"Pickyside", monospace' }
        );
        gameOverText.setOrigin(0.5).setScrollFactor(0).setDepth(3001);

        const statsText = this.scene.add.text(
            this.scene.cameras.main.centerX, this.scene.cameras.main.centerY - 50,
            [
                `Level: ${this.level}   |   Wave: ${wave}`,
                `Kills: ${this.killCount}   |   Time: ${timeSec}s`,
                ``,
                `SCORE:  ${finalScore.toLocaleString()}`
            ].join('\n'),
            { fontSize: '20px', fill: '#ffffff', stroke: '#000000', strokeThickness: 2, align: 'center', lineSpacing: 6 }
        );
        statsText.setOrigin(0.5).setScrollFactor(0).setDepth(3001);

        const restartButton = this.scene.add.rectangle(
            this.scene.cameras.main.centerX - 90, this.scene.cameras.main.centerY + 110, 160, 48, 0x3a3a3a
        );
        restartButton.setScrollFactor(0).setDepth(3001).setInteractive();
        restartButton.setStrokeStyle(2, 0x888888);

        const restartText = this.scene.add.text(
            this.scene.cameras.main.centerX - 90, this.scene.cameras.main.centerY + 110, 'Play Again',
            { fontSize: '18px', fill: '#ffffff', fontFamily: '"Pickyside", monospace' }
        );
        restartText.setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        const homeButton = this.scene.add.rectangle(
            this.scene.cameras.main.centerX + 90, this.scene.cameras.main.centerY + 110, 160, 48, 0x3a3a3a
        );
        homeButton.setScrollFactor(0).setDepth(3001).setInteractive();
        homeButton.setStrokeStyle(2, 0x888888);

        const homeText = this.scene.add.text(
            this.scene.cameras.main.centerX + 90, this.scene.cameras.main.centerY + 110, 'Main Menu',
            { fontSize: '18px', fill: '#ffffff', fontFamily: '"Pickyside", monospace' }
        );
        homeText.setOrigin(0.5).setScrollFactor(0).setDepth(3002);

        // Hover effects
        [restartButton, homeButton].forEach(btn => {
            btn.on('pointerover', () => btn.setFillStyle(0x555555));
            btn.on('pointerout',  () => btn.setFillStyle(0x3a3a3a));
        });

        const stopBgm = () => {
            if (bgmMusic) { try { bgmMusic.stop(); bgmMusic.destroy(); } catch (_) {} bgmMusic = null; }
        };
        const removeNameEntry = () => {
            const el = document.getElementById('cf-name-entry');
            if (el) el.remove();
        };

        restartButton.on('pointerdown', () => { removeNameEntry(); stopBgm(); this.scene.scene.restart(); });
        homeButton.on('pointerdown',    () => { removeNameEntry(); stopBgm(); window.location.href = '/'; });

        // DOM name-entry overlay for leaderboard submission
        const nameEntry = document.createElement('div');
        nameEntry.id = 'cf-name-entry';
        nameEntry.style.cssText = `
            position: fixed;
            left: 50%;
            transform: translateX(-50%);
            top: calc(50% + 30px);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            font-family: 'Pickyside', monospace;
            color: white;
            text-align: center;
        `;
        nameEntry.innerHTML = `
            <p style="margin:0 0 4px;font-size:15px;color:gold;">Submit your score to the leaderboard:</p>
            <div style="display:flex;gap:8px;align-items:center;">
                <input id="cf-name-input" type="text" maxlength="16" placeholder="Your name (max 16)"
                    style="font-family:'Pickyside',monospace;font-size:14px;padding:8px 12px;
                           border-radius:5px;border:2px solid gold;background:rgba(0,0,0,0.85);
                           color:white;width:190px;outline:none;">
                <button id="cf-submit-btn"
                    style="font-family:'Pickyside',monospace;font-size:14px;padding:8px 14px;
                           background:gold;color:black;border:none;border-radius:5px;cursor:pointer;
                           font-weight:bold;">Submit</button>
            </div>
            <p id="cf-submit-status" style="margin:0;font-size:13px;min-height:18px;"></p>
        `;
        document.body.appendChild(nameEntry);

        const submitBtn = document.getElementById('cf-submit-btn');
        const nameInput = document.getElementById('cf-name-input');
        const statusEl  = document.getElementById('cf-submit-status');

        const doSubmit = async () => {
            const rawName = nameInput.value.trim();
            const name = rawName.length > 0 ? rawName : 'Anonymous';
            submitBtn.disabled = true;
            submitBtn.textContent = '...';
            statusEl.style.color = '#aaaaaa';
            statusEl.textContent = 'Submitting…';
            try {
                const res = await fetch('/api/scores', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, score: finalScore, wave })
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                statusEl.style.color = '#90EE90';
                statusEl.textContent = `Score submitted! Check the leaderboard.`;
                submitBtn.textContent = '✓';
                nameInput.disabled = true;
            } catch (err) {
                statusEl.style.color = '#ff6666';
                statusEl.textContent = `Could not submit — server offline?`;
                submitBtn.disabled = false;
                submitBtn.textContent = 'Retry';
            }
        };

        submitBtn.addEventListener('click', doSubmit);
        nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSubmit(); });
        nameInput.focus();
    }
    createAnimations() {
        this.scene.anims.create({
            key: 'idle',
            frames: [
                { key: 'idle_0' }, { key: 'idle_1' }, { key: 'idle_2' }, { key: 'idle_3' },
                { key: 'idle_4' }, { key: 'idle_5' }, { key: 'idle_6' }, { key: 'idle_7' }
            ],
            frameRate: 4,
            repeat: -1
        });
        this.scene.anims.create({
            key: 'run',
            frames: [
                { key: 'run_0' }, { key: 'run_1' }, { key: 'run_2' }, { key: 'run_3' },
                { key: 'run_4' }, { key: 'run_5' }, { key: 'run_6' }, { key: 'run_7' },
                { key: 'run_8' }, { key: 'run_9' }
            ],
            frameRate: 12,
            repeat: -1
        });
    }
    handleInput(cursors) {
        this.isMoving = false;
        this.sprite.setVelocity(0);
        if (!cursors) {
            return;
        }
        const wasMoving = this._wasMoving || false;
        let moveX = 0;
        let moveY = 0;
        if (cursors.A && cursors.A.isDown) {
            this.sprite.setVelocityX(-this.speed);
            this.sprite.setFlipX(true);
            this.isMoving = true;
            moveX = -1;
            this.lastFacingAngle = Math.PI;
        }
        if (cursors.D && cursors.D.isDown) {
            this.sprite.setVelocityX(this.speed);
            this.sprite.setFlipX(false);
            this.isMoving = true;
            moveX = 1;
            this.lastFacingAngle = 0;
        }
        if (cursors.W && cursors.W.isDown) {
            this.sprite.setVelocityY(-this.speed);
            this.isMoving = true;
            moveY = -1;
            this.lastFacingAngle = -Math.PI/2;
        }
        if (cursors.S && cursors.S.isDown) {
            this.sprite.setVelocityY(this.speed);
            this.isMoving = true;
            moveY = 1;
            this.lastFacingAngle = Math.PI/2;
        }
        if (moveX !== 0 && moveY !== 0) {
            this.lastFacingAngle = Math.atan2(moveY, moveX);
            // Normalize diagonal speed so total magnitude remains consistent
            const vx = this.sprite.body?.velocity?.x || 0;
            const vy = this.sprite.body?.velocity?.y || 0;
            this.sprite.setVelocity(vx / Math.SQRT2, vy / Math.SQRT2);
        }
        if (this.isMoving) {
            if (this.sprite.anims.currentAnim?.key !== 'run') {
                this.sprite.play('run');
            }
        } else {
            if (this.sprite.anims.currentAnim?.key !== 'idle') {
                this.sprite.play('idle');
            }
        }
        this._wasMoving = this.isMoving;
    }
}

let player;
let cursors;
let camera;
let tilemap;
let tileLayers = {};
let tilesets = {};
let enemies = [];
let zones = [];
let currentDifficulty = 1;
let globalEnemySpeedBonus = 0;
let projectiles = [];
let maxEnemies = 10;
let currentEnemyCount = 0;
// background music
let bgmMusic = null;
// wave progression
let currentWave = 1;
let waveMultiplier = 1; // 2^(currentWave-1)
window.waveMultiplier = waveMultiplier;
let waveStartAtMs = Date.now();
const CHUNK_SIZE = 32;
const TILE_SIZE = 48;
const RENDER_DISTANCE = 2;
let lastChunkX = null;
let lastChunkY = null;
let loadedChunks = new Map();

// load game assets
function preload() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const loadingBg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000);
    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading Colosseum Fighters...', {
        fontSize: '24px',
        fill: '#ffffff',
        fontFamily: '"Pickyside", monospace'
    });
    loadingText.setOrigin(0.5);
    const loadingBarBg = this.add.rectangle(width / 2, height / 2, 400, 20, 0x333333);
    const loadingBar = this.add.rectangle(width / 2 - 200, height / 2, 0, 20, 0x00ff00);
    loadingBar.setOrigin(0, 0.5);
    const progressText = this.add.text(width / 2, height / 2 + 40, '0%', {
        fontSize: '18px',
        fill: '#ffffff',
        fontFamily: '"Pickyside", monospace'
    });
    progressText.setOrigin(0.5);
    this.load.on('progress', (value) => {
        loadingBar.width = 400 * value;
        progressText.setText(Math.round(value * 100) + '%');
    });
    this.load.on('complete', () => {
        loadingBg.destroy();
        loadingText.destroy();
        loadingBarBg.destroy();
        loadingBar.destroy();
        progressText.destroy();
    });
    this.load.image('grass', '/assets/background/bgtile.png');
    // Audio assets
    this.load.audio('sfx_gameover', '/assets/soundEffects/gameOver.mp3');
    this.load.audio('bgm_game', '/assets/music/retro-gaming-271301.mp3');
    for (let i = 0; i < 8; i++) {
        this.load.image(`idle_${i}`, `/assets/player/Idle/HeroKnight_Idle_${i}.png`);
    }
    for (let i = 0; i < 10; i++) {
        this.load.image(`run_${i}`, `/assets/player/Run/HeroKnight_Run_${i}.png`);
    }
    for (let i = 0; i < 10; i++) {
        this.load.image(`death_${i}`, `/assets/player/Death/HeroKnight_Death_${i}.png`);
    }
    this.load.image('lereon_knight', '/assets/enemies/lereon knight.png');
    this.load.image('baby_dragon', '/assets/enemies/baby dragon.png');
    this.load.image('bat', '/assets/enemies/bat.png');
    this.load.image('big_skeleton', '/assets/enemies/big skeleton.png');
    this.load.image('burning_demon_imp', '/assets/enemies/burning demon imp.png');
    this.load.image('burning_demon', '/assets/enemies/burning demon.png');
    this.load.image('death_angel', '/assets/enemies/death angel.png');
    this.load.image('legendary_dragon', '/assets/enemies/legendary dragon.png');
    this.load.image('orc', '/assets/enemies/orc.png');
    this.load.image('skeleton_king', '/assets/enemies/skeleton king.png');
    this.load.image('skeleton_sword', '/assets/enemies/skeleton sword.png');
    this.load.image('slime', '/assets/enemies/slime.png');
    this.load.image('snake', '/assets/enemies/snake.png');
    this.load.image('spider', '/assets/enemies/spider.png');
    this.load.image('viking_warrior', '/assets/enemies/viking warrior.png');
    this.load.image('werewolf', '/assets/enemies/werewolf.png');
    this.load.image('wolf', '/assets/enemies/wolf.png');
    this.load.image('worm', '/assets/enemies/worm.png');
    this.load.image('berry01blue', '/assets/items/berry01blue.gif');
    this.load.image('berry02yellow', '/assets/items/berry02yellow.gif');
    this.load.image('berry03purple', '/assets/items/berry03purple.gif');
    this.load.image('berry04red', '/assets/items/berry04red.gif');
    this.load.image('gem01orange', '/assets/items/gem01orange.gif');
    this.load.image('gem02blue', '/assets/items/gem02blue.gif');
    this.load.image('gem03yellow', '/assets/items/gem03yellow.gif');
    this.load.image('gem04purple', '/assets/items/gem04purple.gif');
    this.load.image('gem05red', '/assets/items/gem05red.gif');
    this.load.image('gem06green', '/assets/items/gem06green.gif');
    this.load.image('glass01orange', '/assets/items/glass01orange.gif');
    this.load.image('glass02blue', '/assets/items/glass02blue.gif');
    this.load.image('glass03yellow', '/assets/items/glass03yellow.gif');
    this.load.image('glass04purple', '/assets/items/glass04purple.gif');
    this.load.image('glass05red', '/assets/items/glass05red.gif');
    this.load.image('glass06green', '/assets/items/glass06green.gif');
    this.load.image('blueshroom', '/assets/items/BlueShroom.png');
    this.load.image('bongo', '/assets/items/Bongo.png');
    this.load.image('bottle', '/assets/items/Bottle.png');
    this.load.image('clock', '/assets/items/Clock.png');
    this.load.image('crown', '/assets/items/Crown.png');
    this.load.image('diamond', '/assets/items/Diamond.png');
    this.load.image('goldencup', '/assets/items/GoldenCup.png');
    this.load.image('lantern', '/assets/items/Lantern.png');
    // Additional item-based icons used as weapon sprites
    this.load.image('weapon_shield_icon', '/assets/items/MetalShield.png');
    this.load.image('weapon_torch_icon', '/assets/items/Flashlight.png');
    this.load.image('weapon_stone_icon', '/assets/items/SnowBall.png');
    this.load.image('weapon_crystalsword', '/assets/weapons/weapon01crystalsword.gif');
    this.load.image('weapon_dagger', '/assets/weapons/weapon02dagger.gif');
    this.load.image('weapon_longsword', '/assets/weapons/weapon03longsword.gif');
    this.load.image('weapon_flail', '/assets/weapons/weapon04rustyflail.gif');
    this.load.image('weapon_doubleaxe', '/assets/weapons/weapon05doubleaxe.gif');
    this.load.image('weapon_bow', '/assets/weapons/weapon06bow.gif');
    this.load.image('weapon_spear', '/assets/weapons/weapon07spear.gif');
    this.load.image('magic_crystalwand', '/assets/weapons/magic01crystalwand.gif');
    this.load.image('magic_spellbook', '/assets/weapons/magic02spellbook.gif');
    this.load.image('magic_orb', '/assets/weapons/magic03orb.gif');
    this.load.image('magic_ring', '/assets/weapons/magic04ring.gif');
    this.load.image('magic_wand', '/assets/weapons/magic05wand.gif');
    this.load.spritesheet('weaponhit_effect', '/assets/effects/10_weaponhit_spritesheet.png', {
        frameWidth: 64,
        frameHeight: 64
    });
    this.load.spritesheet('fire_effect', '/assets/effects/11_fire_spritesheet.png', {
        frameWidth: 64,
        frameHeight: 64
    });
    this.load.spritesheet('magic_effect', '/assets/effects/1_magicspell_spritesheet.png', {
        frameWidth: 64,
        frameHeight: 64
    });
    this.load.spritesheet('bluefire_effect', '/assets/effects/3_bluefire_spritesheet.png', {
        frameWidth: 64,
        frameHeight: 64
    });
}

// setup game world
function create() {
    createProceduralTextures.call(this);
    tilemap = this.make.tilemap({
        tileWidth: TILE_SIZE,
        tileHeight: TILE_SIZE,
        width: 2000,
        height: 2000
    });
    tilesets.grass = tilemap.addTilesetImage('grass', 'grass', TILE_SIZE, TILE_SIZE);
    tileLayers.background = tilemap.createBlankLayer('background', [tilesets.grass]);
    tileLayers.background.setDepth(-1);
    player = new Player(this, 1000 * TILE_SIZE, 1000 * TILE_SIZE);
    // Make player reference accessible for systems that need a fallback
    this.playerRef = player;
    cursors = this.input.keyboard.addKeys({
        W: Phaser.Input.Keyboard.KeyCodes.W,
        A: Phaser.Input.Keyboard.KeyCodes.A,
        S: Phaser.Input.Keyboard.KeyCodes.S,
        D: Phaser.Input.Keyboard.KeyCodes.D
    });

    // Removed manual weapon selection by hotkeys to simplify inventory UI usage
    
    camera = this.cameras.main;
    camera.startFollow(player.sprite);
    camera.setLerp(0.05, 0.05);
    createEffectAnimations.call(this);
    // Intro/Choice gating
    GAME_STATE = 'intro';
    startIntroSequence.call(this);

    this.input.on('pointerdown', function(pointer) {
        if (!player || !player.isAlive || !player.currentWeapon) return;
        
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        
    const attackRange = player.currentWeapon && player.currentWeapon.attackRange ? player.currentWeapon.attackRange : 150;
        const distance = Phaser.Math.Distance.Between(player.sprite.x, player.sprite.y, worldX, worldY);
        
        if (distance <= attackRange) {
            const angle = Phaser.Math.Angle.Between(player.sprite.x, player.sprite.y, worldX, worldY);
            let hitSomething = false;
            
            enemies.forEach(enemy => {
                const enemyDistance = Phaser.Math.Distance.Between(player.sprite.x, player.sprite.y, enemy.sprite.x, enemy.sprite.y);
                const enemyAngle = Phaser.Math.Angle.Between(player.sprite.x, player.sprite.y, enemy.sprite.x, enemy.sprite.y);
                const angleDiff = Math.abs(Phaser.Math.Angle.ShortestBetween(angle, enemyAngle));
                
                if (enemyDistance <= attackRange && angleDiff <= Math.PI / 4) {
                    let damage = player.currentWeapon.instanceDamage || 
                                (typeof player.currentWeapon.damage === 'function' ? player.currentWeapon.damage() : player.currentWeapon.damage);
                    damage += player.baseDamage;
                    
                    const critRoll = Math.random() * 100;
                    if (critRoll < player.critChance) {
                        damage = Math.floor(damage * (player.critDamage / 100));
                    }
                    
                    
                    enemy.takeDamage(damage, player.currentWeapon?.damageType);
                    player.showFloatingDamage(enemy, damage);
                    player.showAttackEffect(enemy);
                    hitSomething = true;
                }
            });
            
            if (hitSomething && player.currentWeapon) {
                player.createWeaponAttack(angle);
            }
        }
    });
    
    
    
    generateInitialChunks.call(this);
}

// game loop
function update() {
    if (player && player.isAlive) {
        player.handleInput(cursors);
        player.update();
        player.updateHPBar();
        checkEntityCollisions.call(this);
    }
    if (GAME_STATE === 'playing') {
        enemies.forEach(enemy => {
            if (enemy.isAlive) {
                enemy.update(player, enemies);
            }
        });
        enemies = enemies.filter(enemy => enemy.isAlive);
        // Keep count in sync with actual list length to avoid reliance on window globals
        currentEnemyCount = enemies.length;
        projectiles.forEach(projectile => {
            if (projectile.isAlive) {
                projectile.update();
            }
        });
        projectiles = projectiles.filter(projectile => projectile.isAlive);
        // Update zones (burn, lightning, lantern)
        const dt = this.game.loop.delta; // ms
        zones.forEach(z => { if (z.isAlive && z.update) z.update(dt, enemies); });
        zones = zones.filter(z => z.isAlive);
        maintainEnemyLimit.call(this);
    }
    updateChunks.call(this);
}
// Create simple procedural textures for projectiles that have no image asset
function createProceduralTextures() {
    // fireball1–5: orange/red fireballs with slight colour variation
    const fireColors = [0xff6600, 0xff4400, 0xff8822, 0xffaa00, 0xff3300];
    for (let i = 1; i <= 5; i++) {
        if (this.textures.exists(`fireball${i}`)) continue;
        const g = this.add.graphics();
        g.fillStyle(fireColors[i - 1], 1);
        g.fillCircle(12, 12, 12);
        g.fillStyle(0xffee44, 0.75);
        g.fillCircle(9, 9, 6);
        g.generateTexture(`fireball${i}`, 24, 24);
        g.destroy();
    }
    // arrow_move: a simple pointed arrow shape
    if (!this.textures.exists('arrow_move')) {
        const g = this.add.graphics();
        g.fillStyle(0xddddaa, 1);
        g.fillRect(0, 3, 18, 2);      // shaft
        g.fillTriangle(14, 0, 24, 4, 14, 8); // head
        g.generateTexture('arrow_move', 24, 8);
        g.destroy();
    }
}

function createEffectAnimations() {
    this.anims.create({
        key: 'weaponhit_effect_anim',
        frames: this.anims.generateFrameNumbers('weaponhit_effect', { start: 0, end: 7 }),
        frameRate: 12,
        repeat: 0
    });
    this.anims.create({
        key: 'fire_effect_anim',
        frames: this.anims.generateFrameNumbers('fire_effect', { start: 0, end: 15 }),
        frameRate: 15,
        repeat: 0
    });
    this.anims.create({
        key: 'magic_effect_anim',
        frames: this.anims.generateFrameNumbers('magic_effect', { start: 0, end: 7 }),
        frameRate: 10,
        repeat: 0
    });
    this.anims.create({
        key: 'bluefire_effect_anim',
        frames: this.anims.generateFrameNumbers('bluefire_effect', { start: 0, end: 11 }),
        frameRate: 12,
        repeat: 0
    });
}
function startIntroSequence() {
    // Skip story banner; show only the weapon choice immediately with a subtle overlay
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const overlay = this.add.rectangle(this.cameras.main.centerX, this.cameras.main.centerY, width, height, 0x000000, 0.6);
    overlay.setScrollFactor(0);
    overlay.setDepth(1800);
    // Open weapon choice immediately
    player.showInitialWeaponChoice(() => {
        // On selection complete
        if (overlay && overlay.destroy) overlay.destroy();
        GAME_STATE = 'playing';
        // Start background music at ~-30dB + 10% (volume ~0.035) with a short fade-in
        if (!bgmMusic) {
            bgmMusic = this.sound.add('bgm_game', { volume: 0, loop: true });
            bgmMusic.play();
            this.tweens.add({ targets: bgmMusic, volume: 0.035, duration: 1200, ease: 'Sine.easeInOut' });
        }
        // Mark the start of the wave for duration gating
        waveStartAtMs = Date.now();
        spawnEnemies.call(this);
        startDifficultyProgression.call(this);
    });
}
function getDifficultyLevel() {
    if (!player || !player.scene) {
        return 1;
    }
    const levelFactor = Math.floor(player.level / 5);
    const killFactor = Math.floor(player.killCount / 50);
    const timeFactor = Math.floor(player.scene.gameTimer / 300);
    return Math.max(1, levelFactor + killFactor + timeFactor + 1);
}
function updateDifficulty() {
    const newDifficulty = getDifficultyLevel();
    if (newDifficulty > currentDifficulty) {
        currentDifficulty = newDifficulty;
        // Scale enemy cap up but clamp to 40
        maxEnemies = Math.min(10 + (currentDifficulty * 3), 40);
    }
    // Progress wave when player difficulty "strength" exceeds current wave strength
    const diffStrength = Math.pow(2, Math.max(0, currentDifficulty - 1));
    const waveStrength = waveMultiplier; // 1, 2, 4, 8, ...
    const nowMs = (player?.scene?.time?.now) || Date.now();
    const elapsedSinceWaveStart = nowMs - (waveStartAtMs || nowMs);
    if (diffStrength > waveStrength && elapsedSinceWaveStart >= MIN_WAVE_DURATION_MS) {
        // Advance to next wave
        const previousWave = currentWave;
        currentWave += 1;
        waveMultiplier = Math.pow(2, currentWave - 1);
        window.waveMultiplier = waveMultiplier;
        waveStartAtMs = nowMs;
        // Optional: brief wave banner (disabled by SHOW_WAVE_BANNER)
        if (SHOW_WAVE_BANNER) {
            const scene = player?.scene;
            if (scene && scene.add && scene.cameras && scene.time) {
                const banner = scene.add.text(scene.cameras.main.centerX, scene.cameras.main.centerY - 140, `Wave ${currentWave}`, {
                    fontSize: '28px', fill: '#ffd700', stroke: '#000', strokeThickness: 4
                });
                banner.setOrigin(0.5); banner.setDepth(2000); banner.setScrollFactor(0);
                scene.time.delayedCall(1200, () => banner.destroy());
            }
        }
        // Nudge cap on wave jumps
        maxEnemies = Math.min(maxEnemies + 4, 40);
    }
}
function checkEntityCollisions() {
    if (!player || !player.isAlive || !enemies || enemies.length === 0) return;
    enemies.forEach(enemy => {
        if (!enemy || !enemy.isAlive || !enemy.sprite) return;
        const distance = Phaser.Math.Distance.Between(
            player.sprite.x, player.sprite.y,
            enemy.sprite.x, enemy.sprite.y
        );
        const hurtboxDistance = enemy.hurtboxRadius || 40;
        if (distance < hurtboxDistance) {
            const enemyId = enemy.id || `enemy_${enemy.sprite.x}_${enemy.sprite.y}`;
            const currentTime = Date.now();
            if (!player.collisionCooldowns.has(enemyId) ||
                currentTime - player.collisionCooldowns.get(enemyId) > 1000) {
                const damage = (enemy.damage || 15) + (currentDifficulty * 2);
                player.takeDamage(damage);
                player.collisionCooldowns.set(enemyId, currentTime);
                player.sprite.setTint(0xff0000);
                enemy.sprite.setTintFill(0xffffff);
                this.time.delayedCall(200, () => {
                    if (enemy && enemy.isAlive && enemy.sprite) {
                        enemy.sprite.clearTint();
                    }
                });
            }
        }
    });
    // Throttle heavy O(n^2) separation checks to reduce frame drops
    checkEntityCollisions._sepTick = (checkEntityCollisions._sepTick || 0) + 1;
    if ((checkEntityCollisions._sepTick % 6) === 0) {
        for (let i = 0; i < enemies.length; i++) {
            for (let j = i + 1; j < enemies.length; j++) {
            const enemy1 = enemies[i];
            const enemy2 = enemies[j];
            if (!enemy1.isAlive || !enemy2.isAlive) continue;
            const distance = Phaser.Math.Distance.Between(
                enemy1.sprite.x, enemy1.sprite.y,
                enemy2.sprite.x, enemy2.sprite.y
            );
            if (distance < 50) {
                const pushForce = 20;
                const angle = Phaser.Math.Angle.Between(
                    enemy1.sprite.x, enemy1.sprite.y,
                    enemy2.sprite.x, enemy2.sprite.y
                );
                const pushX1 = Math.cos(angle + Math.PI) * pushForce;
                const pushY1 = Math.sin(angle + Math.PI) * pushForce;
                const pushX2 = Math.cos(angle) * pushForce;
                const pushY2 = Math.sin(angle) * pushForce;
                enemy1.sprite.body.velocity.x += pushX1;
                enemy1.sprite.body.velocity.y += pushY1;
                enemy2.sprite.body.velocity.x += pushX2;
                enemy2.sprite.body.velocity.y += pushY2;
            }
        }
        }
    }
}
function createHPBar(entity, width = 50, height = 6, color = 0xff0000) {
    entity.hpBarBg = entity.scene.add.rectangle(0, -40, width, height, 0x000000);
    entity.hpBarBg.setDepth(999);
    entity.hpBarFill = entity.scene.add.rectangle(0, -40, width, height, color);
    entity.hpBarFill.setDepth(1000);
    return {
        background: entity.hpBarBg,
        fill: entity.hpBarFill
    };
}
function maintainEnemyLimit() {
    if (GAME_STATE !== 'playing') return;
    updateDifficulty();
    const spawned = wavesMaintainEnemyLimit(this, player, enemies, Enemy, currentEnemyCount, maxEnemies, currentDifficulty);
    if (spawned > 0) currentEnemyCount += spawned;
}
function spawnEnemies() {
    if (GAME_STATE !== 'playing') return;
    const initialSpawn = Math.min(maxEnemies, 3);
    const spawned = wavesSpawnEnemies(this, player, enemies, Enemy, initialSpawn, currentDifficulty);
    currentEnemyCount += spawned;
}
function getRandomEnemyType() {
    return wavesGetRandomEnemyType(currentDifficulty);
}
function spawnSingleEnemy() {
    const enemy = wavesSpawnSingleEnemy(this, player, enemies, Enemy, currentDifficulty);
    if (enemy) currentEnemyCount++;
}
function startDifficultyProgression() {
    wavesStartDifficulty(this, () => updateDifficulty());
}
function generateInitialChunks() {
    const playerChunkX = Math.floor(player.sprite.x / (CHUNK_SIZE * TILE_SIZE));
    const playerChunkY = Math.floor(player.sprite.y / (CHUNK_SIZE * TILE_SIZE));
    for (let x = playerChunkX - RENDER_DISTANCE; x <= playerChunkX + RENDER_DISTANCE; x++) {
        for (let y = playerChunkY - RENDER_DISTANCE; y <= playerChunkY + RENDER_DISTANCE; y++) {
            generateChunk.call(this, x, y);
        }
    }
    lastChunkX = playerChunkX;
    lastChunkY = playerChunkY;
}
function updateChunks() {
    const playerChunkX = Math.floor(player.sprite.x / (CHUNK_SIZE * TILE_SIZE));
    const playerChunkY = Math.floor(player.sprite.y / (CHUNK_SIZE * TILE_SIZE));
    if (playerChunkX !== lastChunkX || playerChunkY !== lastChunkY) {
        for (let x = playerChunkX - RENDER_DISTANCE; x <= playerChunkX + RENDER_DISTANCE; x++) {
            for (let y = playerChunkY - RENDER_DISTANCE; y <= playerChunkY + RENDER_DISTANCE; y++) {
                const chunkKey = `${x},${y}`;
                if (!loadedChunks.has(chunkKey)) {
                    generateChunk.call(this, x, y);
                }
            }
        }
        const chunksToRemove = [];
        loadedChunks.forEach((chunk, key) => {
            const [chunkX, chunkY] = key.split(',').map(Number);
            const distance = Math.max(
                Math.abs(chunkX - playerChunkX),
                Math.abs(chunkY - playerChunkY)
            );
            if (distance > RENDER_DISTANCE + 1) {
                chunksToRemove.push(key);
            }
        });
        chunksToRemove.forEach(key => {
            loadedChunks.delete(key);
        });
        lastChunkX = playerChunkX;
        lastChunkY = playerChunkY;
    }
}
function generateChunk(chunkX, chunkY) {
    const chunkKey = `${chunkX},${chunkY}`;
    const startX = chunkX * CHUNK_SIZE;
    const startY = chunkY * CHUNK_SIZE;
    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let y = 0; y < CHUNK_SIZE; y++) {
            const tileX = startX + x;
            const tileY = startY + y;
            const grassVariant = generateGrassVariant(tileX * TILE_SIZE, tileY * TILE_SIZE);
            const tile = tileLayers.background.putTileAt(tilesets.grass.firstgid, tileX, tileY);
            if (tile) {
                switch (grassVariant) {
                    case 1:
                        tile.tint = 0x90EE90;
                        break;
                    case 2:
                        tile.tint = 0x228B22;
                        break;
                    case 3:
                        tile.tint = 0x32CD32;
                        break;
                    case 4:
                        tile.tint = 0x9ACD32;
                        break;
                    case 5:
                        tile.tint = 0x6B8E23;
                        break;
                    case 6:
                        tile.tint = 0x7CFC00;
                        break;
                }
            }
        }
    }
    loadedChunks.set(chunkKey, true);
}
function generateGrassVariant(x, y) {
    const noise1 = Math.sin(x * 0.005) * Math.cos(y * 0.005);
    const noise2 = Math.sin(x * 0.002 + 1000) * Math.cos(y * 0.002 + 1000);
    const combinedNoise = (noise1 + noise2) / 2;
    if (combinedNoise > 0.6) {
        return 1;
    } else if (combinedNoise > 0.2) {
        return 2;
    } else if (combinedNoise > -0.1) {
        return 3;
    } else if (combinedNoise > -0.4) {
        return 4;
    } else if (combinedNoise > -0.7) {
        return 5;
    } else {
        return 6;
    }
}


const game = new Phaser.Game(config);
window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight - 50);
});


