import Phaser from 'phaser'
import type { GoogleUser } from '../api/auth'
import type { CollectionData, FlashCard } from '../api/progress'

interface TukTukSceneData {
  user?: GoogleUser
  collection?: CollectionData
  cards?: FlashCard[]
  meKey?: string | null
}

interface Enemy {
  x: number
  y: number
  lane: number
  type: EnemyType
  sprite: Phaser.GameObjects.Image
  active: boolean
  speed: number
  hp: number
}

interface Bullet {
  x: number
  y: number
  gfx: Phaser.GameObjects.Graphics
  active: boolean
}

type EnemyType = 'car' | 'moto' | 'durian' | 'bird'

export class TukTukScene extends Phaser.Scene {
  private sceneData!: TukTukSceneData

  // Layout
  private groundY = 0
  private laneYs: number[] = []   // 3 lanes Y positions

  // Player
  private playerGfx!: Phaser.GameObjects.Image
  private playerY = 0
  private targetY = 0
  private lives = 3
  private invincible = false
  private invincibleTimer = 0

  // Enemies & bullets
  private enemies: Enemy[] = []
  private bullets: Bullet[] = []
  private spawnTimer = 0
  private shootTimer = 0

  // Score / combo
  private score = 0
  private combo = 0
  private comboTimer = 0
  private worldSpeed = 220
  private isAlive = true
  private gameOverShown = false
  private started = false

  // HUD
  private scoreTxt!: Phaser.GameObjects.Text
  private livesTxt!: Phaser.GameObjects.Text
  private speedTxt!: Phaser.GameObjects.Text
  private comboTxt!: Phaser.GameObjects.Text

  // Backgrounds
  private bgFar!: Phaser.GameObjects.TileSprite
  private bgNear!: Phaser.GameObjects.TileSprite
  private road!: Phaser.GameObjects.TileSprite

  constructor() { super('TukTukScene') }

  init(data: TukTukSceneData) {
    this.sceneData = data ?? {}
  }

  create() {
    const { width, height } = this.scale

    // Ground at 80% height, 3 evenly spaced lanes above
    this.groundY = height * 0.80
    const laneTop = height * 0.20
    const laneSpan = this.groundY - laneTop - 40
    this.laneYs = [
      laneTop + laneSpan * 0.10,
      laneTop + laneSpan * 0.45,
      laneTop + laneSpan * 0.85,
    ]

    this.generateTextures(width, height)
    this.drawSky(width, height)
    this.createScrollingLayers(width, height)
    this.drawLaneGuides(width)
    this.createPlayer()
    this.createHUD(width)
    this.setupInput()
    this.showTutorial(width, height)
  }

  // ── Texture generation ────────────────────────────────────────────

