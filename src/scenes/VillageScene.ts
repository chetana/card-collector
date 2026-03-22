import Phaser from 'phaser'
import {
  unlockedCardIds, getLevel, findMyProgress, findOthers,
  type CollectionData, type FlashCard,
} from '../api/progress'
import type { GoogleUser } from '../api/auth'

const BUILDINGS = [
  { minXp: 0,    emoji: '🛖',  label: 'Cabane',      fs: 52 },
  { minXp: 60,   emoji: '🏠',  label: 'Maison',      fs: 58 },
  { minXp: 180,  emoji: '🏡',  label: 'Villa',       fs: 62 },
  { minXp: 400,  emoji: '🏘️', label: 'Hameau',      fs: 66 },
  { minXp: 700,  emoji: '🏰',  label: 'Château',     fs: 72 },
  { minXp: 1200, emoji: '🏯',  label: 'Forteresse',  fs: 76 },
]

function getBuilding(xp: number) {
  return [...BUILDINGS].reverse().find(b => xp >= b.minXp) ?? BUILDINGS[0]
}

export class VillageScene extends Phaser.Scene {
  private clouds: Phaser.GameObjects.Text[] = []

  constructor() { super('VillageScene') }

  init(data: { user: GoogleUser; collection: CollectionData; cards: FlashCard[]; meKey: string | null }) {
    this.data.set('user', data.user)
    this.data.set('collection', data.collection)
    this.data.set('flashcards', data.cards)
    this.data.set('meKey', data.meKey)
  }

  create() {
    const { width, height } = this.scale
    const user    = this.data.get('user')       as GoogleUser
    const collection = this.data.get('collection') as CollectionData
    const flashcards = this.data.get('flashcards') as FlashCard[]
    const meKey   = this.data.get('meKey')      as string | null
    const firstName = user.name.split(' ')[0]

    const me  = (meKey && collection[meKey]) ? collection[meKey] : findMyProgress(collection, firstName)
    const others = meKey
      ? Object.entries(collection).filter(([k]) => k !== meKey).map(([, v]) => v as typeof me)
      : findOthers(collection, firstName)
    const opp = others[0] ?? { name: 'Lys', xp: 0, sessions: [] }

    const meB   = getBuilding(me.xp)
    const oppB  = getBuilding(opp.xp)
    const meLevel = getLevel(me.xp)
    const meUnlocked = unlockedCardIds(me)

    this.drawSky(width, height)
    this.drawClouds(width)
    this.drawHills(width, height)
    this.drawGround(width, height)
    this.drawPath(width, height)
    this.drawTrees(width, height)

    const leftX   = width * 0.25
    const rightX  = width * 0.75
    const buildingY = height * 0.53

    this.drawPlot(leftX,  buildingY + 44, 0x7adc6a)
    this.drawPlot(rightX, buildingY + 44, 0x6ab4dc)

    // Bâtiments
    this.add.text(leftX,  buildingY, meB.emoji,  { fontSize: `${meB.fs}px`  }).setOrigin(0.5).setDepth(5)
    this.add.text(rightX, buildingY, oppB.emoji, { fontSize: `${oppB.fs}px` }).setOrigin(0.5).setDepth(5)

    // Noms + niveaux
    this.stroke(leftX,  buildingY + 60, me.name  || firstName, '#ffffff', '#0a2a0a')
    this.stroke(leftX,  buildingY + 78, `${meB.label}  ·  ${me.xp} XP`, '#c8f5a0', '#0a2a0a')
    this.stroke(rightX, buildingY + 60, opp.name || '???',     '#ffffff', '#0a1a2a')
    this.stroke(rightX, buildingY + 78, `${oppB.label}  ·  ${opp.xp} XP`, '#a0d4f5', '#0a1a2a')

    this.drawTopHUD(user, me.xp, meLevel, width)
    this.drawDock(width, height, user, collection, flashcards, meKey,
      meUnlocked.size, flashcards.length)

    // Animation nuages
    this.time.addEvent({
      delay: 50, loop: true,
      callback: () => {
        this.clouds.forEach(c => { c.x += 0.2; if (c.x > width + 90) c.x = -90 })
      },
    })
  }

  private stroke(x: number, y: number, text: string, color: string, stroke: string) {
    this.add.text(x, y, text, {
      fontSize: '11px', color, fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
      stroke, strokeThickness: 3,
    }).setOrigin(0.5).setDepth(6)
  }

  private drawSky(width: number, height: number) {
    const g = this.add.graphics().setDepth(0)
    g.fillGradientStyle(0x5ab4e8, 0x5ab4e8, 0x90d4b8, 0x90d4b8, 1)
    g.fillRect(0, 0, width, height * 0.65)
    // Soleil
    const sg = this.add.graphics().setDepth(1)
    const sx = width * 0.8, sy = 56
    sg.fillStyle(0xfff176, 0.25); sg.fillCircle(sx, sy, 52)
    sg.fillStyle(0xfff176, 0.4);  sg.fillCircle(sx, sy, 36)
    sg.fillStyle(0xfff9c4, 1);    sg.fillCircle(sx, sy, 22)
  }

  private drawClouds(width: number) {
    const data = [{ x: 40, y: 80, fs: 32 }, { x: 165, y: 55, fs: 26 }, { x: 300, y: 88, fs: 36 }]
    for (const c of data) {
      const cloud = this.add.text(c.x, c.y, '☁️', { fontSize: `${c.fs}px` }).setDepth(2).setAlpha(0.82)
      this.clouds.push(cloud)
    }
  }

