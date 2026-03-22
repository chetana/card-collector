import Phaser from 'phaser'
import { LoadScene } from './scenes/LoadScene'
import { VillageScene } from './scenes/VillageScene'
import { PackScene } from './scenes/PackScene'
import { CollectionScene } from './scenes/CollectionScene'
import { VersusScene } from './scenes/VersusScene'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#0d0d1a',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [LoadScene, VillageScene, PackScene, CollectionScene, VersusScene],
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
