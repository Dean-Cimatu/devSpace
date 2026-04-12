import { Entity } from './Entity.js';

// Melee weapon visual — orbits the player through a swing arc, then fades out
export class WeaponEntity extends Entity {
    constructor(scene, player, weaponData, attackAngle) {
        super(scene, player.sprite.x, player.sprite.y, weaponData.sprite);
        this.player = player;
        this.weaponData = weaponData;
        this.attackAngle = attackAngle;
        this.attackDuration = (weaponData && weaponData.swingDuration) ? weaponData.swingDuration : 900;
        this.createdTime = scene.time.now;
        this.orbitRadius = (weaponData && weaponData.attackRange ? weaponData.attackRange : 80) * 1.0;
        this.startOrbitAngle = this.attackAngle - Math.PI / 2;
        this.endOrbitAngle   = this.attackAngle + Math.PI / 2;
        this.currentOrbitAngle = this.startOrbitAngle;

        this.positionWeapon();
        this.sprite.setOrigin(0.15, 0.5);
        this.sprite.setScale(1.5);
        this.sprite.setDepth(50);
        this.sprite.setTint(0xFFD700);
        this.sprite.setAlpha(0);
        if (this.shadow) {
            this.shadow.destroy();
            this.shadow = null;
        }
        this.performAttackAnimation();
    }

    positionWeapon() {
        const px = this.player.sprite.x;
        const py = this.player.sprite.y;
        const x = px + Math.cos(this.currentOrbitAngle) * this.orbitRadius;
        const y = py + Math.sin(this.currentOrbitAngle) * this.orbitRadius;
        this.sprite.x = x;
        this.sprite.y = y;
        this.sprite.setRotation(this.currentOrbitAngle + Math.PI / 2);
    }

    performAttackAnimation() {
        this.scene.tweens.add({
            targets: this.sprite,
            alpha: 1,
            duration: 150,
            ease: 'Sine.easeOut'
        });
        const orbitObj = { angle: this.startOrbitAngle };
        this.orbitTween = this.scene.tweens.add({
            targets: orbitObj,
            angle: this.endOrbitAngle,
            duration: this.attackDuration,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
                this.currentOrbitAngle = orbitObj.angle;
                this.positionWeapon();
            },
            onComplete: () => {
                this.scene.tweens.add({
                    targets: this.sprite,
                    alpha: 0,
                    duration: 180,
                    ease: 'Sine.easeIn',
                    onComplete: () => this.destroy()
                });
            }
        });
    }

    update() {
        if (!this.isAlive) return;
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
        if (this.player && this.weaponData && this.weaponData.id) {
            const wId = this.weaponData.id;
            if (this.player.activeMeleeAttacks && this.player.activeMeleeAttacks.get(wId) === this) {
                this.player.activeMeleeAttacks.delete(wId);
            }
        }
        super.destroy();
    }
}
