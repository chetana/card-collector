import Phaser from 'phaser'
import type { GoogleUser } from '../api/auth'
import type { CollectionData, FlashCard } from '../api/progress'

interface TowerDefenseSceneData {
  user?: GoogleUser
  collection?: CollectionData
  cards?: FlashCard[]
  meKey?: string | null
}

type EnemyType = 'soldier' | 'cavalry' | 'guard' | 'shaman' | 'dark_knight' | 'boss'
type TowerType = 'archer' | 'monk' | 'ballista' | 'naga' | 'elephant'
type CellState = 'empty' | 'path' | 'tower'

interface TDEnemy {
  id: number
  type: EnemyType
  hp: number
  maxHp: number
  speed: number
  reward: number
  slowed: boolean
  slowTimer: number
  slowAmt: number
  stunned: boolean
  stunTimer: number
  poisoned: boolean
  poisonTimer: number
  poisonDamage: number
  waypointIndex: number
  x: number
  y: number
  sprite: Phaser.GameObjects.Container
  hpBarBg: Phaser.GameObjects.Rectangle
  hpBar: Phaser.GameObjects.Rectangle
  hpBarMaxW: number
  lastHp: number
  active: boolean
  immune: boolean
}

interface TDTower {
  col: number
  row: number
  type: TowerType
  level: number
  range: number
  damage: number
  fireRate: number
  fireTimer: number
  target: TDEnemy | null
  container: Phaser.GameObjects.Container
  rangePreview?: Phaser.GameObjects.Graphics
  special: {
    slow?: boolean
    slowAmt?: number
    slowDur?: number
    splash?: boolean
    splashRadius?: number
    pierce?: boolean
    poison?: boolean
    multishot?: boolean
    areaSlot?: boolean
    stun?: boolean
    stunDur?: number
  }
}

interface TDProjectile {
  x: number
  y: number
  targetId: number
  damage: number
  speed: number
  gfx: Phaser.GameObjects.Graphics
  active: boolean
  type: TowerType
  pierce: boolean
  hitIds: Set<number>
  splash: boolean
  splashRadius: number
  slow: boolean
  slowAmt: number
  slowDur: number
  poison: boolean
  stun: boolean
  stunDur: number
}

interface WaveEnemy {
  type: EnemyType
  count: number
}

interface Wave {
  enemies: WaveEnemy[]
  interval: number
}

interface LevelDef {
  name: string
  path: number[][]
  startGold: number
  waves: Wave[]
}

const ENEMY_STATS: Record<EnemyType, { hp: number; speed: number; reward: number; immune: boolean; color: number; large: boolean }> = {
  soldier:    { hp: 80,   speed: 75,  reward: 8,   immune: false, color: 0x6b7280, large: false },
  cavalry:    { hp: 60,   speed: 140, reward: 12,  immune: false, color: 0x92400e, large: false },
  guard:      { hp: 280,  speed: 45,  reward: 22,  immune: false, color: 0x1e3a8a, large: false },
  shaman:     { hp: 100,  speed: 85,  reward: 18,  immune: true,  color: 0x7c3aed, large: false },
  dark_knight:{ hp: 220,  speed: 90,  reward: 30,  immune: false, color: 0x111827, large: false },
  boss:       { hp: 1200, speed: 35,  reward: 100, immune: false, color: 0x7f1d1d, large: true  },
}

const TOWER_BASE: Record<TowerType, { cost: number; range: number; damage: number; fireRate: number; label: string; emoji: string; color: number }> = {
  archer:   { cost: 80,  range: 2.5, damage: 25,  fireRate: 900,  label: 'Archer',   emoji: '🏹', color: 0x92400e },
  monk:     { cost: 100, range: 2.2, damage: 15,  fireRate: 700,  label: 'Moine',    emoji: '☸️', color: 0xd4af37 },
  ballista: { cost: 140, range: 3.5, damage: 80,  fireRate: 2200, label: 'Baliste',  emoji: '⚡', color: 0x374151 },
  naga:     { cost: 160, range: 3.0, damage: 45,  fireRate: 1300, label: 'Naga',     emoji: '🐍', color: 0x0d9488 },
  elephant: { cost: 200, range: 2.0, damage: 150, fireRate: 3200, label: 'Éléphant', emoji: '🐘', color: 0x6b7280 },
}

const LEVELS: LevelDef[] = [
  {
    name: 'Les Plaines',
    startGold: 150,
    path: [[-1,2],[1,2],[1,5],[4,5],[4,2],[6,2],[6,9],[3,9],[3,7],[7,7],[8,7]],
    waves: [
      { enemies: [{ type: 'soldier', count: 12 }], interval: 900 },
      { enemies: [{ type: 'soldier', count: 16 }, { type: 'cavalry', count: 4 }], interval: 800 },
      { enemies: [{ type: 'soldier', count: 12 }, { type: 'cavalry', count: 6 }, { type: 'guard', count: 4 }], interval: 750 },
      { enemies: [{ type: 'guard', count: 8 }, { type: 'cavalry', count: 12 }, { type: 'shaman', count: 6 }], interval: 700 },
      { enemies: [{ type: 'soldier', count: 20 }, { type: 'guard', count: 5 }, { type: 'boss', count: 1 }], interval: 600 },
    ],
  },
  {
    name: 'La Forêt Sacrée',
    startGold: 180,
    path: [[-1,1],[2,1],[2,4],[0,4],[0,8],[3,8],[3,5],[6,5],[6,2],[7,2],[7,10],[4,10],[4,7],[8,7]],
    waves: [
      { enemies: [{ type: 'soldier', count: 15 }, { type: 'cavalry', count: 5 }], interval: 850 },
      { enemies: [{ type: 'cavalry', count: 10 }, { type: 'guard', count: 8 }], interval: 800 },
      { enemies: [{ type: 'soldier', count: 20 }, { type: 'shaman', count: 5 }, { type: 'guard', count: 4 }], interval: 750 },
      { enemies: [{ type: 'cavalry', count: 12 }, { type: 'shaman', count: 8 }, { type: 'dark_knight', count: 5 }], interval: 700 },
      { enemies: [{ type: 'dark_knight', count: 10 }, { type: 'guard', count: 8 }, { type: 'soldier', count: 10 }], interval: 650 },
      { enemies: [{ type: 'dark_knight', count: 15 }, { type: 'shaman', count: 6 }, { type: 'boss', count: 1 }], interval: 600 },
      { enemies: [{ type: 'soldier', count: 8 }, { type: 'cavalry', count: 8 }, { type: 'guard', count: 6 }, { type: 'shaman', count: 4 }, { type: 'dark_knight', count: 4 }, { type: 'boss', count: 1 }], interval: 500 },
    ],
  },
  {
    name: 'Angkor',
    startGold: 220,
    path: [[-1,0],[1,0],[1,3],[3,3],[3,1],[6,1],[6,4],[4,4],[4,7],[7,7],[7,5],[7,10],[5,10],[5,8],[2,8],[2,11],[8,11]],
    waves: [
      { enemies: [{ type: 'soldier', count: 20 }, { type: 'cavalry', count: 8 }], interval: 800 },
      { enemies: [{ type: 'cavalry', count: 14 }, { type: 'guard', count: 10 }, { type: 'shaman', count: 5 }], interval: 750 },
      { enemies: [{ type: 'soldier', count: 25 }, { type: 'guard', count: 10 }, { type: 'shaman', count: 8 }, { type: 'dark_knight', count: 5 }], interval: 700 },
      { enemies: [{ type: 'dark_knight', count: 12 }, { type: 'shaman', count: 10 }, { type: 'cavalry', count: 8 }], interval: 650 },
      { enemies: [{ type: 'dark_knight', count: 18 }, { type: 'shaman', count: 12 }, { type: 'guard', count: 6 }], interval: 600 },
      { enemies: [{ type: 'dark_knight', count: 22 }, { type: 'shaman', count: 15 }, { type: 'boss', count: 1 }], interval: 580 },
      { enemies: [{ type: 'dark_knight', count: 25 }, { type: 'shaman', count: 18 }, { type: 'boss', count: 2 }], interval: 550 },
      { enemies: [{ type: 'soldier', count: 20 }, { type: 'dark_knight', count: 20 }, { type: 'boss', count: 2 }], interval: 520 },
      { enemies: [{ type: 'guard', count: 15 }, { type: 'dark_knight', count: 25 }, { type: 'shaman', count: 20 }, { type: 'boss', count: 3 }], interval: 500 },
      { enemies: [{ type: 'dark_knight', count: 30 }, { type: 'boss', count: 5 }], interval: 450 },
    ],
  },
]

export class TowerDefenseScene extends Phaser.Scene {
  private sceneData!: TowerDefenseSceneData

  // Layout
  private cellSize = 0
  private gridOffX = 0
  private gridOffY = 4
  private gridCols = 8
  private gridRows = 12

  // State
  private currentLevel = 0
  private currentWave = 0
  private waveActive = false
  private lives = 20
  private gold = 150
  private score = 0

  private grid: CellState[][] = []
  private pathWaypoints: { x: number; y: number }[] = []
  private towers: TDTower[] = []
  private enemies: TDEnemy[] = []
  private projectiles: TDProjectile[] = []
  private enemyIdCounter = 0

  private selectedTowerType: TowerType | null = null
  private selectedTower: TDTower | null = null

  // Wave spawning
  private spawnQueue: { type: EnemyType; interval: number }[] = []
  private spawnTimer = 0

