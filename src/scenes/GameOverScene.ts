import Phaser from 'phaser'
import type { GoogleUser } from '../api/auth'
import type { CollectionData, FlashCard } from '../api/progress'

interface GameOverSceneData {
  user: GoogleUser
  collection: CollectionData
  cards: FlashCard[]
  meKey: string | null
  score: number
  distance: number
  heartsCollected: number
  reachedCambodia: boolean
}

export class GameOverScene extends Phaser.Scene {
  private sceneData!: GameOverSceneData

  constructor() { super('GameOverScene') }

  init(data: GameOverSceneData) {
    this.sceneData = data
  }

  create() {
    const { width, height } = this.scale
    const cx = width / 2
    const { score, distance, heartsCollected, reachedCambodia } = this.sceneData

    const isNewBest = this.checkAndSaveBest(distance)

    // Background
    this.drawBackground()

    // Particles
    this.spawnParticles()

    // Title
    const titleText = reachedCambodia ? '🛕 ARRIVÉE !' : 'GAME OVER'
    const titleColor = reachedCambodia ? '#f5d060' : '#ff6b6b'

    this.add.text(cx, height * 0.15, titleText, {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '36px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 4,
      shadow: { blur: 16, color: titleColor, fill: true, offsetX: 0, offsetY: 0 },
    }).setOrigin(0.5).setDepth(10)

    if (reachedCambodia) {
      this.add.text(cx, height * 0.25, 'Tu es arrivé(e) à Phnom Penh ! ❤️', {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        color: '#ff9eb5',
        stroke: '#2a0010',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(10)
    }

    // Stats card
    const cardY = height * 0.38
    const cardH = 140
    const g = this.add.graphics().setDepth(9)
    g.fillStyle(0x0a0a1a, 0.85)
    g.fillRoundedRect(cx - 150, cardY, 300, cardH, 14)
    g.lineStyle(1, 0x4040a0, 0.6)
    g.strokeRoundedRect(cx - 150, cardY, 300, cardH, 14)

    const km = (distance / 9274).toFixed(1)
    const statsLines = [
      { label: 'Distance', value: `${km} km` },
      { label: 'Cœurs collectés', value: `${heartsCollected} ❤️` },
      { label: 'Score', value: String(score) },
    ]
    statsLines.forEach((s, i) => {
      const lineY = cardY + 22 + i * 36
      this.add.text(cx - 130, lineY, s.label, {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#8090b0',
      }).setDepth(11)
      this.add.text(cx + 130, lineY, s.value, {
        fontFamily: 'Cinzel, sans-serif', fontSize: '14px', color: '#e0eaff',
      }).setOrigin(1, 0).setDepth(11)
    })

    // Best score
    const best = parseInt(localStorage.getItem('cc_runner_best') ?? '0', 10)
    const bestKm = (best / 9274).toFixed(1)
    const bestColor = isNewBest ? '#f5d060' : '#607090'
    const bestLabel = isNewBest ? '🏆 Nouveau record !' : `Record : ${bestKm} km`
    this.add.text(cx, cardY + cardH + 14, bestLabel, {
      fontFamily: 'sans-serif', fontSize: '12px', color: bestColor,
    }).setOrigin(0.5, 0).setDepth(10)

    if (isNewBest) {
      this.tweens.add({
        targets: this.add.text(cx, cardY + cardH + 14, bestLabel, {
          fontFamily: 'sans-serif', fontSize: '12px', color: bestColor,
        }).setOrigin(0.5, 0).setDepth(10),
        scaleX: 1.08, scaleY: 1.08,
        duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
    }

    // Buttons
    const btnY1 = height * 0.72
    const btnY2 = height * 0.84

    this.makeButton(cx, btnY1, '▶  REJOUER', 0x1a1040, 0xa080d0, () => {
      this.scene.start('RunnerScene', {
        user: this.sceneData.user,
        collection: this.sceneData.collection,
        cards: this.sceneData.cards,
        meKey: this.sceneData.meKey,
      })
    })

    this.makeButton(cx, btnY2, '← Menu', 0x0a1020, 0x406080, () => {
      this.scene.start('MenuScene', {
        user: this.sceneData.user,
        collection: this.sceneData.collection,
        cards: this.sceneData.cards,
        meKey: this.sceneData.meKey,
      })
    })
  }

  private checkAndSaveBest(distance: number): boolean {
    const prev = parseInt(localStorage.getItem('cc_runner_best') ?? '0', 10)
    const isBest = distance > prev
    // Best is already saved by RunnerScene, but update if needed
    if (isBest) {
      localStorage.setItem('cc_runner_best', String(Math.floor(distance)))
    }
    return isBest
  }

  private drawBackground() {
    const { width, height } = this.scale
    const g = this.add.graphics().setDepth(0)
    g.fillGradientStyle(0x050510, 0x050510, 0x0a0a2a, 0x150a25, 1)
    g.fillRect(0, 0, width, height)

    // Subtle grid
    g.lineStyle(0.5, 0x1a1a4a, 0.2)
    for (let x = 0; x < width; x += 30) g.lineBetween(x, 0, x, height)
    for (let y = 0; y < height; y += 30) g.lineBetween(0, y, width, y)

    // Stars
    g.fillStyle(0xffffff, 1)
    for (let i = 0; i < 50; i++) {
      const sx = Math.random() * width
      const sy = Math.random() * height
      const sr = Math.random() * 1.2 + 0.2
      g.fillStyle(0xffffff, Math.random() * 0.6 + 0.2)
      g.fillCircle(sx, sy, sr)
    }
  }

  private spawnParticles() {
    if (!this.textures.exists('particle_dot')) return
    const { width, height } = this.scale

    // Ambient floating particles
    this.add.particles(width / 2, height / 2, 'particle_dot', {
      x: { min: 0, max: width },
      y: { min: 0, max: height },
      speedY: { min: -20, max: -5 },
      speedX: { min: -10, max: 10 },
      scale: { start: 0.2, end: 0 },
      lifespan: { min: 2000, max: 4000 },
      quantity: 1,
      frequency: 80,
      tint: [0xff6b9d, 0xf5d060, 0x80c8ff],
    }).setDepth(1)
  }

  private makeButton(
    cx: number, cy: number,
    label: string,
    bgColor: number,
    borderColor: number,
    onClick: () => void,
  ) {
    const w = 200, h = 46

    const bg = this.add.graphics().setDepth(10)
    const drawBg = (hover: boolean) => {
      bg.clear()
      bg.fillStyle(hover ? bgColor + 0x101020 : bgColor, 0.95)
      bg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 12)
      bg.lineStyle(2, hover ? 0xffffff : borderColor, hover ? 0.9 : 0.7)
      bg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 12)
    }
    drawBg(false)

    const txt = this.add.text(cx, cy, label, {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(11)

    const zone = this.add.zone(cx, cy, w, h)
      .setInteractive({ useHandCursor: true })
      .setDepth(12)

    zone.on('pointerover', () => { drawBg(true); txt.setScale(1.04) })
    zone.on('pointerout',  () => { drawBg(false); txt.setScale(1) })
    zone.on('pointerdown', () => {
      this.cameras.main.flash(150, 20, 20, 50)
      this.time.delayedCall(100, onClick)
    })
  }
}
