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
  type: EnemyType
  sprite: Phaser.GameObjects.Image
  active: boolean
  speed: number
}

interface Bullet {
  x: number
  y: number
  gfx: Phaser.GameObjects.Graphics
  active: boolean
}

type EnemyType = 'car' | 'moto' | 'durian' | 'bird'

const ENEMY_TYPES: EnemyType[] = ['car', 'moto', 'durian', 'bird']

export class TukTukScene extends Phaser.Scene {
  private sceneData!: TukTukSceneData

  // Layout
  private groundY = 0
  private skyBottomY = 0
  private playfieldTop = 0
  private playfieldBottom = 0

  // Player
  private playerGfx!: Phaser.GameObjects.Image
  private playerY = 0
  private targetY = 0
  private lives = 3
  private invincible = false
  private invincibleTimer = 0

  // Enemies
  private enemies: Enemy[] = []
  private spawnTimer = 0
  private nextSpawnDelay = 1200

  // Bullets
  private bullets: Bullet[] = []
  private shootTimer = 0

  // Score / speed
  private score = 0
  private worldSpeed = 200
  private isAlive = true

  // HUD
  private scoreTxt!: Phaser.GameObjects.Text
  private livesTxt!: Phaser.GameObjects.Text
  private speedTxt!: Phaser.GameObjects.Text

  // Backgrounds
  private bgFar!: Phaser.GameObjects.TileSprite
  private bgNear!: Phaser.GameObjects.TileSprite
  private road!: Phaser.GameObjects.TileSprite

  // Overlay
  private overlayGfx!: Phaser.GameObjects.Graphics
  private overlayTxts: Phaser.GameObjects.Text[] = []
  private gameOverShown = false

  constructor() { super('TukTukScene') }

  init(data: TukTukSceneData) {
    this.sceneData = data ?? {}
  }

  create() {
    const { width, height } = this.scale

    this.groundY = height * 0.78
    this.skyBottomY = height * 0.35
    this.playfieldTop = this.skyBottomY + 10
    this.playfieldBottom = this.groundY - 10

    this.generateTextures(width, height)
    this.drawSky(width, height)
    this.createScrollingLayers(width, height)
    this.createPlayer(height)
    this.createHUD(width)
    this.setupInput(height)

    this.isAlive = true
    this.score = 0
    this.lives = 3
    this.worldSpeed = 200
    this.spawnTimer = 0
    this.shootTimer = 0
    this.enemies = []
    this.bullets = []
  }

