// Loads all game assets then starts GameScene
export default class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload() {
        const { width, height } = this.cameras.main;
        const bg          = this.add.rectangle(width / 2, height / 2, width, height, 0x000000);
        const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading Colosseum Fighters...', {
            fontSize: '24px', fill: '#ffffff', fontFamily: '"Pickyside", monospace'
        }).setOrigin(0.5);
        const barBg = this.add.rectangle(width / 2, height / 2, 400, 20, 0x333333);
        const bar   = this.add.rectangle(width / 2 - 200, height / 2, 0, 20, 0x00ff00).setOrigin(0, 0.5);
        const pct   = this.add.text(width / 2, height / 2 + 40, '0%', {
            fontSize: '18px', fill: '#ffffff', fontFamily: '"Pickyside", monospace'
        }).setOrigin(0.5);

        this.load.on('progress', v => { bar.width = 400 * v; pct.setText(Math.round(v * 100) + '%'); });
        this.load.on('complete', () => { bg.destroy(); loadingText.destroy(); barBg.destroy(); bar.destroy(); pct.destroy(); });

        // Background
        this.load.image('grass', '/assets/background/bgtile.png');

        // Audio
        this.load.audio('sfx_gameover', '/assets/soundEffects/gameOver.mp3');
        this.load.audio('bgm_game',     '/assets/music/retro-gaming-271301.mp3');

        // Player sprites
        for (let i = 0; i < 8;  i++) this.load.image(`idle_${i}`,  `/assets/player/Idle/HeroKnight_Idle_${i}.png`);
        for (let i = 0; i < 10; i++) this.load.image(`run_${i}`,   `/assets/player/Run/HeroKnight_Run_${i}.png`);
        for (let i = 0; i < 10; i++) this.load.image(`death_${i}`, `/assets/player/Death/HeroKnight_Death_${i}.png`);

        // Enemies
        const enemies = [
            'lereon_knight', 'baby_dragon', 'bat', 'big_skeleton', 'burning_demon_imp',
            'burning_demon', 'death_angel', 'legendary_dragon', 'orc', 'skeleton_king',
            'skeleton_sword', 'slime', 'snake', 'spider', 'viking_warrior', 'werewolf', 'wolf', 'worm'
        ];
        enemies.forEach(e => this.load.image(e, `/assets/enemies/${e.replace(/_/g, ' ')}.png`));

        // Items
        const berries = ['berry01blue','berry02yellow','berry03purple','berry04red'];
        const gems    = ['gem01orange','gem02blue','gem03yellow','gem04purple','gem05red','gem06green'];
        const glasses = ['glass01orange','glass02blue','glass03yellow','glass04purple','glass05red','glass06green'];
        const extras  = ['blueshroom','bongo','bottle','clock','crown','diamond','goldencup','lantern'];
        [...berries, ...gems, ...glasses].forEach(k => this.load.image(k, `/assets/items/${k}.gif`));
        const extraFiles = { blueshroom:'BlueShroom',bongo:'Bongo',bottle:'Bottle',clock:'Clock',crown:'Crown',diamond:'Diamond',goldencup:'GoldenCup',lantern:'Lantern' };
        extras.forEach(k => this.load.image(k, `/assets/items/${extraFiles[k]}.png`));

        // Weapon icon overrides (item sprites used for some weapons)
        this.load.image('weapon_shield_icon', '/assets/items/MetalShield.png');
        this.load.image('weapon_torch_icon',  '/assets/items/Flashlight.png');
        this.load.image('weapon_stone_icon',  '/assets/items/SnowBall.png');

        // Weapons
        this.load.image('weapon_crystalsword', '/assets/weapons/weapon01crystalsword.gif');
        this.load.image('weapon_dagger',       '/assets/weapons/weapon02dagger.gif');
        this.load.image('weapon_longsword',    '/assets/weapons/weapon03longsword.gif');
        this.load.image('weapon_flail',        '/assets/weapons/weapon04rustyflail.gif');
        this.load.image('weapon_doubleaxe',    '/assets/weapons/weapon05doubleaxe.gif');
        this.load.image('weapon_bow',          '/assets/weapons/weapon06bow.gif');
        this.load.image('weapon_spear',        '/assets/weapons/weapon07spear.gif');
        this.load.image('magic_crystalwand',   '/assets/weapons/magic01crystalwand.gif');
        this.load.image('magic_spellbook',     '/assets/weapons/magic02spellbook.gif');
        this.load.image('magic_orb',           '/assets/weapons/magic03orb.gif');
        this.load.image('magic_ring',          '/assets/weapons/magic04ring.gif');
        this.load.image('magic_wand',          '/assets/weapons/magic05wand.gif');

        // Effect spritesheets
        this.load.spritesheet('weaponhit_effect', '/assets/effects/10_weaponhit_spritesheet.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('fire_effect',      '/assets/effects/11_fire_spritesheet.png',      { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('magic_effect',     '/assets/effects/1_magicspell_spritesheet.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('bluefire_effect',  '/assets/effects/3_bluefire_spritesheet.png',   { frameWidth: 64, frameHeight: 64 });
    }

    create() {
        this.scene.start('GameScene');
    }
}
