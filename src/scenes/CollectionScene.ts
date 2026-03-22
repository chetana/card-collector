import Phaser from 'phaser'
import { MangaCard } from '../objects/MangaCard'
import { unlockedCardIds, getLevel, xpPct, type CollectionData, type FlashCard } from '../api/progress'
import type { GoogleUser } from '../api/auth'

const BG = 0x0d0d1a
const ACCENT = 0x58c4dc
const GOLD = 0xffd700

export class CollectionScene extends Phaser.Scene {
  private cards: MangaCard[] = []
  private scrollY = 0
  private targetScrollY = 0
  private cardContainer!: Phaser.GameObjects.Container
  private dragStartY = 0
  private isDragging = false

  constructor() { super('CollectionScene') }

  init(data: { user: GoogleUser; collection: CollectionData; cards: FlashCard[] }) {
    this.data.set('user', data.user)
    this.data.set('collection', data.collection)
    this.data.set('flashcards', data.cards)
  }

  create() {
    const { width, height } = this.scale
    const user = this.data.get('user') as GoogleUser
    const collection = this.data.get('collection') as CollectionData
    const flashcards = this.data.get('flashcards') as FlashCard[]

    // Détermine quelle progression utiliser
    const firstName = user.name.split(' ')[0].toLowerCase()
    const isChet = /^(chet|chetana)$/i.test(firstName.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    const myProgress = isChet ? collection.chet : collection.lys
    const unlocked = unlockedCardIds(myProgress)
    const level = getLevel(myProgress.xp)
    const lvlPct = xpPct(myProgress.xp)

    // Fond
    this.drawBackground()

    // Header HUD
    this.drawHeader(user, myProgress.xp, level, lvlPct, width)

    // Grille de cartes (scrollable)
    this.cardContainer = this.add.container(0, 0)
    this.buildGrid(flashcards, unlocked, width, height)

    // Bouton VERSUS
    this.drawVersusButton(width, height, user, collection, flashcards)

    // Touch / scroll
    this.setupInput()
  }

  private drawBackground() {
    const { width, height } = this.scale
    const g = this.add.graphics()
    g.fillStyle(BG, 1)
    g.fillRect(0, 0, width, height)

    // Tramé manga
    g.fillStyle(0x1a2a3a, 0.12)
    for (let x = 0; x < width; x += 18) {
      for (let y = 0; y < height; y += 18) {
        if ((x + y) % 36 === 0) g.fillCircle(x, y, 0.9)
      }
    }
  }

  private drawHeader(
    user: GoogleUser, xp: number,
    level: { level: number; title: string; avatar: string; color: number },
    lvlPct: number, width: number
  ) {
    const g = this.add.graphics()
    // Bande header
    g.fillStyle(0x0a1525, 1)
    g.fillRect(0, 0, width, 58)
    g.lineStyle(1, ACCENT, 0.4)
    g.lineBetween(0, 58, width, 58)

    // Avatar + nom
    this.add.text(14, 10, user.picture ? '' : level.avatar, { fontSize: '28px' }).setDepth(2)
    this.add.text(48, 10, user.name.split(' ')[0], {
      fontSize: '14px', color: '#f0f0ff', fontFamily: 'sans-serif', fontStyle: 'bold',
    }).setDepth(2)
    this.add.text(48, 28, `${level.avatar} Nv.${level.level} — ${level.title}`, {
      fontSize: '10px', color: '#58c4dc', fontFamily: 'sans-serif',
    }).setDepth(2)

    // XP bar
    const barX = 48, barY = 44, barW = width - barX - 80
    g.fillStyle(0x1a2a3a, 1); g.fillRoundedRect(barX, barY, barW, 5, 2)
    g.fillStyle(level.color, 1); g.fillRoundedRect(barX, barY, barW * (lvlPct / 100), 5, 2)
    this.add.text(barX + barW + 6, barY - 2, `${xp} XP`, {
      fontSize: '9px', color: '#667788', fontFamily: 'monospace',
    }).setDepth(2)

    // Titre section
    this.add.text(14, 68, 'MA COLLECTION', {
      fontSize: '11px', color: '#58c4dc',
      fontFamily: '"Courier New", monospace', fontStyle: 'bold', letterSpacing: 2,
    }).setDepth(2)
  }

  private buildGrid(flashcards: FlashCard[], unlocked: Set<string>, width: number, height: number) {
    const cols = width < 400 ? 2 : 3
    const padX = 16
    const padY = 86
    const gapX = 12
    const gapY = 16
    const cardW = MangaCard.WIDTH
    const startX = (width - (cols * cardW + (cols - 1) * gapX)) / 2 + cardW / 2

    flashcards.forEach((card, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = startX + col * (cardW + gapX)
      const y = padY + cardW / 2 + row * (MangaCard.HEIGHT + gapY) + MangaCard.HEIGHT / 2

      const state = unlocked.has(card.id) ? 'unlocked' : 'locked'
      const mc = new MangaCard(this, x, y, card, state)
      mc.reveal(i * 40)
      mc.setDepth(1)

      // Tap pour voir détail
      mc.setInteractive()
      mc.on('pointerdown', () => this.onCardTap(mc, card, state))

      this.cardContainer.add(mc)
      this.cards.push(mc)
    })

    // Hauteur totale de la grille
    const rows = Math.ceil(flashcards.length / cols)
    const totalH = padY + rows * (MangaCard.HEIGHT + gapY) + 80
    this.data.set('totalH', totalH)
  }

  private onCardTap(mc: MangaCard, card: FlashCard, state: string) {
    if (state === 'locked') {
      // Shake
      this.tweens.add({
        targets: mc, x: mc.x + 6,
        duration: 50, yoyo: true, repeat: 3,
        ease: 'Sine.easeInOut',
      })
      return
    }
    // Flip + afficher popup
    mc.flip(() => {
      this.showCardDetail(card)
    })
  }

  private showCardDetail(card: FlashCard) {
    const { width, height } = this.scale

    // Overlay
    const overlay = this.add.graphics().setDepth(10)
    overlay.fillStyle(0x000000, 0.7)
    overlay.fillRect(0, 0, width, height)

    const px = width / 2, py = height / 2 - 20

    // Panneau manga
    const panel = this.add.graphics().setDepth(11)
    panel.fillStyle(0x0d1a2e, 1)
    panel.fillRoundedRect(px - 140, py - 110, 280, 200, 14)
    panel.lineStyle(1.5, ACCENT, 1)
    panel.strokeRoundedRect(px - 140, py - 110, 280, 200, 14)
    panel.lineStyle(0.5, ACCENT, 0.3)
    panel.strokeRoundedRect(px - 134, py - 104, 268, 188, 11)

    // Contenu
    const texts = this.add.container(0, 0).setDepth(12)
    texts.add(this.add.text(px, py - 92, `🇰🇭  ${card.kh}`, {
      fontSize: '18px', color: '#f0f0ff',
      fontFamily: '"Noto Sans Khmer", sans-serif', align: 'center',
    }).setOrigin(0.5))
    if (card.phonetic_kh) {
      texts.add(this.add.text(px, py - 62, card.phonetic_kh, {
        fontSize: '11px', color: '#58c4dc', fontStyle: 'italic', fontFamily: 'sans-serif',
      }).setOrigin(0.5))
    }
    // Séparateur
    const sg = this.add.graphics().setDepth(12)
    sg.lineStyle(0.5, ACCENT, 0.5); sg.lineBetween(px - 80, py - 44, px + 80, py - 44)

    texts.add(this.add.text(px, py - 28, `🇫🇷  ${card.fr}`, {
      fontSize: '16px', color: '#e8f4ff', fontFamily: 'sans-serif', align: 'center',
    }).setOrigin(0.5))
    if (card.phonetic_fr) {
      texts.add(this.add.text(px, py - 4, card.phonetic_fr, {
        fontSize: '10px', color: '#a0c4d8', fontStyle: 'italic', fontFamily: 'sans-serif',
      }).setOrigin(0.5))
    }
    if (card.en) {
      texts.add(this.add.text(px, py + 18, `🇬🇧  ${card.en}`, {
        fontSize: '12px', color: '#667788', fontFamily: 'sans-serif',
      }).setOrigin(0.5))
    }

    // Bouton fermer
    const closeBtn = this.add.text(px, py + 62, '✕  Fermer', {
      fontSize: '13px', color: '#58c4dc',
      fontFamily: 'sans-serif', fontStyle: 'bold',
      backgroundColor: '#0a1525', padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setDepth(12).setInteractive({ useHandCursor: true })

    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'))
    closeBtn.on('pointerout', () => closeBtn.setColor('#58c4dc'))
    closeBtn.on('pointerdown', () => {
      [overlay, panel, sg, texts, closeBtn].forEach(o => o.destroy())
    })

    // Tap overlay pour fermer aussi
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains)
    overlay.on('pointerdown', () => {
      [overlay, panel, sg, texts, closeBtn].forEach(o => o.destroy())
    })
  }

  private drawVersusButton(
    width: number, height: number,
    user: GoogleUser, collection: CollectionData, flashcards: FlashCard[]
  ) {
    const btnW = 160, btnH = 40
    const bx = width / 2, by = height - 30

    const g = this.add.graphics().setDepth(5)

    // Fond fixe (hors scroll)
    g.fillStyle(0x0a1525, 1)
    g.fillRect(0, height - 64, width, 64)
    g.lineStyle(1, ACCENT, 0.3)
    g.lineBetween(0, height - 64, width, height - 64)

    // Bouton VS
    g.fillStyle(0x16213e, 1)
    g.fillRoundedRect(bx - btnW / 2, by - btnH / 2, btnW, btnH, 8)
    g.lineStyle(1.5, GOLD, 0.9)
    g.strokeRoundedRect(bx - btnW / 2, by - btnH / 2, btnW, btnH, 8)

    const btnText = this.add.text(bx, by, '⚔️  VERSUS LYS', {
      fontSize: '13px', color: '#ffd700',
      fontFamily: '"Courier New", monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(6).setInteractive({ useHandCursor: true })

    btnText.on('pointerover', () => {
      g.clear()
      g.fillStyle(0x0a1525, 1); g.fillRect(0, height - 64, width, 64)
      g.lineStyle(1, ACCENT, 0.3); g.lineBetween(0, height - 64, width, height - 64)
      g.fillStyle(0x1e3558, 1); g.fillRoundedRect(bx - btnW / 2, by - btnH / 2, btnW, btnH, 8)
      g.lineStyle(2, GOLD, 1); g.strokeRoundedRect(bx - btnW / 2, by - btnH / 2, btnW, btnH, 8)
    })
    btnText.on('pointerout', () => {
      g.clear()
      g.fillStyle(0x0a1525, 1); g.fillRect(0, height - 64, width, 64)
      g.lineStyle(1, ACCENT, 0.3); g.lineBetween(0, height - 64, width, height - 64)
      g.fillStyle(0x16213e, 1); g.fillRoundedRect(bx - btnW / 2, by - btnH / 2, btnW, btnH, 8)
      g.lineStyle(1.5, GOLD, 0.9); g.strokeRoundedRect(bx - btnW / 2, by - btnH / 2, btnW, btnH, 8)
    })
    btnText.on('pointerdown', () => {
      this.scene.start('VersusScene', {
        user, collection, cards: flashcards,
      })
    })
  }

  private setupInput() {
    const { height } = this.scale
    const totalH = this.data.get('totalH') as number ?? height
    const maxScroll = Math.max(0, totalH - height + 64)

    // Wheel
    this.input.on('wheel', (_: any, __: any, ___: any, deltaY: number) => {
      this.targetScrollY = Phaser.Math.Clamp(this.targetScrollY + deltaY * 0.6, 0, maxScroll)
    })

    // Touch drag
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragStartY = p.y + this.scrollY
      this.isDragging = true
    })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.isDragging || !p.isDown) return
      const delta = this.dragStartY - p.y
      this.targetScrollY = Phaser.Math.Clamp(delta, 0, maxScroll)
    })
    this.input.on('pointerup', () => { this.isDragging = false })
  }

  update() {
    // Smooth scroll
    this.scrollY = Phaser.Math.Linear(this.scrollY, this.targetScrollY, 0.12)
    if (this.cardContainer) {
      this.cardContainer.y = -this.scrollY
    }
  }
}
