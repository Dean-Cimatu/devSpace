import { Entity } from './Entity.js';

// Melee weapon visual — sweeps through an arc around the player, purely cosmetic.
// Damage is handled separately by behaviors.js; this class only provides the sprite animation.
export class WeaponEntity extends Entity {
    constructor(scene, player, weaponData, attackAngle) {
        super(scene, player.sprite.x, player.sprite.y, weaponData.sprite);
        this.player       = player;
        this.weaponData   = weaponData;
        this.attackAngle  = attackAngle;

        // Visual-only duration: faster than the full swing cooldown so the sprite
        // disappears well before the next attack fires
        const swingMs        = (weaponData && weaponData.swingDuration) ? weaponData.swingDuration : 700;
        this.attackDuration  = Math.max(200, Math.floor(swingMs * 0.5));

        // Tighter 120° arc — feels snappier than a full 180° sweep
        this.orbitRadius       = (weaponData && weaponData.attackRange ? weaponData.attackRange : 80) * 0.62;
        this.startOrbitAngle   = attackAngle - Math.PI / 3;
        this.endOrbitAngle     = attackAngle + Math.PI / 3;
        this.currentOrbitAngle = this.startOrbitAngle;

        this._tweenDone = false;

        if (this.shadow) { this.shadow.destroy(); this.shadow = null; }

        this.sprite.setOrigin(0.15, 0.5);
        this.sprite.setScale(1.4);
        this.sprite.setDepth(50);
        this.sprite.setAlpha(0);

        this._position();
        this._animate();
    }

    _position() {
        const px = this.player.sprite.x;
        const py = this.player.sprite.y;
        this.sprite.x = px + Math.cos(this.currentOrbitAngle) * this.orbitRadius;
        this.sprite.y = py + Math.sin(this.currentOrbitAngle) * this.orbitRadius;
        this.sprite.setRotation(this.currentOrbitAngle + Math.PI / 2);
    }

    _animate() {
        // Quick fade in
        this.scene.tweens.add({
            targets: this.sprite,
            alpha: 1,
            duration: 60,
            ease: 'Sine.easeOut'
        });

        const orbitObj = { angle: this.startOrbitAngle };
        this._orbitTween = this.scene.tweens.add({
            targets:  orbitObj,
            angle:    this.endOrbitAngle,
            duration: this.attackDuration,
            ease:     'Quad.easeOut',   // fast start → natural deceleration
            onUpdate: () => {
                if (!this.isAlive || !this.sprite) return;
                this.currentOrbitAngle = orbitObj.angle;
                this._position();
            },
            onComplete: () => {
                this._tweenDone = true;
                if (!this.isAlive || !this.sprite) return;
                this.scene.tweens.add({
                    targets:  this.sprite,
                    alpha:    0,
                    duration: 120,
                    ease:     'Sine.easeIn',
                    onComplete: () => this.destroy()
                });
            }
        });
    }

    // update() is intentionally minimal — the tween owns positioning and lifecycle.
    update() {}

    destroy() {
        if (this._orbitTween) { this._orbitTween.remove(); this._orbitTween = null; }
        // Untrack from activeMeleeAttacks if registered
        if (this.player && this.weaponData && this.weaponData.id) {
            const wId = this.weaponData.id;
            if (this.player.activeMeleeAttacks && this.player.activeMeleeAttacks.get(wId) === this) {
                this.player.activeMeleeAttacks.delete(wId);
            }
        }
        super.destroy();
    }
}
