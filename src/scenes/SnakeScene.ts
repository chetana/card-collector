import Phaser from 'phaser'
import type { GoogleUser } from '../api/auth'
import type { CollectionData, FlashCard } from '../api/progress'

interface SnakeSceneData {
  user?: GoogleUser
  collection?: CollectionData
  cards?: FlashCard[]
  meKey?: string | null
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

interface Segment { col: number; row: number }

const GRID_COLS = 20
const GRID_ROWS = 24
const FOOD_EMOJIS = ['🌺', '🪷', '🐘', '⛩️', '🌿', '💎', '🔮']

export class SnakeScene extends Phaser.Scene {
  private sceneData!: SnakeSceneData

  // Grid
  private cellSize = 0
  private gridX = 0
  private gridY = 0
  private gridW = 0
  private gridH = 0

  // Snake
  private snake: Segment[] = []
  private direction: Direction = 'RIGHT'
  private nextDirection: Direction = 'RIGHT'

  // Food
  private foodCol = 0
  private foodRow = 0
  private foodEmoji = '🌺'
  private foodText!: Phaser.GameObjects.Text

  // Score / state
  private score = 0
  private level = 1
  private isAlive = true
  private gameOverShown = false
  private canRestart = false

  // Graphics
  private gridGfx!: Phaser.GameObjects.Graphics
  private snakeGfx!: Phaser.GameObjects.Graphics
  private scoreTxt!: Phaser.GameObjects.Text
  private overlayGfx!: Phaser.GameObjects.Graphics
  private overlayTxts: Phaser.GameObjects.Text[] = []

  // Timer
  private tickEvent!: Phaser.Time.TimerEvent

  // Touch
  private pointerDownX = 0
  private pointerDownY = 0

  // Mobile buttons
  private btnUp!: Phaser.GameObjects.Zone
  private btnDown!: Phaser.GameObjects.Zone
  private btnLeft!: Phaser.GameObjects.Zone
  private btnRight!: Phaser.GameObjects.Zone

  constructor() { super('SnakeScene') }

  init(data: SnakeSceneData) {
    this.sceneData = data ?? {}
  }

  create() {
    const { width, height } = this.scale

    // Compute grid dimensions
    this.cellSize = Math.floor(Math.min(width, height * 0.85) / 22)
    this.gridW = this.cellSize * GRID_COLS
    this.gridH = this.cellSize * GRID_ROWS
    this.gridX = Math.floor((width - this.gridW) / 2)
    this.gridY = 50 + 28 // header height

    this.drawBackground()
    this.drawHeader()
    this.drawMobileButtons()

    this.gridGfx = this.add.graphics().setDepth(2)
    this.snakeGfx = this.add.graphics().setDepth(4)

    this.drawStaticGrid()
    this.resetGame()
    this.setupInput()
  }

  private drawBackground() {
    const { width, height } = this.scale
    const g = this.add.graphics().setDepth(0)
    g.fillStyle(0x0d0d0a, 1)
    g.fillRect(0, 0, width, height)
  }

  private drawHeader() {
    const { width } = this.scale
    const hg = this.add.graphics().setDepth(1)
    hg.fillStyle(0x0a0f0a, 0.9)
    hg.fillRect(0, 0, width, 50)

    this.add.text(12, 14, '🐍 SNAKE ANGKOR', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '15px',
      color: '#4ade80',
    }).setDepth(3)