  // HUD refs
  private goldText!: Phaser.GameObjects.Text
  private livesText!: Phaser.GameObjects.Text
  private waveText!: Phaser.GameObjects.Text
  private launchBtn!: Phaser.GameObjects.Container
  private launchBtnGfx!: Phaser.GameObjects.Graphics
  private launchBtnTxt!: Phaser.GameObjects.Text
  private launchBtnZone!: Phaser.GameObjects.Zone
  private waveProgressBar!: Phaser.GameObjects.Graphics
  private towerBtnData: { btnX: number; btnY: number; btnW: number; btnH: number; type: TowerType; btnBg: Phaser.GameObjects.Graphics }[] = []
  private towerBtnHighlights: Phaser.GameObjects.Graphics[] = []
  private towerTypes: TowerType[] = ['archer', 'monk', 'ballista', 'naga', 'elephant']
  private infoPanel: Phaser.GameObjects.Container | null = null
  private mapGraphics!: Phaser.GameObjects.Graphics
  private rangePreviewGfx!: Phaser.GameObjects.Graphics

  // Level select overlay
  private levelSelectContainer: Phaser.GameObjects.Container | null = null
  private gameStarted = false

  constructor() { super('TowerDefenseScene') }

  init(data: TowerDefenseSceneData) {
    this.sceneData = data ?? {}
  }

  create() {
    const { width, height } = this.scale

    // Compute cell size: fit 8 cols × 12 rows in top 80%
    this.cellSize = Math.floor(Math.min(width / this.gridCols, height * 0.80 / this.gridRows))
    this.gridOffX = (width - this.gridCols * this.cellSize) / 2
    this.gridOffY = 4

    this.generateAllTextures()

    // Draw angkor silhouette background
    this.drawAngkorSilhouette(width, height)

    // Map graphics layer
    this.mapGraphics = this.add.graphics().setDepth(1)

    // Range preview graphics
    this.rangePreviewGfx = this.add.graphics().setDepth(8)

    this.drawBottomBar(width, height)
    this.setupInput(width, height)

    this.showLevelSelect(width, height)
  }

  // ── Texture generation ────────────────────────────────────────────

  private generateAllTextures() {
    const cs = this.cellSize
    const half = cs / 2

    // Enemy textures
    const enemyDefs: { key: string; color: number; large: boolean; special?: string }[] = [
      { key: 'td_enemy_soldier',    color: 0x6b7280, large: false },
      { key: 'td_enemy_cavalry',    color: 0x92400e, large: false },
      { key: 'td_enemy_guard',      color: 0x1e3a8a, large: false },
      { key: 'td_enemy_shaman',     color: 0x7c3aed, large: false, special: 'shaman' },
      { key: 'td_enemy_dark_knight',color: 0x111827, large: false, special: 'dark' },
      { key: 'td_enemy_boss',       color: 0x7f1d1d, large: true,  special: 'boss' },
    ]

    for (const def of enemyDefs) {
      if (this.textures.exists(def.key)) continue
      const size = def.large ? Math.floor(cs * 1.2) : Math.floor(cs * 0.8)
      const g = this.make.graphics({ add: false } as Phaser.Types.GameObjects.Graphics.Options)
      const cx = size / 2, headR = size * 0.22, bodyH = size * 0.28, bodyW = size * 0.30

      // Shadow
      g.fillStyle(0x000000, 0.3)
      g.fillEllipse(cx, size - 4, size * 0.55, 8)

      // Body
      g.fillStyle(def.color, 1)
      g.fillRect(cx - bodyW / 2, size * 0.38, bodyW, bodyH)

      // Head
      g.fillStyle(def.color, 1)
      g.fillCircle(cx, size * 0.30, headR)

      // Highlights / specials
      if (def.special === 'boss') {
        // Crown
        g.fillStyle(0xffd700, 1)
        g.fillRect(cx - size * 0.25, size * 0.06, size * 0.5, size * 0.1)
        g.fillTriangle(cx - size*0.22, size*0.06, cx - size*0.17, size*0.06 - size*0.1, cx - size*0.12, size*0.06)
        g.fillTriangle(cx - size*0.04, size*0.06, cx, size*0.06 - size*0.13, cx + size*0.04, size*0.06)
        g.fillTriangle(cx + size*0.12, size*0.06, cx + size*0.17, size*0.06 - size*0.1, cx + size*0.22, size*0.06)
        // Outline
        g.lineStyle(2, 0xff4444, 1)
        g.strokeCircle(cx, size * 0.30, headR)
        g.lineStyle(2, 0xff4444, 1)
        g.strokeRect(cx - bodyW / 2, size * 0.38, bodyW, bodyH)
      } else if (def.special === 'shaman') {
        // Staff glimmer
        g.fillStyle(0xffffff, 0.6)
        g.fillCircle(cx + bodyW / 2 + 4, size * 0.35, 3)
      } else if (def.special === 'dark') {
        // Visor effect
        g.fillStyle(0xff3300, 0.8)
        g.fillRect(cx - headR * 0.6, size * 0.28 - 3, headR * 1.2, 5)
      } else {
        // Eyes
        g.fillStyle(0xffffff, 0.8)
        g.fillCircle(cx - headR * 0.35, size * 0.28, 2.5)
        g.fillCircle(cx + headR * 0.35, size * 0.28, 2.5)
      }

      // Legs
      g.fillStyle(def.color, 1)
      g.fillRect(cx - bodyW / 2, size * 0.66, bodyW * 0.35, size * 0.18)
      g.fillRect(cx + bodyW * 0.13, size * 0.66, bodyW * 0.35, size * 0.18)

      g.generateTexture(def.key, size, size)
      g.destroy()
    }

    // Tower textures: each type × 3 levels
    const towerDefs: { type: TowerType; colors: number[]; shape: string }[] = [
      { type: 'archer',   colors: [0x92400e, 0xa05020, 0xb06030], shape: 'tower' },
      { type: 'monk',     colors: [0xd4af37, 0xdfc04a, 0xeacf5d], shape: 'pagoda' },
      { type: 'ballista', colors: [0x374151, 0x4a5568, 0x5a6580], shape: 'wide' },
      { type: 'naga',     colors: [0x0d9488, 0x10a89b, 0x14c4b5], shape: 'curved' },
      { type: 'elephant', colors: [0x6b7280, 0x7a8290, 0x8a92a0], shape: 'heavy' },
    ]

    for (const def of towerDefs) {
      for (let lvl = 1; lvl <= 3; lvl++) {
        const key = `td_tower_${def.type}_${lvl}`
        if (this.textures.exists(key)) continue
        const size = cs
        const g = this.make.graphics({ add: false } as Phaser.Types.GameObjects.Graphics.Options)
        const col = def.colors[lvl - 1]

        // Stone base
        g.fillStyle(0x4a3728, 1)
        g.fillRoundedRect(2, size * 0.55, size - 4, size * 0.42, 4)
        g.fillStyle(0x5a4738, 1)
        g.fillRect(4, size * 0.55, size - 8, 3)

        // Level 2+ gold rim
        if (lvl >= 2) {
          g.lineStyle(2, 0xd4af37, 1)
          g.strokeRoundedRect(2, size * 0.55, size - 4, size * 0.42, 4)
        }

        // Tower body based on shape
        if (def.shape === 'tower') {
          // Archer: narrow tall tower
          g.fillStyle(col, 1)
          g.fillRect(half - size*0.15, size*0.12, size*0.30, size*0.45)
          // Battlements
          for (let b = 0; b < 3; b++) {
            g.fillRect(half - size*0.15 + b * size*0.10, size*0.08, size*0.07, size*0.08)
          }
          // Arrow slit
          g.fillStyle(0x000000, 0.6)
          g.fillRect(half - 2, size*0.22, 4, size*0.20)
        } else if (def.shape === 'pagoda') {
          // Monk: pagoda tiers
          g.fillStyle(col, 1)
          g.fillRect(half - size*0.28, size*0.38, size*0.56, size*0.18)
          g.fillRect(half - size*0.20, size*0.24, size*0.40, size*0.16)
          g.fillRect(half - size*0.12, size*0.12, size*0.24, size*0.14)
          // Spire
          g.fillStyle(0xffffff, 0.8)
          g.fillTriangle(half, size*0.04, half - 5, size*0.14, half + 5, size*0.14)
        } else if (def.shape === 'wide') {
          // Ballista: wide crossbow platform
          g.fillStyle(col, 1)
          g.fillRect(half - size*0.35, size*0.30, size*0.70, size*0.26)
          // Crossbow
          g.fillStyle(0x8a9db5, 1)
          g.fillRect(half - size*0.05, size*0.15, size*0.10, size*0.18)
          g.fillRect(half - size*0.25, size*0.19, size*0.50, size*0.07)
          // Bolt
          g.fillStyle(0xffd700, 1)
          g.fillRect(half - size*0.18, size*0.21, size*0.36, size*0.03)
        } else if (def.shape === 'curved') {
          // Naga: serpentine shape
          g.fillStyle(col, 1)
          g.fillEllipse(half, size*0.26, size*0.40, size*0.22)
          g.fillRect(half - size*0.12, size*0.22, size*0.24, size*0.32)
          // Serpent head
          g.fillEllipse(half + size*0.16, size*0.18, size*0.20, size*0.14)
          // Tongue
          g.fillStyle(0xff4444, 1)
          g.fillRect(half + size*0.24, size*0.16, size*0.08, 3)
        } else if (def.shape === 'heavy') {
          // Elephant: massive block with tusks
          g.fillStyle(col, 1)
          g.fillRoundedRect(half - size*0.30, size*0.18, size*0.60, size*0.38, 6)
          // Ears
          g.fillEllipse(half - size*0.34, size*0.28, size*0.14, size*0.22)
          g.fillEllipse(half + size*0.34, size*0.28, size*0.14, size*0.22)
          // Trunk
          g.fillStyle(col, 1)
          g.fillEllipse(half, size*0.55, size*0.18, size*0.18)
          // Tusks
          g.fillStyle(0xfffff0, 1)
          g.fillRect(half - size*0.28, size*0.42, size*0.10, 5)
          g.fillRect(half + size*0.18, size*0.42, size*0.10, 5)
          // Eyes
          g.fillStyle(0x111111, 1)
          g.fillCircle(half - size*0.12, size*0.28, 3)
          g.fillCircle(half + size*0.12, size*0.28, 3)
        }

        // Level 3 glow marker
        if (lvl === 3) {
          g.lineStyle(3, 0xffd700, 0.5)
          g.strokeCircle(half, half * 0.5, size * 0.38)
        }

        g.generateTexture(key, size, size)
        g.destroy()
      }
    }
  }

