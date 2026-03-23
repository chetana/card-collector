import Phaser from 'phaser'
import type { GoogleUser } from '../api/auth'
import type { CollectionData, FlashCard } from '../api/progress'

interface GameSelectSceneData {
  user: GoogleUser
  collection: CollectionData
  cards: FlashCard[]
  meKey: string | null
}

interface GameCard {
  id: string
  emoji: string
  title: string
  localKey: string
  borderColor: number
  sceneKey: string
}

const GAME_CARDS: GameCard[] = [
  { id: 'runner',  emoji: '🏃', title: 'Runner',     localKey: 'best_runner',  borderColor: 0x58c4dc, sceneKey: 'MenuScene' },
  { id: 'snake',   emoji: '🐍', title: 'Snake',      localKey: 'best_snake',   borderColor: 0x4ade80, sceneKey: 'SnakeScene' },
  { id: 'tuktuk',  emoji: '🚗', title: 'Tuk-Tuk',    localKey: 'best_tuktuk',  borderColor: 0xf97316, sceneKey: 'TukTukScene' },
  { id: 'breakout',emoji: '🧱', title: 'Breakout',   localKey: 'best_breakout',borderColor: 0xa78bfa, sceneKey: 'BreakoutScene' },
  { id: 'td',      emoji: '🏯', title: 'Tower Def.', localKey: 'best_td',      borderColor: 0xf59e0b, sceneKey: 'TowerDefenseScene' },
]

export class GameSelectScene extends Phaser.Scene {
  private sceneData!: GameSelectSceneData

  constructor() { super('GameSelectScene') }

  init(data: GameSelectSceneData) {
    this.sceneData = data
  }

  create() {
    const { width, height } = this.scale
    const cx = width / 2

    this.drawBackground(width, height)
    this.drawHeader(cx, height)
    this.drawGameCards(cx, width, height)
    this.drawVillageButton(cx, height)
  }

  private drawBackground(width: number, height: number) {
    const g = this.add.graphics().setDepth(0)
    // Deep space gradient
    g.fillGradientStyle(0x020612, 0x020612, 0x0a0d1f, 0x060916, 1)
    g.fillRect(0, 0, width, height)

    // 80 random stars
    for (let i = 0; i < 80; i++) {
      const sx = Math.random() * width
      const sy = Math.random() * height
      const sr = Math.random() * 1.3 + 0.2
      g.fillStyle(0xffffff, Math.random() * 0.7 + 0.2)
      g.fillCircle(sx, sy, sr)
    }

    // Subtle nebula glow
    g.fillStyle(0x1a0a4a, 0.12)
    g.fillCircle(width * 0.2, height * 0.3, 120)
    g.fillStyle(0x0a2a4a, 0.1)
    g.fillCircle(width * 0.8, height * 0.6, 100)
  }

  private drawHeader(cx: number, height: number) {
    // Arcade title
    this.add.text(cx, height * 0.1, '🎮 ARCADE', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '34px',
      color: '#f5d060',
      stroke: '#2a1a00',
      strokeThickness: 4,
      shadow: { blur: 18, color: '#f5d060', fill: true, offsetX: 0, offsetY: 0 },
    }).setOrigin(0.5).setDepth(10)