  private generateTextures(_width: number, _height: number) {
    if (!this.textures.exists('tt_bg_far')) {
      const g = this.make.graphics({ add: false } as any)
      const buildings = [
        { x: 10, w: 55, h: 90 }, { x: 80, w: 40, h: 110, dome: true },
        { x: 140, w: 60, h: 80 }, { x: 220, w: 35, h: 100, stupa: true },
        { x: 270, w: 50, h: 85 }, { x: 340, w: 45, h: 95, dome: true },
        { x: 400, w: 38, h: 105 }, { x: 450, w: 55, h: 78 },
      ]
      for (const b of buildings) {
        g.fillStyle(0x1a0a2e, 1)
        g.fillRect(b.x, 120 - b.h, b.w, b.h)
        if ((b as any).dome) {
          g.fillStyle(0x1a0a2e, 1)
          g.fillEllipse(b.x + b.w / 2, 120 - b.h, b.w * 0.7, b.w * 0.5)
        }
        if ((b as any).stupa) {
          g.fillStyle(0x1a0a2e, 1)
          g.fillTriangle(b.x + b.w / 2 - 6, 120 - b.h, b.x + b.w / 2 + 6, 120 - b.h, b.x + b.w / 2, 120 - b.h - 30)
        }
      }
      g.generateTexture('tt_bg_far', 500, 120)
      g.destroy()
    }

    if (!this.textures.exists('tt_bg_near')) {
      const g = this.make.graphics({ add: false } as any)
      g.fillStyle(0x0d0520, 1)
      const nbs = [
        { x: 0, w: 70, h: 60 }, { x: 90, w: 55, h: 75 },
        { x: 165, w: 65, h: 55 }, { x: 250, w: 50, h: 70 },
        { x: 320, w: 80, h: 65 },
      ]
      for (const b of nbs) {
        g.fillRect(b.x, 80 - b.h, b.w, b.h)
      }
      g.generateTexture('tt_bg_near', 400, 80)
      g.destroy()
    }

    if (!this.textures.exists('tt_road')) {
      const g = this.make.graphics({ add: false } as any)
      g.fillStyle(0x1a1a1a, 1)
      g.fillRect(0, 0, 800, 60)
      g.fillStyle(0xf5d060, 0.7)
      for (let x = 0; x < 800; x += 60) {
        g.fillRect(x, 27, 36, 5)
      }
      g.generateTexture('tt_road', 800, 60)
      g.destroy()
    }

    if (!this.textures.exists('tt_tuktuk')) {
      const g = this.make.graphics({ add: false } as any)
      g.fillStyle(0xf97316, 1)
      g.fillRoundedRect(4, 5, 62, 32, 6)
      g.fillStyle(0xf5d060, 1)
      g.fillRect(4, 4, 62, 5)
      g.fillStyle(0x7ec8e3, 0.85)
      g.fillRect(42, 10, 20, 18)
      g.fillStyle(0x111111, 1)
      g.fillCircle(18, 40, 10); g.fillCircle(56, 40, 10)
      g.fillStyle(0x555555, 1)
      g.fillCircle(18, 40, 5); g.fillCircle(56, 40, 5)
      // Exhaust pipe
      g.fillStyle(0x888888, 1)
      g.fillRect(0, 22, 6, 4)
      g.generateTexture('tt_tuktuk', 72, 50)
      g.destroy()
    }

    if (!this.textures.exists('tt_car')) {
      const g = this.make.graphics({ add: false } as any)
      g.fillStyle(0xe53e3e, 1)
      g.fillRoundedRect(2, 6, 56, 22, 4)
      g.fillStyle(0x87ceeb, 0.7)
      g.fillRect(6, 8, 14, 10); g.fillRect(36, 8, 14, 10)
      g.fillStyle(0x111111, 1)
      g.fillCircle(12, 30, 7); g.fillCircle(46, 30, 7)
      g.fillStyle(0x444444, 1)
      g.fillCircle(12, 30, 4); g.fillCircle(46, 30, 4)
      g.generateTexture('tt_car', 60, 36)
      g.destroy()
    }

    if (!this.textures.exists('tt_moto')) {
      const g = this.make.graphics({ add: false } as any)
      g.fillStyle(0x3182ce, 1)
      g.fillRoundedRect(5, 10, 36, 14, 3)
      g.fillStyle(0x1a202c, 1)
      g.fillEllipse(32, 8, 14, 12)
      g.fillRect(26, 12, 12, 10)
      g.fillStyle(0x111111, 1)
      g.fillCircle(8, 26, 6); g.fillCircle(38, 26, 6)
      g.fillStyle(0x444444, 1)
      g.fillCircle(8, 26, 3); g.fillCircle(38, 26, 3)
      g.generateTexture('tt_moto', 46, 32)
      g.destroy()
    }

    if (!this.textures.exists('tt_durian')) {
      const g = this.make.graphics({ add: false } as any)
      g.fillStyle(0x86c90a, 1)
      g.fillCircle(22, 22, 18)
      g.fillStyle(0xc8e820, 1)
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        const sx = 22 + Math.cos(a) * 18, sy = 22 + Math.sin(a) * 18
        const ex = 22 + Math.cos(a) * 28, ey = 22 + Math.sin(a) * 28
        g.fillTriangle(sx - 2, sy, sx + 2, sy, ex, ey)
      }
      g.generateTexture('tt_durian', 44, 44)
      g.destroy()
    }