    this.scoreTxt = this.add.text(width - 12, 14, 'Score: 0', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: '#a0e0a0',
    }).setOrigin(1, 0).setDepth(3)
  }

  private drawStaticGrid() {
    this.gridGfx.clear()

    // Stone border
    this.gridGfx.lineStyle(2, 0xd4af37, 0.6)
    this.gridGfx.strokeRect(this.gridX - 2, this.gridY - 2, this.gridW + 4, this.gridH + 4)

    // Subtle grid lines
    this.gridGfx.lineStyle(0.5, 0x1a1a14, 0.3)
    for (let c = 0; c <= GRID_COLS; c++) {
      const x = this.gridX + c * this.cellSize
      this.gridGfx.lineBetween(x, this.gridY, x, this.gridY + this.gridH)
    }
    for (let r = 0; r <= GRID_ROWS; r++) {
      const y = this.gridY + r * this.cellSize
      this.gridGfx.lineBetween(this.gridX, y, this.gridX + this.gridW, y)
    }
  }

  private drawMobileButtons() {
    const { width, height } = this.scale
    const btnSize = 44
    const btnGap = 4
    const bx = width / 2
    const by = height - 60

    const btnG = this.add.graphics().setDepth(5)

    const drawBtn = (x: number, y: number, label: string) => {
      btnG.fillStyle(0x1a2a1a, 0.7)
      btnG.fillRoundedRect(x - btnSize / 2, y - btnSize / 2, btnSize, btnSize, 8)
      btnG.lineStyle(1, 0x4ade80, 0.4)
      btnG.strokeRoundedRect(x - btnSize / 2, y - btnSize / 2, btnSize, btnSize, 8)
      this.add.text(x, y, label, {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        color: '#4ade80',
      }).setOrigin(0.5).setDepth(6)
    }

    const upX = bx, upY = by - btnSize - btnGap
    const downX = bx, downY = by
    const leftX = bx - btnSize - btnGap, leftY = by - (btnSize + btnGap) / 2
    const rightX = bx + btnSize + btnGap, rightY = by - (btnSize + btnGap) / 2

    drawBtn(upX, upY, '▲')
    drawBtn(downX, downY, '▼')
    drawBtn(leftX, leftY, '◀')
    drawBtn(rightX, rightY, '▶')

    this.btnUp    = this.add.zone(upX,    upY,    btnSize, btnSize).setInteractive().setDepth(7)
    this.btnDown  = this.add.zone(downX,  downY,  btnSize, btnSize).setInteractive().setDepth(7)
    this.btnLeft  = this.add.zone(leftX,  leftY,  btnSize, btnSize).setInteractive().setDepth(7)
    this.btnRight = this.add.zone(rightX, rightY, btnSize, btnSize).setInteractive().setDepth(7)

    this.btnUp.on('pointerdown',    () => this.tryDir('UP'))
    this.btnDown.on('pointerdown',  () => this.tryDir('DOWN'))
    this.btnLeft.on('pointerdown',  () => this.tryDir('LEFT'))
    this.btnRight.on('pointerdown', () => this.tryDir('RIGHT'))
  }

  private resetGame() {
    this.score = 0
    this.level = 1
    this.isAlive = true
    this.gameOverShown = false
    this.canRestart = false
    this.direction = 'RIGHT'
    this.nextDirection = 'RIGHT'

    // Initial snake: head at (10,12), 3 segments going left
    this.snake = [
      { col: 10, row: 12 },
      { col: 9,  row: 12 },
      { col: 8,  row: 12 },
    ]

    // Spawn food
    this.spawnFood()

    // Clear overlay
    this.overlayGfx?.clear()
    this.overlayTxts.forEach(t => t.destroy())
    this.overlayTxts = []

    // Start tick
    if (this.tickEvent) this.tickEvent.destroy()
    this.tickEvent = this.time.addEvent({
      delay: this.tickDelay(),
      loop: true,
      callback: this.tick,
      callbackScope: this,
    })

    this.scoreTxt.setText('Score: 0')
    this.renderSnake()
    this.renderFood()
  }

  private tickDelay(): number {
    return Math.max(80, 200 - this.score * 2)
  }

  private tick() {
    if (!this.isAlive) return

    this.direction = this.nextDirection

    const head = this.snake[0]
    let nc = head.col, nr = head.row
    if (this.direction === 'UP')    nr--
    if (this.direction === 'DOWN')  nr++
    if (this.direction === 'LEFT')  nc--
    if (this.direction === 'RIGHT') nc++

    // Wall collision
    if (nc < 0 || nc >= GRID_COLS || nr < 0 || nr >= GRID_ROWS) {
      this.die()
      return
    }

    // Self collision
    if (this.snake.some(s => s.col === nc && s.row === nr)) {
      this.die()
      return
    }

    const ateFood = (nc === this.foodCol && nr === this.foodRow)

    // Move snake
    this.snake.unshift({ col: nc, row: nr })
    if (!ateFood) {
      this.snake.pop()
    }

    if (ateFood) {
      this.score += 10 + this.level * 2
      this.scoreTxt.setText(`Score: ${this.score}`)
      this.spawnFood()
      this.level = Math.floor(this.score / 50) + 1
      // Recreate tick event with new speed
      this.tickEvent.destroy()
      this.tickEvent = this.time.addEvent({
        delay: this.tickDelay(),
        loop: true,
        callback: this.tick,
        callbackScope: this,
      })
    }

    this.renderSnake()
  }

  private spawnFood() {
    const occupied = new Set(this.snake.map(s => `${s.col},${s.row}`))
    let col: number, row: number
    do {
      col = Math.floor(Math.random() * GRID_COLS)
      row = Math.floor(Math.random() * GRID_ROWS)
    } while (occupied.has(`${col},${row}`))

    this.foodCol = col
    this.foodRow = row
    this.foodEmoji = FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)]
    this.renderFood()
  }

  private renderFood() {
    if (this.foodText) this.foodText.destroy()
    const x = this.gridX + this.foodCol * this.cellSize + this.cellSize / 2
    const y = this.gridY + this.foodRow * this.cellSize + this.cellSize / 2
    const fontSize = Math.max(10, this.cellSize - 4)
    this.foodText = this.add.text(x, y, this.foodEmoji, {
      fontSize: `${fontSize}px`,
    }).setOrigin(0.5).setDepth(3)
  }

  private renderSnake() {
    this.snakeGfx.clear()
    const cs = this.cellSize

    this.snake.forEach((seg, i) => {
      const x = this.gridX + seg.col * cs
      const y = this.gridY + seg.row * cs

      // Color: interpolate from #4ade80 (head) to #16a34a (tail)
      const t = this.snake.length > 1 ? i / (this.snake.length - 1) : 0
      const r = Math.round(0x4a + (0x16 - 0x4a) * t)
      const gn = Math.round(0xde + (0xa3 - 0xde) * t)
      const b = Math.round(0x80 + (0x4a - 0x80) * t)
      const color = (r << 16) | (gn << 8) | b

      this.snakeGfx.fillStyle(color, 1)
      this.snakeGfx.fillRoundedRect(x + 1, y + 1, cs - 2, cs - 2, 3)

      // Eyes on head
      if (i === 0) {
        this.snakeGfx.fillStyle(0xffffff, 1)
        const ex1 = { x: x + cs * 0.3, y: y + cs * 0.3 }
        const ex2 = { x: x + cs * 0.7, y: y + cs * 0.3 }
        if (this.direction === 'UP' || this.direction === 'DOWN') {
          ex1.x = x + cs * 0.3; ex1.y = y + cs * 0.5
          ex2.x = x + cs * 0.7; ex2.y = y + cs * 0.5
        }
        this.snakeGfx.fillCircle(ex1.x, ex1.y, 2)
        this.snakeGfx.fillCircle(ex2.x, ex2.y, 2)
      }
    })
  }

  private die() {
    if (!this.isAlive) return
    this.isAlive = false
    this.tickEvent.destroy()

    this.saveBest()

    // Flash red
    this.cameras.main.flash(400, 80, 0, 0)

    this.time.delayedCall(600, () => {
      this.showGameOver()
    })
  }

  private saveBest() {
    const prev = parseInt(localStorage.getItem('best_snake') ?? '0', 10)
    if (this.score > prev) {
      localStorage.setItem('best_snake', String(this.score))
    }
  }

  private showGameOver() {
    this.gameOverShown = true
    const { width, height } = this.scale

    if (!this.overlayGfx) {
      this.overlayGfx = this.add.graphics().setDepth(10)
    }
    this.overlayGfx.clear()
    this.overlayGfx.fillStyle(0x000000, 0.72)
    this.overlayGfx.fillRect(this.gridX, this.gridY, this.gridW, this.gridH)
    this.overlayGfx.lineStyle(2, 0x4ade80, 0.6)
    this.overlayGfx.strokeRect(this.gridX, this.gridY, this.gridW, this.gridH)

    const cx = width / 2
    const cy = this.gridY + this.gridH / 2

    const t1 = this.add.text(cx, cy - 48, 'GAME OVER', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '28px',
      color: '#ff6b6b',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(11)

    const best = localStorage.getItem('best_snake') ?? '0'
    const t2 = this.add.text(cx, cy - 10, `Score: ${this.score}   |   Record: ${best}`, {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: '#a0e0a0',
    }).setOrigin(0.5).setDepth(11)

    this.overlayTxts.push(t1, t2)

    this.time.delayedCall(1500, () => {
      this.canRestart = true

      const t3 = this.add.text(cx, cy + 30, 'Appuie pour rejouer', {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        color: '#ffffff',
      }).setOrigin(0.5).setDepth(11)

      const retBtn = this.makeButton(cx, cy + 68, '← Retour', 0x0a1020, 0x406080, () => {
        this.scene.start('GameSelectScene', {
          user: this.sceneData.user,
          collection: this.sceneData.collection,
          cards: this.sceneData.cards,
          meKey: this.sceneData.meKey,
        })
      })

      this.overlayTxts.push(t3, ...retBtn)
    })
  }

  private makeButton(
    cx: number, cy: number, label: string,
    bgColor: number, borderColor: number,
    onClick: () => void,
  ): Phaser.GameObjects.Text[] {
    const w = 180, h = 42

    const bg = this.add.graphics().setDepth(11)
    bg.fillStyle(bgColor, 0.95)
    bg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 10)
    bg.lineStyle(2, borderColor, 0.8)
    bg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 10)

    const txt = this.add.text(cx, cy, label, {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(12)

    const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true }).setDepth(13)
    zone.on('pointerdown', () => {
      this.cameras.main.flash(150, 20, 20, 50)
      this.time.delayedCall(100, onClick)
    })

    return [txt]
  }

  private setupInput() {
    // Keyboard
    const cursors = this.input.keyboard!.createCursorKeys()
    const wasd = this.input.keyboard!.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D' }) as Record<string, Phaser.Input.Keyboard.Key>

    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':    case 'w': case 'W': this.tryDir('UP');    break
        case 'ArrowDown':  case 's': case 'S': this.tryDir('DOWN');  break
        case 'ArrowLeft':  case 'a': case 'A': this.tryDir('LEFT');  break
        case 'ArrowRight': case 'd': case 'D': this.tryDir('RIGHT'); break
      }
    })

    void cursors
    void wasd

    // Touch swipe
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.pointerDownX = p.x
      this.pointerDownY = p.y
    })

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const dx = p.x - this.pointerDownX
      const dy = p.y - this.pointerDownY
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      if (Math.max(absDx, absDy) < 30) {
        // Short tap — restart if game over
        if (this.canRestart) this.resetGame()
        return
      }

      if (absDx > absDy) {
        this.tryDir(dx > 0 ? 'RIGHT' : 'LEFT')
      } else {
        this.tryDir(dy > 0 ? 'DOWN' : 'UP')
      }
    })
  }

  private tryDir(dir: Direction) {
    const opposites: Record<Direction, Direction> = {
      UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
    }
    if (dir !== opposites[this.direction]) {
      this.nextDirection = dir
    }
  }
}
