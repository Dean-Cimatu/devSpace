// Base entity: handles shadow, physics sprite, hitbox, and lifecycle
export class Entity {
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
        return distance < 60;
    }
}