  private generateTextures(width: number, height: number) {
    // Far buildings
    if (!this.textures.exists('tt_bg_far')) {
      const g = this.make.graphics({ add: false } as any)
      g.fillStyle(0x1a0a2e, 1)
      const buildings = [
        { x: 10, w: 55, h: 90 }, { x: 80, w: 40, h: 110, dome: true },
        { x: 140, w: 60, h: 80 }, { x: 220, w: 35, h: 100, stupa: true },
        { x: 270, w: 50, h: 85 }, { x: 340, w: 45, h: 95, dome: true },
        { x: 400, w: 38, h: 105 }, { x: 450, w: 55, h: 78 },
      ]
      const baseY = 120
      for (const b of buildings) {
        g.fillStyle(0x1a0a2e, 1)
        g.fillRect(b.x, baseY - b.h, b.w, b.h)
        if ((b as any).dome) {
          g.fillEllipse(b.x + b.w / 2, baseY - b.h, b.w * 0.7, b.w * 0.5)
        }
        if ((b as any).stupa) {
          g.fillTriangle(b.x + b.w / 2 - 6, baseY - b.h, b.x + b.w / 2 + 6, baseY - b.h, b.x + b.w / 2, baseY - b.h - 30)
        }
      }
      g.generateTexture('tt_bg_far', 500, 120)
      g.destroy()
    }

    // Near buildings
    if (!this.textures.exists('tt_bg_near')) {
      const g = this.make.graphics({ add: false } as any)
      g.fillStyle(0x0d0520, 1)
      const nBuildings = [
        { x: 0, w: 70, h: 60 }, { x: 90, w: 55, h: 75 },
        { x: 165, w: 65, h: 55 }, { x: 250, w: 50, h: 70 },
        { x: 320, w: 80, h: 65 },
      ]
      for (const b of nBuildings) {
        g.fillStyle(0x0d0520, 1)
        g.fillRect(b.x, 80 - b.h, b.w, b.h)
      }
      g.generateTexture('tt_bg_near', 400, 80)
      g.destroy()
    }

    // Road
    if (!this.textures.exists('tt_road')) {
      const g = this.make.graphics({ add: false } as any)
      g.fillStyle(0x1a1a1a, 1)
      g.fillRect(0, 0, 800, 60)
      // Center yellow dashes
      g.fillStyle(0xf5d060, 0.8)
      for (let x = 0; x < 800; x += 60) {
        g.fillRect(x, 28, 36, 4)
      }
      g.generateTexture('tt_road', 800, 60)
      g.destroy()
    }

    // Tuk-tuk player texture
    if (!this.textures.exists('tt_tuktuk')) {
      const g = this.make.graphics({ add: false } as any)
      // Body
      g.fillStyle(0xf97316, 1)
      g.fillRoundedRect(4, 6, 60, 30, 5)
      // Roof trim
      g.fillStyle(0xf5d060, 1)
      g.fillRect(4, 5, 60, 4)
      // Windshield
      g.fillStyle(0x87ceeb, 0.8)
      g.fillRect(40, 10, 18, 16)
      // Wheels
      g.fillStyle(0x111111, 1)
      g.fillCircle(18, 38, 9)
      g.fillCircle(56, 38, 9)
      g.fillStyle(0x444444, 1)
      g.fillCircle(18, 38, 5)
      g.fillCircle(56, 38, 5)
      g.generateTexture('tt_tuktuk', 70, 46)
      g.destroy()
    }

    // Enemy textures
    if (!this.textures.exists('tt_car')) {
      const g = this.make.graphics({ add: false } as any)
      g.fillStyle(0xe53e3e, 1)
      g.fillRoundedRect(0, 8, 58, 22, 4)
      g.fillStyle(0x87ceeb, 0.7)
      g.fillRect(4, 10, 16, 10)
      g.fillRect(38, 10, 16, 10)
      g.fillStyle(0x111111, 1)
      g.fillCircle(12, 30, 7); g.fillCircle(46, 30, 7)
      g.fillStyle(0x333333, 1)
      g.fillCircle(12, 30, 4); g.fillCircle(46, 30, 4)
      g.generateTexture('tt_car', 60, 36)
      g.destroy()
    }

    if (!this.textures.exists('tt_moto')) {
      const g = this.make.graphics({ add: false } as any)
      g.fillStyle(0x3182ce, 1)
      g.fillRoundedRect(5, 10, 36, 14, 3)
      // Rider silhouette
      g.fillStyle(0x1a202c, 1)
      g.fillEllipse(32, 8, 14, 12)
      g.fillRect(26, 12, 12, 10)
      g.fillStyle(0x111111, 1)
      g.fillCircle(8, 24, 6); g.fillCircle(38, 24, 6)
      g.fillStyle(0x333333, 1)
      g.fillCircle(8, 24, 3); g.fillCircle(38, 24, 3)
      g.generateTexture('tt_moto', 46, 30)
      g.destroy()
    }

    if (!this.textures.exists('tt_durian')) {
      const g = this.make.graphics({ add: false } as any)
      g.fillStyle(0x9ae600, 1)
      g.fillCircle(24, 24, 20)
      g.fillStyle(0xd4ef10, 1)
      // Spikes
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2
        const sx = 24 + Math.cos(angle) * 20
        const sy = 24 + Math.sin(angle) * 20
        const sx2 = 24 + Math.cos(angle) * 28
        const sy2 = 24 + Math.sin(angle) * 28
        g.fillTriangle(sx - 3, sy, sx + 3, sy, sx2, sy2)
      }
      g.generateTexture('tt_durian', 48, 48)
      g.destroy()
    }

    if (!this.textures.exists('tt_bird')) {
      const g = this.make.graphics({ add: false } as any)
      g.fillStyle(0x2d3748, 1)
      // Body
      g.fillEllipse(20, 14, 24, 12)
      // Left wing
      g.fillTriangle(4, 14, 20, 8, 20, 16)
      // Right wing
      g.fillTriangle(36, 14, 20, 8, 20, 16)
      // Head
      g.fillCircle(30, 10, 7)
      // Beak
      g.fillStyle(0xf5d060, 1)
      g.fillTriangle(36, 9, 42, 11, 36, 13)
      g.generateTexture('tt_bird', 48, 26)
      g.destroy()
    }

