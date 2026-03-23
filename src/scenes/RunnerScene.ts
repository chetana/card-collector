import Phaser from 'phaser'
import type { GoogleUser } from '../api/auth'
import type { CollectionData, FlashCard } from '../api/progress'

interface RunnerSceneData {
  user: GoogleUser
  collection: CollectionData
  cards: FlashCard[]
  meKey: string | null
}

type Zone = 'paris' | 'ocean' | 'cambodia'

interface ZoneDef {
  skyTop: number
  skyBot: number
  groundColor: number
  groundTop: number
  groundLine: number
  label: string
  farKey: string
  midKey: string
}

const ZONE_DATA: Record<Zone, ZoneDef> = {
  paris: {
    skyTop: 0x0d1428, skyBot: 0x3a4888,
    groundColor: 0x3a3050, groundTop: 0x5a5070, groundLine: 0x6a6080,
    label: '🗼 Paris', farKey: 'bg_far_paris', midKey: 'bg_mid_paris',
  },
  ocean: {
    skyTop: 0x05051a, skyBot: 0xe87840,
    groundColor: 0x1a2a4a, groundTop: 0x3a5a8a, groundLine: 0x4a6a9a,
    label: '✈️ En route...', farKey: 'bg_far_ocean', midKey: 'bg_far_ocean',
  },
  cambodia: {
    skyTop: 0x0a1020, skyBot: 0xe89040,
    groundColor: 0x2a1a08, groundTop: 0x5a3a18, groundLine: 0x6a4a28,
    label: '🛕 Cambodge', farKey: 'bg_far_cambodia', midKey: 'bg_mid_cambodia',
  },
}

const GRAVITY = 1600
const JUMP_VEL = -740
const INIT_SPEED = 260

export class RunnerScene extends Phaser.Scene {
  // Scene data
  private sceneData!: RunnerSceneData

  // Physics / world
  private worldSpeed = INIT_SPEED
  private distance = 0
  private groundScrollX = 0

  // Player state
  private player!: Phaser.Physics.Arcade.Image
  private velY = 0
  private isOnGround = false
  private isAlive = true
  private invincible = false
  private runCycle = 0
  private jumpCount = 0

  // Lives / score
  private lives = 3
  private score = 0
  private heartsCollected = 0

  // Spawn timers
  private nextObstacleTimer = 2000
  private nextHeartTimer = 1500

  // Groups
  private obstacles!: Phaser.Physics.Arcade.Group
  private heartsGroup!: Phaser.Physics.Arcade.Group

  // Background layers
  private skyGfx!: Phaser.GameObjects.Graphics
  private layer1!: Phaser.GameObjects.TileSprite
  private layer2!: Phaser.GameObjects.TileSprite
  private layer3!: Phaser.GameObjects.TileSprite
  private groundGfx!: Phaser.GameObjects.Graphics
  private shadowEllipse!: Phaser.GameObjects.Ellipse

  // Sky color interpolation
  private curSkyTop = 0x0d1428
  private curSkyBot = 0x3a4888
  private tgtSkyTop = 0x0d1428
  private tgtSkyBot = 0x3a4888

  // Zone
  private currentZone: Zone = 'paris'
  private zoneTransitioning = false

  // Stars
  private stars: { x: number; y: number; r: number; a: number }[] = []
  private starsGfx!: Phaser.GameObjects.Graphics

  // HUD
  private distText!: Phaser.GameObjects.Text
  private zoneText!: Phaser.GameObjects.Text
  private livesText!: Phaser.GameObjects.Text
  private zoneBanner!: Phaser.GameObjects.Text

  constructor() { super('RunnerScene') }

