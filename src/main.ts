import Phaser from 'phaser'
import { LoadScene } from './scenes/LoadScene'
import { VillageScene } from './scenes/VillageScene'
import { PackScene } from './scenes/PackScene'
import { CollectionScene } from './scenes/CollectionScene'
import { VersusScene } from './scenes/VersusScene'
import { MenuScene } from './scenes/MenuScene'
import { RunnerScene } from './scenes/RunnerScene'
import { GameOverScene } from './scenes/GameOverScene'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#0d0d1a',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [LoadScene, VillageScene, PackScene, CollectionScene, VersusScene, MenuScene, RunnerScene, GameOverScene],
  audio: {
    noAudio: true,
  },
  render: {
    antialias: true,
    roundPixels: false,
  },
  dom: {
    createContainer: true,
  },
}

new Phaser.Game(config)
