import { Player } from '../entities/Player.js';
import { Enemy }  from '../entities/Enemy.js';
import {
    getRandomEnemyType as wavesGetRandomEnemyType,
    spawnSingleEnemy   as wavesSpawnSingleEnemy,
    spawnEnemies       as wavesSpawnEnemies,
    maintainEnemyLimit as wavesMaintainEnemyLimit,
    startDifficultyProgression as wavesStartDifficulty
} from '../systems/waves.js';

const DEBUG                = false;
const SHOW_WAVE_BANNER     = false;
const MIN_WAVE_DURATION_MS = 60000;
const CHUNK_SIZE           = 32;
const TILE_SIZE            = 48;
const RENDER_DISTANCE      = 2;

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    // ─── Phaser lifecycle ──────────────────────────────────────────────────────

    create() {
        // Shared game state — accessed by entity classes via this.scene.*
        this.enemies            = [];
        this.projectiles        = [];
        this.zones              = [];
        this.player             = null;
        this.bgmMusic           = null;
        this.currentWave        = 1;
        this.waveMultiplier     = 1;
        this.waveStartAtMs      = Date.now();
        this.currentDifficulty  = 1;
        this.globalEnemySpeedBonus = 0;
        this.maxEnemies         = 10;
        this.currentEnemyCount  = 0;
        this.GAME_STATE         = 'intro';
        this.gameTimer          = 0;

        // Sync waveMultiplier to window so Enemy.js can read it
        window.waveMultiplier = this.waveMultiplier;
        window.globalEnemySpeedBonus = 0;

        // Chunk state
        this.tilemap     = null;
        this.tileLayers  = {};
        this.tilesets    = {};
        this.loadedChunks = new Map();
        this.lastChunkX  = null;
        this.lastChunkY  = null;

        this.createProceduralTextures();

        this.tilemap = this.make.tilemap({ tileWidth: TILE_SIZE, tileHeight: TILE_SIZE, width: 2000, height: 2000 });
        this.tilesets.grass   = this.tilemap.addTilesetImage('grass', 'grass', TILE_SIZE, TILE_SIZE);
        this.tileLayers.background = this.tilemap.createBlankLayer('background', [this.tilesets.grass]);
        this.tileLayers.background.setDepth(-1);

        this.player = new Player(this, 1000 * TILE_SIZE, 1000 * TILE_SIZE);

        this.cursors = this.input.keyboard.addKeys({
            W: Phaser.Input.Keyboard.KeyCodes.W,
            A: Phaser.Input.Keyboard.KeyCodes.A,
            S: Phaser.Input.Keyboard.KeyCodes.S,
            D: Phaser.Input.Keyboard.KeyCodes.D
        });

        const camera = this.cameras.main;
        camera.startFollow(this.player.sprite);
        camera.setLerp(0.05, 0.05);

        this.createEffectAnimations();

        this.GAME_STATE = 'intro';
        this.startIntroSequence();

        this.input.on('pointerdown', (pointer) => {
            if (!this.player || !this.player.isAlive || !this.player.currentWeapon) return;
            const worldX = pointer.worldX;
            const worldY = pointer.worldY;
            const attackRange = this.player.currentWeapon.attackRange || 150;
            if (Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, worldX, worldY) > attackRange) return;
            const angle = Phaser.Math.Angle.Between(this.player.sprite.x, this.player.sprite.y, worldX, worldY);
            let hitSomething = false;
            this.enemies.forEach(enemy => {
                const enemyDist  = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, enemy.sprite.x, enemy.sprite.y);
                const enemyAngle = Phaser.Math.Angle.Between(this.player.sprite.x, this.player.sprite.y, enemy.sprite.x, enemy.sprite.y);
                if (enemyDist <= attackRange && Math.abs(Phaser.Math.Angle.ShortestBetween(angle, enemyAngle)) <= Math.PI / 4) {
                    let damage = this.player.currentWeapon.instanceDamage ||
                                 (typeof this.player.currentWeapon.damage === 'function' ? this.player.currentWeapon.damage() : this.player.currentWeapon.damage);
                    damage += this.player.baseDamage;
                    if (Math.random() * 100 < this.player.critChance) damage = Math.floor(damage * (this.player.critDamage / 100));
                    enemy.takeDamage(damage, this.player.currentWeapon?.damageType);
                    this.player.showFloatingDamage(enemy, damage);
                    this.player.showAttackEffect(enemy);
                    hitSomething = true;
                }
            });
            if (hitSomething) this.player.createWeaponAttack(angle);
        });

        this.generateInitialChunks();
    }

    update() {
        if (this.player && this.player.isAlive) {
            this.player.handleInput(this.cursors);
            this.player.update();
            this.player.updateHPBar();
            this.checkEntityCollisions();
        }
        if (this.GAME_STATE === 'playing') {
            this.enemies.forEach(enemy => { if (enemy.isAlive) enemy.update(this.player, this.enemies); });
            this.enemies = this.enemies.filter(e => e.isAlive);
            this.currentEnemyCount = this.enemies.length;

            this.projectiles.forEach(p => { if (p.isAlive) p.update(); });
            this.projectiles = this.projectiles.filter(p => p.isAlive);

            const dt = this.game.loop.delta;
            this.zones.forEach(z => { if (z.isAlive && z.update) z.update(dt, this.enemies); });
            this.zones = this.zones.filter(z => z.isAlive);

            this.maintainEnemyLimit();
        }
        this.updateChunks();
    }

    // ─── Intro / game flow ─────────────────────────────────────────────────────

    startIntroSequence() {
        const { width, height } = this.cameras.main;
        const overlay = this.add.rectangle(this.cameras.main.centerX, this.cameras.main.centerY, width, height, 0x000000, 0.6);
        overlay.setScrollFactor(0).setDepth(1800);
        this.player.showInitialWeaponChoice(() => {
            if (overlay && overlay.destroy) overlay.destroy();
            this.GAME_STATE = 'playing';
            if (!this.bgmMusic) {
                this.bgmMusic = this.sound.add('bgm_game', { volume: 0, loop: true });
                this.bgmMusic.play();
                this.tweens.add({ targets: this.bgmMusic, volume: 0.035, duration: 1200, ease: 'Sine.easeInOut' });
            }
            this.waveStartAtMs = Date.now();
            this.spawnEnemies();
            this.startDifficultyProgression();
        });
    }

    // ─── Difficulty / waves ────────────────────────────────────────────────────

    getDifficultyLevel() {
        if (!this.player || !this.player.scene) return 1;
        return Math.max(1,
            Math.floor(this.player.level / 5) +
            Math.floor(this.player.killCount / 50) +
            Math.floor(this.gameTimer / 300) + 1
        );
    }

    updateDifficulty() {
        const newDiff = this.getDifficultyLevel();
        if (newDiff > this.currentDifficulty) {
            this.currentDifficulty = newDiff;
            this.maxEnemies = Math.min(10 + (this.currentDifficulty * 3), 40);
        }
        const diffStrength = Math.pow(2, Math.max(0, this.currentDifficulty - 1));
        const nowMs = this.time?.now || Date.now();
        const elapsed = nowMs - (this.waveStartAtMs || nowMs);
        if (diffStrength > this.waveMultiplier && elapsed >= MIN_WAVE_DURATION_MS) {
            this.currentWave++;
            this.waveMultiplier = Math.pow(2, this.currentWave - 1);
            window.waveMultiplier = this.waveMultiplier;
            this.waveStartAtMs = nowMs;
            this.maxEnemies = Math.min(this.maxEnemies + 4, 40);
            if (SHOW_WAVE_BANNER) {
                const banner = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY - 140, `Wave ${this.currentWave}`, {
                    fontSize: '28px', fill: '#ffd700', stroke: '#000', strokeThickness: 4
                });
                banner.setOrigin(0.5).setDepth(2000).setScrollFactor(0);
                this.time.delayedCall(1200, () => banner.destroy());
            }
        }
    }

    maintainEnemyLimit() {
        if (this.GAME_STATE !== 'playing') return;
        this.updateDifficulty();
        const spawned = wavesMaintainEnemyLimit(this, this.player, this.enemies, Enemy, this.currentEnemyCount, this.maxEnemies, this.currentDifficulty);
        if (spawned > 0) this.currentEnemyCount += spawned;
    }

    spawnEnemies() {
        if (this.GAME_STATE !== 'playing') return;
        const spawned = wavesSpawnEnemies(this, this.player, this.enemies, Enemy, Math.min(this.maxEnemies, 3), this.currentDifficulty);
        this.currentEnemyCount += spawned;
    }

    startDifficultyProgression() {
        wavesStartDifficulty(this, () => this.updateDifficulty());
    }

    // ─── Collision ─────────────────────────────────────────────────────────────

    checkEntityCollisions() {
        if (!this.player || !this.player.isAlive || !this.enemies.length) return;
        this.enemies.forEach(enemy => {
            if (!enemy || !enemy.isAlive || !enemy.sprite) return;
            const dist = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, enemy.sprite.x, enemy.sprite.y);
            if (dist < (enemy.hurtboxRadius || 40)) {
                const eid  = enemy.id || `enemy_${enemy.sprite.x}_${enemy.sprite.y}`;
                const now  = Date.now();
                if (!this.player.collisionCooldowns.has(eid) || now - this.player.collisionCooldowns.get(eid) > 1000) {
                    this.player.takeDamage((enemy.damage || 15) + (this.currentDifficulty * 2));
                    this.player.collisionCooldowns.set(eid, now);
                    this.player.sprite.setTint(0xff0000);
                    enemy.sprite.setTintFill(0xffffff);
                    this.time.delayedCall(200, () => { if (enemy && enemy.isAlive && enemy.sprite) enemy.sprite.clearTint(); });
                }
            }
        });
        // Enemy-enemy separation (throttled — every 6 frames)
        this._sepTick = (this._sepTick || 0) + 1;
        if ((this._sepTick % 6) === 0) {
            for (let i = 0; i < this.enemies.length; i++) {
                for (let j = i + 1; j < this.enemies.length; j++) {
                    const e1 = this.enemies[i], e2 = this.enemies[j];
                    if (!e1.isAlive || !e2.isAlive) continue;
                    const d = Phaser.Math.Distance.Between(e1.sprite.x, e1.sprite.y, e2.sprite.x, e2.sprite.y);
                    if (d < 50) {
                        const a = Phaser.Math.Angle.Between(e1.sprite.x, e1.sprite.y, e2.sprite.x, e2.sprite.y);
                        const f = 20;
                        e1.sprite.body.velocity.x += Math.cos(a + Math.PI) * f;
                        e1.sprite.body.velocity.y += Math.sin(a + Math.PI) * f;
                        e2.sprite.body.velocity.x += Math.cos(a) * f;
                        e2.sprite.body.velocity.y += Math.sin(a) * f;
                    }
                }
            }
        }
    }

    // ─── Procedural textures & animations ─────────────────────────────────────

    createProceduralTextures() {
        const fireColors = [0xff6600, 0xff4400, 0xff8822, 0xffaa00, 0xff3300];
        for (let i = 1; i <= 5; i++) {
            if (this.textures.exists(`fireball${i}`)) continue;
            const g = this.add.graphics();
            g.fillStyle(fireColors[i - 1], 1).fillCircle(12, 12, 12);
            g.fillStyle(0xffee44, 0.75).fillCircle(9, 9, 6);
            g.generateTexture(`fireball${i}`, 24, 24);
            g.destroy();
        }
        if (!this.textures.exists('arrow_move')) {
            const g = this.add.graphics();
            g.fillStyle(0xddddaa, 1).fillRect(0, 3, 18, 2).fillTriangle(14, 0, 24, 4, 14, 8);
            g.generateTexture('arrow_move', 24, 8);
            g.destroy();
        }
    }

    createEffectAnimations() {
        const defs = [
            { key: 'weaponhit_effect_anim', tex: 'weaponhit_effect', end: 7,  fps: 12 },
            { key: 'fire_effect_anim',      tex: 'fire_effect',      end: 15, fps: 15 },
            { key: 'magic_effect_anim',     tex: 'magic_effect',     end: 7,  fps: 10 },
            { key: 'bluefire_effect_anim',  tex: 'bluefire_effect',  end: 11, fps: 12 }
        ];
        defs.forEach(({ key, tex, end, fps }) => {
            this.anims.create({
                key,
                frames: this.anims.generateFrameNumbers(tex, { start: 0, end }),
                frameRate: fps,
                repeat: 0
            });
        });
    }

    // ─── Chunk system ──────────────────────────────────────────────────────────

    generateInitialChunks() {
        const px = Math.floor(this.player.sprite.x / (CHUNK_SIZE * TILE_SIZE));
        const py = Math.floor(this.player.sprite.y / (CHUNK_SIZE * TILE_SIZE));
        for (let x = px - RENDER_DISTANCE; x <= px + RENDER_DISTANCE; x++) {
            for (let y = py - RENDER_DISTANCE; y <= py + RENDER_DISTANCE; y++) {
                this.generateChunk(x, y);
            }
        }
        this.lastChunkX = px;
        this.lastChunkY = py;
    }

    updateChunks() {
        const px = Math.floor(this.player.sprite.x / (CHUNK_SIZE * TILE_SIZE));
        const py = Math.floor(this.player.sprite.y / (CHUNK_SIZE * TILE_SIZE));
        if (px === this.lastChunkX && py === this.lastChunkY) return;
        for (let x = px - RENDER_DISTANCE; x <= px + RENDER_DISTANCE; x++) {
            for (let y = py - RENDER_DISTANCE; y <= py + RENDER_DISTANCE; y++) {
                const key = `${x},${y}`;
                if (!this.loadedChunks.has(key)) this.generateChunk(x, y);
            }
        }
        const toRemove = [];
        this.loadedChunks.forEach((_, key) => {
            const [cx, cy] = key.split(',').map(Number);
            if (Math.max(Math.abs(cx - px), Math.abs(cy - py)) > RENDER_DISTANCE + 1) toRemove.push(key);
        });
        toRemove.forEach(k => this.loadedChunks.delete(k));
        this.lastChunkX = px;
        this.lastChunkY = py;
    }

    generateChunk(chunkX, chunkY) {
        const startX = chunkX * CHUNK_SIZE;
        const startY = chunkY * CHUNK_SIZE;
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let y = 0; y < CHUNK_SIZE; y++) {
                const tx = startX + x, ty = startY + y;
                const tile = this.tileLayers.background.putTileAt(this.tilesets.grass.firstgid, tx, ty);
                if (tile) {
                    const variant = this.grassVariant(tx * TILE_SIZE, ty * TILE_SIZE);
                    const tints = [0x90EE90, 0x228B22, 0x32CD32, 0x9ACD32, 0x6B8E23, 0x7CFC00];
                    tile.tint = tints[variant - 1] || tints[0];
                }
            }
        }
        this.loadedChunks.set(`${chunkX},${chunkY}`, true);
    }

    grassVariant(x, y) {
        const n1 = Math.sin(x * 0.005) * Math.cos(y * 0.005);
        const n2 = Math.sin(x * 0.002 + 1000) * Math.cos(y * 0.002 + 1000);
        const v  = (n1 + n2) / 2;
        if (v > 0.6) return 1;
        if (v > 0.2) return 2;
        if (v > -0.1) return 3;
        if (v > -0.4) return 4;
        if (v > -0.7) return 5;
        return 6;
    }
}