  init(data: RunnerSceneData) {
    this.sceneData = data
    this.worldSpeed = INIT_SPEED
    this.distance = 0
    this.groundScrollX = 0
    this.velY = 0
    this.isOnGround = false
    this.isAlive = true
    this.invincible = false
    this.runCycle = 0
    this.jumpCount = 0
    this.lives = 3
    this.score = 0
    this.heartsCollected = 0
    this.nextObstacleTimer = 2200
    this.nextHeartTimer = 1800
    this.currentZone = 'paris'
    this.zoneTransitioning = false
    this.curSkyTop = 0x0d1428
    this.curSkyBot = 0x3a4888
    this.tgtSkyTop = 0x0d1428
    this.tgtSkyBot = 0x3a4888
    this.stars = []
  }

  create() {
    const { width, height } = this.scale
    this.physics.world.gravity.y = 0

    this.generateTextures()

    // Sky (depth 0)
    this.skyGfx = this.add.graphics().setDepth(0)
    this.drawSkyGradient()

    // Stars (depth 0.5)
    this.starsGfx = this.add.graphics().setDepth(1)
    this.generateStars()

    // Parallax layers
    this.layer1 = this.add.tileSprite(0, 0, width, height, 'bg_far_paris')
      .setOrigin(0, 0).setDepth(2)
    this.layer2 = this.add.tileSprite(0, 0, width, height, 'bg_mid_paris')
      .setOrigin(0, 0).setDepth(3)
    this.layer3 = this.add.tileSprite(0, 0, width, height, 'bg_near_all')
      .setOrigin(0, 0).setDepth(4)

    // Ground graphics (depth 5)
    this.groundGfx = this.add.graphics().setDepth(5)

    // Player shadow
    const gY = height * 0.76
    this.shadowEllipse = this.add.ellipse(90, gY + 4, 30, 8, 0x000000, 0.3).setDepth(5)

    // Player
    this.player = this.physics.add.image(90, gY - 26, 'player_tex')
      .setDepth(6).setOrigin(0.5, 0.5)
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setAllowGravity(false)
    body.setSize(24, 44)

    // Groups
    this.obstacles = this.physics.add.group()
    this.heartsGroup = this.physics.add.group()

    // Input
    this.input.on('pointerdown', this.doJump, this)
    this.input.keyboard?.on('keydown-SPACE', this.doJump, this)

    // HUD
    this.buildHUD()

    // Particle texture (tiny circle)
    if (!this.textures.exists('particle_dot')) {
      const pg = this.make.graphics({ add: false } as any)
      pg.fillStyle(0xffffff, 1)
      pg.fillCircle(4, 4, 4)
      pg.generateTexture('particle_dot', 8, 8)
      pg.destroy()
    }

    // Initial banner
    this.showZoneBanner('🗼 Paris', 0x3a4888)
  }

  // ── Texture generation ────────────────────────────────────────────────────

