import Phaser from 'phaser'
import type { GoogleUser } from '../api/auth'
import type { CollectionData, FlashCard } from '../api/progress'

interface MenuSceneData {
  user: GoogleUser
  collection: CollectionData
  cards: FlashCard[]
  meKey: string | null
}

export class MenuScene extends Phaser.Scene {
  private scrollX = 0
  private layer1!: Phaser.GameObjects.TileSprite
  private layer2!: Phaser.GameObjects.TileSprite
  private layer3!: Phaser.GameObjects.TileSprite
  private sceneData!: MenuSceneData
  private stars: { x: number; y: number; r: number; alpha: number }[] = []
  private starsGfx!: Phaser.GameObjects.Graphics

  constructor() { super('MenuScene') }

  init(data: MenuSceneData) {
    this.sceneData = data
  }

  create() {
    const { width, height } = this.scale

    this.generateTextures()
    this.drawStaticSky()
    this.drawStars()

    this.layer1 = this.add.tileSprite(0, 0, width, height, 'bg_far_paris')
      .setOrigin(0, 0).setDepth(1)
    this.layer2 = this.add.tileSprite(0, 0, width, height, 'bg_mid_paris')
      .setOrigin(0, 0).setDepth(2)
    this.layer3 = this.add.tileSprite(0, 0, width, height, 'bg_near_all')
      .setOrigin(0, 0).setDepth(3)

    // Ground
    const gY = height * 0.76
    const groundGfx = this.add.graphics().setDepth(4)
    groundGfx.fillStyle(0x3a3050, 1)
    groundGfx.fillRect(0, gY, width, height - gY)
    groundGfx.fillStyle(0x5a5070, 0.6)
    groundGfx.fillRect(0, gY, width, 2)

    this.buildUI()
  }

