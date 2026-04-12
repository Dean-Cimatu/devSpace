import PreloadScene from './scenes/PreloadScene.js';
import GameScene    from './scenes/GameScene.js';

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
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: [PreloadScene, GameScene]
};

const game = new Phaser.Game(config);
window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight - 50);
});