  private generateTextures() {
    const { width, height } = this.scale
    const gY = height * 0.76

    if (!this.textures.exists('player_tex')) {
      const pg = this.make.graphics({ add: false } as any)
      const firstName = (this.sceneData?.user?.name ?? '').split(' ')[0].toLowerCase()
      const isChet = firstName.startsWith('chet')
      // Head
      pg.fillStyle(0xf5cba7, 1); pg.fillCircle(16, 12, 9)
      // Hair
      pg.fillStyle(0x2c1a0e, 1); pg.fillEllipse(16, 7, 18, 11)
      // Body
      pg.fillStyle(isChet ? 0x3a7bd5 : 0xe87099, 1); pg.fillRoundedRect(9, 21, 14, 16, 3)
      // Legs
      pg.fillStyle(0x1a2060, 1); pg.fillRect(9, 35, 6, 12); pg.fillRect(17, 35, 6, 12)
      // Eyes
      pg.fillStyle(0x1a1a1a, 1); pg.fillCircle(13, 12, 1.5); pg.fillCircle(19, 12, 1.5)
      pg.generateTexture('player_tex', 32, 52)
      pg.destroy()
    }

    if (!this.textures.exists('obs_low')) {
      const og1 = this.make.graphics({ add: false } as any)
      og1.fillStyle(0x8a7a6a, 1); og1.fillRoundedRect(0, 0, 28, 50, 3)
      og1.fillStyle(0x9a8a7a, 0.4); og1.fillRect(4, 4, 8, 6); og1.fillRect(16, 4, 8, 6)
      og1.generateTexture('obs_low', 28, 50); og1.destroy()
    }

    if (!this.textures.exists('obs_tall')) {
      const og2 = this.make.graphics({ add: false } as any)
      og2.fillStyle(0x7a6a5a, 1); og2.fillRoundedRect(0, 0, 22, 72, 3)
      og2.fillStyle(0x8a7a6a, 0.4)
      for (let y = 4; y < 72; y += 14) og2.fillRect(4, y, 14, 6)
      og2.generateTexture('obs_tall', 22, 72); og2.destroy()
    }

    // Paris far
    if (!this.textures.exists('bg_far_paris')) {
      const g = this.make.graphics({ add: false } as any)
      const bldgs = [
        { x: 60, w: 70, h: 160 }, { x: 160, w: 55, h: 120 }, { x: 240, w: 90, h: 180 },
        { x: 360, w: 60, h: 140 }, { x: 450, w: 80, h: 170 }, { x: 560, w: 65, h: 130 },
        { x: 650, w: 75, h: 155 }, { x: 730, w: 50, h: 110 },
      ]
      for (const b of bldgs) {
        g.fillStyle(0x2a3050, 1)
        g.fillRect(b.x, gY - b.h, b.w, b.h)
        g.fillStyle(0xffd870, 0.5)
        for (let wy = gY - b.h + 8; wy < gY - 10; wy += 18) {
          for (let wx = b.x + 6; wx < b.x + b.w - 10; wx += 16) {
            if ((wx * 7 + wy * 13) % 3 !== 0) g.fillRect(wx, wy, 8, 6)
          }
        }
      }
      drawEiffelTower(g, 400, gY, 1.4)
      g.generateTexture('bg_far_paris', 800, height); g.destroy()
    }

    if (!this.textures.exists('bg_mid_paris')) {
      const g = this.make.graphics({ add: false } as any)
      const mb = [
        { x: 20, w: 50, h: 80 }, { x: 90, w: 40, h: 65 }, { x: 150, w: 55, h: 90 },
        { x: 230, w: 45, h: 75 }, { x: 300, w: 60, h: 85 }, { x: 385, w: 42, h: 70 },
        { x: 450, w: 55, h: 80 }, { x: 525, w: 48, h: 72 },
      ]
      for (const b of mb) {
        g.fillStyle(0x3a4060, 1)
        g.fillRect(b.x, gY - b.h, b.w, b.h)
        g.fillStyle(0xffd870, 0.35)
        for (let wy = gY - b.h + 6; wy < gY - 8; wy += 14) {
          for (let wx = b.x + 4; wx < b.x + b.w - 6; wx += 12) {
            if ((wx + wy) % 5 !== 0) g.fillRect(wx, wy, 6, 5)
          }
        }
      }
      for (let lx = 40; lx < 560; lx += 90) {
        g.fillStyle(0x5a6080, 1); g.fillRect(lx - 1, gY - 38, 3, 38)
        g.fillStyle(0xffd870, 0.8); g.fillCircle(lx, gY - 38, 4)
      }
      g.generateTexture('bg_mid_paris', 600, height); g.destroy()
    }

    if (!this.textures.exists('bg_far_cambodia')) {
      const g = this.make.graphics({ add: false } as any)
      drawAngkorWat(g, 400, gY, 1.5)
      for (const px of [80, 160, 620, 720]) drawPalmTree(g, px, gY, 1.0)
      g.generateTexture('bg_far_cambodia', 800, height); g.destroy()
    }

    if (!this.textures.exists('bg_mid_cambodia')) {
      const g = this.make.graphics({ add: false } as any)
      g.fillStyle(0x1a2a0e, 1)
      for (let bx = 0; bx < 600; bx += 70) {
        g.fillEllipse(bx + 30, gY - 15, 60, 30)
      }
      for (const px of [50, 150, 280, 420, 530]) drawPalmTree(g, px, gY, 0.75)
      g.generateTexture('bg_mid_cambodia', 600, height); g.destroy()
    }

    if (!this.textures.exists('bg_far_ocean')) {
      const g = this.make.graphics({ add: false } as any)
      const clouds = [{ x: 80 }, { x: 220 }, { x: 400 }, { x: 600 }, { x: 730 }]
      for (const c of clouds) {
        const cy2 = gY - 180
        g.fillStyle(0x3a4a6a, 0.6)
        g.fillEllipse(c.x, cy2, 100, 30)
        g.fillEllipse(c.x + 20, cy2 - 12, 70, 25)
        g.fillEllipse(c.x - 20, cy2 - 8, 60, 20)
      }
      g.generateTexture('bg_far_ocean', 800, height); g.destroy()
    }

    if (!this.textures.exists('bg_near_all')) {
      const g = this.make.graphics({ add: false } as any)
      for (let rx = 0; rx < 600; rx += 35) {
        const rh = 4 + (rx * 7) % 8
        g.fillStyle(0x4a5070, 0.5); g.fillRect(rx + 4, gY - rh, 12, rh)
        g.fillStyle(0x3a4060, 0.4); g.fillEllipse(rx + 20, gY - 3, 14, 6)
      }
      g.generateTexture('bg_near_all', 600, height); g.destroy()
    }
  }

