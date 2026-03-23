import Phaser from 'phaser'
import type { GoogleUser } from '../api/auth'
import type { CollectionData, FlashCard } from '../api/progress'

interface BreakoutSceneData {
  user?: GoogleUser
  collection?: CollectionData
  cards?: FlashCard[]
  meKey?: string | null
}

interface Brick {
  x: number
  y: number
  hp: number
  maxHp: number
  color: number
  active: boolean
  gfx: Phaser.GameObjects.Graphics
}

export class BreakoutScene extends Phaser.Scene {
  private sceneData!: BreakoutSceneData

  // Layout
  private hudH = 44
  private playfieldTop = 0
  private playfieldBottom = 0

  // Bricks
  private bricks: Brick[] = []
  private brickW = 50
  private brickH = 18
  private brickGap = 6
  private brickCols = 0
  private brickRows = 6

  // Paddle
  private paddleX = 0
  private paddleW = 100
  private paddleH = 12
  private paddleGfx!: Phaser.GameObjects.Graphics

  // Ball
  private ballX = 0
  private ballY = 0
  private ballR = 10
  private ballVX = 0
  private ballVY = 0
  private ballSpeed = 280
  private ballLaunched = false
  private ballGfx!: Phaser.GameObjects.Graphics

  // State
  private lives = 3
  private score = 0
  private level = 1
  private isAlive = true
  private gameOverShown = false
  private levelClearShown = false

  // HUD
  private scoreTxt!: Phaser.GameObjects.Text
  private livesTxt!: Phaser.GameObjects.Text
  private levelTxt!: Phaser.GameObjects.Text

  // Overlay
  private overlayGfx!: Phaser.GameObjects.Graphics
  private overlayTxts: Phaser.GameObjects.Text[] = []

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys

  constructor() { super('BreakoutScene') }

  init(data: BreakoutSceneData) {
    this.sceneData = data ?? {}
  }

  create() {
    const { width, height } = this.scale

    this.playfieldTop = this.hudH + 4
    this.playfieldBottom = height

    this.drawBackground(width, height)
    this.createHUD(width)
    this.setupBricks(width)
    this.createPaddle(width, height)
    this.createBall(width, height)
    this.setupInput()
    this.updateHUD()
  }

  private drawBackground(width: number, height: number) {
    const g = this.add.graphics().setDepth(0)
    g.fillStyle(0x0a0a0f, 1)
    g.fillRect(0, 0, width, height)

    // Stone block pattern
    g.lineStyle(0.5, 0x1a1a22, 0.4)
    const blockW = 60, blockH = 25
    for (let y = this.hudH; y < height; y += blockH) {
      const offset = Math.floor(y / blockH) % 2 === 0 ? 0 : blockW / 2
      for (let x = -blockW + offset; x < width + blockW; x += blockW) {
        g.strokeRect(x, y, blockW, blockH)
      }
    }

    // Torch glows in corners
    const torchGlow = (tx: number, ty: number) => {
      g.fillStyle(0xff6a00, 0.06)
      g.fillCircle(tx, ty, 80)
      g.fillStyle(0xff8c00, 0.04)
      g.fillCircle(tx, ty, 50)
      g.fillStyle(0xffcc00, 0.05)
      g.fillCircle(tx, ty, 25)
    }
    torchGlow(30, height * 0.35)
    torchGlow(width - 30, height * 0.35)
    torchGlow(30, height * 0.75)
    torchGlow(width - 30, height * 0.75)
  }

  private createHUD(width: number) {
    const hudBg = this.add.graphics().setDepth(1)
    hudBg.fillStyle(0x080810, 0.95)
    hudBg.fillRect(0, 0, width, this.hudH)
    hudBg.lineStyle(1, 0xd4af37, 0.3)
    hudBg.lineBetween(0, this.hudH, width, this.hudH)

    this.livesTxt = this.add.text(10, 12, '', {
      fontSize: '16px',
    }).setDepth(2)

    this.scoreTxt = this.add.text(width / 2, 12, 'Score: 0', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '14px',
      color: '#d4af37',
    }).setOrigin(0.5, 0).setDepth(2)

