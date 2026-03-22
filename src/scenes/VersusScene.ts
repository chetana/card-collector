import Phaser from 'phaser'
import { unlockedCardIds, getLevel, xpPct, findMyProgress, findOthers, type CollectionData, type FlashCard } from '../api/progress'
import type { GoogleUser } from '../api/auth'

const BG     = 0x1e0f06
const WOOD   = 0x2c1a0e
const ACCENT = 0x58c4dc
const GOLD   = 0xffd700

export class VersusScene extends Phaser.Scene {
  constructor() { super('VersusScene') }

  init(data: { user: GoogleUser; collection: CollectionData; cards: FlashCard[] }) {
    this.data.set('user', data.user)
    this.data.set('collection', data.collection)
    this.data.set('flashcards', data.cards)
  }

  create() {
    const { width, height } = this.scale
    const collection = this.data.get('collection') as CollectionData
    const flashcards = this.data.get('flashcards') as FlashCard[]

    this.drawBackground()
    this.drawHeader(width)
    this.drawVersus(collection, flashcards, width, height)
    this.drawBackButton(width, height)
  }

  private drawBackground() {
    const { width, height } = this.scale
    const g = this.add.graphics()
    g.fillStyle(WOOD, 1)
    g.fillRect(0, 0, width, height)

    // Grain de bois
    for (let y = 0; y < height; y += 8) {
      g.lineStyle(y % 16 === 0 ? 1 : 0.5, 0x5c3820, y % 24 === 0 ? 0.1 : 0.04)
      g.lineBetween(0, y, width, y + Math.sin(y * 0.1) * 2)
    }

    // Lignes diagonales combat (ambiance versus)
    g.lineStyle(0.5, 0x6b3a1a, 0.15)
    for (let i = -height; i < width + height; i += 28) {
      g.lineBetween(i, 0, i + height, height)
    }
  }

  private drawHeader(width: number) {
    const g = this.add.graphics()
    g.fillStyle(0x180b04, 1)
    g.fillRect(0, 0, width, 50)
    g.lineStyle(1.5, GOLD, 0.6)
    g.lineBetween(0, 50, width, 50)
    g.lineStyle(0.5, GOLD, 0.2)
    g.lineBetween(0, 52, width, 52)

    this.add.text(width / 2, 25, '⚔️  VERSUS', {
      fontSize: '16px', color: '#ffd700',
      fontFamily: 'Cinzel, serif', fontStyle: 'bold', letterSpacing: 4,
    }).setOrigin(0.5)
  }