  private generateStars() {
    const { width, height } = this.scale
    const gY = height * 0.76
    for (let i = 0; i < 50; i++) {
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * gY * 0.85,
        r: Math.random() * 1.1 + 0.3,
        a: Math.random() * 0.7 + 0.2,
      })
    }
    this.redrawStars(1)
  }

  private redrawStars(alpha: number) {
    this.starsGfx.clear()
    for (const s of this.stars) {
      this.starsGfx.fillStyle(0xffffff, s.a * alpha)
      this.starsGfx.fillCircle(s.x, s.y, s.r)
    }
  }

  // ── HUD ───────────────────────────────────────────────────────────────────

  private buildHUD() {
    const { width, height } = this.scale

    // Top bar
    const hudBg = this.add.graphics().setDepth(20).setScrollFactor(0)
    hudBg.fillStyle(0x000000, 0.5)
    hudBg.fillRect(0, 0, width, 38)

    this.distText = this.add.text(12, 10, '0.0 km', {
      fontFamily: 'Cinzel, sans-serif', fontSize: '13px', color: '#a0e8ff',
    }).setDepth(21).setScrollFactor(0)

    this.zoneText = this.add.text(width / 2, 10, '🗼 Paris', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#f5d060',
    }).setOrigin(0.5, 0).setDepth(21).setScrollFactor(0)

    this.livesText = this.add.text(width - 12, 10, '❤️❤️❤️', {
      fontFamily: 'sans-serif', fontSize: '13px',
    }).setOrigin(1, 0).setDepth(21).setScrollFactor(0)

    // Zone banner (hidden initially)
    this.zoneBanner = this.add.text(width / 2, height / 2 - 20, '', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '30px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(25).setScrollFactor(0).setAlpha(0)
  }

  private updateLivesHUD() {
    const hearts = ['', '❤️', '❤️❤️', '❤️❤️❤️']
    this.livesText.setText(this.lives >= 0 && this.lives <= 3 ? hearts[this.lives] : '')
  }

  // ── Zone management ───────────────────────────────────────────────────────

  private checkZone() {
    if (this.distance >= 12000 && this.currentZone !== 'cambodia') {
      this.transitionToZone('cambodia')
    } else if (this.distance >= 6000 && this.currentZone === 'paris') {
      this.transitionToZone('ocean')
    }
  }

  private transitionToZone(zone: Zone) {
    if (this.zoneTransitioning) return
    this.zoneTransitioning = true
    this.currentZone = zone
    const zd = ZONE_DATA[zone]

    this.tgtSkyTop = zd.skyTop
    this.tgtSkyBot = zd.skyBot
    this.zoneText.setText(zd.label)

    // Flash + crossfade layers
    this.cameras.main.flash(400, 30, 20, 60)
    this.showZoneBanner(zd.label, zd.skyBot)

    // Cross-fade TileSprites
    this.tweens.add({
      targets: [this.layer1, this.layer2],
      alpha: 0,
      duration: 500,
      onComplete: () => {
        this.layer1.setTexture(zd.farKey)
        this.layer2.setTexture(zd.midKey)
        this.tweens.add({
          targets: [this.layer1, this.layer2],
          alpha: 1,
          duration: 500,
          onComplete: () => { this.zoneTransitioning = false },
        })
      },
    })
  }

  private showZoneBanner(text: string, _color: number) {
    this.zoneBanner.setText(text).setAlpha(0).setScale(0.5)
    this.tweens.add({
      targets: this.zoneBanner,
      alpha: 1, scaleX: 1, scaleY: 1,
      duration: 400, ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(1800, () => {
          this.tweens.add({
            targets: this.zoneBanner,
            alpha: 0, scaleX: 1.1, scaleY: 1.1,
            duration: 400,
          })
        })
      },
    })
  }

  // ── Sky ───────────────────────────────────────────────────────────────────

  private drawSkyGradient() {
    const { width, height } = this.scale
    this.skyGfx.clear()
    this.skyGfx.fillGradientStyle(
      this.curSkyTop, this.curSkyTop,
      this.curSkyBot, this.curSkyBot,
      1
    )
    this.skyGfx.fillRect(0, 0, width, height * 0.76)
  }

  private updateSky(dt: number) {
    const lerpF = Math.min(1, dt * 1.2)
    this.curSkyTop = lerpColor(this.curSkyTop, this.tgtSkyTop, lerpF)
    this.curSkyBot = lerpColor(this.curSkyBot, this.tgtSkyBot, lerpF)
    this.drawSkyGradient()

    // Stars visibility: full in paris/cambodia, fade in ocean
    const starAlpha = this.currentZone === 'ocean' ? 0.2 : 0.8
    this.redrawStars(starAlpha)
  }

  // ── Ground ────────────────────────────────────────────────────────────────

  private updateGround() {
    const { width, height } = this.scale
    const gY = height * 0.76
    const zd = ZONE_DATA[this.currentZone]

    this.groundGfx.clear()
    this.groundGfx.fillStyle(zd.groundColor, 1)
    this.groundGfx.fillRect(0, gY, width, height - gY)
    this.groundGfx.fillStyle(zd.groundTop, 0.6)
    this.groundGfx.fillRect(0, gY, width, 3)

    // Scrolling detail lines
    this.groundGfx.lineStyle(1, zd.groundLine, 0.25)
    const lineSpacing = 40
    const offset = this.groundScrollX % lineSpacing
    for (let x = -offset; x < width + lineSpacing; x += lineSpacing) {
      this.groundGfx.lineBetween(x, gY + 4, x + 10, gY + 12)
    }
  }

  // ── Player ────────────────────────────────────────────────────────────────

  private doJump() {
    if (!this.isAlive) return
    if (this.isOnGround) {
      this.velY = JUMP_VEL
      this.isOnGround = false
      this.jumpCount = 1

      // Poof effect at feet
      this.spawnJumpPoof()
    }
  }

  private spawnJumpPoof() {
    const gY = this.scale.height * 0.76
    const poof = this.add.graphics().setDepth(5)
    poof.fillStyle(0xffffff, 0.5)
    poof.fillCircle(this.player.x, gY, 10)
    this.tweens.add({
      targets: poof,
      scaleX: 2.5, scaleY: 1.5,
      alpha: 0,
      duration: 300,
      onComplete: () => poof.destroy(),
    })
  }

  private onLand() {
    // Small squish
    this.tweens.add({
      targets: this.player,
      scaleY: 0.75, scaleX: 1.2,
      duration: 80,
      yoyo: true,
    })
  }

  // ── Spawning ──────────────────────────────────────────────────────────────

  private spawnObstacle() {
    const { width, height } = this.scale
    const gY = height * 0.76
    const isLow = this.distance < 3000 || Math.random() > 0.4
    const type = isLow ? 'obs_low' : 'obs_tall'
    const h = isLow ? 50 : 72

    const obs = this.physics.add.image(width + 40, gY - h / 2, type)
    obs.setDepth(6)
    const body = obs.body as Phaser.Physics.Arcade.Body
    body.setAllowGravity(false)
    body.setImmovable(true)
    this.obstacles.add(obs)

    obs.setScale(0, 1)
    this.tweens.add({ targets: obs, scaleX: 1, duration: 150, ease: 'Back.easeOut' })
  }

  private spawnHeart() {
    const { width, height } = this.scale
    const gY = height * 0.76
    const yOffset = Phaser.Math.Between(80, 160)

    const heart = this.add.text(width + 30, gY - yOffset, '❤️', {
      fontSize: '20px',
    }).setDepth(6)

    this.physics.add.existing(heart)
    const body = heart.body as Phaser.Physics.Arcade.Body
    body.setAllowGravity(false)
    body.setSize(24, 24)
    this.heartsGroup.add(heart)

    this.tweens.add({
      targets: heart,
      y: heart.y - 8,
      duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
  }

  private resetObstacleTimer() {
    const minTime = Math.max(700, 1800 - this.distance / 6)
    const maxTime = Math.max(1400, 2800 - this.distance / 6)
    this.nextObstacleTimer = Phaser.Math.Between(minTime, maxTime)
  }

  // ── Collisions ────────────────────────────────────────────────────────────

  private checkCollisions() {
    if (this.invincible) return
    const px = this.player.x, py = this.player.y
    const pw = 22, ph = 38

    for (const obs of this.obstacles.getChildren()) {
      const o = obs as Phaser.Physics.Arcade.Image
      const ow = o.width * o.scaleX, oh = o.height
      if (
        px - pw / 2 < o.x + ow / 2 && px + pw / 2 > o.x - ow / 2 &&
        py - ph / 2 < o.y + oh / 2 && py + ph / 2 > o.y - oh / 2
      ) {
        this.hitObstacle()
        break
      }
    }

    for (const h of this.heartsGroup.getChildren()) {
      const heart = h as Phaser.GameObjects.Text
      if (Math.abs(px - heart.x) < 22 && Math.abs(py - heart.y) < 22) {
        this.collectHeart(heart)
      }
    }
  }

  private hitObstacle() {
    if (this.invincible || !this.isAlive) return
    this.lives--
    this.invincible = true
    this.time.delayedCall(1500, () => { this.invincible = false })

    this.tweens.add({
      targets: this.player, alpha: 0,
      duration: 150, yoyo: true, repeat: 4,
      onComplete: () => { this.player.setAlpha(1) },
    })

    this.cameras.main.shake(250, 0.012)

    if (this.lives <= 0) {
      this.isAlive = false
      this.time.delayedCall(800, () => this.endGame())
    }

    this.updateLivesHUD()
  }

  private collectHeart(heart: Phaser.GameObjects.Text) {
    this.heartsGroup.remove(heart, false, false)
    const hx = heart.x, hy = heart.y
    this.tweens.killTweensOf(heart)
    heart.destroy()
    this.heartsCollected++
    this.score += 50

    // +50 floating text
    const bonus = this.add.text(hx, hy - 5, '+50', {
      fontFamily: 'Cinzel, sans-serif', fontSize: '14px',
      color: '#ff9eb5', stroke: '#2a0010', strokeThickness: 2,
    }).setDepth(15).setScrollFactor(0).setOrigin(0.5)
    // Note: we need world coords since this is a world object
    bonus.setScrollFactor(1)
    this.tweens.add({
      targets: bonus,
      y: hy - 40, alpha: 0,
      duration: 800,
      ease: 'Cubic.easeOut',
      onComplete: () => bonus.destroy(),
    })

    // Particle burst
    const particles = this.add.particles(hx, hy, 'particle_dot', {
      speed: { min: 50, max: 110 },
      scale: { start: 0.4, end: 0 },
      lifespan: 500,
      quantity: 10,
      tint: 0xff6b9d,
      emitting: false,
    })
    particles.explode(10, hx, hy)
    this.time.delayedCall(600, () => particles.destroy())
  }

  // ── End game ──────────────────────────────────────────────────────────────

  private endGame() {
    // Save best
    const prev = parseInt(localStorage.getItem('cc_runner_best') ?? '0', 10)
    if (this.distance > prev) {
      localStorage.setItem('cc_runner_best', String(Math.floor(this.distance)))
    }

    const reachedCambodia = this.distance >= 12000

    this.scene.start('GameOverScene', {
      ...this.sceneData,
      score: this.score,
      distance: this.distance,
      heartsCollected: this.heartsCollected,
      reachedCambodia,
    })
  }

  // ── Main update ───────────────────────────────────────────────────────────

  update(_time: number, delta: number) {
    if (!this.isAlive) return
    const dt = delta / 1000

    // Speed + distance
    this.worldSpeed = Math.min(650, INIT_SPEED + this.distance / 80)
    this.distance += this.worldSpeed * dt
    this.groundScrollX += this.worldSpeed * dt

    // Player manual physics
    this.velY += GRAVITY * dt
    this.player.y += this.velY * dt
    const gY = this.scale.height * 0.76
    const groundHit = gY - 26

    if (this.player.y >= groundHit) {
      this.player.y = groundHit
      if (!this.isOnGround) {
        this.isOnGround = true
        this.onLand()
      }
      this.velY = 0
    } else {
      this.isOnGround = false
    }

    // Sync physics body
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.reset(this.player.x, this.player.y)

    // Running animation (bob)
    if (this.isOnGround) {
      this.runCycle += dt * 12
      this.player.setScale(1, 1 + Math.sin(this.runCycle) * 0.04)
    }

    // Shadow: scale based on height above ground
    const heightAbove = groundHit - this.player.y
    const shadowScale = Math.max(0.3, 1 - heightAbove / 200)
    this.shadowEllipse.setScale(shadowScale, shadowScale)
    this.shadowEllipse.setAlpha(0.15 + 0.2 * shadowScale)
    this.shadowEllipse.setPosition(this.player.x, gY + 4)

    // Scroll obstacles + hearts
    for (const obs of this.obstacles.getChildren()) {
      const o = obs as Phaser.Physics.Arcade.Image
      o.x -= this.worldSpeed * dt
      if (o.x < -100) o.destroy()
    }
    for (const h of this.heartsGroup.getChildren()) {
      const heart = h as Phaser.GameObjects.Text
      heart.x -= this.worldSpeed * dt
      if (heart.x < -100) heart.destroy()
    }

    // Parallax
    this.layer1.setTilePosition(this.groundScrollX * 0.08, 0)
    this.layer2.setTilePosition(this.groundScrollX * 0.22, 0)
    this.layer3.setTilePosition(this.groundScrollX * 0.6, 0)

    // Visuals
    this.updateSky(dt)
    this.updateGround()

    // Collision
    this.checkCollisions()

    // Zone
    this.checkZone()

    // Spawn timers
    this.nextObstacleTimer -= delta
    if (this.nextObstacleTimer <= 0) {
      this.spawnObstacle()
      this.resetObstacleTimer()
    }
    this.nextHeartTimer -= delta
    if (this.nextHeartTimer <= 0) {
      this.spawnHeart()
      this.nextHeartTimer = Phaser.Math.Between(1000, 2200)
    }

    // HUD: distance in km (9274 internal px ≈ 1 km)
    const km = (this.distance / 9274).toFixed(1)
    this.distText.setText(`${km} km`)

    // Score ticker from distance
    this.score = Math.floor(this.distance / 10) + this.heartsCollected * 50
  }
}

// ── Shared drawing helpers ────────────────────────────────────────────────

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return (r << 16) | (g << 8) | bl
}