    // Subtitle
    this.add.text(cx, height * 0.1 + 44, 'Chet & Lys', {
      fontFamily: 'Georgia, serif',
      fontSize: '13px',
      color: '#ff9eb5',
      fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(10)
  }

  private drawGameCards(cx: number, width: number, height: number) {
    const cardW = Math.min(140, (width - 48) / 3)
    const cardH = 100
    const gap = 12

    // Row 0: 3 cards (runner, snake, tuktuk)
    // Row 1: 2 cards centered (breakout, td)
    const row0Cards = GAME_CARDS.slice(0, 3)
    const row1Cards = GAME_CARDS.slice(3)

    const row0W = 3 * cardW + 2 * gap
    const row1W = row1Cards.length * cardW + (row1Cards.length - 1) * gap
    const startY = height * 0.27

    row0Cards.forEach((card, i) => {
      const cardX = cx - row0W / 2 + i * (cardW + gap)
      this.createCard(card, cardX, startY, cardW, cardH, width, height)
    })

    row1Cards.forEach((card, i) => {
      const cardX = cx - row1W / 2 + i * (cardW + gap)
      this.createCard(card, cardX, startY + cardH + gap, cardW, cardH, width, height)
    })
  }

  private createCard(
    card: GameCard,
    cardX: number, cardY: number,
    cardW: number, cardH: number,
    _width: number, _height: number,
  ) {
    const cx = cardX + cardW / 2
    const cy = cardY + cardH / 2

    // Card background graphics
    const bg = this.add.graphics().setDepth(5)
    const drawCard = (hover: boolean) => {
      bg.clear()
      // Dark panel
      bg.fillStyle(0x0d1a2e, 0.95)
      bg.fillRoundedRect(cardX, cardY, cardW, cardH, 8)
      // Colored border
      bg.lineStyle(2, card.borderColor, hover ? 1.0 : 0.7)
      bg.strokeRoundedRect(cardX, cardY, cardW, cardH, 8)
      // Glow on hover
      if (hover) {
        bg.lineStyle(6, card.borderColor, 0.15)
        bg.strokeRoundedRect(cardX - 2, cardY - 2, cardW + 4, cardH + 4, 10)
      }
    }
    drawCard(false)

    // Emoji
    const emojiText = this.add.text(cx, cardY + 28, card.emoji, {
      fontSize: '28px',
    }).setOrigin(0.5).setDepth(6)

    // Title
    this.add.text(cx, cardY + 58, card.title, {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '13px',
      color: '#e0eaff',
    }).setOrigin(0.5).setDepth(6)

    // Best score
    const best = localStorage.getItem(card.localKey)
    const bestLabel = best ? `${best} pts` : '— pts'
    this.add.text(cx, cardY + 78, bestLabel, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#607090',
    }).setOrigin(0.5).setDepth(6)

    // Interactive zone
    const zone = this.add.zone(cx, cy, cardW, cardH)
      .setInteractive({ useHandCursor: true })
      .setDepth(7)

    const container = { scaleX: 1, scaleY: 1 }

    zone.on('pointerover', () => {
      drawCard(true)
      this.tweens.add({
        targets: [bg, emojiText],
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
        ease: 'Sine.easeOut',
      })
    })

    zone.on('pointerout', () => {
      drawCard(false)
      this.tweens.add({
        targets: [bg, emojiText],
        scaleX: 1,
        scaleY: 1,
        duration: 100,
        ease: 'Sine.easeOut',
      })
    })

    zone.on('pointerdown', () => {
      void container
      this.cameras.main.flash(150, 20, 20, 50)
      this.time.delayedCall(100, () => {
        const data = {
          user: this.sceneData.user,
          collection: this.sceneData.collection,
          cards: this.sceneData.cards,
          meKey: this.sceneData.meKey,
        }
        if (card.sceneKey === 'MenuScene') {
          this.scene.start('MenuScene', { ...data, fromSelect: true })
        } else {
          this.scene.start(card.sceneKey, data)
        }
      })
    })
  }

  private drawVillageButton(cx: number, height: number) {
    const txt = this.add.text(cx, height * 0.92, '← Village', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: '#607090',
    }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true })

    txt.on('pointerover', () => txt.setColor('#a0b8d0'))
    txt.on('pointerout',  () => txt.setColor('#607090'))
    txt.on('pointerdown', () => {
      this.scene.start('VillageScene', {
        user: this.sceneData.user,
        collection: this.sceneData.collection,
        cards: this.sceneData.cards,
        meKey: this.sceneData.meKey,
      })
    })
  }
}