  private generateTextures() {
    const { width, height } = this.scale
    const gY = height * 0.76

    // --- Paris far ---
    if (!this.textures.exists('bg_far_paris')) {
      const g = this.make.graphics({ add: false } as any)
      g.fillStyle(0x2a3050, 1)
      const bldgs = [
        { x: 60, w: 70, h: 160 }, { x: 160, w: 55, h: 120 }, { x: 240, w: 90, h: 180 },
        { x: 360, w: 60, h: 140 }, { x: 450, w: 80, h: 170 }, { x: 560, w: 65, h: 130 },
        { x: 650, w: 75, h: 155 }, { x: 730, w: 50, h: 110 },
      ]
      for (const b of bldgs) {
        g.fillStyle(0x2a3050, 1)
        g.fillRect(b.x, gY - b.h, b.w, b.h)
        // Windows
        g.fillStyle(0x6a7898, 0.5)
        for (let wy = gY - b.h + 8; wy < gY - 10; wy += 18) {
          for (let wx = b.x + 6; wx < b.x + b.w - 10; wx += 16) {
            if (Math.random() > 0.35) {
              g.fillStyle(0xffd870, 0.6)
              g.fillRect(wx, wy, 8, 6)
            }
          }
        }
      }
      // Eiffel Tower in center
      drawEiffelTower(g, 800 / 2, gY, 1.4)
      g.generateTexture('bg_far_paris', 800, height)
      g.destroy()
    }

    // --- Paris mid ---
    if (!this.textures.exists('bg_mid_paris')) {
      const g = this.make.graphics({ add: false } as any)
      const midBldgs = [
        { x: 20, w: 50, h: 80 }, { x: 90, w: 40, h: 65 }, { x: 150, w: 55, h: 90 },
        { x: 230, w: 45, h: 75 }, { x: 300, w: 60, h: 85 }, { x: 385, w: 42, h: 70 },
        { x: 450, w: 55, h: 80 }, { x: 525, w: 48, h: 72 },
      ]
      for (const b of midBldgs) {
        g.fillStyle(0x3a4060, 1)
        g.fillRect(b.x, gY - b.h, b.w, b.h)
        g.fillStyle(0xffd870, 0.4)
        for (let wy = gY - b.h + 6; wy < gY - 8; wy += 14) {
          for (let wx = b.x + 4; wx < b.x + b.w - 6; wx += 12) {
            if (Math.random() > 0.5) g.fillRect(wx, wy, 6, 5)
          }
        }
      }
      // Streetlamps
      for (let lx = 40; lx < 560; lx += 90) {
        g.fillStyle(0x5a6080, 1)
        g.fillRect(lx - 1, gY - 38, 3, 38)
        g.fillStyle(0xffd870, 0.8)
        g.fillCircle(lx, gY - 38, 4)
      }
      g.generateTexture('bg_mid_paris', 600, height)
      g.destroy()
    }

    // --- Cambodia far ---
    if (!this.textures.exists('bg_far_cambodia')) {
      const g = this.make.graphics({ add: false } as any)
      drawAngkorWat(g, 400, gY, 1.5)
      // Palm trees
      for (const px of [80, 160, 620, 720]) {
        drawPalmTree(g, px, gY, 1.0)
      }
      g.generateTexture('bg_far_cambodia', 800, height)
      g.destroy()
    }

    // --- Cambodia mid ---
    if (!this.textures.exists('bg_mid_cambodia')) {
      const g = this.make.graphics({ add: false } as any)
      // Jungle bushes
      g.fillStyle(0x1a2a0e, 1)
      for (let bx = 0; bx < 600; bx += 70) {
        const bh = 20 + Math.floor(Math.random() * 25)
        g.fillEllipse(bx + 30, gY - bh / 2, 60, bh)
      }
      // More palm trees
      for (const px of [50, 150, 280, 420, 530]) {
        drawPalmTree(g, px, gY, 0.75)
      }
      g.generateTexture('bg_mid_cambodia', 600, height)
      g.destroy()
    }

    // --- Ocean far ---
    if (!this.textures.exists('bg_far_ocean')) {
      const g = this.make.graphics({ add: false } as any)
      g.fillStyle(0x1a2a4a, 0.5)
      // Clouds as ellipses
      const cloudPos = [{ x: 80, y: gY - 180 }, { x: 220, y: gY - 210 }, { x: 400, y: gY - 195 }, { x: 600, y: gY - 175 }, { x: 730, y: gY - 200 }]
      for (const c of cloudPos) {
        g.fillStyle(0x3a4a6a, 0.6)
        g.fillEllipse(c.x, c.y, 100, 30)
        g.fillEllipse(c.x + 20, c.y - 12, 70, 25)
        g.fillEllipse(c.x - 20, c.y - 8, 60, 20)
      }
      g.generateTexture('bg_far_ocean', 800, height)
      g.destroy()
    }

    // --- Near ground decoration (all zones) ---
    if (!this.textures.exists('bg_near_all')) {
      const g = this.make.graphics({ add: false } as any)
      g.fillStyle(0x4a5070, 0.5)
      for (let rx = 0; rx < 600; rx += 35) {
        const rh = 4 + Math.floor(Math.random() * 8)
        g.fillRect(rx + 4, gY - rh, 12, rh)
        g.fillEllipse(rx + 20, gY - 3, 14, 6)
      }
      g.generateTexture('bg_near_all', 600, height)
      g.destroy()
    }
  }

  private drawStaticSky() {
    const { width, height } = this.scale
    const g = this.add.graphics().setDepth(0)
    g.fillGradientStyle(0x0d1428, 0x0d1428, 0x1a1a5a, 0x2a2060, 1)
    g.fillRect(0, 0, width, height)
  }

