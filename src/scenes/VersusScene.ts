import Phaser from 'phaser'
import { unlockedCardIds, getLevel, xpPct, type CollectionData, type FlashCard } from '../api/progress'
import type { GoogleUser } from '../api/auth'

const BG = 0x0d0d1a
const ACCENT = 0x58c4dc
const GOLD = 0xffd700

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
    g.fillStyle(BG, 1)
    g.fillRect(0, 0, width, height)

    // Lignes vitesse en diagonale (ambiance combat)
    g.lineStyle(0.5, 0x1a2a3a, 0.5)
    for (let i = -height; i < width + height; i += 22) {
      g.lineBetween(i, 0, i + height, height)
    }
  }

  private drawHeader(width: number) {
    const g = this.add.graphics()
    g.fillStyle(0x0a1525, 1)
    g.fillRect(0, 0, width, 50)
    g.lineStyle(1, GOLD, 0.5)
    g.lineBetween(0, 50, width, 50)

    this.add.text(width / 2, 25, '⚔️  VERSUS', {
      fontSize: '16px', color: '#ffd700',
      fontFamily: '"Courier New", monospace', fontStyle: 'bold', letterSpacing: 3,
    }).setOrigin(0.5)
  }

  private drawVersus(collection: CollectionData, flashcards: FlashCard[], width: number, height: number) {
    const cx = width / 2

    // Ligne centrale verticale
    const g = this.add.graphics()
    g.lineStyle(1, GOLD, 0.3)
    g.lineBetween(cx, 60, cx, height - 70)

    // VS au centre
    this.add.text(cx, 90, 'VS', {
      fontSize: '22px', color: '#ffd700',
      fontFamily: '"Courier New", monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2)

    // Données
    const chetLevel = getLevel(collection.chet.xp)
    const lysLevel  = getLevel(collection.lys.xp)
    const chetUnlocked = unlockedCardIds(collection.chet)
    const lysUnlocked  = unlockedCardIds(collection.lys)
    const chetPct = xpPct(collection.chet.xp)
    const lysPct  = xpPct(collection.lys.xp)

    const halfW = cx - 20

    // ── Côté CHET ──────────────────────────────────────────
    this.drawPlayerCard(
      g, 10, 60, halfW - 10, height - 140,
      'Chet', chetLevel, collection.chet.xp, chetPct,
      chetUnlocked, flashcards, ACCENT, 'left'
    )

    // ── Côté LYS ───────────────────────────────────────────
    this.drawPlayerCard(
      g, cx + 10, 60, halfW - 10, height - 140,
      'Lys', lysLevel, collection.lys.xp, lysPct,
      lysUnlocked, flashcards, 0xe879a8, 'right'
    )

    // ── Résultat global ────────────────────────────────────
    const winner = collection.chet.xp >= collection.lys.xp ? 'Chet' : 'Lys'
    const draw = collection.chet.xp === collection.lys.xp
    const resultText = draw ? '🤝 Ex aequo !' : `🏆 ${winner} mène !`
    this.add.text(cx, height - 105, resultText, {
      fontSize: '13px', color: draw ? '#58c4dc' : '#ffd700',
      fontFamily: '"Courier New", monospace', fontStyle: 'bold',
    }).setOrigin(0.5)

    // Cartes communes (maîtrisées par les deux)
    const both = [...chetUnlocked].filter(id => lysUnlocked.has(id))
    this.add.text(cx, height - 88, `${both.length} carte${both.length > 1 ? 's' : ''} maîtrisée${both.length > 1 ? 's' : ''} en commun`, {
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
    g.fillStyle(0x0a1525, 0.8)
    g.fillRoundedRect(x, y, w, h, 10)
    g.lineStyle(1, accent, 0.5)
    g.strokeRoundedRect(x, y, w, h, 10)

    const ty = y + 14
    // Avatar
    this.add.text(px, ty, level.avatar, { fontSize: '24px' }).setOrigin(0.5).setDepth(2)

    // Nom
    this.add.text(px, ty + 34, name, {
      fontSize: '14px', color: '#f0f0ff',
      fontFamily: 'sans-serif', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2)

    // Niveau
    this.add.text(px, ty + 52, `Nv.${level.level} · ${level.title}`, {
      fontSize: '10px', fontFamily: 'sans-serif',
      color: Phaser.Display.Color.IntegerToColor(accent).rgba,
    }).setOrigin(0.5).setDepth(2)

    // XP
    this.add.text(px, ty + 68, `${xp} XP`, {
      fontSize: '12px', color: '#a0b8cc',
      fontFamily: 'monospace', fontStyle: 'bold',
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