  // ── Background ────────────────────────────────────────────────────

  private drawAngkorSilhouette(width: number, height: number) {
    const gridH = this.cellSize * this.gridRows
    const gridBottom = this.gridOffY + gridH
    const bg = this.add.graphics().setDepth(0)

    // Sky gradient background
    bg.fillGradientStyle(0x0a0510, 0x0a0510, 0x1a0d05, 0x1a0d05, 1)
    bg.fillRect(0, 0, width, height)

    // Angkor Wat silhouette
    const silW = width * 0.90
    const silX = (width - silW) / 2
    const silColor = 0x2d1040

    // Central tower (tallest)
    const ct = { x: silX + silW * 0.5, w: silW * 0.10, h: gridH * 0.40 }
    // Inner towers
    const it1 = { x: silX + silW * 0.35, w: silW * 0.07, h: gridH * 0.30 }
    const it2 = { x: silX + silW * 0.65, w: silW * 0.07, h: gridH * 0.30 }
    // Outer towers
    const ot1 = { x: silX + silW * 0.18, w: silW * 0.06, h: gridH * 0.20 }
    const ot2 = { x: silX + silW * 0.82, w: silW * 0.06, h: gridH * 0.20 }

    bg.fillStyle(silColor, 1)

    const drawTower = (tx: number, tw: number, th: number) => {
      // Base platform
      bg.fillRect(tx - tw * 0.8, gridBottom - th * 0.12, tw * 1.6, th * 0.12)
      // Mid section
      bg.fillRect(tx - tw * 0.6, gridBottom - th * 0.55, tw * 1.2, th * 0.43)
      // Upper section
      bg.fillRect(tx - tw * 0.4, gridBottom - th * 0.80, tw * 0.8, th * 0.25)
      // Spire
      bg.fillTriangle(tx - tw * 0.15, gridBottom - th * 0.80, tx + tw * 0.15, gridBottom - th * 0.80, tx, gridBottom - th)
    }

    drawTower(ct.x, ct.w, ct.h)
    drawTower(it1.x, it1.w, it1.h)
    drawTower(it2.x, it2.w, it2.h)
    drawTower(ot1.x, ot1.w, ot1.h)
    drawTower(ot2.x, ot2.w, ot2.h)

    // Connecting base wall
    bg.fillRect(silX, gridBottom - gridH * 0.08, silW, gridH * 0.08)
  }

  // ── Level setup ───────────────────────────────────────────────────

  private initLevel(levelIndex: number) {
    this.currentLevel = levelIndex
    const def = LEVELS[levelIndex]

    // Reset grid
    this.grid = []
    for (let r = 0; r < this.gridRows; r++) {
      this.grid[r] = []
      for (let c = 0; c < this.gridCols; c++) {
        this.grid[r][c] = 'empty'
      }
    }

    // Mark path cells
    const rawPath = def.path
    for (const wp of rawPath) {
      const col = wp[0], row = wp[1]
      if (col >= 0 && col < this.gridCols && row >= 0 && row < this.gridRows) {
        this.grid[row][col] = 'path'
      }
    }

    // Also mark cells between consecutive waypoints
    for (let i = 0; i < rawPath.length - 1; i++) {
      const a = rawPath[i], b = rawPath[i + 1]
      if (a[0] === b[0]) {
        // Same column, interpolate rows
        const minR = Math.min(a[1], b[1]), maxR = Math.max(a[1], b[1])
        for (let r = minR; r <= maxR; r++) {
          if (a[0] >= 0 && a[0] < this.gridCols && r >= 0 && r < this.gridRows)
            this.grid[r][a[0]] = 'path'
        }
      } else if (a[1] === b[1]) {
        // Same row, interpolate cols
        const minC = Math.max(0, Math.min(a[0], b[0])), maxC = Math.min(7, Math.max(a[0], b[0]))
        for (let c = minC; c <= maxC; c++) {
          if (c >= 0 && c < this.gridCols && a[1] >= 0 && a[1] < this.gridRows)
            this.grid[a[1]][c] = 'path'
        }
      }
    }

    // Convert waypoints to world positions
    this.pathWaypoints = rawPath.map(wp => ({
      x: this.gridOffX + wp[0] * this.cellSize + this.cellSize / 2,
      y: this.gridOffY + wp[1] * this.cellSize + this.cellSize / 2,
    }))

    // Reset state
    this.gold = def.startGold
    this.lives = 20
    this.score = 0
    this.currentWave = 0
    this.waveActive = false

    // Clear enemies, towers, projectiles
    for (const e of this.enemies) {
      e.sprite.destroy()
      e.hpBar.destroy()
      e.hpBarBg.destroy()
    }
    this.enemies = []

    for (const t of this.towers) {
      t.container.destroy()
      if (t.rangePreview) t.rangePreview.destroy()
    }
    this.towers = []

    for (const p of this.projectiles) {
      p.gfx.destroy()
    }
    this.projectiles = []

    this.selectedTower = null
    this.selectedTowerType = null
    this.spawnQueue = []

    this.drawMap()
    this.updateHUD()
    this.setLaunchBtnVisible(true)
  }

  // ── Map drawing ───────────────────────────────────────────────────