function drawEiffelTower(g: Phaser.GameObjects.Graphics, cx: number, baseY: number, scale: number = 1) {
  const w = 60 * scale, h = 120 * scale
  const ty = baseY - h
  g.fillStyle(0x2a3050, 1)
  g.fillTriangle(cx - w / 2, ty + h, cx - w * 0.12, ty + h * 0.65, cx, ty + h * 0.58)
  g.fillTriangle(cx + w / 2, ty + h, cx + w * 0.12, ty + h * 0.65, cx, ty + h * 0.58)
  g.fillRect(cx - w * 0.3, ty + h * 0.62, w * 0.6, h * 0.04)
  g.fillTriangle(cx - w * 0.22, ty + h * 0.66, cx - w * 0.08, ty + h * 0.38, cx, ty + h * 0.34)
  g.fillTriangle(cx + w * 0.22, ty + h * 0.66, cx + w * 0.08, ty + h * 0.38, cx, ty + h * 0.34)
  g.fillRect(cx - w * 0.15, ty + h * 0.32, w * 0.3, h * 0.03)
  g.fillRect(cx - w * 0.04, ty + h * 0.12, w * 0.08, h * 0.22)
  g.fillRect(cx - w * 0.015, ty, w * 0.03, h * 0.14)
}

function drawAngkorWat(g: Phaser.GameObjects.Graphics, cx: number, baseY: number, scale: number = 1) {
  const w = 120 * scale, h = 90 * scale
  g.fillStyle(0x2a1a0e, 1)
  g.fillRect(cx - w / 2, baseY - h * 0.25, w, h * 0.25)
  g.fillRect(cx - w * 0.1, baseY - h, w * 0.2, h * 0.75)
  g.fillTriangle(cx - w * 0.12, baseY - h, cx + w * 0.12, baseY - h, cx, baseY - h * 1.05)
  g.fillRect(cx - w * 0.38, baseY - h * 0.72, w * 0.14, h * 0.48)
  g.fillTriangle(cx - w * 0.41, baseY - h * 0.72, cx - w * 0.25, baseY - h * 0.72, cx - w * 0.33, baseY - h * 0.77)
  g.fillRect(cx + w * 0.24, baseY - h * 0.72, w * 0.14, h * 0.48)
  g.fillTriangle(cx + w * 0.22, baseY - h * 0.72, cx + w * 0.38, baseY - h * 0.72, cx + w * 0.31, baseY - h * 0.77)
  g.fillRect(cx - w * 0.48, baseY - h * 0.55, w * 0.09, h * 0.3)
  g.fillRect(cx + w * 0.39, baseY - h * 0.55, w * 0.09, h * 0.3)
}

function drawPalmTree(g: Phaser.GameObjects.Graphics, x: number, baseY: number, scale: number = 1) {
  g.fillStyle(0x1a2a0e, 1)
  g.fillRect(x - 4 * scale, baseY - 70 * scale, 8 * scale, 70 * scale)
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI - Math.PI / 2 + Math.PI * 0.15
    const lx = x + Math.cos(angle) * 32 * scale
    const ly = baseY - 70 * scale + Math.sin(angle) * 32 * scale
    g.fillEllipse(lx, ly, 36 * scale, 10 * scale)
  }
}