  private drawStars() {
    const { width, height } = this.scale
    this.starsGfx = this.add.graphics().setDepth(0).setAlpha(0.8)
    const gY = height * 0.76
    for (let i = 0; i < 60; i++) {
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * gY * 0.9,
        r: Math.random() * 1.2 + 0.3,
        alpha: Math.random() * 0.6 + 0.3,
      })
    }
    this.redrawStars()
    // Twinkle
    this.time.addEvent({
      delay: 120, loop: true, callback: () => {
        for (const s of this.stars) {
          if (Math.random() > 0.85) s.alpha = Math.random() * 0.6 + 0.3
        }
        this.redrawStars()
      },
    })
  }

  private redrawStars() {
    this.starsGfx.clear()
    for (const s of this.stars) {
      this.starsGfx.fillStyle(0xffffff, s.alpha)
      this.starsGfx.fillCircle(s.x, s.y, s.r)
    }
  }

  private buildUI() {
    const { width, height } = this.scale
    const cx = width / 2

    // Title
    this.add.text(cx, height * 0.22, 'Paris → Phnom Penh', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '28px',
      color: '#f5d060',
      stroke: '#2a1a00',
      strokeThickness: 3,
      shadow: { blur: 12, color: '#f5d060', fill: true, offsetX: 0, offsetY: 0 },
    }).setOrigin(0.5).setDepth(10)

    this.add.text(cx, height * 0.32, 'Chet & Lys ❤️', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '16px',
      color: '#ff9eb5',
      stroke: '#2a0010',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(10)

    // Best score
    const best = parseInt(localStorage.getItem('cc_runner_best') ?? '0', 10)
    this.add.text(cx, height * 0.42, best > 0 ? `Meilleur : ${(best / 9274).toFixed(1)} km` : 'Aucun record', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: '#a0c8ff',
    }).setOrigin(0.5).setDepth(10)

    // Play button
    const btnW = 160, btnH = 50
    const btnX = cx - btnW / 2
    const btnY = height * 0.55 - btnH / 2

    const btnBg = this.add.graphics().setDepth(10)
    this.drawBtn(btnBg, cx, height * 0.55, btnW, btnH, false)

    const btnText = this.add.text(cx, height * 0.55, '▶  JOUER', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(11)

    // Hit area
    const hitZone = this.add.zone(cx, height * 0.55, btnW, btnH)
      .setInteractive({ useHandCursor: true })
      .setDepth(12)

    hitZone.on('pointerover', () => {
      btnBg.clear()
      this.drawBtn(btnBg, cx, height * 0.55, btnW, btnH, true)
      btnText.setScale(1.05)
    })
    hitZone.on('pointerout', () => {
      btnBg.clear()
      this.drawBtn(btnBg, cx, height * 0.55, btnW, btnH, false)
      btnText.setScale(1)
    })
    hitZone.on('pointerdown', () => {
      this.cameras.main.flash(200, 30, 20, 60)
      this.time.delayedCall(150, () => {
        this.scene.start('RunnerScene', this.sceneData)
      })
    })

    // Hint
    this.add.text(cx, height * 0.68, 'Tap pour sauter · Évite les obstacles · Collecte les cœurs', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#607090',
      align: 'center',
      wordWrap: { width: width * 0.8 },
    }).setOrigin(0.5).setDepth(10)

    // Back to GameSelect
    const backTxt = this.add.text(cx, height * 0.82, '← Arcade', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: '#607090',
    }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true })
    backTxt.on('pointerover', () => backTxt.setColor('#a0b8d0'))
    backTxt.on('pointerout',  () => backTxt.setColor('#607090'))
    backTxt.on('pointerdown', () => {
      this.scene.start('GameSelectScene', this.sceneData)
    })

    // Version
    void btnX // suppress unused warning
  }

  private drawBtn(g: Phaser.GameObjects.Graphics, cx: number, cy: number, w: number, h: number, hover: boolean) {
    g.fillStyle(hover ? 0x2a1a60 : 0x1a1040, 0.95)
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 12)
    g.lineStyle(2, hover ? 0xf5d060 : 0xa080d0, 1)
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 12)
    if (hover) {
      g.fillStyle(0xf5d060, 0.08)
      g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h * 0.4, { tl: 12, tr: 12, bl: 0, br: 0 })
    }
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000
    this.scrollX += 80 * dt
    if (this.layer1) this.layer1.setTilePosition(this.scrollX * 0.08, 0)
    if (this.layer2) this.layer2.setTilePosition(this.scrollX * 0.22, 0)
    if (this.layer3) this.layer3.setTilePosition(this.scrollX * 0.6, 0)
  }
}