  private drawMap() {
    const g = this.mapGraphics
    g.clear()

    const cs = this.cellSize
    const ox = this.gridOffX, oy = this.gridOffY

    // Background: dark stone
    g.fillStyle(0x2d1b0e, 1)
    g.fillRect(ox, oy, cs * this.gridCols, cs * this.gridRows)

    // Grid lines
    g.lineStyle(1, 0x3d2b1e, 0.4)
    for (let r = 0; r <= this.gridRows; r++) {
      g.lineBetween(ox, oy + r * cs, ox + cs * this.gridCols, oy + r * cs)
    }
    for (let c = 0; c <= this.gridCols; c++) {
      g.lineBetween(ox + c * cs, oy, ox + c * cs, oy + cs * this.gridRows)
    }

    // Buildable cells
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        if (this.grid[r][c] === 'empty') {
          g.fillStyle(0x3d2b1e, 0.5)
          g.fillRect(ox + c * cs + 1, oy + r * cs + 1, cs - 2, cs - 2)
        }
      }
    }

    // Path cells
    const rawPath = LEVELS[this.currentLevel].path
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        if (this.grid[r][c] === 'path') {
          g.fillStyle(0x8b7355, 1)
          g.fillRoundedRect(ox + c * cs + 1, oy + r * cs + 1, cs - 2, cs - 2, 3)
          // Worn texture lines
          g.lineStyle(1, 0x6b5535, 0.4)
          g.lineBetween(ox + c * cs + 3, oy + r * cs + cs * 0.4, ox + c * cs + cs - 3, oy + r * cs + cs * 0.4)
        }
      }
    }

    // Path direction arrows
    for (let i = 0; i < rawPath.length - 1; i++) {
      const a = rawPath[i], b = rawPath[i + 1]
      const midC = (Math.max(0, a[0]) + Math.max(0, b[0])) / 2
      const midR = (Math.max(0, a[1]) + Math.max(0, b[1])) / 2
      if (midC < 0 || midC >= this.gridCols || midR < 0 || midR >= this.gridRows) continue

      const mx = ox + midC * cs + cs / 2
      const my = oy + midR * cs + cs / 2
      const dx = b[0] - a[0], dy = b[1] - a[1]
      const len = cs * 0.25

      g.fillStyle(0xd4af37, 0.5)
      if (Math.abs(dx) > Math.abs(dy)) {
        const dir = dx > 0 ? 1 : -1
        g.fillTriangle(mx + dir * len, my, mx - dir * len * 0.5, my - len * 0.6, mx - dir * len * 0.5, my + len * 0.6)
      } else {
        const dir = dy > 0 ? 1 : -1
        g.fillTriangle(mx, my + dir * len, mx - len * 0.6, my - dir * len * 0.5, mx + len * 0.6, my - dir * len * 0.5)
      }
    }

    // Start marker (green gate)
    const startWP = rawPath[0]
    const startX = this.gridOffX + startWP[0] * cs + cs / 2
    const startY = this.gridOffY + startWP[1] * cs + cs / 2
    g.fillStyle(0x22c55e, 0.9)
    g.fillCircle(startX, startY, cs * 0.3)
    g.fillStyle(0xffffff, 0.8)
    g.fillTriangle(startX + cs * 0.08, startY, startX - cs * 0.10, startY - cs * 0.15, startX - cs * 0.10, startY + cs * 0.15)

    // End marker (red temple icon)
    const endWP = rawPath[rawPath.length - 1]
    const endX = this.gridOffX + endWP[0] * cs + cs / 2
    const endY = this.gridOffY + endWP[1] * cs + cs / 2
    g.fillStyle(0xef4444, 0.9)
    g.fillCircle(endX, endY, cs * 0.3)
    g.fillStyle(0xffffff, 0.8)
    g.fillRect(endX - cs * 0.12, endY - cs * 0.14, cs * 0.24, cs * 0.22)
    g.fillTriangle(endX - cs * 0.16, endY - cs * 0.14, endX + cs * 0.16, endY - cs * 0.14, endX, endY - cs * 0.26)
  }

  // ── Bottom bar ───────────────────────────────────────────────────

  private drawBottomBar(width: number, height: number) {
    const gridBottom = this.gridOffY + this.gridRows * this.cellSize
    const barH = Math.max(100, height * 0.18)
    const barY = gridBottom

    // Background
    const g = this.add.graphics().setDepth(10)
    g.fillStyle(0x1a0d05, 0.97)
    g.fillRect(0, barY, width, barH)
    g.lineStyle(2, 0xd4af37, 0.8)
    g.lineBetween(0, barY, width, barY)

    // Left section: tower buttons (40%)
    const leftW = width * 0.42
    const btnAreaW = leftW - 8
    const btnCount = this.towerTypes.length
    const btnW = Math.max(44, Math.floor(btnAreaW / btnCount) - 4)
    const btnH = Math.max(44, barH - 20)
    const startBtnX = 4

    this.towerBtnData = []
    this.towerBtnHighlights = []

    for (let i = 0; i < this.towerTypes.length; i++) {
      const type = this.towerTypes[i]
      const base = TOWER_BASE[type]
      const bx = startBtnX + i * (btnW + 4)
      const by = barY + 6

      // Highlight ring (drawn on selection)
      const hl = this.add.graphics().setDepth(13)
      this.towerBtnHighlights.push(hl)

      // Button background
      const btnBg = this.add.graphics().setDepth(11)
      const drawBtnBg = (hover: boolean) => {
        btnBg.clear()
        btnBg.fillStyle(hover ? 0x3d2b0e : 0x2d1b0e, 0.95)
        btnBg.fillRoundedRect(bx, by, btnW, btnH - 4, 6)
        btnBg.lineStyle(hover ? 2 : 1, hover ? 0xd4af37 : 0x5a3a1e, hover ? 0.9 : 0.8)
        btnBg.strokeRoundedRect(bx, by, btnW, btnH - 4, 6)
      }
      drawBtnBg(false)

      // Tower mini icon
      const iconSize = Math.min(btnW - 8, btnH - 28)
      const iconX = bx + btnW / 2
      const iconY = by + 4 + iconSize / 2
      this.add.image(iconX, iconY, `td_tower_${type}_1`)
        .setDisplaySize(iconSize, iconSize).setDepth(12)

      // Cost text
      this.add.text(bx + btnW / 2, by + btnH - 16, `${base.emoji} ${base.cost}💰`, {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#f5d060',
      }).setOrigin(0.5, 1).setDepth(12)

      // Interactive zone
      const zone = this.add.zone(bx + btnW / 2, by + (btnH - 4) / 2, btnW, btnH - 4)
        .setInteractive({ useHandCursor: true }).setDepth(13)

      zone.on('pointerover', () => drawBtnBg(true))
      zone.on('pointerout',  () => { if (this.selectedTowerType !== type) drawBtnBg(false) })
      zone.on('pointerdown', () => this.selectTowerType(type))

      this.towerBtnData.push({ btnX: bx, btnY: by, btnW, btnH, type, btnBg })
    }

    // Right section (60%): HUD info
    const rightX = leftW + 8
    const hudY = barY + 8

    this.goldText = this.add.text(rightX, hudY, '💰 150', {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: '13px', color: '#f5d060',
    }).setDepth(12)

    this.livesText = this.add.text(rightX + 90, hudY, '❤️ 20', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#f87171',
    }).setDepth(12)

    this.waveText = this.add.text(rightX, hudY + 20, 'Vague 0/0', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#94a3b8',
    }).setDepth(12)

    // Wave progress bar
    this.waveProgressBar = this.add.graphics().setDepth(12)

    // Launch button
    const lbX = rightX, lbY = hudY + 38
    const lbW = Math.min(width - rightX - 8, 170), lbH = 36

    this.launchBtnGfx = this.add.graphics().setDepth(12)
    this.launchBtnGfx.fillStyle(0x15803d, 1)
    this.launchBtnGfx.fillRoundedRect(lbX, lbY, lbW, lbH, 8)
    this.launchBtnGfx.lineStyle(2, 0x22c55e, 0.9)
    this.launchBtnGfx.strokeRoundedRect(lbX, lbY, lbW, lbH, 8)

    this.launchBtnTxt = this.add.text(lbX + lbW / 2, lbY + lbH / 2, '▶ LANCER LA VAGUE', {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: '11px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(13)

    this.launchBtnZone = this.add.zone(lbX + lbW / 2, lbY + lbH / 2, lbW, lbH)
      .setInteractive({ useHandCursor: true }).setDepth(14)
    this.launchBtnZone.on('pointerover', () => this.launchBtnTxt.setScale(1.05))
    this.launchBtnZone.on('pointerout',  () => this.launchBtnTxt.setScale(1))
    this.launchBtnZone.on('pointerdown', () => {
      if (this.waveActive || !this.gameStarted) return
      this.startWave()
    })

    this.launchBtn = this.add.container(0, 0, [])
  }

  // ── Input ─────────────────────────────────────────────────────────

  private setupInput(_width: number, _height: number) {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.gameStarted) return

      // Check if click is in grid area
      const gridH = this.gridRows * this.cellSize
      if (p.y > this.gridOffY + gridH) return  // bottom bar — handled by zones

      const cell = this.worldToCell(p.x, p.y)
      if (cell.col < 0 || cell.col >= this.gridCols || cell.row < 0 || cell.row >= this.gridRows) {
        this.deselectAll()
        return
      }

      const cellState = this.grid[cell.row][cell.col]

      if (this.selectedTowerType !== null) {
        if (cellState === 'empty') {
          this.placeTower(this.selectedTowerType, cell.col, cell.row)
          this.selectedTowerType = null
          this.updateTowerBtnHighlights()
          this.rangePreviewGfx.clear()
        } else if (cellState === 'tower') {
          const t = this.towers.find(t => t.col === cell.col && t.row === cell.row)
          if (t) { this.selectedTowerType = null; this.updateTowerBtnHighlights(); this.showTowerInfo(t) }
        } else {
          this.deselectAll()
        }
      } else {
        if (cellState === 'tower') {
          const t = this.towers.find(t => t.col === cell.col && t.row === cell.row)
          if (t) this.showTowerInfo(t)
        } else {
          this.deselectAll()
        }
      }
    })

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.gameStarted || this.selectedTowerType === null) return
      const cell = this.worldToCell(p.x, p.y)
      if (cell.col < 0 || cell.col >= this.gridCols || cell.row < 0 || cell.row >= this.gridRows) {
        this.rangePreviewGfx.clear()
        return
      }
      if (this.grid[cell.row][cell.col] !== 'empty') {
        this.rangePreviewGfx.clear()
        return
      }
      // Show range preview
      const base = TOWER_BASE[this.selectedTowerType]
      const wp = this.cellToWorld(cell.col, cell.row)
      this.rangePreviewGfx.clear()
      this.rangePreviewGfx.fillStyle(0x22c55e, 0.10)
      this.rangePreviewGfx.fillCircle(wp.x, wp.y, base.range * this.cellSize)
      this.rangePreviewGfx.lineStyle(2, 0x22c55e, 0.5)
      this.rangePreviewGfx.strokeCircle(wp.x, wp.y, base.range * this.cellSize)
    })
  }

  private deselectAll() {
    this.selectedTowerType = null
    this.selectedTower = null
    this.updateTowerBtnHighlights()
    this.rangePreviewGfx.clear()
    this.hideInfoPanel()
    // Clear range rings on towers
    for (const t of this.towers) {
      if (t.rangePreview) { t.rangePreview.clear() }
    }
  }

  private selectTowerType(type: TowerType) {
    this.selectedTowerType = type
    this.selectedTower = null
    this.hideInfoPanel()
    this.updateTowerBtnHighlights()
    // Clear tower range rings
    for (const t of this.towers) {
      if (t.rangePreview) t.rangePreview.clear()
    }
  }

  private updateTowerBtnHighlights() {
    for (const hl of this.towerBtnHighlights) hl.clear()
    for (let i = 0; i < this.towerBtnData.length; i++) {
      const { btnX, btnY, btnW, btnH, type } = this.towerBtnData[i]
      const hl = this.towerBtnHighlights[i]
      if (this.selectedTowerType === type) {
        hl.lineStyle(3, 0xd4af37, 1)
        hl.strokeRoundedRect(btnX - 1, btnY - 1, btnW + 2, btnH - 2, 7)
      }
    }
  }

  // ── Tower placement ───────────────────────────────────────────────

  private placeTower(type: TowerType, col: number, row: number) {
    const base = TOWER_BASE[type]
    if (this.gold < base.cost) {
      this.showFloatingText('Pas assez d\'or!', this.cellToWorld(col, row).x, this.cellToWorld(col, row).y, '#ff4444')
      return
    }

    this.gold -= base.cost
    this.grid[row][col] = 'tower'

    const wp = this.cellToWorld(col, row)
    const img = this.add.image(0, 0, `td_tower_${type}_1`).setDisplaySize(this.cellSize, this.cellSize)
    const container = this.add.container(wp.x, wp.y, [img]).setDepth(4)

    const rangeGfx = this.add.graphics().setDepth(3)

    const special = this.buildSpecial(type, 1)
    const tower: TDTower = {
      col, row, type, level: 1,
      range: base.range,
      damage: base.damage,
      fireRate: base.fireRate,
      fireTimer: 0,
      target: null,
      container,
      rangePreview: rangeGfx,
      special,
    }
    this.towers.push(tower)

    // Place animation
    container.setScale(0.1)
    this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 300, ease: 'Back.easeOut' })

    this.updateHUD()
    this.drawMap()
  }

  private buildSpecial(type: TowerType, level: number): TDTower['special'] {
    if (type === 'monk') {
      const slowAmts = [0.40, 0.55, 0.55]
      const slowDurs = [1500, 2000, 2000]
      return { slow: true, slowAmt: slowAmts[level - 1], slowDur: slowDurs[level - 1], areaSlot: level === 3 }
    }
    if (type === 'ballista') return { pierce: level === 3 }
    if (type === 'naga')     return { poison: level === 3 }
    if (type === 'elephant') {
      const radii = [1.5, 1.8, 2.2]
      return { splash: true, splashRadius: radii[level - 1], stun: level === 3, stunDur: 500 }
    }
    if (type === 'archer')   return { multishot: level === 3 }
    return {}
  }

  private upgradeTower(tower: TDTower) {
    if (tower.level >= 3) return
    const base = TOWER_BASE[tower.type]
    const upgradeCost = Math.round(base.cost * (tower.level === 1 ? 0.9 : 1.3))
    if (this.gold < upgradeCost) {
      this.showFloatingText('Pas assez d\'or!', tower.container.x, tower.container.y, '#ff4444')
      return
    }
    this.gold -= upgradeCost
    tower.level++
    this.applyUpgrade(tower)

    // Update sprite
    const img = this.add.image(0, 0, `td_tower_${tower.type}_${tower.level}`).setDisplaySize(this.cellSize, this.cellSize)
    tower.container.removeAll(true)
    tower.container.add(img)
    tower.special = this.buildSpecial(tower.type, tower.level)

    // Level 3 glow
    if (tower.level === 3 && (tower.container as any).postFX) {
      try { (tower.container as any).postFX.addGlow(0xd4af37, 4, 0, false, 0.1, 16) } catch { /* not supported */ }
    }

    this.hideInfoPanel()
    this.showTowerInfo(tower)
    this.updateHUD()
  }

  private applyUpgrade(tower: TDTower) {
    const t = tower.type
    const l = tower.level
    if (t === 'archer') {
      if (l === 2) { tower.damage = Math.round(tower.damage * 1.6); tower.range += 0.3; tower.fireRate -= 150 }
      if (l === 3) { tower.damage = Math.round(tower.damage * 1.3) } // multishot handles the rest
    } else if (t === 'monk') {
      if (l === 2) { tower.damage = Math.round(tower.damage * 1.5); tower.range += 0.4 }
      if (l === 3) { tower.range += 0.3 }
    } else if (t === 'ballista') {
      if (l === 2) { tower.damage = Math.round(tower.damage * 1.8); tower.range += 0.5 }
      if (l === 3) { tower.damage = Math.round(tower.damage * 1.4) }
    } else if (t === 'naga') {
      if (l === 2) { tower.damage = Math.round(tower.damage * 1.7); tower.fireRate -= 200; tower.range += 0.3 }
      if (l === 3) { tower.damage = Math.round(tower.damage * 1.3) }
    } else if (t === 'elephant') {
      if (l === 2) { tower.damage = Math.round(tower.damage * 1.7); tower.fireRate -= 400 }
      if (l === 3) { tower.damage = Math.round(tower.damage * 1.4) }
    }
  }

  private sellTower(tower: TDTower) {
    const base = TOWER_BASE[tower.type]
    let totalCost = base.cost
    if (tower.level >= 2) totalCost += Math.round(base.cost * 0.9)
    if (tower.level >= 3) totalCost += Math.round(base.cost * 1.3)
    const refund = Math.round(totalCost * 0.6)

    this.gold += refund
    this.grid[tower.row][tower.col] = 'empty'
    tower.container.destroy()
    if (tower.rangePreview) tower.rangePreview.destroy()
    this.towers = this.towers.filter(t => t !== tower)
    this.hideInfoPanel()
    this.drawMap()
    this.updateHUD()
    this.showFloatingText(`+${refund}💰`, this.cellToWorld(tower.col, tower.row).x, this.cellToWorld(tower.col, tower.row).y, '#f5d060')
  }

  // ── Tower info panel ──────────────────────────────────────────────

  private showTowerInfo(tower: TDTower) {
    this.selectedTower = tower
    this.hideInfoPanel()

    // Show range ring
    if (tower.rangePreview) {
      tower.rangePreview.clear()
      tower.rangePreview.fillStyle(0xd4af37, 0.12)
      tower.rangePreview.fillCircle(tower.container.x, tower.container.y, tower.range * this.cellSize)
      tower.rangePreview.lineStyle(2, 0xd4af37, 0.6)
      tower.rangePreview.strokeCircle(tower.container.x, tower.container.y, tower.range * this.cellSize)
    }

    const { width } = this.scale
    const panelW = Math.min(200, width - 20)
    const panelH = 140
    const px = Phaser.Math.Clamp(tower.container.x - panelW / 2, 5, width - panelW - 5)
    const py = Math.max(10, tower.container.y - panelH - this.cellSize)

    const g = this.add.graphics().setDepth(20)
    g.fillStyle(0x0d0a05, 0.95)
    g.fillRoundedRect(px, py, panelW, panelH, 10)
    g.lineStyle(2, 0xd4af37, 0.9)
    g.strokeRoundedRect(px, py, panelW, panelH, 10)

    const base = TOWER_BASE[tower.type]
    const titleTxt = this.add.text(px + panelW / 2, py + 12, `${base.emoji} ${base.label} Niv.${tower.level}`, {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: '12px', color: '#f5d060',
    }).setOrigin(0.5, 0).setDepth(21)

    const statsTxt = this.add.text(px + 8, py + 32, [
      `Dégâts: ${tower.damage}`,
      `Portée: ${tower.range.toFixed(1)} cases`,
      `Cadence: ${(1000 / tower.fireRate).toFixed(1)}/s`,
    ].join('\n'), {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#d0c0a0', lineSpacing: 3,
    }).setDepth(21)

    const closeBtn = this.makeSmallBtn(px + panelW - 20, py + 4, '✕', 0x333333, 0x888888, () => this.deselectAll())

    let upgradeBtn: Phaser.GameObjects.Graphics | null = null
    let upgradeTxt: Phaser.GameObjects.Text | null = null
    let upgradeZone: Phaser.GameObjects.Zone | null = null
    if (tower.level < 3) {
      const upgCost = Math.round(base.cost * (tower.level === 1 ? 0.9 : 1.3))
      const canAfford = this.gold >= upgCost
      upgradeBtn = this.add.graphics().setDepth(21)
      upgradeBtn.fillStyle(canAfford ? 0x15803d : 0x333333, 1)
      upgradeBtn.fillRoundedRect(px + 6, py + 88, panelW * 0.53 - 3, 34, 6)
      upgradeBtn.lineStyle(1, canAfford ? 0x22c55e : 0x555555, 0.8)
      upgradeBtn.strokeRoundedRect(px + 6, py + 88, panelW * 0.53 - 3, 34, 6)
      upgradeTxt = this.add.text(px + 6 + (panelW * 0.53 - 3) / 2, py + 105, `⬆ ${upgCost}💰`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: canAfford ? '#fff' : '#666',
      }).setOrigin(0.5).setDepth(22)
      upgradeZone = this.add.zone(px + 6 + (panelW * 0.53 - 3) / 2, py + 105, panelW * 0.53 - 3, 34)
        .setInteractive({ useHandCursor: true }).setDepth(23)
      upgradeZone.on('pointerdown', () => { if (canAfford) this.upgradeTower(tower) })
    }

    const sellRefund = Math.round(base.cost * 0.6 * tower.level)
    const sellBtn = this.add.graphics().setDepth(21)
    const sellX = tower.level < 3 ? px + panelW * 0.53 + 3 : px + 6
    const sellW = tower.level < 3 ? panelW * 0.47 - 9 : panelW - 12
    sellBtn.fillStyle(0x7f1d1d, 1)
    sellBtn.fillRoundedRect(sellX, py + 88, sellW, 34, 6)
    sellBtn.lineStyle(1, 0xef4444, 0.8)
    sellBtn.strokeRoundedRect(sellX, py + 88, sellW, 34, 6)
    const sellTxt = this.add.text(sellX + sellW / 2, py + 105, `💰 ${sellRefund}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#fca5a5',
    }).setOrigin(0.5).setDepth(22)
    const sellZone = this.add.zone(sellX + sellW / 2, py + 105, sellW, 34)
      .setInteractive({ useHandCursor: true }).setDepth(23)
    sellZone.on('pointerdown', () => this.sellTower(tower))

    const children: Phaser.GameObjects.GameObject[] = [g, titleTxt, statsTxt, closeBtn.g, closeBtn.txt, closeBtn.zone, sellBtn, sellTxt, sellZone]
    if (upgradeBtn)  children.push(upgradeBtn)
    if (upgradeTxt)  children.push(upgradeTxt)
    if (upgradeZone) children.push(upgradeZone)

    this.infoPanel = this.add.container(0, 0, children).setDepth(20)
  }

  private makeSmallBtn(x: number, y: number, label: string, bgColor: number, borderColor: number, cb: () => void) {
    const g = this.add.graphics().setDepth(22)
    g.fillStyle(bgColor, 0.9)
    g.fillCircle(x, y, 10)
    g.lineStyle(1, borderColor, 0.8)
    g.strokeCircle(x, y, 10)
    const txt = this.add.text(x, y, label, { fontSize: '10px', color: '#ccc' }).setOrigin(0.5).setDepth(23)
    const zone = this.add.zone(x, y, 20, 20).setInteractive({ useHandCursor: true }).setDepth(24)
    zone.on('pointerdown', cb)
    return { g, txt, zone }
  }

  private hideInfoPanel() {
    if (this.infoPanel) {
      this.infoPanel.getAll().forEach(obj => (obj as Phaser.GameObjects.GameObject).destroy())
      this.infoPanel.destroy()
      this.infoPanel = null
    }
    if (this.selectedTower?.rangePreview) this.selectedTower.rangePreview.clear()
    this.selectedTower = null
  }

  // ── Wave system ───────────────────────────────────────────────────

  private startWave() {
    if (this.waveActive) return
    const def = LEVELS[this.currentLevel]
    if (this.currentWave >= def.waves.length) return

    this.waveActive = true
    this.setLaunchBtnVisible(false)

    const wave = def.waves[this.currentWave]
    this.spawnQueue = []
    for (const group of wave.enemies) {
      for (let i = 0; i < group.count; i++) {
        this.spawnQueue.push({ type: group.type, interval: wave.interval })
      }
    }
    this.spawnTimer = 0

    // Wave banner
    this.showWaveBanner(`⚔️ VAGUE ${this.currentWave + 1}`)

    this.updateHUD()
  }

  private showWaveBanner(text: string) {
    const { width, height } = this.scale
    const banner = this.add.text(width / 2, height * 0.15, text, {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: '28px', color: '#f5d060',
      stroke: '#000000', strokeThickness: 4,
      shadow: { blur: 12, color: '#d4af37', fill: true, offsetX: 0, offsetY: 0 },
    }).setOrigin(0.5).setDepth(30).setAlpha(0).setY(-50)

    this.tweens.add({
      targets: banner,
      y: height * 0.15,
      alpha: 1,
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(1200, () => {
          this.tweens.add({ targets: banner, alpha: 0, y: height * 0.10, duration: 400, onComplete: () => banner.destroy() })
        })
      }
    })
  }

  private waveComplete() {
    this.waveActive = false
    this.currentWave++
    const def = LEVELS[this.currentLevel]
    const goldBonus = 50
    this.gold += goldBonus
    this.score += goldBonus * 2

    this.showFloatingText(`+${goldBonus}💰 Vague terminée!`, this.scale.width / 2, this.scale.height * 0.20, '#f5d060')

    if (this.currentWave >= def.waves.length) {
      // Level complete
      this.time.delayedCall(800, () => this.showLevelComplete())
    } else {
      this.setLaunchBtnVisible(true)
    }
    this.updateHUD()
  }

  private setLaunchBtnVisible(visible: boolean) {
    if (!this.launchBtnGfx) return
    this.launchBtnGfx.setVisible(visible)
    this.launchBtnTxt.setVisible(visible)
    this.launchBtnZone.setActive(visible)
  }

  // ── Enemy system ──────────────────────────────────────────────────

  private spawnEnemy(type: EnemyType) {
    const stats = ENEMY_STATS[type]
    const bossHpBonus = type === 'boss' ? this.currentLevel * 400 : 0
    const maxHp = stats.hp + bossHpBonus

    const startWP = this.pathWaypoints[0]
    const bodySize = stats.large ? Math.floor(this.cellSize * 1.2) : Math.floor(this.cellSize * 0.8)

    // Sprite container
    const img = this.add.image(0, 0, `td_enemy_${type}`).setDisplaySize(bodySize, bodySize)
    const container = this.add.container(startWP.x, startWP.y, [img]).setDepth(5)

    // HP bar — use Rectangle (no redraw needed, just position/size update)
    const barW = stats.large ? this.cellSize * 1.1 : this.cellSize * 0.85
    const barH = stats.large ? 7 : 5
    const barX = startWP.x - barW / 2
    const barY2 = startWP.y - bodySize / 2 - barH - 4
    const hpBarBg = this.add.rectangle(barX, barY2, barW, barH, 0x1f2937)
      .setOrigin(0, 0).setDepth(6)
    const hpBar = this.add.rectangle(barX + 1, barY2 + 1, barW - 2, barH - 2, 0x22c55e)
      .setOrigin(0, 0).setDepth(7)

    const id = ++this.enemyIdCounter
    const enemy: TDEnemy = {
      id, type,
      hp: maxHp, maxHp,
      speed: stats.speed,
      reward: stats.reward,
      slowed: false, slowTimer: 0, slowAmt: 0,
      stunned: false, stunTimer: 0,
      poisoned: false, poisonTimer: 0, poisonDamage: 0,
      waypointIndex: 1,
      x: startWP.x, y: startWP.y,
      sprite: container, hpBarBg, hpBar, hpBarMaxW: barW - 2, lastHp: maxHp,
      active: true,
      immune: stats.immune,
    }
    this.enemies.push(enemy)
  }

  private updateEnemy(enemy: TDEnemy, dt: number) {
    if (!enemy.active) return

    // Stun
    if (enemy.stunned) {
      enemy.stunTimer -= dt * 1000
      if (enemy.stunTimer <= 0) enemy.stunned = false
      // Update HP bar position
      this.updateEnemyHPBar(enemy)
      return
    }

    // Slow
    if (enemy.slowed) {
      enemy.slowTimer -= dt * 1000
      if (enemy.slowTimer <= 0) { enemy.slowed = false; enemy.slowAmt = 0 }
    }

    // Poison
    if (enemy.poisoned) {
      enemy.poisonTimer -= dt * 1000
      enemy.hp -= enemy.poisonDamage * dt
      if (enemy.hp <= 0) { this.killEnemy(enemy); return }
      if (enemy.poisonTimer <= 0) { enemy.poisoned = false; enemy.poisonDamage = 0 }
    }

    const effectiveSpeed = enemy.slowed ? enemy.speed * (1 - enemy.slowAmt) : enemy.speed

    // Move toward next waypoint
    if (enemy.waypointIndex >= this.pathWaypoints.length) {
      // Reached end
      this.lives--
      this.updateHUD()
      this.cameras.main.flash(180, 80, 0, 0)
      this.destroyEnemy(enemy)
      if (this.lives <= 0) this.doGameOver()
      return
    }

    const target = this.pathWaypoints[enemy.waypointIndex]
    const dx = target.x - enemy.x
    const dy = target.y - enemy.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < 4) {
      enemy.waypointIndex++
    } else {
      const step = effectiveSpeed * dt
      enemy.x += (dx / dist) * step
      enemy.y += (dy / dist) * step
    }

    enemy.sprite.setPosition(enemy.x, enemy.y)
    // Face direction
    if (Math.abs(dx) > Math.abs(dy)) {
      enemy.sprite.scaleX = dx < 0 ? -1 : 1
    }

    // Slow tint
    if (enemy.slowed) {
      enemy.sprite.setAlpha(0.85)
    } else {
      enemy.sprite.setAlpha(1)
    }

    this.updateEnemyHPBar(enemy)
  }

  private updateEnemyHPBar(enemy: TDEnemy) {
    const stats = ENEMY_STATS[enemy.type]
    const bodySize = stats.large ? Math.floor(this.cellSize * 1.2) : Math.floor(this.cellSize * 0.8)
    const barW = stats.large ? this.cellSize * 1.1 : this.cellSize * 0.85
    const barH = stats.large ? 7 : 5
    const bx = enemy.x - barW / 2
    const by = enemy.y - bodySize / 2 - barH - 4

    // Always move the bar to follow the enemy
    enemy.hpBarBg.setPosition(bx, by)
    enemy.hpBar.setPosition(bx + 1, by + 1)

    // Only update width/color when HP actually changed
    if (enemy.hp !== enemy.lastHp) {
      enemy.lastHp = enemy.hp
      const hpRatio = Math.max(0, enemy.hp / enemy.maxHp)
      const newW = Math.max(0, (enemy.hpBarMaxW) * hpRatio)
      enemy.hpBar.setSize(newW, barH - 2)
      const r = Math.round(255 * (1 - hpRatio))
      const g2 = Math.round(200 * hpRatio)
      enemy.hpBar.setFillStyle(Phaser.Display.Color.GetColor(r, g2, 30))
    }
  }

  private killEnemy(enemy: TDEnemy) {
    this.gold += enemy.reward
    this.score += enemy.reward * 2
    this.showFloatingText(`+${enemy.reward}`, enemy.x, enemy.y - 20, '#f5d060')
    this.spawnDeathParticles(enemy.x, enemy.y, ENEMY_STATS[enemy.type].color)
    this.destroyEnemy(enemy)
    this.updateHUD()
  }

  private destroyEnemy(enemy: TDEnemy) {
    enemy.active = false
    this.tweens.add({
      targets: enemy.sprite,
      alpha: 0, scaleX: 0.2, scaleY: 0.2,
      duration: 200,
      onComplete: () => {
        enemy.sprite.destroy()
        enemy.hpBar.destroy()
        enemy.hpBarBg.destroy()
      }
    })
  }

  private spawnDeathParticles(x: number, y: number, color: number) {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5
      const speed = 40 + Math.random() * 60
      const g = this.add.graphics().setDepth(8)
      g.fillStyle(color, 1)
      g.fillCircle(0, 0, 4 + Math.random() * 3)
      g.x = x; g.y = y
      this.tweens.add({
        targets: g,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0, scaleX: 0.2, scaleY: 0.2,
        duration: 350 + Math.random() * 150,
        ease: 'Sine.easeOut',
        onComplete: () => g.destroy(),
      })
    }
  }

  // ── Tower firing ──────────────────────────────────────────────────

  private updateTower(tower: TDTower, _dt: number) {
    tower.fireTimer -= 16  // approximate per frame
    if (tower.fireTimer > 0) return

    // Find targets
    const targets = this.getTargets(tower)
    if (targets.length === 0) return

    tower.fireTimer = tower.fireRate

    if (tower.special.areaSlot) {
      // Area slow: affect all in range
      for (const t of targets) {
        if (!t.immune) {
          t.slowed = true
          t.slowAmt = tower.special.slowAmt ?? 0.55
          t.slowTimer = tower.special.slowDur ?? 2000
        }
      }
      // Visual pulse
      if (tower.rangePreview) {
        tower.rangePreview.clear()
        tower.rangePreview.fillStyle(0x6366f1, 0.20)
        tower.rangePreview.fillCircle(tower.container.x, tower.container.y, tower.range * this.cellSize)
        this.time.delayedCall(300, () => { if (tower.rangePreview) tower.rangePreview.clear() })
      }
      return
    }

    const maxTargets = tower.special.multishot ? 2 : 1
    const firedAt = targets.slice(0, maxTargets)

    for (const target of firedAt) {
      this.fireProjectile(tower, target)
    }
  }

  private getTargets(tower: TDTower): TDEnemy[] {
    const rangePixels = tower.range * this.cellSize
    const tx = tower.container.x, ty = tower.container.y

    const inRange = this.enemies.filter(e => {
      if (!e.active) return false
      const dx = e.x - tx, dy = e.y - ty
      return Math.sqrt(dx * dx + dy * dy) <= rangePixels
    })

    // Sort by progress (furthest along path = highest waypointIndex + progress to next)
    inRange.sort((a, b) => b.waypointIndex - a.waypointIndex)
    return inRange
  }

  private fireProjectile(tower: TDTower, target: TDEnemy) {
    const gfx = this.add.graphics().setDepth(6)
    this.drawProjectile(gfx, tower.type)

    gfx.x = tower.container.x
    gfx.y = tower.container.y

    const proj: TDProjectile = {
      x: tower.container.x,
      y: tower.container.y,
      targetId: target.id,
      damage: tower.damage,
      speed: 280 + (tower.type === 'archer' ? 80 : 0),
      gfx,
      active: true,
      type: tower.type,
      pierce: tower.special.pierce ?? false,
      hitIds: new Set(),
      splash: tower.special.splash ?? false,
      splashRadius: (tower.special.splashRadius ?? 0) * this.cellSize,
      slow: tower.special.slow ?? false,
      slowAmt: tower.special.slowAmt ?? 0,
      slowDur: tower.special.slowDur ?? 0,
      poison: tower.special.poison ?? false,
      stun: tower.special.stun ?? false,
      stunDur: tower.special.stunDur ?? 0,
    }
    this.projectiles.push(proj)
  }

  private drawProjectile(gfx: Phaser.GameObjects.Graphics, type: TowerType) {
    gfx.clear()
    if (type === 'archer') {
      gfx.fillStyle(0xfde047, 1); gfx.fillCircle(0, 0, 4)
    } else if (type === 'monk') {
      gfx.fillStyle(0x818cf8, 1); gfx.fillCircle(0, 0, 5)
      gfx.fillStyle(0xffffff, 0.5); gfx.fillCircle(0, 0, 2)
    } else if (type === 'ballista') {
      gfx.fillStyle(0x374151, 1); gfx.fillRect(-8, -2, 16, 4)
      gfx.fillStyle(0x9ca3af, 1); gfx.fillRect(6, -1, 4, 2)
    } else if (type === 'naga') {
      gfx.fillStyle(0x2dd4bf, 1); gfx.fillCircle(0, 0, 5)
    } else if (type === 'elephant') {
      gfx.fillStyle(0xf97316, 1); gfx.fillCircle(0, 0, 8)
      gfx.fillStyle(0xfef3c7, 0.5); gfx.fillCircle(0, 0, 4)
    }
  }

  private updateProjectile(proj: TDProjectile, dt: number) {
    if (!proj.active) return

    // Find target enemy
    const target = this.enemies.find(e => e.id === proj.targetId && e.active)

    let targetX: number, targetY: number
    if (target) {
      targetX = target.x; targetY = target.y
    } else if (!proj.pierce) {
      // No target, destroy
      proj.active = false; proj.gfx.destroy(); return
    } else {
      proj.active = false; proj.gfx.destroy(); return
    }

    const dx = targetX - proj.x, dy = targetY - proj.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < 12) {
      // Hit!
      this.onProjectileHit(proj, target)
      return
    }

    const step = proj.speed * dt
    proj.x += (dx / dist) * step
    proj.y += (dy / dist) * step
    proj.gfx.setPosition(proj.x, proj.y)

    // Rotate ballista bolt
    if (proj.type === 'ballista') {
      proj.gfx.setRotation(Math.atan2(dy, dx))
    }
  }

  private onProjectileHit(proj: TDProjectile, target: TDEnemy | undefined) {
    if (proj.splash) {
      // Splash damage
      for (const e of this.enemies) {
        if (!e.active) continue
        const dx = e.x - proj.x, dy = e.y - proj.y
        if (Math.sqrt(dx * dx + dy * dy) <= proj.splashRadius) {
          this.applyDamage(e, proj.damage, proj)
        }
      }
      // Explosion flash
      const flash = this.add.graphics().setDepth(7)
      flash.fillStyle(0xf97316, 0.6)
      flash.fillCircle(proj.x, proj.y, proj.splashRadius)
      this.tweens.add({ targets: flash, alpha: 0, scaleX: 1.5, scaleY: 1.5, duration: 250, onComplete: () => flash.destroy() })
    } else if (proj.pierce) {
      // Pierce: find all enemies on path
      for (const e of this.enemies) {
        if (!e.active || proj.hitIds.has(e.id)) continue
        const dx = e.x - proj.x, dy = e.y - proj.y
        if (Math.sqrt(dx * dx + dy * dy) <= this.cellSize * 0.6) {
          proj.hitIds.add(e.id)
          this.applyDamage(e, proj.damage, proj)
        }
      }
      if (target) {
        proj.hitIds.add(target.id)
        this.applyDamage(target, proj.damage, proj)
      }
    } else {
      if (target) this.applyDamage(target, proj.damage, proj)
    }

    proj.active = false
    proj.gfx.destroy()
  }

  private applyDamage(enemy: TDEnemy, damage: number, proj: TDProjectile) {
    if (!enemy.active) return
    enemy.hp -= damage

    if (proj.slow && !enemy.immune) {
      enemy.slowed = true
      enemy.slowAmt = Math.max(enemy.slowAmt, proj.slowAmt)
      enemy.slowTimer = Math.max(enemy.slowTimer, proj.slowDur)
    }
    if (proj.poison && !enemy.immune) {
      enemy.poisoned = true
      enemy.poisonDamage = 3
      enemy.poisonTimer = Math.max(enemy.poisonTimer, 3000)
    }
    if (proj.stun) {
      enemy.stunned = true
      enemy.stunTimer = Math.max(enemy.stunTimer, proj.stunDur)
    }

    if (enemy.hp <= 0) this.killEnemy(enemy)
  }

  // ── HUD ───────────────────────────────────────────────────────────

  private updateHUD() {
    if (!this.goldText) return
    this.goldText.setText(`💰 ${this.gold}`)
    this.livesText.setText(`❤️ ${this.lives}`)
    const def = LEVELS[this.currentLevel]
    this.waveText.setText(`Vague ${this.currentWave}/${def.waves.length}`)
  }

  private _floatingCount = 0
  private readonly MAX_FLOATING = 12

  private showFloatingText(text: string, x: number, y: number, color: string) {
    // Cap concurrent floating texts to avoid object accumulation on mass kills
    if (this._floatingCount >= this.MAX_FLOATING) return
    const { width } = this.scale
    const safeX = Phaser.Math.Clamp(x, 30, width - 30)
    const t = this.add.text(safeX, y, text, {
      fontFamily: 'sans-serif', fontSize: '11px', color,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(25)
    this._floatingCount++
    this.tweens.add({
      targets: t, y: y - 36, alpha: 0, duration: 900, ease: 'Sine.easeOut',
      onComplete: () => { t.destroy(); this._floatingCount-- },
    })
  }

  // ── Coordinate helpers ────────────────────────────────────────────

  private cellToWorld(col: number, row: number) {
    return {
      x: this.gridOffX + col * this.cellSize + this.cellSize / 2,
      y: this.gridOffY + row * this.cellSize + this.cellSize / 2,
    }
  }

  private worldToCell(wx: number, wy: number) {
    return {
      col: Math.floor((wx - this.gridOffX) / this.cellSize),
      row: Math.floor((wy - this.gridOffY) / this.cellSize),
    }
  }

  // ── Level select ──────────────────────────────────────────────────

  private showLevelSelect(width: number, height: number) {
    this.gameStarted = false

    const cx = width / 2
    // Single container — destroy it all at once when a level is chosen
    const root = this.add.container(0, 0).setDepth(50)

    const bg = this.add.graphics()
    bg.fillStyle(0x000000, 0.88)
    bg.fillRect(0, 0, width, height)
    root.add(bg)

    const title = this.add.text(cx, height * 0.08, '🏯 DÉFENSE D\'ANGKOR', {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: '22px', color: '#f5d060',
      stroke: '#2a1a00', strokeThickness: 3,
    }).setOrigin(0.5)
    root.add(title)

    const sub = this.add.text(cx, height * 0.08 + 32, 'Protège Angkor Wat des envahisseurs!', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#94a3b8',
    }).setOrigin(0.5)
    root.add(sub)

    const levelNames = ['Les Plaines', 'La Forêt Sacrée', 'Angkor']
    const levelStars = ['★☆☆', '★★☆', '★★★']
    const levelKeys = ['td_level1_complete', 'td_level2_complete', 'td_level3_complete']
    const cardH = Math.min(100, (height * 0.65) / 3 - 12)
    const cardW = Math.min(260, width - 40)
    const startY = height * 0.20

    const dismiss = (levelIndex: number) => {
      root.destroy(true)
      this.gameStarted = true
      this.initLevel(levelIndex)
    }

    for (let i = 0; i < 3; i++) {
      const isUnlocked = i === 0 || !!localStorage.getItem(levelKeys[i - 1])
      const cardY = startY + i * (cardH + 12)
      const cardX = cx - cardW / 2

      const cardBg = this.add.graphics()
      const drawCard = (hover: boolean) => {
        cardBg.clear()
        cardBg.fillStyle(isUnlocked ? (hover ? 0x2a1800 : 0x1a1000) : 0x0d0d0d, 0.95)
        cardBg.fillRoundedRect(cardX, cardY, cardW, cardH, 10)
        cardBg.lineStyle(hover ? 3 : 2, isUnlocked ? 0xd4af37 : 0x333333, isUnlocked ? (hover ? 1 : 0.8) : 0.4)
        cardBg.strokeRoundedRect(cardX, cardY, cardW, cardH, 10)
      }
      drawCard(false)
      root.add(cardBg)

      root.add(this.add.text(cx, cardY + cardH * 0.28, `${isUnlocked ? '' : '🔒 '}${levelNames[i]}`, {
        fontFamily: 'Cinzel, Georgia, serif', fontSize: '16px', color: isUnlocked ? '#f5d060' : '#555555',
      }).setOrigin(0.5))

      root.add(this.add.text(cx, cardY + cardH * 0.55, levelStars[i], {
        fontFamily: 'sans-serif', fontSize: '18px', color: isUnlocked ? '#fbbf24' : '#333333',
      }).setOrigin(0.5))

      root.add(this.add.text(cx, cardY + cardH * 0.78,
        isUnlocked ? `${LEVELS[i].waves.length} vagues — ${LEVELS[i].startGold}💰 départ` : 'Terminer le niveau précédent', {
        fontFamily: 'sans-serif', fontSize: '10px', color: isUnlocked ? '#94a3b8' : '#444444',
      }).setOrigin(0.5))

      if (isUnlocked) {
        const zone = this.add.zone(cx, cardY + cardH / 2, cardW, cardH)
          .setInteractive({ useHandCursor: true })
        zone.on('pointerover', () => drawCard(true))
        zone.on('pointerout',  () => drawCard(false))
        zone.on('pointerdown', () => {
          this.cameras.main.flash(120, 30, 20, 5)
          this.time.delayedCall(120, () => dismiss(i))
        })
        root.add(zone)
      }
    }

    // Back button
    const backTxt = this.add.text(cx, height * 0.92, '← Arcade', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#607090',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    backTxt.on('pointerover', () => backTxt.setColor('#a0b8d0'))
    backTxt.on('pointerout',  () => backTxt.setColor('#607090'))
    backTxt.on('pointerdown', () => this.scene.start('GameSelectScene', this.sceneData))
    root.add(backTxt)
  }

  // ── Level complete ────────────────────────────────────────────────

  private showLevelComplete() {
    const { width, height } = this.scale
    const cx = width / 2

    // Save progress
    localStorage.setItem(`td_level${this.currentLevel + 1}_complete`, '1')
    const bestKey = 'best_td'
    const prev = parseInt(localStorage.getItem(bestKey) ?? '0', 10)
    if (this.score > prev) localStorage.setItem(bestKey, String(this.score))

    const bg = this.add.graphics().setDepth(40)
    bg.fillStyle(0x000000, 0.85)
    bg.fillRect(0, 0, width, height)

    this.add.text(cx, height * 0.22, '🏆 NIVEAU TERMINÉ!', {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: '26px', color: '#f5d060',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(41)

    this.add.text(cx, height * 0.36, `Score: ${this.score}`, {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: '18px', color: '#e0eaff',
    }).setOrigin(0.5).setDepth(41)

    this.add.text(cx, height * 0.44, `Vies restantes: ${this.lives}`, {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#94a3b8',
    }).setOrigin(0.5).setDepth(41)

    if (this.currentLevel < 2) {
      this.makeOverlayBtn(cx, height * 0.56, 'Niveau Suivant ▶', 0x15803d, 0x22c55e, () => {
        bg.destroy()
        this.showLevelSelect(width, height)
      })
    }

    this.makeOverlayBtn(cx, height * 0.66, '🔄 Rejouer', 0x1e3a8a, 0x3b82f6, () => {
      bg.destroy()
      this.initLevel(this.currentLevel)
    })

    this.makeOverlayBtn(cx, height * 0.76, '← Arcade', 0x0d0d0d, 0x555555, () => {
      this.scene.start('GameSelectScene', this.sceneData)
    })
  }

  // ── Game over ─────────────────────────────────────────────────────

  private doGameOver() {
    this.waveActive = false
    const bestKey = 'best_td'
    const prev = parseInt(localStorage.getItem(bestKey) ?? '0', 10)
    if (this.score > prev) localStorage.setItem(bestKey, String(this.score))

    this.cameras.main.shake(400, 0.018)
    this.cameras.main.flash(500, 80, 0, 0)
    this.time.delayedCall(600, () => this.showGameOver())
  }

  private showGameOver() {
    const { width, height } = this.scale
    const cx = width / 2

    const bg = this.add.graphics().setDepth(40)
    bg.fillStyle(0x000000, 0.85)
    bg.fillRect(0, 0, width, height)

    this.add.text(cx, height * 0.22, '💀 DÉFAITE', {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: '32px', color: '#ef4444',
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(41)

    const best = localStorage.getItem('best_td') ?? '0'
    this.add.text(cx, height * 0.38, `Score : ${this.score}`, {
      fontFamily: 'Cinzel, serif', fontSize: '18px', color: '#f5d060',
    }).setOrigin(0.5).setDepth(41)
    this.add.text(cx, height * 0.46, `Record : ${best}`, {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#aaa',
    }).setOrigin(0.5).setDepth(41)

    if (this.score >= parseInt(best, 10) && this.score > 0) {
      this.add.text(cx, height * 0.53, '🏆 Nouveau record!', {
        fontFamily: 'sans-serif', fontSize: '13px', color: '#ffd700',
      }).setOrigin(0.5).setDepth(41)
    }

    this.makeOverlayBtn(cx, height * 0.62, '🔄 Rejouer', 0x7c2d12, 0xf97316, () => {
      this.scene.restart(this.sceneData)
    })
    this.makeOverlayBtn(cx, height * 0.72, '← Arcade', 0x0a1020, 0x406080, () => {
      this.scene.start('GameSelectScene', this.sceneData)
    })
  }

  private makeOverlayBtn(cx: number, cy: number, label: string, bgColor: number, borderColor: number, cb: () => void) {
    const w = 200, h = 44
    const g = this.add.graphics().setDepth(42)
    g.fillStyle(bgColor, 0.95)
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 10)
    g.lineStyle(2, borderColor, 0.9)
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 10)
    const txt = this.add.text(cx, cy, label, {
      fontFamily: 'Cinzel, serif', fontSize: '14px', color: '#fff',
    }).setOrigin(0.5).setDepth(43)
    const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true }).setDepth(44)
    zone.on('pointerover', () => txt.setScale(1.05))
    zone.on('pointerout', () => txt.setScale(1))
    zone.on('pointerdown', () => { this.cameras.main.flash(120, 20, 20, 50); this.time.delayedCall(80, cb) })
  }

  // ── Main update loop ──────────────────────────────────────────────

  update(_time: number, delta: number) {
    if (!this.gameStarted) return

    const dt = delta / 1000

    // Spawning
    if (this.waveActive && this.spawnQueue.length > 0) {
      this.spawnTimer -= delta
      if (this.spawnTimer <= 0) {
        const next = this.spawnQueue.shift()!
        this.spawnEnemy(next.type)
        this.spawnTimer = next.interval
      }
    }

    // Update enemies
    for (const e of this.enemies) {
      if (e.active) this.updateEnemy(e, dt)
    }

    // Update towers
    for (const t of this.towers) {
      this.updateTower(t, dt)
    }

    // Update projectiles
    for (const p of this.projectiles) {
      if (p.active) this.updateProjectile(p, dt)
    }

    // Cleanup
    this.enemies = this.enemies.filter(e => e.active || e.sprite.active)
    this.projectiles = this.projectiles.filter(p => p.active)

    // Wave complete check
    if (this.waveActive && this.spawnQueue.length === 0) {
      const aliveCount = this.enemies.filter(e => e.active).length
      if (aliveCount === 0) {
        this.waveComplete()
      }
    }

    // Wave progress bar update
    if (this.waveActive) {
      const def = LEVELS[this.currentLevel]
      const wave = def.waves[Math.min(this.currentWave, def.waves.length - 1)]
      if (!wave) return
      const total = wave.enemies.reduce((s, g) => s + g.count, 0)
      const remaining = this.spawnQueue.length + this.enemies.filter(e => e.active).length
      const ratio = 1 - remaining / total

      const { width } = this.scale
      const gridBottom = this.gridOffY + this.gridRows * this.cellSize
      const barY = gridBottom + 2
      const barW = width * 0.35

      this.waveProgressBar.clear()
      this.waveProgressBar.fillStyle(0x374151, 0.8)
      this.waveProgressBar.fillRoundedRect(this.goldText.x, barY, barW, 6, 3)
      this.waveProgressBar.fillStyle(0x22c55e, 1)
      this.waveProgressBar.fillRoundedRect(this.goldText.x, barY, barW * ratio, 6, 3)
    } else {
      this.waveProgressBar.clear()
    }
  }
}