    this.levelTxt = this.add.text(width - 10, 12, 'Niv. 1', {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: '#a78bfa',
    }).setOrigin(1, 0).setDepth(2)
  }

  private updateHUD() {
    this.livesTxt.setText('❤️'.repeat(Math.max(0, this.lives)))
    this.scoreTxt.setText(`Score: ${this.score}`)
    this.levelTxt.setText(`Niv. ${this.level}`)
  }

  private setupBricks(width: number) {
    // Destroy old bricks
    for (const b of this.bricks) b.gfx.destroy()
    this.bricks = []

    this.brickCols = Math.floor((width - 40) / (this.brickW + this.brickGap))
    const totalW = this.brickCols * this.brickW + (this.brickCols - 1) * this.brickGap
    const startX = (width - totalW) / 2
    const startY = this.playfieldTop + 12

    const rowColors: { color: number; hp: number }[] = [
      { color: 0xd4af37, hp: 3 },
      { color: 0xd4af37, hp: 3 },
      { color: 0x0d9488, hp: 2 },
      { color: 0x0d9488, hp: 2 },
      { color: 0x6b7280, hp: 1 },
      { color: 0x6b7280, hp: 1 },
    ]

    for (let row = 0; row < this.brickRows; row++) {
      const { color, hp } = rowColors[row]
      for (let col = 0; col < this.brickCols; col++) {
        const bx = startX + col * (this.brickW + this.brickGap)
        const by = startY + row * (this.brickH + this.brickGap)

        const gfx = this.add.graphics().setDepth(3)
        this.drawBrick(gfx, bx, by, color, hp, hp)

        this.bricks.push({
          x: bx, y: by,
          hp, maxHp: hp,
          color, active: true,
          gfx,
        })
      }
    }
  }

  private drawBrick(gfx: Phaser.GameObjects.Graphics, bx: number, by: number, color: number, hp: number, maxHp: number) {
    gfx.clear()
    const damage = (maxHp - hp) / maxHp
    const alpha = 1 - damage * 0.3

    gfx.fillStyle(color, alpha)
    gfx.fillRoundedRect(bx, by, this.brickW, this.brickH, 3)

    // Border (slightly lighter)
    const r = ((color >> 16) & 0xff)
    const gn = ((color >> 8) & 0xff)
    const b = (color & 0xff)
    const lighter = (Math.min(255, r + 40) << 16) | (Math.min(255, gn + 40) << 8) | Math.min(255, b + 40)
    gfx.lineStyle(1, lighter, 0.6)
    gfx.strokeRoundedRect(bx, by, this.brickW, this.brickH, 3)

    // Crack if damaged
    if (damage > 0) {
      gfx.lineStyle(1, 0x000000, 0.5)
      const cx = bx + this.brickW / 2
      const cy = by + this.brickH / 2
      gfx.lineBetween(cx - 8, cy - 4, cx + 4, cy + 5)
      if (damage > 0.5) {
        gfx.lineBetween(cx + 2, cy - 5, cx - 3, cy + 4)
      }
    }
  }

  private createPaddle(width: number, height: number) {
    this.paddleX = width / 2
    const paddleY = height - 60

    this.paddleGfx = this.add.graphics().setDepth(5)
    this.drawPaddle(paddleY)

    void paddleY
  }

  private getPaddleY(): number {
    return this.scale.height - 60
  }

  private drawPaddle(paddleY: number) {
    this.paddleGfx.clear()
    const px = this.paddleX - this.paddleW / 2
    // Gold gradient effect
    this.paddleGfx.fillStyle(0xd4af37, 1)
    this.paddleGfx.fillRoundedRect(px, paddleY, this.paddleW, this.paddleH, 4)
    // Highlight
    this.paddleGfx.fillStyle(0xffd700, 0.5)
    this.paddleGfx.fillRoundedRect(px + 2, paddleY + 1, this.paddleW - 4, this.paddleH / 2 - 1, 2)
    // Border
    this.paddleGfx.lineStyle(1, 0xb45309, 0.8)
    this.paddleGfx.strokeRoundedRect(px, paddleY, this.paddleW, this.paddleH, 4)
  }

  private createBall(width: number, height: number) {
    this.ballX = width / 2
    this.ballY = height - 80
    this.ballGfx = this.add.graphics().setDepth(6)
    this.launchBall()
  }

  private launchBall() {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8
    this.ballVX = Math.cos(angle) * this.ballSpeed
    this.ballVY = Math.sin(angle) * this.ballSpeed
    this.ballLaunched = true
    this.drawBall()
  }

  private resetBall() {
    const { width, height } = this.scale
    this.ballX = width / 2
    this.ballY = height - 80
    this.ballVX = 0
    this.ballVY = 0
    this.ballLaunched = false
    this.drawBall()

    // Brief pause then relaunch
    this.time.delayedCall(800, () => {
      if (this.isAlive && !this.gameOverShown) this.launchBall()
    })
  }

  private drawBall() {
    this.ballGfx.clear()
    // Glow
    this.ballGfx.fillStyle(0x7dd3fc, 0.2)
    this.ballGfx.fillCircle(this.ballX, this.ballY, this.ballR + 5)
    // Core
    this.ballGfx.fillStyle(0xe0f2fe, 1)
    this.ballGfx.fillCircle(this.ballX, this.ballY, this.ballR)
    // Shine
    this.ballGfx.fillStyle(0xffffff, 0.6)
    this.ballGfx.fillCircle(this.ballX - 3, this.ballY - 3, 3)
  }

  private setupInput() {
    const { width } = this.scale
    this.cursors = this.input.keyboard!.createCursorKeys()

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.paddleX = Phaser.Math.Clamp(p.x, this.paddleW / 2, width - this.paddleW / 2)
    })

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.paddleX = Phaser.Math.Clamp(p.x, this.paddleW / 2, width - this.paddleW / 2)
      if (!this.ballLaunched && this.isAlive && !this.gameOverShown) {
        this.launchBall()
      }
    })
  }

  update(_time: number, delta: number) {
    if (!this.isAlive || this.gameOverShown || this.levelClearShown) return

    const { width } = this.scale
    const dt = delta / 1000

    // Keyboard paddle
    const paddleSpeed = 420
    if (this.cursors.left.isDown) {
      this.paddleX = Math.max(this.paddleW / 2, this.paddleX - paddleSpeed * dt)
    } else if (this.cursors.right.isDown) {
      this.paddleX = Math.min(width - this.paddleW / 2, this.paddleX + paddleSpeed * dt)
    }

    const paddleY = this.getPaddleY()
    this.drawPaddle(paddleY)

    if (!this.ballLaunched) {
      this.ballX = this.paddleX
      this.drawBall()
      return
    }

    // Move ball
    this.ballX += this.ballVX * dt
    this.ballY += this.ballVY * dt

    // Wall bounces
    if (this.ballX - this.ballR < 0) {
      this.ballX = this.ballR
      this.ballVX = Math.abs(this.ballVX)
    } else if (this.ballX + this.ballR > width) {
      this.ballX = width - this.ballR
      this.ballVX = -Math.abs(this.ballVX)
    }

    if (this.ballY - this.ballR < this.playfieldTop) {
      this.ballY = this.playfieldTop + this.ballR
      this.ballVY = Math.abs(this.ballVY)
    }

    // Ball lost
    if (this.ballY > this.scale.height + 20) {
      this.lives--
      this.updateHUD()
      if (this.lives <= 0) {
        this.doGameOver()
        return
      }
      this.cameras.main.flash(300, 80, 0, 0)
      this.resetBall()
    }

    // Paddle collision
    const px = this.paddleX - this.paddleW / 2
    if (
      this.ballY + this.ballR >= paddleY &&
      this.ballY - this.ballR <= paddleY + this.paddleH &&
      this.ballX >= px - this.ballR &&
      this.ballX <= px + this.paddleW + this.ballR &&
      this.ballVY > 0
    ) {
      this.ballVY = -Math.abs(this.ballVY)
      // Angle based on hit position
      const relativeHit = (this.ballX - this.paddleX) / (this.paddleW / 2)
      this.ballVX = relativeHit * this.ballSpeed * 1.2
      // Normalize to keep speed consistent
      const speed = Math.sqrt(this.ballVX ** 2 + this.ballVY ** 2)
      this.ballVX = (this.ballVX / speed) * this.ballSpeed
      this.ballVY = (this.ballVY / speed) * this.ballSpeed
      this.ballY = paddleY - this.ballR - 1
    }

    // Brick collisions
    let allClear = true
    for (const brick of this.bricks) {
      if (!brick.active) continue
      allClear = false

      const bLeft = brick.x
      const bRight = brick.x + this.brickW
      const bTop = brick.y
      const bBot = brick.y + this.brickH

      if (
        this.ballX + this.ballR >= bLeft &&
        this.ballX - this.ballR <= bRight &&
        this.ballY + this.ballR >= bTop &&
        this.ballY - this.ballR <= bBot
      ) {
        brick.hp--
        if (brick.hp <= 0) {
          brick.active = false
          brick.gfx.clear()
          this.score += brick.maxHp * 10
        } else {
          this.drawBrick(brick.gfx, brick.x, brick.y, brick.color, brick.hp, brick.maxHp)
          this.score += 10
        }
        this.updateHUD()

        // Determine bounce direction
        const fromLeft = this.ballX < bLeft
        const fromRight = this.ballX > bRight
        const fromTop = this.ballY < bTop
        const fromBottom = this.ballY > bBot

        if (fromLeft || fromRight) {
          this.ballVX *= -1
        } else if (fromTop || fromBottom) {
          this.ballVY *= -1
        } else {
          this.ballVY *= -1
        }

        // Small nudge to prevent sticking
        if (this.ballVY < 0) this.ballY = bTop - this.ballR - 1
        else this.ballY = bBot + this.ballR + 1
        break
      }
    }

    if (allClear && !this.levelClearShown) {
      this.showLevelClear()
    }

    this.drawBall()
  }

  private showLevelClear() {
    this.levelClearShown = true
    const { width, height } = this.scale
    const cx = width / 2

    const bannerGfx = this.add.graphics().setDepth(20)
    bannerGfx.fillStyle(0x000000, 0.7)
    bannerGfx.fillRoundedRect(cx - 160, height / 2 - 40, 320, 80, 12)
    bannerGfx.lineStyle(2, 0xd4af37, 0.8)
    bannerGfx.strokeRoundedRect(cx - 160, height / 2 - 40, 320, 80, 12)

    const banner = this.add.text(cx, height / 2, 'NIVEAU SUIVANT !', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '22px',
      color: '#d4af37',
    }).setOrigin(0.5).setDepth(21)

    this.time.delayedCall(1500, () => {
      bannerGfx.destroy()
      banner.destroy()
      this.level++
      this.ballSpeed += 15
      this.setupBricks(width)
      const { height: h } = this.scale
      this.resetBallToCenter(width, h)
      this.levelClearShown = false
      this.updateHUD()
    })
  }

  private resetBallToCenter(width: number, height: number) {
    this.ballX = width / 2
    this.ballY = height - 80
    this.ballVX = 0
    this.ballVY = 0
    this.ballLaunched = false
    this.drawBall()
    this.time.delayedCall(400, () => {
      if (this.isAlive && !this.gameOverShown) this.launchBall()
    })
  }

  private doGameOver() {
    this.isAlive = false
    this.saveBest()
    this.cameras.main.flash(500, 80, 0, 0)
    this.time.delayedCall(300, () => this.showGameOver())
  }

  private saveBest() {
    const prev = parseInt(localStorage.getItem('best_breakout') ?? '0', 10)
    if (this.score > prev) {
      localStorage.setItem('best_breakout', String(this.score))
    }
  }

  private showGameOver() {
    this.gameOverShown = true
    const { width, height } = this.scale
    const cx = width / 2
    const cy = height / 2

    this.overlayGfx = this.add.graphics().setDepth(20)
    this.overlayGfx.fillStyle(0x000000, 0.78)
    this.overlayGfx.fillRect(0, 0, width, height)

    const t1 = this.add.text(cx, cy - 70, 'GAME OVER', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '32px',
      color: '#ff6b6b',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(21)

    const best = localStorage.getItem('best_breakout') ?? '0'
    const t2 = this.add.text(cx, cy - 28, `Score: ${this.score}   |   Record: ${best}`, {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#d4af37',
    }).setOrigin(0.5).setDepth(21)

    this.overlayTxts = [t1, t2]

    this.makeBtn(cx, cy + 18, '▶  REJOUER', 0x1a1040, 0xa080d0, () => {
      this.scene.restart(this.sceneData)
    })

    this.makeBtn(cx, cy + 70, '← Retour', 0x0a1020, 0x406080, () => {
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
    const g = this.add.graphics().setDepth(21)
    g.fillStyle(bg, 0.95)
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 10)
    g.lineStyle(2, border, 0.8)
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 10)

    const txt = this.add.text(cx, cy, label, {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: '15px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(22)

    const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true }).setDepth(23)
    zone.on('pointerover', () => { txt.setScale(1.05) })
    zone.on('pointerout',  () => { txt.setScale(1) })
    zone.on('pointerdown', () => {
      this.cameras.main.flash(150, 20, 20, 50)
      this.time.delayedCall(100, cb)
    })
  }
}