  private drawVersus(collection: CollectionData, flashcards: FlashCard[], width: number, height: number) {
    const cx = width / 2
    const user = this.data.get('user') as { name: string }
    const firstName = user.name.split(' ')[0]

    // Dynamique : moi + le premier "autre"
    const me = findMyProgress(collection, firstName)
    const others = findOthers(collection, firstName)
    const opponent = others[0] ?? { name: '???', xp: 0, sessions: [] }

    const g = this.add.graphics()
    g.lineStyle(1, GOLD, 0.3)
    g.lineBetween(cx, 60, cx, height - 70)

    this.add.text(cx, 88, 'VS', {
      fontSize: '26px', color: '#ffd700',
      fontFamily: 'Cinzel, serif', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2)

    const meLevel  = getLevel(me.xp)
    const oppLevel = getLevel(opponent.xp)
    const meUnlocked  = unlockedCardIds(me)
    const oppUnlocked = unlockedCardIds(opponent)
    const halfW = cx - 20

    this.drawPlayerCard(g, 10, 60, halfW - 10, height - 140,
      me.name || firstName, meLevel, me.xp, xpPct(me.xp),
      meUnlocked, flashcards, ACCENT, 'left')

    this.drawPlayerCard(g, cx + 10, 60, halfW - 10, height - 140,
      opponent.name || '???', oppLevel, opponent.xp, xpPct(opponent.xp),
      oppUnlocked, flashcards, 0xe879a8, 'right')

    const draw = me.xp === opponent.xp
    const winner = me.xp >= opponent.xp ? (me.name || firstName) : (opponent.name || '???')
    this.add.text(cx, height - 105, draw ? '🤝 Ex aequo !' : `🏆 ${winner} mène !`, {
      fontSize: '13px', color: draw ? '#58c4dc' : '#ffd700',
      fontFamily: '"Courier New", monospace', fontStyle: 'bold',
    }).setOrigin(0.5)

    const both = [...meUnlocked].filter(id => oppUnlocked.has(id))
    this.add.text(cx, height - 88, `${both.length} carte${both.length > 1 ? 's' : ''} en commun`, {
      fontSize: '10px', color: '#667788', fontFamily: 'sans-serif',
    }).setOrigin(0.5)
  }

  private drawPlayerCard(
    g: Phaser.GameObjects.Graphics,
    x: number, y: number, w: number, h: number,
    name: string,
    level: { level: number; title: string; avatar: string; color: number },
    xp: number, lvlPct: number,
    unlocked: Set<string>, flashcards: FlashCard[],
    accent: number, side: 'left' | 'right'
  ) {
    const px = x + w / 2

    // Panel joueur
    g.fillStyle(0x180b04, 0.85)
    g.fillRoundedRect(x, y, w, h, 10)
    g.lineStyle(1, accent, 0.5)
    g.strokeRoundedRect(x, y, w, h, 10)

    const ty = y + 14
    // Avatar
    this.add.text(px, ty, level.avatar, { fontSize: '24px' }).setOrigin(0.5).setDepth(2)

    // Nom
    this.add.text(px, ty + 34, name, {
      fontSize: '14px', color: '#ffe8cc',
      fontFamily: 'Cinzel, serif', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2)

    // Niveau
    this.add.text(px, ty + 52, `Nv.${level.level} · ${level.title}`, {
      fontSize: '10px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
      color: Phaser.Display.Color.IntegerToColor(accent).rgba,
    }).setOrigin(0.5).setDepth(2)

    // XP
    this.add.text(px, ty + 68, `${xp} XP`, {
      fontSize: '13px', color: '#ffe8cc',
      fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2)

    // XP bar
    const barX = x + 16, barW = w - 32
    g.fillStyle(0x1a2a3a, 1); g.fillRoundedRect(barX, ty + 80, barW, 5, 2)
    g.fillStyle(accent, 1); g.fillRoundedRect(barX, ty + 80, barW * (lvlPct / 100), 5, 2)

    // Stats cartes
    const total = flashcards.length
    const count = unlocked.size
    this.add.text(px, ty + 98, `${count} / ${total} cartes`, {
      fontSize: '11px', color: '#58c4dc',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(2)

    // Mini grille de badges cartes
    const cols = 5
    const dot = 10
    const gap = 4
    const gridW = cols * (dot + gap) - gap
    const gx = px - gridW / 2
    const gy = ty + 114

    flashcards.slice(0, 20).forEach((card, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx2 = gx + col * (dot + gap) + dot / 2
      const cy2 = gy + row * (dot + gap) + dot / 2
      const has = unlocked.has(card.id)
      g.fillStyle(has ? accent : 0x1a2a3a, has ? 0.9 : 1)
      g.fillRoundedRect(cx2 - dot / 2, cy2 - dot / 2, dot, dot, 2)
    })
  }

  private drawBackButton(width: number, height: number) {
    const bx = width / 2

    const g = this.add.graphics().setDepth(5)
    g.fillStyle(0x0a1525, 1)
    g.fillRect(0, height - 64, width, 64)
    g.lineStyle(1, ACCENT, 0.3)
    g.lineBetween(0, height - 64, width, height - 64)

    g.fillStyle(0x16213e, 1)
    g.fillRoundedRect(bx - 80, height - 46, 160, 34, 8)
    g.lineStyle(1.5, ACCENT, 0.8)
    g.strokeRoundedRect(bx - 80, height - 46, 160, 34, 8)

    const btn = this.add.text(bx, height - 29, '← MA COLLECTION', {
      fontSize: '12px', color: '#58c4dc',
      fontFamily: '"Courier New", monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(6).setInteractive({ useHandCursor: true })

    btn.on('pointerdown', () => {
      this.scene.start('CollectionScene', {
        user: this.data.get('user'),
        collection: this.data.get('collection'),
        cards: this.data.get('flashcards'),
      })
    })
  }
}