// ── Shared drawing helpers ──────────────────────────────────────────────────

function drawEiffelTower(g: Phaser.GameObjects.Graphics, cx: number, baseY: number, scale: number = 1) {
  const w = 60 * scale, h = 120 * scale
  const ty = baseY - h
  g.fillStyle(0x2a3050, 1)
  // Two diagonal legs
  g.fillTriangle(cx - w / 2, ty + h, cx - w * 0.12, ty + h * 0.65, cx, ty + h * 0.58)
  g.fillTriangle(cx + w / 2, ty + h, cx + w * 0.12, ty + h * 0.65, cx, ty + h * 0.58)
  // First platform
  g.fillRect(cx - w * 0.3, ty + h * 0.62, w * 0.6, h * 0.04)
  // Upper triangle legs
  g.fillTriangle(cx - w * 0.22, ty + h * 0.66, cx - w * 0.08, ty + h * 0.38, cx, ty + h * 0.34)
  g.fillTriangle(cx + w * 0.22, ty + h * 0.66, cx + w * 0.08, ty + h * 0.38, cx, ty + h * 0.34)
  // Second platform
  g.fillRect(cx - w * 0.15, ty + h * 0.32, w * 0.3, h * 0.03)
  // Top spire
  g.fillRect(cx - w * 0.04, ty + h * 0.12, w * 0.08, h * 0.22)
  // Antenna
  g.fillRect(cx - w * 0.015, ty, w * 0.03, h * 0.14)
}

function drawAngkorWat(g: Phaser.GameObjects.Graphics, cx: number, baseY: number, scale: number = 1) {
  const w = 120 * scale, h = 90 * scale
  g.fillStyle(0x2a1a0e, 1)
  // Base platform
  g.fillRect(cx - w / 2, baseY - h * 0.25, w, h * 0.25)
  // Central tower (tallest)
  g.fillRect(cx - w * 0.1, baseY - h, w * 0.2, h * 0.75)
  g.fillTriangle(cx - w * 0.12, baseY - h, cx + w * 0.12, baseY - h, cx, baseY - h * 1.05)
  // Left tower
  g.fillRect(cx - w * 0.38, baseY - h * 0.72, w * 0.14, h * 0.48)
  g.fillTriangle(cx - w * 0.41, baseY - h * 0.72, cx - w * 0.25, baseY - h * 0.72, cx - w * 0.33, baseY - h * 0.77)
  // Right tower
  g.fillRect(cx + w * 0.24, baseY - h * 0.72, w * 0.14, h * 0.48)
  g.fillTriangle(cx + w * 0.22, baseY - h * 0.72, cx + w * 0.38, baseY - h * 0.72, cx + w * 0.31, baseY - h * 0.77)
  // Outer towers (smallest)
  g.fillRect(cx - w * 0.48, baseY - h * 0.55, w * 0.09, h * 0.3)
  g.fillRect(cx + w * 0.39, baseY - h * 0.55, w * 0.09, h * 0.3)
}

function drawPalmTree(g: Phaser.GameObjects.Graphics, x: number, baseY: number, scale: number = 1) {
  g.fillStyle(0x1a2a0e, 1)
  // Trunk
  g.fillRect(x - 4 * scale, baseY - 70 * scale, 8 * scale, 70 * scale)
  // Leaves
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI - Math.PI / 2 + Math.PI * 0.15
    const lx = x + Math.cos(angle) * 32 * scale
    const ly = baseY - 70 * scale + Math.sin(angle) * 32 * scale
    g.fillEllipse(lx, ly, 36 * scale, 10 * scale)
  }
}