    if (!this.textures.exists('tt_bird')) {
      const g = this.make.graphics({ add: false } as any)
      g.fillStyle(0x8b5cf6, 1)
      g.fillEllipse(20, 14, 24, 12)
      g.fillTriangle(2, 14, 20, 8, 20, 18)
      g.fillTriangle(38, 14, 20, 8, 20, 18)
      g.fillCircle(30, 10, 7)
      g.fillStyle(0xf5d060, 1)
      g.fillTriangle(36, 9, 43, 11, 36, 13)
      g.generateTexture('tt_bird', 48, 28)
      g.destroy()
    }
  }

  // ── Scene layout ──────────────────────────────────────────────────

  private drawSky(width: number, height: number) {
    const g = this.add.graphics().setDepth(0)
    g.fillGradientStyle(0xff6a30, 0xff6a30, 0x5b21b6, 0x3b0764, 1)
    g.fillRect(0, 0, width, this.groundY)
    // Horizon glow
    g.fillGradientStyle(0xff9a5c, 0xff9a5c, 0xff6a30, 0xff6a30, 0.4)
    g.fillRect(0, this.groundY * 0.55, width, 40)
    // Ground
    g.fillStyle(0x232323, 1)
    g.fillRect(0, this.groundY, width, height - this.groundY)
    // Ground edge highlight
    g.fillStyle(0x444444, 1)
    g.fillRect(0, this.groundY, width, 3)
  }

  private createScrollingLayers(width: number, height: number) {
    const farY = this.groundY * 0.30
    this.bgFar = this.add.tileSprite(0, farY - 60, width, 120, 'tt_bg_far')
      .setOrigin(0, 0).setDepth(1)
    this.bgNear = this.add.tileSprite(0, this.groundY - 80, width, 80, 'tt_bg_near')
      .setOrigin(0, 0).setDepth(2)
    this.road = this.add.tileSprite(0, this.groundY, width, 60, 'tt_road')
      .setOrigin(0, 0).setDepth(2)
    void height
  }

  private drawLaneGuides(width: number) {
    const g = this.add.graphics().setDepth(1)
    for (const ly of this.laneYs) {
      // Subtle dashed lane line
      g.lineStyle(1, 0xffffff, 0.07)
      for (let x = 100; x < width; x += 40) {
        g.lineBetween(x, ly, x + 22, ly)
      }
    }
  }

  private createPlayer() {
    this.playerY = this.laneYs[2]   // start on bottom lane
    this.targetY = this.playerY
    this.playerGfx = this.add.image(100, this.playerY, 'tt_tuktuk')
      .setOrigin(0.5, 0.5).setDepth(5)
  }

  private createHUD(width: number) {
    const hudBg = this.add.graphics().setDepth(8)
    hudBg.fillStyle(0x000000, 0.55)
    hudBg.fillRect(0, 0, width, 38)

    this.livesTxt = this.add.text(10, 8, '❤️❤️❤️', { fontSize: '16px' }).setDepth(9)

    this.scoreTxt = this.add.text(width / 2, 8, 'Score: 0', {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: '14px', color: '#f5d060',
    }).setOrigin(0.5, 0).setDepth(9)

    this.speedTxt = this.add.text(width - 10, 8, '220 km/h', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#a0c8ff',
    }).setOrigin(1, 0).setDepth(9)

    this.comboTxt = this.add.text(width / 2, 42, '', {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: '13px', color: '#f97316',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(9).setAlpha(0)
  }

  // ── Tutorial overlay ──────────────────────────────────────────────

  private showTutorial(width: number, height: number) {
    this.started = false
    const cx = width / 2, cy = height / 2

    const bg = this.add.graphics().setDepth(20)
    bg.fillStyle(0x000000, 0.72)
    bg.fillRoundedRect(cx - 150, cy - 110, 300, 220, 14)
    bg.lineStyle(2, 0xf97316, 0.9)
    bg.strokeRoundedRect(cx - 150, cy - 110, 300, 220, 14)

    const title = this.add.text(cx, cy - 82, '🚗  TUK-TUK SHOOTER', {
      fontFamily: 'Cinzel, serif', fontSize: '15px', color: '#f5d060',
    }).setOrigin(0.5).setDepth(21)

    const lines = [
      '👆 Glisse le doigt (ou la souris)',
      '   pour changer de lane',
      '',
      '🔫 Tu tires automatiquement',
      '',
      '💥 Évite les ennemis',
      '   ou tire dessus pour scorer',
    ]
    const body = this.add.text(cx, cy - 28, lines.join('\n'), {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#e0e0e0',
      align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0).setDepth(21)

    const btnBg = this.add.graphics().setDepth(21)
    btnBg.fillStyle(0xf97316, 1)
    btnBg.fillRoundedRect(cx - 70, cy + 82, 140, 36, 10)

    const btnTxt = this.add.text(cx, cy + 100, '▶  JOUER', {
      fontFamily: 'Cinzel, serif', fontSize: '14px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(22)

    const zone = this.add.zone(cx, cy + 100, 140, 36).setInteractive({ useHandCursor: true }).setDepth(23)
    zone.on('pointerover', () => btnTxt.setScale(1.07))
    zone.on('pointerout',  () => btnTxt.setScale(1))
    zone.on('pointerdown', () => {
      ;[bg, btnBg].forEach(o => o.destroy())
      ;[title, body, btnTxt].forEach(o => o.destroy())
      zone.destroy()
      this.started = true
    })
  }

  // ── Input ─────────────────────────────────────────────────────────

  private setupInput() {
    // Follow pointer Y directly — most intuitive on mobile
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.started || !this.isAlive || this.gameOverShown) return
      this.targetY = Phaser.Math.Clamp(p.y, this.laneYs[0] - 20, this.laneYs[2] + 20)
    })

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.started || !this.isAlive || this.gameOverShown) return
      this.targetY = Phaser.Math.Clamp(p.y, this.laneYs[0] - 20, this.laneYs[2] + 20)
    })

    // Keyboard: snap to lanes
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (!this.started || !this.isAlive) return
      const cur = this.closestLane(this.playerY)
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        this.targetY = this.laneYs[Math.max(0, cur - 1)]
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        this.targetY = this.laneYs[Math.min(2, cur + 1)]
      }
    })
  }

  private closestLane(y: number): number {
    let best = 0, bestDist = Infinity
    this.laneYs.forEach((ly, i) => {
      const d = Math.abs(ly - y)
      if (d < bestDist) { bestDist = d; best = i }
    })
    return best
  }

  // ── Main loop ─────────────────────────────────────────────────────

  update(_time: number, delta: number) {
    if (!this.started || !this.isAlive || this.gameOverShown) return

    const dt = delta / 1000
    this.worldSpeed = Math.min(480, 220 + this.score * 0.25)

    // Scroll backgrounds
    this.bgFar.tilePositionX  += this.worldSpeed * 0.10 * dt
    this.bgNear.tilePositionX += this.worldSpeed * 0.38 * dt
    this.road.tilePositionX   += this.worldSpeed * dt

    // Smooth player Y (fast follow)
    const dy = this.targetY - this.playerGfx.y
    this.playerGfx.y += dy * Math.min(1, 10 * dt)

    // Tuk-tuk slight tilt based on movement direction
    this.playerGfx.angle = Phaser.Math.Clamp(dy * 0.18, -8, 8)

    // Invincibility blink
    if (this.invincible) {
      this.invincibleTimer -= delta
      this.playerGfx.alpha = Math.sin(this.invincibleTimer * 0.015) > 0 ? 1 : 0.25
      if (this.invincibleTimer <= 0) { this.invincible = false; this.playerGfx.alpha = 1 }
    }

    // Combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= delta
      if (this.comboTimer <= 0) {
        this.combo = 0
        this.comboTxt.setAlpha(0)
      }
    }

    // Shoot
    this.shootTimer -= delta
    if (this.shootTimer <= 0) {
      this.shootTimer = 260
      this.spawnBullet()
    }

    // Spawn enemies
    this.spawnTimer -= delta
    if (this.spawnTimer <= 0) {
      const minDelay = Math.max(380, 900 - this.score * 1.8)
      this.spawnTimer = minDelay + Math.random() * 350
      this.spawnEnemy()
    }

    this.updateBullets(dt)
    this.updateEnemies(dt)

    // HUD update
    this.scoreTxt.setText(`Score: ${this.score}`)
    this.speedTxt.setText(`${Math.round(this.worldSpeed)} km/h`)
  }

  // ── Bullets ───────────────────────────────────────────────────────

  private spawnBullet() {
    if (this.bullets.filter(b => b.active).length >= 8) return

    const g = this.add.graphics().setDepth(6)
    const bx = 132, by = this.playerGfx.y - 2

    // Bullet: orange elongated oval with trail
    g.fillStyle(0xff8c00, 1)
    g.fillEllipse(0, 0, 18, 7)
    g.fillStyle(0xffd700, 0.7)
    g.fillEllipse(-8, 0, 8, 4)
    g.x = bx; g.y = by

    this.bullets.push({ x: bx, y: by, gfx: g, active: true })
  }

  private updateBullets(dt: number) {
    const { width } = this.scale
    for (const b of this.bullets) {
      if (!b.active) continue
      b.x += 620 * dt
      b.gfx.x = b.x
      if (b.x > width + 30) {
        b.active = false; b.gfx.destroy()
      }
    }
  }

  // ── Enemies ───────────────────────────────────────────────────────

  private spawnEnemy() {
    const { width } = this.scale
    const ENEMY_TYPES: EnemyType[] = ['car', 'moto', 'durian', 'bird']
    const type = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)]

    // Birds on lane 0, cars/motos on lane 2, durians on any
    let lane: number
    if (type === 'bird') lane = 0
    else if (type === 'car') lane = 2
    else if (type === 'moto') lane = Math.random() < 0.6 ? 2 : 1
    else lane = Math.floor(Math.random() * 3)

    const y = this.laneYs[lane]

    const sprite = this.add.image(width + 40, y, `tt_${type}`)
      .setOrigin(0.5, 0.5).setDepth(4).setFlipX(true)

    // Scale: birds smaller, cars bigger
    const scaleMap: Record<EnemyType, number> = { car: 1.1, moto: 0.95, durian: 0.9, bird: 0.85 }
    sprite.setScale(scaleMap[type])

    // Entrance animation
    sprite.setScale(0.1)
    this.tweens.add({ targets: sprite, scaleX: scaleMap[type], scaleY: scaleMap[type], duration: 220, ease: 'Back.easeOut' })

    const hp = type === 'car' ? 2 : 1

    this.enemies.push({
      x: width + 40, y, lane, type, sprite, active: true,
      speed: this.worldSpeed + 40 + Math.random() * 50,
      hp,
    })
  }

  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (!e.active) continue

      e.x -= e.speed * dt
      e.sprite.x = e.x

      // Slight wobble for durian and bird
      if (e.type === 'durian') {
        e.sprite.y = e.y + Math.sin(e.x * 0.04) * 8
      } else if (e.type === 'bird') {
        e.sprite.y = e.y + Math.sin(e.x * 0.06) * 12
      }

      // Bullet collision
      for (const b of this.bullets) {
        if (!b.active) continue
        if (Math.abs(b.x - e.x) < 38 && Math.abs(b.y - e.sprite.y) < 28) {
          b.active = false; b.gfx.destroy()
          e.hp--
          if (e.hp <= 0) {
            this.destroyEnemy(e)
            this.addScore()
          } else {
            // Flash on damage
            this.tweens.add({ targets: e.sprite, alpha: 0.3, duration: 80, yoyo: true })
          }
          break
        }
      }

      if (!e.active) continue

      // Enemy past player → check hit
      if (e.x < 130) {
        if (Math.abs(e.sprite.y - this.playerGfx.y) < 32) {
          this.hitPlayer()
          this.destroyEnemy(e)
        } else if (e.x < -80) {
          this.destroyEnemy(e)
        }
      }
    }

    // Clean up
    this.enemies = this.enemies.filter(e => e.active)
    this.bullets = this.bullets.filter(b => b.active)
  }

  private addScore() {
    this.combo++
    this.comboTimer = 1800
    const pts = 10 * Math.max(1, this.combo)
    this.score += pts

    // Show combo
    if (this.combo >= 2) {
      this.comboTxt.setText(`x${this.combo} COMBO !  +${pts}`)
      this.comboTxt.setAlpha(1)
      this.tweens.add({ targets: this.comboTxt, scaleX: 1.15, scaleY: 1.15, duration: 120, yoyo: true })
    }
  }

  private destroyEnemy(e: Enemy) {
    e.active = false
    this.spawnExplosion(e.x, e.sprite.y)
    this.tweens.add({
      targets: e.sprite, alpha: 0, scaleX: 1.6, scaleY: 1.6,
      duration: 180, ease: 'Sine.easeOut',
      onComplete: () => e.sprite.destroy(),
    })
  }

  private spawnExplosion(x: number, y: number) {
    const colors = [0xff8c00, 0xffd700, 0xff4500, 0xffffff]
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.5
      const speed = 60 + Math.random() * 80
      const g = this.add.graphics().setDepth(7)
      g.fillStyle(colors[i % colors.length], 1)
      g.fillCircle(0, 0, 4 + Math.random() * 3)
      g.x = x; g.y = y
      this.tweens.add({
        targets: g,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0, scaleX: 0.2, scaleY: 0.2,
        duration: 300 + Math.random() * 150,
        ease: 'Sine.easeOut',
        onComplete: () => g.destroy(),
      })
    }
  }

  private hitPlayer() {
    if (this.invincible) return
    this.lives--
    this.combo = 0
    this.comboTxt.setAlpha(0)
    this.updateLivesHUD()

    if (this.lives <= 0) { this.doGameOver(); return }

    this.invincible = true
    this.invincibleTimer = 2200
    this.cameras.main.shake(200, 0.012)
    this.cameras.main.flash(200, 100, 0, 0)
  }

  private updateLivesHUD() {
    this.livesTxt.setText('❤️'.repeat(Math.max(0, this.lives)))
  }

  // ── Game over ─────────────────────────────────────────────────────

  private doGameOver() {
    this.isAlive = false
    const prev = parseInt(localStorage.getItem('best_tuktuk') ?? '0', 10)
    if (this.score > prev) localStorage.setItem('best_tuktuk', String(this.score))
    this.cameras.main.shake(400, 0.018)
    this.cameras.main.flash(500, 80, 0, 0)
    this.time.delayedCall(600, () => this.showGameOver())
  }

  private showGameOver() {
    this.gameOverShown = true
    const { width, height } = this.scale
    const cx = width / 2, cy = height / 2

    const bg = this.add.graphics().setDepth(15)
    bg.fillStyle(0x000000, 0.80)
    bg.fillRect(0, 0, width, height)

    this.add.text(cx, cy - 80, 'GAME OVER', {
      fontFamily: 'Cinzel, serif', fontSize: '34px', color: '#ff6b6b',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(16)

    const best = localStorage.getItem('best_tuktuk') ?? '0'
    this.add.text(cx, cy - 32, `Score : ${this.score}`, {
      fontFamily: 'Cinzel, serif', fontSize: '20px', color: '#f5d060',
    }).setOrigin(0.5).setDepth(16)

    this.add.text(cx, cy + 2, `Record : ${best}`, {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#aaa',
    }).setOrigin(0.5).setDepth(16)

    if (this.score > 0 && this.score >= parseInt(best, 10)) {
      this.add.text(cx, cy + 22, '🏆 Nouveau record !', {
        fontFamily: 'sans-serif', fontSize: '13px', color: '#ffd700',
      }).setOrigin(0.5).setDepth(16)
    }

    this.makeBtn(cx, cy + 60, '▶  REJOUER', 0x7c2d12, 0xf97316, () => {
      this.scene.restart(this.sceneData)
    })
    this.makeBtn(cx, cy + 112, '← Retour', 0x0a1020, 0x406080, () => {
      this.scene.start('GameSelectScene', this.sceneData)
    })
  }

  private makeBtn(cx: number, cy: number, label: string, bg: number, border: number, cb: () => void) {
    const w = 200, h = 44
    const g = this.add.graphics().setDepth(16)
    g.fillStyle(bg, 0.95)
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 10)
    g.lineStyle(2, border, 0.9)
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 10)
    const txt = this.add.text(cx, cy, label, {
      fontFamily: 'Cinzel, serif', fontSize: '15px', color: '#fff',
    }).setOrigin(0.5).setDepth(17)
    const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true }).setDepth(18)
    zone.on('pointerover', () => txt.setScale(1.06))
    zone.on('pointerout',  () => txt.setScale(1))
    zone.on('pointerdown', () => { this.cameras.main.flash(120, 20, 20, 50); this.time.delayedCall(80, cb) })
  }
}
