import { Entity } from './Entity.js';
import { WeaponEntity } from './WeaponEntity.js';
import { Projectile } from './Projectile.js';
import { DAMAGE_TYPES, WEAPON_TYPES } from '../data/weapons.js';
import { ITEM_TYPES, ENHANCED_ITEM_TYPES } from '../data/items.js';
import { executeWeaponAttack } from '../systems/behaviors.js';

export class Player extends Entity {
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
        this.weaponSizeScale = 1.0;
        this.debuffPower = 0;
        this.score = 0;
        this.inventory = [];
        this.maxInventorySize = 10;
        this.weapons = [];
        this.maxWeapons = 6;
        this.weaponLevels = {};
        this.maxWeaponLevel = 10;
        this.autoAttackEnabled = true;
        this.lastAttackTime = -5000;
        this.currentWeapon = null;
        this.attackTarget = null;
        this.lastFacingAngle = 0;
        this.weaponAttackState  = new Map();
        this.activeMeleeAttacks = new Map();
        this.lastTrailAt = new Map();
        this.isUpgradeOpen = false;
        this.collisionCooldowns = new Map();
        this.createAnimations();
        this.sprite.play('idle');
        this.createUI();
        this.scene.time.delayedCall(50, () => {
            if (this.levelText && this.killCountText) this.updateUI();
        });
    }

    // ─── UI ────────────────────────────────────────────────────────────────────

    createUI() {
        this.hpBarBg   = this.scene.add.rectangle(0, 0, 60, 8, 0x000000);
        this.hpBarFill = this.scene.add.rectangle(0, 0, 60, 8, 0x00ff00);
        this.hpBarBg.setDepth(999);
        this.hpBarFill.setDepth(1000);
        this.hpBarBg.setVisible(true);
        this.hpBarFill.setVisible(true);
        this.scene.time.delayedCall(50, () => { this.updateHPBar(); });

        const textStyle = (color) => ({
            fontSize: '16px', fill: color, stroke: '#000000', strokeThickness: 2,
            fontFamily: '"Inter", "Roboto", sans-serif'
        });
        this.levelText     = this.scene.add.text(16,  82, `Level: ${this.level}`,  textStyle('#ffffff'));
        this.killCountText = this.scene.add.text(16, 102, `Kills: ${this.killCount}`, textStyle('#00ff00'));
        this.waveText      = this.scene.add.text(16, 122, `Wave: 1`,               textStyle('#88ccff'));
        this.scoreText     = this.scene.add.text(16, 142, `Score: 0`,              textStyle('#ffdd44'));
        [this.levelText, this.killCountText, this.waveText, this.scoreText].forEach(t => {
            t.setScrollFactor(0).setDepth(1000);
        });

        this.createInventoryUI();

        this.scene.gameTimer = 0;
        this.timerText = this.scene.add.text(16, 212, `Time: 0s`, {
            fontSize: '14px', fill: '#aaaaaa', stroke: '#000000', strokeThickness: 2,
            fontFamily: '"Inter", "Roboto", sans-serif'
        });
        this.timerText.setScrollFactor(0).setDepth(1000);

        const screenWidth = this.scene.cameras.main.width;
        this.xpBarBg = this.scene.add.rectangle(screenWidth / 2, 20, screenWidth - 40, 20, 0x000000);
        this.xpBarBg.setScrollFactor(0).setDepth(1000);
        this.xpBar = this.scene.add.rectangle(screenWidth / 2, 20, screenWidth - 40, 20, 0x00ff00);
        this.xpBar.setScrollFactor(0).setDepth(1001);
        this.xpBar.scaleX = 0;
        this.xpText = this.scene.add.text(screenWidth / 2, 20, `XP: ${this.experience}/${this.experienceToNext}`, {
            fontSize: '14px', fill: '#ffffff', stroke: '#000000', strokeThickness: 2,
            fontFamily: '"Inter", "Roboto", sans-serif'
        });
        this.xpText.setOrigin(0.5).setScrollFactor(0).setDepth(1002);

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
        this.inventorySlots      = [];
        this.inventoryBgs        = [];
        this.inventoryLevelTexts = [];
        const startX = 16, startY = 168, slotSize = 32, slotSpacing = 36;
        for (let i = 0; i < this.maxWeapons; i++) {
            const x = startX + (i * slotSpacing);
            const bg = this.scene.add.rectangle(x + slotSize / 2, startY + slotSize / 2, slotSize, slotSize, 0x444444);
            bg.setStrokeStyle(2, 0x888888).setScrollFactor(0).setDepth(1000);
            this.inventoryBgs.push(bg);
            const slot = this.scene.add.image(x + slotSize / 2, startY + slotSize / 2, '');
            slot.setDisplaySize(24, 24).setScrollFactor(0).setDepth(1001).setVisible(false);
            this.inventorySlots.push(slot);
            const lvl = this.scene.add.text(x + slotSize - 2, startY + slotSize - 2, '', {
                fontSize: '11px', fill: '#ffffff', fontStyle: 'bold'
            });
            lvl.setOrigin(1, 1).setScrollFactor(0).setDepth(1002).setVisible(false);
            this.inventoryLevelTexts.push(lvl);
        }
        this.updateInventoryUI();
    }

    updateInventoryUI() {
        if (!this.inventorySlots) return;
        for (let i = 0; i < this.maxWeapons; i++) {
            const slot    = this.inventorySlots[i];
            const bg      = this.inventoryBgs[i];
            const lvlText = this.inventoryLevelTexts[i];
            if (i < this.weapons.length) {
                const weapon = this.weapons[i];
                slot.setTexture(weapon.sprite).setVisible(true).setDisplaySize(24, 24);
                bg.setFillStyle(0x444444).setStrokeStyle(2, 0x888888);
                const wId    = weapon.id || weapon.name;
                const wLevel = this.weaponLevels[wId] || weapon.level || 1;
                lvlText.setText(`Lv ${wLevel}`).setVisible(true).setColor('#ffffff');
            } else {
                slot.setVisible(false);
                bg.setFillStyle(0x222222).setStrokeStyle(2, 0x444444);
                if (lvlText) lvlText.setVisible(false);
            }
        }
    }

    updateHPBar() {
        if (this.hpBarBg && this.hpBarFill && this.sprite) {
            const hpBarY = this.sprite.y - 50;
            this.hpBarBg.x   = this.sprite.x;
            this.hpBarBg.y   = hpBarY;
            this.hpBarFill.x = this.sprite.x;
            this.hpBarFill.y = hpBarY;
            this.hpBarFill.scaleX = this.currentHealth / this.maxHealth;
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
        if (this.waveText)  this.waveText.setText(`Wave: ${this.scene.currentWave}`);
        if (this.scoreText) this.scoreText.setText(`Score: ${this.score.toLocaleString()}`);
    }

    // ─── XP / Kill ─────────────────────────────────────────────────────────────

    gainExperience(amount) {
        this.experience += amount;
        if (this.experience >= this.experienceToNext) this.levelUp();
        this.updateUI();
    }

    incrementKillCount() {
        this.killCount++;
        this.score += Math.max(1, 10 + Math.floor((this.scene.currentDifficulty || 1) * 5) + (this.scene.currentWave || 1) * 2);
        this.updateUI();
    }

    // ─── Weapon management ─────────────────────────────────────────────────────

    addWeapon(weapon) {
        const weaponId  = weapon.id || weapon.name;
        const existing  = this.weapons.find(w => (w.id || w.name) === weaponId);
        if (existing) {
            const currentLevel = this.weaponLevels[weaponId] || existing.level || 1;
            if (currentLevel >= this.maxWeaponLevel) {
                existing.instanceDamage = Math.floor(existing.instanceDamage * 1.05);
                this.updateInventoryUI();
                return;
            }
            const nextLevel = currentLevel + 1;
            this.weaponLevels[weaponId] = nextLevel;
            existing.level = nextLevel;
            this.upgradeWeaponCustom(existing, nextLevel);
            if (nextLevel >= this.maxWeaponLevel) this.applyMaxWeaponBehavior(existing);
            this.updateInventoryUI();
            return;
        }
        if (this.weapons.length >= this.maxWeapons) return;
        const baseDamage = (typeof weapon.damage === 'function') ? weapon.damage() : weapon.damage;
        const weaponInstance = {
            ...weapon,
            id: weaponId,
            level: 1,
            baseDamage,
            baseAttackRange: weapon.attackRange || 80,
            baseAttackSpeed: weapon.attackSpeed || 1000,
            instanceDamage:  baseDamage
        };
        this.weaponLevels[weaponId] = 1;
        this.weapons.push(weaponInstance);
        this.weaponAttackState.set(weaponId, { lastAttackTime: this.scene.time.now });
        if (this.weapons.length === 1 || !this.currentWeapon) {
            this.currentWeapon = weaponInstance;
        }
        this.applyWeaponEffects(weaponInstance);
        this.updateInventoryUI();
    }

    upgradeWeaponCustom(weaponInstance, level) {
        const isProjectile = !!weaponInstance.projectile;
        if (level % 2 === 0) {
            if (isProjectile) {
                weaponInstance.spreadShots    = (weaponInstance.spreadShots || 1) + 1;
                weaponInstance.spreadAngleDeg = Math.max(weaponInstance.spreadAngleDeg || 0, 20);
            } else {
                weaponInstance.attackRange = Math.floor((weaponInstance.attackRange || weaponInstance.baseAttackRange || 80) * 1.06);
            }
            return;
        }
        const seq = ['size', 'damage', 'attackSpeed'];
        const stat = seq[Math.floor((level - 1) / 2) % seq.length];
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
                weaponInstance.attackSpeed = Math.max(200, Math.floor((weaponInstance.attackSpeed || weaponInstance.baseAttackSpeed || 1000) * 0.92));
            } else {
                weaponInstance.swingDuration = Math.max(350, Math.floor((weaponInstance.swingDuration || 1000) * 0.95));
            }
        }
    }

    applyMaxWeaponBehavior(weaponInstance) {
        if (!weaponInstance.maxBehavior) return;
        switch (weaponInstance.maxBehavior) {
            case 'giant_thrust':
                weaponInstance.attackRange    = Math.max(weaponInstance.attackRange, 180);
                weaponInstance.instanceDamage = Math.floor(weaponInstance.instanceDamage * 1.6);
                weaponInstance.swingDuration  = Math.max(weaponInstance.swingDuration, 1200);
                weaponInstance.restAfterSwing = Math.max(weaponInstance.restAfterSwing || 1000, 1000);
                break;
            case 'spread_shot':
                weaponInstance.spreadShots    = 5;
                weaponInstance.spreadAngleDeg = 30;
                break;
            case 'rapid_flurry':
                weaponInstance.attackRange    = Math.max(weaponInstance.attackRange, 70);
                weaponInstance.swingDuration  = Math.max(350, Math.floor((weaponInstance.swingDuration || 700) * 0.75));
                weaponInstance.restAfterSwing = Math.max(400, Math.floor((weaponInstance.restAfterSwing || 900) * 0.75));
                weaponInstance.instanceDamage = Math.floor(weaponInstance.instanceDamage * 1.2);
                break;
            case 'whirlwind':
                weaponInstance.attackRange    = Math.max(weaponInstance.attackRange, 140);
                weaponInstance.swingDuration  = Math.max(1200, Math.floor((weaponInstance.swingDuration || 1200) * 1.1));
                weaponInstance.instanceDamage = Math.floor(weaponInstance.instanceDamage * 1.3);
                break;
            case 'impale':
                weaponInstance.attackRange    = Math.max(weaponInstance.attackRange, 160);
                weaponInstance.instanceDamage = Math.floor(weaponInstance.instanceDamage * 1.4);
                break;
            case 'inferno_spread':
                weaponInstance.spreadShots    = Math.max(weaponInstance.spreadShots || 1, 3);
                weaponInstance.spreadAngleDeg = Math.max(weaponInstance.spreadAngleDeg || 0, 20);
                break;
        }
        weaponInstance.maxMode = true;
    }

    applyWeaponEffects(weapon) {
        if (!weapon.effects) return;
        for (const [effectType, valueFunc] of Object.entries(weapon.effects)) {
            this.applyStatBonus(effectType, valueFunc());
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
            case 'speed': {
                this.speed += value;
                const enemySpeedBonus = Math.floor(value * 0.25);
                this.scene.globalEnemySpeedBonus = (this.scene.globalEnemySpeedBonus || 0) + enemySpeedBonus;
                window.globalEnemySpeedBonus = this.scene.globalEnemySpeedBonus;
                this.scene.enemies.forEach(enemy => {
                    if (enemy.isAlive) enemy.speed += enemySpeedBonus;
                });
                break;
            }
            case 'damage':      this.baseDamage += value; break;
            case 'defense':     this.defense    += value; break;
            case 'critChance':  this.critChance += value; break;
            case 'critDamage':  this.critDamage += value; break;
            case 'regeneration': this.regeneration += value; break;
            case 'attackSpeed': this.attackSpeed += value; break;
            case 'debuffPower': this.debuffPower += value; break;
            case 'weaponSize':  this.weaponSizeScale *= (1 + value); break;
        }
    }

    // ─── Level-up & item selection ─────────────────────────────────────────────

    levelUp() {
        this.level++;
        this.experience = 0;
        this.experienceToNext = Math.floor(this.experienceToNext * 1.5);
        this.maxHealth += 20;
        this.currentHealth = Math.min(this.currentHealth, this.maxHealth);
        this.showLevelUpSelection();
        this.updateUI();
    }

    _pauseGame() {
        this.isUpgradeOpen = true;
        this.scene.physics.pause();
        if (this.scene.tweens) this.scene.tweens.pauseAll();
        if (this.scene.anims)  this.scene.anims.pauseAll();
    }

    _resumeGame() {
        if (this.scene.tweens) this.scene.tweens.resumeAll();
        if (this.scene.anims)  this.scene.anims.resumeAll();
        this.scene.physics.resume();
        this.isUpgradeOpen = false;
    }

    _buildChoiceCard(baseX, baseY, item, uiElements, width, height, onPick) {
        const rarityColors = {
            common: 0x808080, uncommon: 0x00ff00, rare: 0x0080ff, epic: 0x8000ff, legendary: 0xff8000
        };
        const rarityBorderColors = {
            common: 0xa0a0a0, uncommon: 0x40ff40, rare: 0x4080ff, epic: 0xa040ff, legendary: 0xff9040
        };
        const bgColor     = rarityColors[item.rarity]       || rarityColors.common;
        const borderColor = rarityBorderColors[item.rarity] || rarityBorderColors.common;
        const card = this.scene.add.rectangle(baseX, baseY, width, height, bgColor, 0.15);
        card.setScrollFactor(0).setDepth(2001).setStrokeStyle(3, borderColor).setInteractive();
        const sprite = this.scene.add.image(baseX, baseY - 80, item.sprite);
        sprite.setScrollFactor(0).setDepth(2003).setScale(2);
        const nameText = this.scene.add.text(baseX, baseY - 20, item.name, {
            fontSize: '18px', fill: '#ffffff', fontStyle: 'bold', align: 'center'
        });
        nameText.setOrigin(0.5).setScrollFactor(0).setDepth(2003);
        uiElements.push(card, sprite, nameText);
        card.on('pointerover', () => { card.setFillStyle(bgColor, 0.3).setStrokeStyle(4, borderColor); sprite.setScale(2.2); });
        card.on('pointerout',  () => { card.setFillStyle(bgColor, 0.15).setStrokeStyle(3, borderColor); sprite.setScale(2); });
        card.on('pointerdown', onPick);
        sprite.setInteractive({ useHandCursor: true });
        sprite.on('pointerdown', onPick);
        return { card, sprite };
    }

    showLevelUpSelection() {
        this._pauseGame();
        const { width: sw, height: sh } = { width: this.scene.cameras.main.width, height: this.scene.cameras.main.height };
        const cx = this.scene.cameras.main.centerX;
        const cy = this.scene.cameras.main.centerY;
        const overlay = this.scene.add.rectangle(cx, cy, sw * 0.9, sh * 0.8, 0x000000, 0.85);
        overlay.setScrollFactor(0).setDepth(2000);
        const title = this.scene.add.text(cx, cy - (sh * 0.3), 'LEVEL UP! Choose an Upgrade:', {
            fontSize: '32px', fill: '#ffffff', fontStyle: 'bold'
        });
        title.setOrigin(0.5).setScrollFactor(0).setDepth(2001);
        const items = this.getRandomItems(3);
        const uiElements = [overlay, title];
        let choiceMade = false;
        const closeUI = () => {
            uiElements.forEach(el => { try { if (el.destroy) el.destroy(); else if (el.setVisible) el.setVisible(false); } catch (_) {} });
            this._resumeGame();
        };
        items.forEach((item, index) => {
            const baseX = cx + (index - 1) * 280;
            const descText = this.scene.add.text(baseX, cy + 40, item.description, {
                fontSize: '12px', fill: '#cccccc', align: 'center', wordWrap: { width: 200 }
            });
            descText.setOrigin(0.5).setScrollFactor(0).setDepth(2003);
            const effectText = this.scene.add.text(baseX, cy + 80, item.effectSummary, {
                fontSize: '11px', fill: '#aaffaa', align: 'center', wordWrap: { width: 200 }
            });
            effectText.setOrigin(0.5).setScrollFactor(0).setDepth(2003);
            const rarityBorderColor = { common: 0xa0a0a0, uncommon: 0x40ff40, rare: 0x4080ff, epic: 0xa040ff, legendary: 0xff9040 }[item.rarity] || 0xa0a0a0;
            const rarityText = this.scene.add.text(baseX, cy + 5, item.rarity.toUpperCase(), {
                fontSize: '14px', fill: `#${rarityBorderColor.toString(16).padStart(6, '0')}`, fontStyle: 'bold', align: 'center'
            });
            rarityText.setOrigin(0.5).setScrollFactor(0).setDepth(2003);
            uiElements.push(descText, effectText, rarityText);
            this._buildChoiceCard(baseX, cy, item, uiElements, 240, 320, () => {
                if (choiceMade) return;
                choiceMade = true;
                this.addToInventory(item);
                closeUI();
            });
        });
    }

    showInitialWeaponChoice(onComplete) {
        this._pauseGame();
        const { width: sw, height: sh } = { width: this.scene.cameras.main.width, height: this.scene.cameras.main.height };
        const cx = this.scene.cameras.main.centerX;
        const cy = this.scene.cameras.main.centerY;
        const overlay = this.scene.add.rectangle(cx, cy, sw * 0.9, sh * 0.8, 0x000000, 0.85);
        overlay.setScrollFactor(0).setDepth(2000);
        const title = this.scene.add.text(cx, cy - (sh * 0.3), 'Choose Your Weapon', {
            fontSize: '32px', fill: '#ffffff', fontStyle: 'bold'
        });
        title.setOrigin(0.5).setScrollFactor(0).setDepth(2001);
        const weaponKeys = Phaser.Utils.Array.Shuffle(Object.keys(WEAPON_TYPES)).slice(0, 3);
        const items = weaponKeys.map(key => ({ ...WEAPON_TYPES[key], id: key, isWeapon: true, weaponData: { ...WEAPON_TYPES[key], id: key } }));
        const uiElements = [overlay, title];
        let choiceMade = false;
        const closeUI = () => {
            uiElements.forEach(el => { try { if (el.destroy) el.destroy(); else if (el.setVisible) el.setVisible(false); } catch (_) {} });
            this._resumeGame();
        };
        items.forEach((item, index) => {
            const baseX   = cx + (index - 1) * 280;
            const dmgVal  = (typeof item.damage === 'function') ? item.damage() : item.damage;
            const stats   = `${Math.floor(dmgVal)} DMG • ${item.attackRange} Range`;
            const descText = this.scene.add.text(baseX, cy + 40, stats, {
                fontSize: '12px', fill: '#cccccc', align: 'center', wordWrap: { width: 200 }
            });
            descText.setOrigin(0.5).setScrollFactor(0).setDepth(2003);
            uiElements.push(descText);
            this._buildChoiceCard(baseX, cy, item, uiElements, 240, 300, () => {
                if (choiceMade) return;
                choiceMade = true;
                this.addWeapon(item.weaponData);
                closeUI();
                if (onComplete) onComplete();
            });
        });
    }

    getRandomItems(count = 3) {
        const rarityWeights = { common: 50, uncommon: 30, rare: 15, epic: 4, legendary: 1 };
        const includeNewWeapons  = (this.weapons.length < this.maxWeapons);
        const itemsPool          = { ...ITEM_TYPES, ...ENHANCED_ITEM_TYPES };
        const ownedWeapons       = this.weapons;
        const ownedWeaponIds     = new Set(ownedWeapons.map(w => w.id || w.name));
        const nonMaxedOwnedIds   = new Set(
            ownedWeapons
                .filter(w => (this.weaponLevels[w.id || w.name] || w.level || 1) < this.maxWeaponLevel)
                .map(w => w.id || w.name)
        );
        const ownedWeaponsPool   = {};
        nonMaxedOwnedIds.forEach(id => { if (WEAPON_TYPES[id]) ownedWeaponsPool[id] = WEAPON_TYPES[id]; });
        const allItems    = { ...itemsPool, ...(includeNewWeapons ? WEAPON_TYPES : {}), ...ownedWeaponsPool };
        const allItemKeys = Object.keys(allItems);
        const selected = [];
        for (let i = 0; i < count; i++) {
            let attempts = 0, selectedItem = null;
            while (!selectedItem && attempts < 30) {
                const randomKey  = allItemKeys[Math.floor(Math.random() * allItemKeys.length)];
                const itemData   = allItems[randomKey];
                const rarityWeight = rarityWeights[itemData.rarity] || 1;
                if (Math.random() * 100 < rarityWeight) {
                    const isWeapon = WEAPON_TYPES[randomKey] !== undefined;
                    if (isWeapon && !includeNewWeapons && !ownedWeaponIds.has(randomKey)) { attempts++; continue; }
                    if (isWeapon) {
                        const lvl = this.weaponLevels[randomKey] || (ownedWeapons.find(w => (w.id || w.name) === randomKey)?.level) || 0;
                        if (lvl >= this.maxWeaponLevel) { attempts++; continue; }
                        if (!includeNewWeapons && !ownedWeaponIds.has(randomKey)) { attempts++; continue; }
                        if (ownedWeaponIds.has(randomKey) && !nonMaxedOwnedIds.has(randomKey)) { attempts++; continue; }
                    }
                    const effectDescriptions = [];
                    const effects = {};
                    if (itemData.effects) {
                        for (const [effectType, effectFunc] of Object.entries(itemData.effects)) {
                            const value = effectFunc();
                            effects[effectType] = value;
                            const sign = value > 0 ? '+' : '';
                            const labels = {
                                health: `${sign}${value} Health`, maxHealth: `${sign}${value} Max Health`,
                                speed: `${sign}${value} Speed`, damage: `${sign}${value} Damage`,
                                defense: `${sign}${value} Defense`, critChance: `${sign}${value}% Crit Chance`,
                                critDamage: `${sign}${value}% Crit Damage`, regeneration: `${sign}${value} HP/sec Regen`,
                                attackSpeed: `${sign}${value}% Attack Speed`
                            };
                            if (labels[effectType]) effectDescriptions.push(labels[effectType]);
                        }
                    }
                    if (isWeapon) {
                        const dmgVal = (typeof itemData.damage === 'function') ? itemData.damage() : itemData.damage;
                        let aps = null;
                        if (itemData.attackSpeed) aps = 1000 / itemData.attackSpeed;
                        else if (itemData.swingDuration || itemData.restAfterSwing) {
                            aps = 1000 / ((itemData.swingDuration || 1000) + (itemData.restAfterSwing || 1000));
                        }
                        const stats = [`${Math.floor(dmgVal)} DMG`, `${itemData.attackRange} Range`];
                        if (aps) stats.push(`${aps.toFixed(2)} APS`);
                        effectDescriptions.unshift(stats.join(' • '));
                    }
                    selectedItem = {
                        id: randomKey, sprite: itemData.sprite, name: itemData.name,
                        category: itemData.category, rarity: itemData.rarity,
                        effects, isWeapon,
                        weaponData: isWeapon ? { ...itemData, id: randomKey } : null,
                        description: itemData.description || effectDescriptions.join(', '),
                        effectSummary: effectDescriptions.join(' | ')
                    };
                }
                attempts++;
            }
            if (selectedItem) {
                selected.push(selectedItem);
            } else {
                const fd = ITEM_TYPES['berry01blue'];
                selected.push({ id: 'berry01blue', sprite: fd.sprite, name: fd.name, category: fd.category, rarity: fd.rarity, effects: { health: 20 }, description: '+20 Health' });
            }
        }
        return selected;
    }

    addToInventory(item) {
        if (item.isWeapon) {
            this.addWeapon(item.weaponData);
        } else if (this.inventory.length < this.maxInventorySize) {
            this.inventory.push(item);
            this.applyItemEffect(item);
        }
    }

    applyItemEffect(item) {
        if (!item.effects) return;
        for (const [effectType, value] of Object.entries(item.effects)) {
            switch (effectType) {
                case 'health':    this.currentHealth = Math.min(this.currentHealth + value, this.maxHealth); break;
                case 'maxHealth': this.maxHealth += value; this.currentHealth = Math.min(this.currentHealth + value, this.maxHealth); break;
                case 'speed':     this.applyStatBonus('speed', value); break;
                case 'damage':    this.baseDamage  += value; break;
                case 'defense':   this.defense     += value; break;
                case 'critChance': this.critChance += value; break;
                case 'critDamage': this.critDamage += value; break;
                case 'regeneration': this.regeneration += value; break;
                case 'attackSpeed':  this.attackSpeed  += value; break;
                case 'weaponSize':   this.weaponSizeScale *= (1 + value); break;
            }
        }
        this.updateUI();
    }

    // ─── Combat / attack ───────────────────────────────────────────────────────

    update() {
        super.update();
        if (!this.isAlive) return;
        this.updateHPBar();
        if (!this.lastRegenTime) this.lastRegenTime = Date.now();
        const now = Date.now();
        if (now - this.lastRegenTime >= 1000 && this.regeneration > 0) {
            this.currentHealth = Math.min(this.currentHealth + this.regeneration, this.maxHealth);
            this.updateUI();
            this.lastRegenTime = now;
        }
        if (this.currentWeapon) this.autoAttack();
    }

    findNearestEnemy() {
        const enemies = this.scene.enemies;
        if (!enemies || enemies.length === 0) return null;
        let nearest = null, nearestDist = Infinity;
        enemies.forEach(enemy => {
            if (enemy.isAlive) {
                const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, enemy.sprite.x, enemy.sprite.y);
                if (d < nearestDist) { nearestDist = d; nearest = enemy; }
            }
        });
        return nearest;
    }

    autoAttack() {
        if (this.isUpgradeOpen || !this.autoAttackEnabled) return;
        if (!this.weapons || this.weapons.length === 0) return;
        const currentTime = this.scene.time.now;
        const target = this.findNearestEnemy();
        for (const weapon of this.weapons) {
            if (!weapon) continue;
            const wId = weapon.id || weapon.name;
            let state = this.weaponAttackState.get(wId);
            if (!state) { state = { lastAttackTime: -99999 }; this.weaponAttackState.set(wId, state); }
            if (currentTime - state.lastAttackTime < this.getWeaponCooldown(weapon)) continue;
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
        if (!weapon.projectile) return (weapon.swingDuration || 1000) + (weapon.restAfterSwing || 1000);
        return Math.max(200, Math.floor((weapon.attackSpeed || 800) * 100 / (100 + this.attackSpeed)));
    }

    performContinuousAttackFor(weapon, target) {
        const handled = executeWeaponAttack(this.scene, this, weapon, target, this.scene.enemies, this.scene.projectiles, this.scene.zones);
        if (handled) return;
        if (weapon.projectile) {
            if (target) this.performWeaponAttack(weapon, target);
        } else {
            const attackAngle = target
                ? Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, target.sprite.x, target.sprite.y)
                : (this.lastFacingAngle || 0);
            this.createWeaponAttackFor(weapon, attackAngle);
            this.createAttackHitboxFor(weapon, attackAngle);
        }
    }

    showWeaponSwingAtAngle(angle, weaponOverride = null) {
        const w   = weaponOverride || this.currentWeapon;
        const wid = (w && (w.id || w.name)) || 'default';
        const now = this.scene.time.now;
        if (now - (this.lastTrailAt.get(wid) || 0) < 120) return;
        this.lastTrailAt.set(wid, now);
        const g = this.scene.add.graphics();
        g.lineStyle(6, 0xFFD700, 0.8).setDepth(200);
        const radius = w && w.attackRange ? w.attackRange : 80;
        g.beginPath();
        g.arc(this.sprite.x, this.sprite.y, radius, angle - Math.PI / 2, angle + Math.PI / 2);
        g.strokePath();
        this.scene.tweens.add({ targets: g, alpha: 0, duration: 300, ease: 'Sine.easeOut', onComplete: () => g.destroy() });
    }

    createWeaponAttack(angle) {
        if (!this.currentWeapon) return;
        if (!this.currentWeapon.projectile) {
            const wId = this.currentWeapon.id || this.currentWeapon.name;
            const active = this.activeMeleeAttacks.get(wId);
            if (active && active.isAlive) return;
        }
        const weaponEntity = new WeaponEntity(this.scene, this, this.currentWeapon, angle);
        if (!this.currentWeapon.projectile) {
            this.activeMeleeAttacks.set(this.currentWeapon.id || this.currentWeapon.name, weaponEntity);
        }
    }

    createWeaponAttackFor(weapon, angle) {
        if (!weapon || weapon.projectile) return;
        const wId = weapon.id || weapon.name;
        const active = this.activeMeleeAttacks.get(wId);
        if (active && active.isAlive) return;
        this.activeMeleeAttacks.set(wId, new WeaponEntity(this.scene, this, weapon, angle));
    }

    createAttackHitboxFor(weapon, angle) {
        if (!weapon) return;
        const hitboxX   = this.sprite.x + Math.cos(angle) * 50;
        const hitboxY   = this.sprite.y + Math.sin(angle) * 50;
        const slashLength = weapon.attackRange || 60;
        const g = this.scene.add.graphics();
        g.lineStyle(4, 0xFFFFFF, 0.7).setDepth(100);
        const half = Math.PI / 3 / 2;
        g.beginPath();
        g.arc(this.sprite.x, this.sprite.y, slashLength, angle - half, angle + half);
        g.strokePath();
        this.checkEnemiesInAttackArea(hitboxX, hitboxY, slashLength, weapon);
        this.scene.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
    }

    // Legacy single-weapon version (kept for pointer click handler in GameScene)
    createAttackHitbox(angle) {
        if (!this.currentWeapon) return;
        this.createAttackHitboxFor(this.currentWeapon, angle);
    }

    checkEnemiesInAttackArea(centerX, centerY, radius, weaponOverride = null) {
        const w = weaponOverride || this.currentWeapon;
        this.scene.enemies.forEach(enemy => {
            if (!enemy.isAlive) return;
            const d = Phaser.Math.Distance.Between(centerX, centerY, enemy.sprite.x, enemy.sprite.y);
            if (d <= radius) {
                let damage = w.instanceDamage || (typeof w.damage === 'function' ? w.damage() : w.damage);
                damage += this.baseDamage;
                if (Math.random() * 100 < this.critChance) damage = Math.floor(damage * (this.critDamage / 100));
                enemy.takeDamage(damage, w?.damageType);
                if (enemy.knockback) enemy.knockback(this.sprite.x, this.sprite.y, 50);
                if (w && w.damageType && enemy.applyDebuff) enemy.applyDebuff(w.damageType, 1 + (this.debuffPower || 0));
                this.showFloatingDamage(enemy, damage);
                this.showAttackEffect(enemy);
            }
        });
    }

    performWeaponAttack(weapon, target) {
        if (!weapon || !target) return;
        let damage = weapon.instanceDamage || (typeof weapon.damage === 'function' ? weapon.damage() : weapon.damage);
        damage += this.baseDamage;
        if (Math.random() * 100 < this.critChance) damage = Math.floor(damage * (this.critDamage / 100));
        if (weapon.projectile) {
            this.launchProjectileWithWeapon(weapon, target, damage);
        } else {
            this.performMeleeAttackWithWeapon(weapon, target, damage);
        }
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

    createSlashHitboxFor(weapon, target, damage) {
        const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, target.sprite.x, target.sprite.y);
        const wid   = (weapon && (weapon.id || weapon.name)) || 'default_melee';
        const now   = this.scene.time.now;
        const allowTrail = now - (this.lastTrailAt.get(wid) || 0) >= 120;
        if (allowTrail) this.lastTrailAt.set(wid, now);
        const slashLength = weapon && weapon.attackRange ? weapon.attackRange : 60;
        const half  = Math.PI / 3 / 2;
        if (allowTrail) {
            const g = this.scene.add.graphics();
            g.lineStyle(3, 0xFFFFFF, 0.9).setDepth(100);
            g.beginPath();
            g.arc(this.sprite.x, this.sprite.y, slashLength, angle - half, angle + half);
            g.strokePath();
            this.scene.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
        }
        target.takeDamage(damage, weapon?.damageType);
        if (weapon && weapon.damageType && target.applyDebuff) target.applyDebuff(weapon.damageType, 1 + (this.debuffPower || 0));
        this.showFloatingDamage(target, damage);
    }

    showFloatingDamage(target, damage) {
        this.damageTextCooldowns = this.damageTextCooldowns || new Map();
        const now  = this.scene.time.now || Date.now();
        const id   = target.id || `${target.sprite.x}_${target.sprite.y}`;
        if (now - (this.damageTextCooldowns.get(id) || 0) < 200) return;
        this.damageTextCooldowns.set(id, now);
        const t = this.scene.add.text(target.sprite.x, target.sprite.y - 20, `-${Math.floor(damage)}`, {
            fontSize: '16px', fontFamily: '"Inter", "Roboto", sans-serif', fill: '#ff4444', fontStyle: 'bold'
        });
        t.setDepth(1000);
        this.scene.tweens.add({
            targets: t, y: target.sprite.y - 60, alpha: 0, duration: 1000, ease: 'Power2',
            onComplete: () => t.destroy()
        });
    }

    launchProjectileWithWeapon(weapon, target, damage) {
        const baseAngle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, target.sprite.x, target.sprite.y);
        const shots  = weapon.spreadShots    || 1;
        const spread = weapon.spreadAngleDeg || 0;
        for (let i = 0; i < shots; i++) {
            let offsetDeg = 0;
            if (shots > 1) offsetDeg = (-spread / 2) + (i * (spread / (shots - 1)));
            const angle = baseAngle + Phaser.Math.DEG_TO_RAD * offsetDeg;
            const dist  = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, target.sprite.x, target.sprite.y);
            this.scene.projectiles.push(new Projectile(
                this.scene, this.sprite.x, this.sprite.y,
                this.sprite.x + Math.cos(angle) * dist,
                this.sprite.y + Math.sin(angle) * dist,
                weapon, damage
            ));
        }
        if (weapon.category === 'magic') this.showCastingEffect();
    }

    showCastingEffect() {
        const e = this.scene.add.sprite(this.sprite.x, this.sprite.y, 'magic_effect');
        e.setDepth(1500).setScale(1.2);
        e.play('magic_effect_anim');
        e.on('animationcomplete', () => e.destroy());
    }

    applyWeaponUniqueEffectFor(weapon, target, damage) {
        const enemies = this.scene.enemies;
        switch (weapon.name) {
            case 'Swift Dagger':
                if (Math.random() < 0.25) {
                    this.scene.time.delayedCall(200, () => {
                        if (target.isAlive) { target.takeDamage(Math.floor(damage * 0.5), DAMAGE_TYPES.PHYSICAL); this.showAttackEffect(target); }
                    });
                }
                break;
            case 'Double Axe':
                enemies.forEach(enemy => {
                    if (enemy !== target && enemy.isAlive) {
                        const d = Phaser.Math.Distance.Between(target.sprite.x, target.sprite.y, enemy.sprite.x, enemy.sprite.y);
                        if (d < 80) { enemy.takeDamage(Math.floor(damage * 0.4), DAMAGE_TYPES.PHYSICAL); this.showAttackEffect(enemy); }
                    }
                });
                break;
            case 'Crystal Sword':
                if (Math.random() < 0.3) this.chainLightning(target, damage);
                break;
            case 'Shield': {
                const angle   = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, target.sprite.x, target.sprite.y);
                const pushDist = 40;
                this.scene.tweens.add({
                    targets: target.sprite,
                    x: target.sprite.x + Math.cos(angle) * pushDist,
                    y: target.sprite.y + Math.sin(angle) * pushDist,
                    duration: 120, ease: 'Sine.easeOut'
                });
                break;
            }
        }
    }

    chainLightning(startTarget, baseDamage) {
        let currentTarget = startTarget, chainCount = 0;
        const chainNext = () => {
            if (chainCount >= 3) return;
            let nearestEnemy = null, nearestDist = Infinity;
            this.scene.enemies.forEach(enemy => {
                if (enemy !== currentTarget && enemy.isAlive) {
                    const d = Phaser.Math.Distance.Between(currentTarget.sprite.x, currentTarget.sprite.y, enemy.sprite.x, enemy.sprite.y);
                    if (d < 120 && d < nearestDist) { nearestDist = d; nearestEnemy = enemy; }
                }
            });
            if (nearestEnemy) {
                this.createLightningEffect(currentTarget, nearestEnemy);
                nearestEnemy.takeDamage(Math.floor(baseDamage * (0.6 - chainCount * 0.1)), DAMAGE_TYPES.LIGHTNING);
                currentTarget = nearestEnemy;
                chainCount++;
                this.scene.time.delayedCall(150, chainNext);
            }
        };
        this.scene.time.delayedCall(100, chainNext);
    }

    createLightningEffect(from, to) {
        const line = this.scene.add.line(0, 0, from.sprite.x, from.sprite.y, to.sprite.x, to.sprite.y, 0x00ffff, 0.8);
        line.setDepth(1500).setLineWidth(3);
        this.scene.time.delayedCall(100, () => { if (line) line.destroy(); });
    }

    showAttackEffect(target) {
        if (!target || !target.sprite) return;
        const w       = this.currentWeapon;
        const dmgType = (w && w.damageType) ? w.damageType : 'physical';
        let texKey, animKey;
        if      (dmgType === 'burn')                         { texKey = 'fire_effect';    animKey = 'fire_effect_anim'; }
        else if (dmgType === 'lightning' || dmgType === 'armor_weaken') { texKey = 'bluefire_effect'; animKey = 'bluefire_effect_anim'; }
        else if (dmgType === 'poison')                       { texKey = 'magic_effect';   animKey = 'magic_effect_anim'; }
        else                                                  { texKey = 'weaponhit_effect'; animKey = 'weaponhit_effect_anim'; }
        const e = this.scene.add.sprite(target.sprite.x, target.sprite.y, texKey);
        e.setDepth(1500).setScale(1.0);
        e.play(animKey);
        e.on('animationcomplete', () => e.destroy());
    }

    // ─── Damage & death ────────────────────────────────────────────────────────

    takeDamage(amount) {
        if (!this.isAlive) return;
        const now = this.scene.time.now || Date.now();
        if (this.imperviousUntil && now < this.imperviousUntil) return;
        this.currentHealth -= amount;
        if (this.currentHealth < 0) this.currentHealth = 0;
        this.sprite.setTint(0xff0000);
        this.scene.time.delayedCall(100, () => { if (this.isAlive) this.sprite.setTint(0xffffff); });
        // Camera shake + red vignette for impact feedback
        this.scene.cameras.main.shake(180, 0.010);
        if (this.scene.triggerDamageFlash) this.scene.triggerDamageFlash();
        if (this.currentHealth <= 0) this.die();
        this.updateHPBar();
        this.updateUI();
    }

    die() {
        if (this.isDying) return;
        this.isDying  = true;
        this.isAlive  = false;
        if (this._timerEvent && this._timerEvent.remove) {
            try { this._timerEvent.remove(false); } catch (_) {}
            this._timerEvent = null;
        }
        this.sprite.setVelocity(0, 0).clearTint();
        this.playDeathAnimation();
        this.scene.time.delayedCall(100, () => { this.scene.physics.pause(); });
    }

    playDeathAnimation() {
        if (this.deathAnimationStarted) return;
        this.deathAnimationStarted = true;
        this.sprite.stop().setVelocity(0, 0);
        let frame = 0;
        const playNext = () => {
            if (frame < 10) {
                this.sprite.setTexture(`death_${frame++}`);
                this.scene.time.delayedCall(200, playNext);
            } else {
                this.scene.time.delayedCall(500, () => { this.showGameOverScreen(); });
            }
        };
        playNext();
    }

    showGameOverScreen() {
        try { this.scene.sound.play('sfx_gameover', { volume: 1.0 }); } catch (_) {}
        const bgm = this.scene.bgmMusic;
        if (bgm) {
            try {
                this.scene.tweens.add({
                    targets: bgm, volume: 0, duration: 800, ease: 'Sine.easeInOut',
                    onComplete: () => { try { bgm.stop(); bgm.destroy(); } catch (_) {} this.scene.bgmMusic = null; }
                });
            } catch (_) { try { bgm.stop(); bgm.destroy(); } catch (_) {} this.scene.bgmMusic = null; }
        }

        const timeSec    = this.scene.gameTimer || 0;
        const finalScore = this.score + Math.floor(timeSec * 3);
        const wave       = this.scene.currentWave;
        const cam        = this.scene.cameras.main;

        const overlay = this.scene.add.rectangle(cam.centerX, cam.centerY, cam.width, cam.height, 0x000000, 0.82);
        overlay.setScrollFactor(0).setDepth(3000);

        const gameOverText = this.scene.add.text(cam.centerX, cam.centerY - 130, 'GAME OVER', {
            fontSize: '54px', fill: '#ff2222', stroke: '#000000', strokeThickness: 5, fontFamily: '"Pickyside", monospace'
        });
        gameOverText.setOrigin(0.5).setScrollFactor(0).setDepth(3001);

        const statsText = this.scene.add.text(cam.centerX, cam.centerY - 50, [
            `Level: ${this.level}   |   Wave: ${wave}`,
            `Kills: ${this.killCount}   |   Time: ${timeSec}s`,
            ``,
            `SCORE:  ${finalScore.toLocaleString()}`
        ].join('\n'), { fontSize: '20px', fill: '#ffffff', stroke: '#000000', strokeThickness: 2, align: 'center', lineSpacing: 6 });
        statsText.setOrigin(0.5).setScrollFactor(0).setDepth(3001);

        const makeBtn = (x, label) => {
            const btn = this.scene.add.rectangle(x, cam.centerY + 110, 160, 48, 0x3a3a3a);
            btn.setScrollFactor(0).setDepth(3001).setInteractive().setStrokeStyle(2, 0x888888);
            const txt = this.scene.add.text(x, cam.centerY + 110, label, {
                fontSize: '18px', fill: '#ffffff', fontFamily: '"Pickyside", monospace'
            });
            txt.setOrigin(0.5).setScrollFactor(0).setDepth(3002);
            btn.on('pointerover', () => btn.setFillStyle(0x555555));
            btn.on('pointerout',  () => btn.setFillStyle(0x3a3a3a));
            return btn;
        };
        const restartBtn = makeBtn(cam.centerX - 90, 'Play Again');
        const homeBtn    = makeBtn(cam.centerX + 90, 'Main Menu');

        const removeNameEntry = () => { const el = document.getElementById('cf-name-entry'); if (el) el.remove(); };
        const stopBgm = () => { if (this.scene.bgmMusic) { try { this.scene.bgmMusic.stop(); this.scene.bgmMusic.destroy(); } catch (_) {} this.scene.bgmMusic = null; } };
        restartBtn.on('pointerdown', () => { removeNameEntry(); stopBgm(); this.scene.scene.restart(); });
        homeBtn.on('pointerdown',    () => { removeNameEntry(); stopBgm(); window.location.href = '/'; });

        const nameEntry = document.createElement('div');
        nameEntry.id = 'cf-name-entry';
        nameEntry.style.cssText = `
            position:fixed; left:50%; transform:translateX(-50%);
            top:calc(50% + 30px); z-index:9999;
            display:flex; flex-direction:column; align-items:center; gap:8px;
            font-family:'Pickyside',monospace; color:white; text-align:center;
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
                           background:gold;color:black;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">
                    Submit</button>
            </div>
            <p id="cf-submit-status" style="margin:0;font-size:13px;min-height:18px;"></p>
        `;
        document.body.appendChild(nameEntry);

        const submitBtn = document.getElementById('cf-submit-btn');
        const nameInput = document.getElementById('cf-name-input');
        const statusEl  = document.getElementById('cf-submit-status');

        // Pre-fill name from JWT if the player is logged in
        const loggedInUser = window.auth ? window.auth.getCurrentUser() : null;
        if (loggedInUser && loggedInUser.username) {
            nameInput.value = loggedInUser.username;
        }

        const doSubmit = async () => {
            const name = nameInput.value.trim() || 'Anonymous';
            submitBtn.disabled = true;
            submitBtn.textContent = '...';
            statusEl.style.color = '#aaaaaa';
            statusEl.textContent = 'Submitting…';
            try {
                const headers = { 'Content-Type': 'application/json' };
                const token = window.auth ? window.auth.getToken() : null;
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const res = await fetch('/api/scores', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ name, score: finalScore, wave })
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                statusEl.style.color = '#90EE90';
                statusEl.textContent = 'Score submitted! Check the leaderboard.';
                submitBtn.textContent = '✓';
                nameInput.disabled = true;
            } catch (_) {
                statusEl.style.color = '#ff6666';
                statusEl.textContent = 'Could not submit — server offline?';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Retry';
            }
        };
        submitBtn.addEventListener('click', doSubmit);
        nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSubmit(); });
        nameInput.focus();
    }

    // ─── Animations & input ────────────────────────────────────────────────────

    createAnimations() {
        this.scene.anims.create({
            key: 'idle',
            frames: Array.from({ length: 8 }, (_, i) => ({ key: `idle_${i}` })),
            frameRate: 4, repeat: -1
        });
        this.scene.anims.create({
            key: 'run',
            frames: Array.from({ length: 10 }, (_, i) => ({ key: `run_${i}` })),
            frameRate: 12, repeat: -1
        });
    }

    handleInput(cursors) {
        this.isMoving = false;
        this.sprite.setVelocity(0);
        if (!cursors) return;
        let moveX = 0, moveY = 0;
        if (cursors.A?.isDown) { this.sprite.setVelocityX(-this.speed); this.sprite.setFlipX(true);  this.isMoving = true; moveX = -1; this.lastFacingAngle = Math.PI; }
        if (cursors.D?.isDown) { this.sprite.setVelocityX(this.speed);  this.sprite.setFlipX(false); this.isMoving = true; moveX =  1; this.lastFacingAngle = 0; }
        if (cursors.W?.isDown) { this.sprite.setVelocityY(-this.speed); this.isMoving = true; moveY = -1; this.lastFacingAngle = -Math.PI / 2; }
        if (cursors.S?.isDown) { this.sprite.setVelocityY(this.speed);  this.isMoving = true; moveY =  1; this.lastFacingAngle =  Math.PI / 2; }
        if (moveX !== 0 && moveY !== 0) {
            this.lastFacingAngle = Math.atan2(moveY, moveX);
            const vx = this.sprite.body?.velocity?.x || 0;
            const vy = this.sprite.body?.velocity?.y || 0;
            this.sprite.setVelocity(vx / Math.SQRT2, vy / Math.SQRT2);
        }
        const targetAnim = this.isMoving ? 'run' : 'idle';
        if (this.sprite.anims.currentAnim?.key !== targetAnim) this.sprite.play(targetAnim);
        this._wasMoving = this.isMoving;
    }
}