  private drawHills(width: number, height: number) {
    const g = this.add.graphics().setDepth(2)
    g.fillStyle(0x52a858, 0.8)
    g.fillEllipse(width * 0.12, height * 0.57, 230, 130)
    g.fillEllipse(width * 0.50, height * 0.54, 300, 140)
    g.fillEllipse(width * 0.88, height * 0.57, 210, 120)
    g.fillStyle(0x3d8c44, 1)
    g.fillEllipse(width * 0.05, height * 0.62, 160, 90)
    g.fillEllipse(width * 0.95, height * 0.62, 150, 85)
  }

  private drawGround(width: number, height: number) {
    const g = this.add.graphics().setDepth(2)
    g.fillGradientStyle(0x5ebd5e, 0x5ebd5e, 0x3d8a3d, 0x3d8a3d, 1)
    g.fillRect(0, height * 0.60, width, height * 0.40)
    g.fillStyle(0x7ee07e, 0.5)
    g.fillRect(0, height * 0.60, width, 3)
  }

  private drawPath(width: number, height: number) {
    const g = this.add.graphics().setDepth(3)
    const cx = width / 2
    g.fillStyle(0xc4a46a, 1)
    g.fillRect(cx - 22, height * 0.60, 44, height * 0.40)
    g.fillStyle(0xd4b47a, 0.55)
    g.fillRect(cx - 13, height * 0.60, 26, height * 0.40)
  }

  private drawTrees(width: number, height: number) {
    const trees = [
      { x: width * 0.08, y: height * 0.65, s: 1.1 },
      { x: width * 0.18, y: height * 0.69, s: 0.9 },
      { x: width * 0.82, y: height * 0.65, s: 1.1 },
      { x: width * 0.92, y: height * 0.69, s: 0.9 },
    ]
    for (const t of trees) {
      this.add.text(t.x, t.y, '🌲', { fontSize: `${Math.floor(38 * t.s)}px` })
        .setOrigin(0.5).setDepth(4)
    }
  }

  private drawPlot(x: number, y: number, color: number) {
    const g = this.add.graphics().setDepth(4)
    g.fillStyle(color, 0.28); g.fillEllipse(x, y, 130, 32)
    g.lineStyle(1, color, 0.5); g.strokeEllipse(x, y, 130, 32)
  }

  private drawTopHUD(user: GoogleUser, xp: number, level: { level: number; title: string; avatar: string }, width: number) {
    const g = this.add.graphics().setDepth(10)
    g.fillStyle(0x000000, 0.45)
    g.fillRect(0, 0, width, 48)
    this.add.text(10, 8,  level.avatar,             { fontSize: '24px' }).setDepth(11)
    this.add.text(40, 7,  user.name.split(' ')[0],  { fontSize: '15px', color: '#ffffff', fontFamily: 'Cinzel, serif', fontStyle: 'bold' }).setDepth(11)
    this.add.text(40, 26, `Nv.${level.level}  ·  ${level.title}  ·  ${xp} XP`, { fontSize: '10px', color: '#a0e8ff', fontFamily: 'Nunito, sans-serif' }).setDepth(11)
  }

  private drawDock(
    width: number, height: number,
    user: GoogleUser, collection: CollectionData, flashcards: FlashCard[],
    meKey: string | null, unlockedCount: number, totalCount: number,
  ) {
    const g = this.add.graphics().setDepth(10)
    g.fillStyle(0x0a1520, 0.92)
    g.fillRect(0, height - 82, width, 82)
    g.lineStyle(1, 0x58c4dc, 0.3)
    g.lineBetween(0, height - 82, width, height - 82)

    const btnY = height - 42
    const btns = [
      { x: width * 0.2, icon: '🎴', label: `${unlockedCount}/${totalCount}`, scene: 'CollectionScene' },
      { x: width * 0.5, icon: '📦', label: 'Paquet', scene: 'PackScene', badge: true },
      { x: width * 0.8, icon: '⚔️', label: 'Versus', scene: 'VersusScene' },
    ] as const

    for (const btn of btns) {
      const iconEl = this.add.text(btn.x, btnY - 6, btn.icon, { fontSize: '26px' })
        .setOrigin(0.5).setDepth(11).setInteractive({ useHandCursor: true })

      this.add.text(btn.x, btnY + 20, btn.label, {
        fontSize: '9px', color: '#7fb8cc', fontFamily: 'Nunito, sans-serif',
      }).setOrigin(0.5).setDepth(11)

      if ((btn as any).badge) {
        const bg = this.add.graphics().setDepth(12)
        bg.fillStyle(0xff3333, 1)
        bg.fillCircle(btn.x + 16, btnY - 22, 7)
        this.add.text(btn.x + 16, btnY - 22, '!', {
          fontSize: '9px', color: '#ffffff', fontFamily: 'sans-serif', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(13)
      }

      iconEl.on('pointerover', () => iconEl.setScale(1.2))
      iconEl.on('pointerout',  () => iconEl.setScale(1))
      iconEl.on('pointerdown', () => {
        this.scene.start(btn.scene, { user, collection, cards: flashcards, meKey })
      })
    }
  }
}