    void width
    void height
  }

  private drawSky(width: number, height: number) {
    const g = this.add.graphics().setDepth(0)
    // Sunset gradient
    g.fillGradientStyle(0xff7c40, 0xff7c40, 0x6b21a8, 0x4c1d95, 1)
    g.fillRect(0, 0, width, this.groundY)
    // Ground below
    g.fillStyle(0x2d2d2d, 1)
    g.fillRect(0, this.groundY, width, height - this.groundY)
  }

  private createScrollingLayers(width: number, height: number) {
    const farY = this.skyBottomY - 5
    this.bgFar = this.add.tileSprite(0, farY - 115, width, 120, 'tt_bg_far')
      .setOrigin(0, 0).setDepth(1)

    this.bgNear = this.add.tileSprite(0, this.groundY - 78, width, 80, 'tt_bg_near')
      .setOrigin(0, 0).setDepth(2)

    this.road = this.add.tileSprite(0, this.groundY, width, 60, 'tt_road')
      .setOrigin(0, 0).setDepth(2)

    void height
  }

  private createPlayer(height: number) {
    this.playerY = this.groundY - 24
    this.targetY = this.playerY

    this.playerGfx = this.add.image(90, this.playerY, 'tt_tuktuk')
      .setOrigin(0.5, 0.5).setDepth(5)

    void height
  }

  private createHUD(width: number) {
    const hudBg = this.add.graphics().setDepth(8)
    hudBg.fillStyle(0x000000, 0.5)
    hudBg.fillRect(0, 0, width, 36)

    this.livesTxt = this.add.text(10, 8, '❤️❤️❤️', {
      fontSize: '16px',
    }).setDepth(9)

    this.scoreTxt = this.add.text(width / 2, 8, 'Score: 0', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '14px',
      color: '#f5d060',
    }).setOrigin(0.5, 0).setDepth(9)

    this.speedTxt = this.add.text(width - 10, 8, '200 km/h', {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: '#a0c8ff',
    }).setOrigin(1, 0).setDepth(9)
  }

  private setupInput(height: number) {
    // Pointer: top half = up, bottom half = down
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.isAlive || this.gameOverShown) return
      if (p.y < height / 2) {
        this.targetY = this.playfieldTop + 30
      } else {
        this.targetY = this.groundY - 24
      }
    })

    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (!this.isAlive) return
      if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
        this.targetY = this.playfieldTop + 30
      } else if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
        this.targetY = this.groundY - 24
      }
    })
  }

  update(_time: number, delta: number) {
    if (!this.isAlive || this.gameOverShown) return

    const dt = delta / 1000
    this.worldSpeed = Math.min(450, 200 + this.score * 0.3)

    // Scroll backgrounds
    this.bgFar.tilePositionX += this.worldSpeed * 0.12 * dt
    this.bgNear.tilePositionX += this.worldSpeed * 0.4 * dt
    this.road.tilePositionX += this.worldSpeed * dt

    // Smooth player Y
    const dy = this.targetY - this.playerGfx.y
    this.playerGfx.y += dy * Math.min(1, 8 * dt)
    // Clamp
    this.playerGfx.y = Phaser.Math.Clamp(
      this.playerGfx.y,
      this.playfieldTop + 20,
      this.playfieldBottom,
    )

    // Invincibility blink
    if (this.invincible) {
      this.invincibleTimer -= delta
      this.playerGfx.alpha = Math.sin(this.invincibleTimer * 0.01) > 0 ? 1 : 0.3
      if (this.invincibleTimer <= 0) {
        this.invincible = false
        this.playerGfx.alpha = 1
      }
    }

    // Shoot
    this.shootTimer -= delta
    if (this.shootTimer <= 0) {
      this.shootTimer = 300
      this.spawnBullet()
    }

    // Spawn enemies
    this.spawnTimer -= delta
    if (this.spawnTimer <= 0) {
      const minDelay = Math.max(400, 800 - this.score * 2)
      this.spawnTimer = minDelay + Math.random() * 400
      this.spawnEnemy()
    }

    // Update bullets
    this.updateBullets(dt)

    // Update enemies
    this.updateEnemies(dt)

    // HUD
    this.scoreTxt.setText(`Score: ${this.score}`)
    this.speedTxt.setText(`${Math.round(this.worldSpeed)} km/h`)
  }

  private spawnBullet() {
    const activeBullets = this.bullets.filter(b => b.active)
    if (activeBullets.length >= 8) return

    const g = this.add.graphics().setDepth(6)
    const bx = 120
    const by = this.playerGfx.y
    g.fillStyle(0xf97316, 1)
    g.fillCircle(0, 0, 8)
    g.x = bx
    g.y = by

    this.bullets.push({ x: bx, y: by, gfx: g, active: true })
  }

  private updateBullets(dt: number) {
    const { width } = this.scale
    for (const b of this.bullets) {
      if (!b.active) continue
      b.x += 600 * dt
      b.gfx.x = b.x
      if (b.x > width + 20) {
        b.active = false
        b.gfx.destroy()
      }
    }
  }

  private spawnEnemy() {
    const { width } = this.scale
    const type = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)]
    const texKey = `tt_${type}`

    let y: number
    if (type === 'car' || type === 'moto') {
      y = this.groundY - (type === 'car' ? 18 : 14)
    } else {
      y = this.playfieldTop + Math.random() * (this.playfieldBottom - this.playfieldTop)
    }

    const sprite = this.add.image(width + 30, y, texKey)
      .setOrigin(0.5, 0.5).setDepth(4)
      // Mirror horizontally since enemy comes from right
      .setFlipX(true)

    this.enemies.push({
      x: width + 30,
      y,
      type,
      sprite,
      active: true,
      speed: this.worldSpeed + Math.random() * 60,
    })
  }

  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (!e.active) continue

      e.x -= e.speed * dt
      e.sprite.x = e.x

      // Check bullet collision
      for (const b of this.bullets) {
        if (!b.active) continue
        const dx = b.x - e.x
        const dy = b.y - e.y
        if (Math.abs(dx) < 35 && Math.abs(dy) < 25) {
          // Hit!
          b.active = false
          b.gfx.destroy()
          this.destroyEnemy(e)
          this.score += 10
          break
        }
      }

      if (!e.active) continue

      // Check if enemy reached player zone
      if (e.x < 120) {
        const dy = Math.abs(e.y - this.playerGfx.y)
        if (dy < 30) {
          this.hitPlayer()
          this.destroyEnemy(e)
        } else if (e.x < -60) {
          this.destroyEnemy(e)
        }
      }

      if (e.x < -80) {
        this.destroyEnemy(e)
      }
    }

    this.enemies = this.enemies.filter(e => e.active)
  }

  private destroyEnemy(e: Enemy) {
    e.active = false
    // Flash + fade
    this.tweens.add({
      targets: e.sprite,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 200,
      ease: 'Sine.easeOut',
      onComplete: () => e.sprite.destroy(),
    })
  }

  private hitPlayer() {
    if (this.invincible) return
    this.lives--
    this.updateLivesHUD()

    if (this.lives <= 0) {
      this.doGameOver()
      return
    }

    this.invincible = true
    this.invincibleTimer = 2000
    this.cameras.main.flash(300, 80, 0, 0)
  }

  private updateLivesHUD() {
    this.livesTxt.setText('❤️'.repeat(Math.max(0, this.lives)))
  }

  private doGameOver() {
    this.isAlive = false
    this.saveBest()
    this.cameras.main.flash(500, 80, 0, 0)
    this.time.delayedCall(400, () => this.showGameOver())
  }

  private saveBest() {
    const prev = parseInt(localStorage.getItem('best_tuktuk') ?? '0', 10)
    if (this.score > prev) {
      localStorage.setItem('best_tuktuk', String(this.score))
    }
  }

  private showGameOver() {
    this.gameOverShown = true
    const { width, height } = this.scale
    const cx = width / 2
    const cy = height / 2

    this.overlayGfx = this.add.graphics().setDepth(15)
    this.overlayGfx.fillStyle(0x000000, 0.78)
    this.overlayGfx.fillRect(0, 0, width, height)

    const t1 = this.add.text(cx, cy - 70, 'GAME OVER', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '32px',
      color: '#ff6b6b',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(16)

    const best = localStorage.getItem('best_tuktuk') ?? '0'
    const t2 = this.add.text(cx, cy - 28, `Score: ${this.score}   |   Record: ${best}`, {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#f5d060',
    }).setOrigin(0.5).setDepth(16)

    this.overlayTxts = [t1, t2]

    this.makeBtn(cx, cy + 20, '▶  REJOUER', 0x1a1040, 0xa080d0, () => {
      this.scene.restart(this.sceneData)
    })

    this.makeBtn(cx, cy + 72, '← Retour', 0x0a1020, 0x406080, () => {
      this.scene.start('GameSelectScene', {
        user: this.sceneData.user,
        collection: this.sceneData.collection,
        cards: this.sceneData.cards,
        meKey: this.sceneData.meKey,
      })
    })
  }

  private makeBtn(cx: number, cy: number, label: string, bg: number, border: number, cb: () => void) {
    const w = 200, h = 44
    const g = this.add.graphics().setDepth(16)
    g.fillStyle(bg, 0.95)
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 10)
    g.lineStyle(2, border, 0.8)
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 10)

    const txt = this.add.text(cx, cy, label, {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: '15px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(17)

    const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true }).setDepth(18)
    zone.on('pointerover', () => { txt.setScale(1.05) })
    zone.on('pointerout',  () => { txt.setScale(1) })
    zone.on('pointerdown', () => {
      this.cameras.main.flash(150, 20, 20, 50)
      this.time.delayedCall(100, cb)
    })
  }
}
