import Phaser from 'phaser'
import { MangaCard } from '../objects/MangaCard'
import { unlockedCardIds, getLevel, xpPct, findMyProgress, type CollectionData, type FlashCard } from '../api/progress'
import type { GoogleUser } from '../api/auth'

const ACCENT = 0x58c4dc
const GOLD   = 0xffd700

export class CollectionScene extends Phaser.Scene {
  private cards: MangaCard[] = []
  private targetScrollY = 0
  private maxScroll = 0
  private dragStartY = 0
  private isDragging = false

  constructor() { super('CollectionScene') }

  init(data: { user: GoogleUser; collection: CollectionData; cards: FlashCard[]; meKey: string | null }) {
    this.data.set('user', data.user)
    this.data.set('collection', data.collection)
    this.data.set('flashcards', data.cards)
    this.data.set('meKey', data.meKey)
    // Réinitialise le scroll à chaque entrée dans la scène
    this.targetScrollY = 0
    this.cards = []
  }

  create() {
    const { width, height } = this.scale
    const user       = this.data.get('user')       as GoogleUser
    const collection = this.data.get('collection') as CollectionData
    const flashcards = this.data.get('flashcards') as FlashCard[]
    const meKey      = this.data.get('meKey')      as string | null
    const firstName  = user.name.split(' ')[0]

    const myProgress = (meKey && collection[meKey]) ? collection[meKey] : findMyProgress(collection, firstName)
    const unlocked   = unlockedCardIds(myProgress)
    const level      = getLevel(myProgress.xp)
    const lvlPct     = xpPct(myProgress.xp)

    // Caméra principale : démarre à y=0
    this.cameras.main.setScroll(0, 0)

    // ── Fond (fixe, ne défile pas) ────────────────────────────
    this.drawBackground(width, height)

    // ── Grille de cartes (défile avec la caméra) ──────────────
    this.buildGrid(flashcards, unlocked, width, height)

    // ── Header HUD (fixe) ─────────────────────────────────────
    this.drawHeader(user, myProgress.xp, level, lvlPct, width)

    // ── Dock bas (fixe) ───────────────────────────────────────
    this.drawDock(width, height, user, collection, flashcards, meKey)

    // ── Input scroll ──────────────────────────────────────────
    this.setupInput(height)
  }

  // ── Fond crépuscule (scrollFactor 0 = fixe, ne défile pas) ──
  private drawBackground(width: number, height: number) {
    const sf0 = (o: any) => { o.setScrollFactor(0); return o }

    // Ciel dégradé indigo → orange couchant
    const sky = sf0(this.add.graphics().setDepth(0))
    sky.fillGradientStyle(0x1a0e54, 0x1a0e54, 0xf0723a, 0xf0723a, 1)
    sky.fillRect(0, 0, width, height * 0.65)

    // Étoiles
    const stars = sf0(this.add.graphics().setDepth(1))
    const rng = Phaser.Math.RND
    for (let i = 0; i < 55; i++) {
      stars.fillStyle(0xffffff, rng.frac() * 0.7 + 0.2)
      stars.fillCircle(rng.frac() * width, rng.frac() * height * 0.5, rng.frac() * 1.4 + 0.3)
    }

    // Soleil couchant (bas de l'écran, grand, orange)
    const sun = sf0(this.add.graphics().setDepth(1))
    const sx = width * 0.78, sy = height * 0.64
    sun.fillStyle(0xff8c42, 0.12); sun.fillCircle(sx, sy, 58)
    sun.fillStyle(0xff8c42, 0.28); sun.fillCircle(sx, sy, 40)
    sun.fillStyle(0xff9e50, 0.65); sun.fillCircle(sx, sy, 26)
    sun.fillStyle(0xffffff,  0.85); sun.fillCircle(sx, sy, 12)

    // Collines silhouette
    const hills = sf0(this.add.graphics().setDepth(2))
    hills.fillStyle(0x2a1a3e, 1)
    hills.fillEllipse(width * 0.10, height * 0.60, 260, 140)
    hills.fillEllipse(width * 0.50, height * 0.57, 320, 160)
    hills.fillEllipse(width * 0.90, height * 0.60, 240, 130)

    // Sol
    const ground = sf0(this.add.graphics().setDepth(2))
    ground.fillGradientStyle(0x4a6a2a, 0x4a6a2a, 0x2a3e18, 0x2a3e18, 1)
    ground.fillRect(0, height * 0.63, width, height * 0.37)
    ground.fillStyle(0xffaa44, 0.15)
    ground.fillRect(0, height * 0.63, width, 4)

    // Arbres silhouette
    const trees = sf0(this.add.graphics().setDepth(3))
    trees.fillStyle(0x1a0e2a, 1)
    const tpos = [{ x: 0.06, s: 1.1 }, { x: 0.16, s: 0.85 }, { x: 0.83, s: 1.1 }, { x: 0.93, s: 0.85 }]
    for (const t of tpos) {
      const tx = width * t.x, ty = height * 0.67, r = 18 * t.s
      trees.fillRect(tx - 3, ty, 6, 28 * t.s)
      trees.fillEllipse(tx, ty - 8,  r * 2,   r * 1.4)
      trees.fillEllipse(tx, ty - 20, r * 1.6, r * 1.2)
      trees.fillEllipse(tx, ty - 30, r * 1.1, r)
    }

    // Overlay semi-transparent pour lisibilité des cartes
    const overlay = sf0(this.add.graphics().setDepth(4))
    overlay.fillStyle(0x000000, 0.35)
    overlay.fillRect(0, 0, width, height)
  }

  // ── Header (setScrollFactor 0 = fixe en haut) ────────────────
  private drawHeader(
    user: GoogleUser, xp: number,
    level: { level: number; title: string; avatar: string; color: number },
    lvlPct: number, width: number,
  ) {
    const sf = (o: Phaser.GameObjects.GameObject & { setScrollFactor: Function; setDepth: Function }) =>
      o.setScrollFactor(0).setDepth(10)

    const g = this.add.graphics().setScrollFactor(0).setDepth(10)
    g.fillStyle(0x180b04, 1); g.fillRect(0, 0, width, 62)
    g.lineStyle(1.5, GOLD, 0.5); g.lineBetween(0, 62, width, 62)
    g.lineStyle(0.5, GOLD, 0.2); g.lineBetween(0, 64, width, 64)

    sf(this.add.text(14, 10, level.avatar, { fontSize: '26px' }))
    sf(this.add.text(46, 8, user.name.split(' ')[0], {
      fontSize: '16px', color: '#ffe8cc', fontFamily: 'Cinzel, serif', fontStyle: 'bold',
    }))
    sf(this.add.text(46, 28, `${level.avatar}  Nv.${level.level} · ${level.title}`, {
      fontSize: '10px', color: '#58c4dc', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
    }))

    const barX = 46, barY = 48, barW = width - barX - 70
    g.fillStyle(0x3d1f0a, 1); g.fillRoundedRect(barX, barY, barW, 6, 3)
    g.fillStyle(level.color, 1); g.fillRoundedRect(barX, barY, barW * (lvlPct / 100), 6, 3)
    sf(this.add.text(barX + barW + 6, barY - 1, `${xp} XP`, {
      fontSize: '9px', color: '#a07040', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
    }))
    sf(this.add.text(width / 2, 74, '✦  MA COLLECTION  ✦', {
      fontSize: '11px', color: '#ffd700', fontFamily: 'Cinzel, serif',
      fontStyle: 'bold', letterSpacing: 2,
    }).setOrigin(0.5))
  }

  // ── Grille de cartes (world space, défile) ────────────────────
  private buildGrid(flashcards: FlashCard[], unlocked: Set<string>, width: number, height: number) {
    const cols   = width < 480 ? 2 : 3
    const padY   = 90           // espace sous le header
    const gapX   = 12
    const gapY   = 14
    const cardW  = MangaCard.WIDTH
    const cardH  = MangaCard.HEIGHT
    // startX = bord gauche de la première carte (origine top-left)
    const startX = (width - (cols * cardW + (cols - 1) * gapX)) / 2

    flashcards.forEach((card, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x   = startX + col * (cardW + gapX)
      const y   = padY + row * (cardH + gapY)

      const state = unlocked.has(card.id) ? 'unlocked' : 'locked'
      // MangaCard appelle scene.add.existing() dans son constructeur → dans la scène directement
      const mc = new MangaCard(this, x, y, card, state)
      mc.reveal(i * 40)
      mc.setDepth(1)
      mc.setInteractive()
      mc.on('pointerdown', () => this.onCardTap(mc, card, state))
      this.cards.push(mc)
    })

    const rows   = Math.ceil(flashcards.length / cols)
    const totalH = padY + rows * (cardH + gapY) + 80
    this.maxScroll = Math.max(0, totalH - height + 70)
  }

  private onCardTap(mc: MangaCard, card: FlashCard, state: string) {
    if (state === 'locked') {
      this.tweens.add({
        targets: mc, x: mc.x + 6,
        duration: 50, yoyo: true, repeat: 3, ease: 'Sine.easeInOut',
      })
      return
    }
    mc.flip(() => { this.showCardDetail(card) })
  }

  // ── Popup détail carte (setScrollFactor 0 = fixe sur l'écran) ─
  private showCardDetail(card: FlashCard) {
    const { width, height } = this.scale
    const sf0 = (o: any) => { o.setScrollFactor(0); return o }

    const overlay = sf0(this.add.graphics().setDepth(20))
    overlay.fillStyle(0x000000, 0.7)
    overlay.fillRect(0, 0, width, height)

    const px = width / 2, py = height / 2 - 20
    const panel = sf0(this.add.graphics().setDepth(21))
    panel.fillStyle(0x0d1a2e, 1)
    panel.fillRoundedRect(px - 140, py - 110, 280, 200, 14)
    panel.lineStyle(1.5, ACCENT, 1)
    panel.strokeRoundedRect(px - 140, py - 110, 280, 200, 14)
    panel.lineStyle(0.5, ACCENT, 0.3)
    panel.strokeRoundedRect(px - 134, py - 104, 268, 188, 11)

    const sg = sf0(this.add.graphics().setDepth(22))
    sg.lineStyle(0.5, ACCENT, 0.5); sg.lineBetween(px - 80, py - 44, px + 80, py - 44)

    const addT = (x: number, y: number, txt: string, style: object) =>
      sf0(this.add.text(x, y, txt, style).setOrigin(0.5).setDepth(22))

    addT(px, py - 92, `🇰🇭  ${card.kh}`, {
      fontSize: '18px', color: '#f0f0ff',
      fontFamily: '"Noto Sans Khmer", sans-serif', align: 'center',
    })
    if (card.phonetic_kh) addT(px, py - 62, card.phonetic_kh, {
      fontSize: '11px', color: '#58c4dc', fontStyle: 'italic', fontFamily: 'sans-serif',
    })
    addT(px, py - 28, `🇫🇷  ${card.fr}`, {
      fontSize: '16px', color: '#e8f4ff', fontFamily: 'sans-serif', align: 'center',
    })
    if (card.phonetic_fr) addT(px, py - 4, card.phonetic_fr, {
      fontSize: '10px', color: '#a0c4d8', fontStyle: 'italic', fontFamily: 'sans-serif',
    })
    if (card.en) addT(px, py + 18, `🇬🇧  ${card.en}`, {
      fontSize: '12px', color: '#667788', fontFamily: 'sans-serif',
    })

    const closeBtn = sf0(this.add.text(px, py + 62, '✕  Fermer', {
      fontSize: '13px', color: '#58c4dc', fontFamily: 'sans-serif', fontStyle: 'bold',
      backgroundColor: '#0a1525', padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setDepth(22).setInteractive({ useHandCursor: true }))

    const destroy = () => [overlay, panel, sg, closeBtn].forEach(o => o.destroy())

    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'))
    closeBtn.on('pointerout',  () => closeBtn.setColor('#58c4dc'))
    closeBtn.on('pointerdown', destroy)

    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains)
    overlay.on('pointerdown', destroy)
  }

  // ── Dock bas (setScrollFactor 0 = fixe en bas) ─────────────────
  private drawDock(
    width: number, height: number,
    user: GoogleUser, collection: CollectionData,
    flashcards: FlashCard[], meKey: string | null,
  ) {
    const g = this.add.graphics().setScrollFactor(0).setDepth(10)
    g.fillStyle(0x0a1525, 1); g.fillRect(0, height - 70, width, 70)
    g.lineStyle(1, ACCENT, 0.3); g.lineBetween(0, height - 70, width, height - 70)
    g.lineStyle(1, ACCENT, 0.2); g.lineBetween(width / 2, height - 60, width / 2, height - 10)

    const by = height - 35
    const sf0 = (o: any) => { o.setScrollFactor(0); return o }

    const vBtn = sf0(this.add.text(width * 0.28, by, '🏘️  Village', {
      fontSize: '12px', color: '#7fb8cc',
      fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(11).setInteractive({ useHandCursor: true }))

    vBtn.on('pointerover', () => vBtn.setColor('#ffffff'))
    vBtn.on('pointerout',  () => vBtn.setColor('#7fb8cc'))
    vBtn.on('pointerdown', () => {
      this.scene.start('VillageScene', { user, collection, cards: flashcards, meKey })
    })

    const vsBtn = sf0(this.add.text(width * 0.72, by, '⚔️  Versus', {
      fontSize: '12px', color: '#ffd700',
      fontFamily: '"Courier New", monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(11).setInteractive({ useHandCursor: true }))

    vsBtn.on('pointerover', () => vsBtn.setColor('#ffffff'))
    vsBtn.on('pointerout',  () => vsBtn.setColor('#ffd700'))
    vsBtn.on('pointerdown', () => {
      this.scene.start('VersusScene', { user, collection, cards: flashcards, meKey })
    })
  }

  // ── Scroll input ────────────────────────────────────────────────
  private setupInput(height: number) {
    // Wheel souris
    this.input.on('wheel', (_: any, __: any, ___: any, deltaY: number) => {
      this.targetScrollY = Phaser.Math.Clamp(this.targetScrollY + deltaY * 0.6, 0, this.maxScroll)
    })

    // Drag tactile / souris
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragStartY = p.y + this.cameras.main.scrollY
      this.isDragging = true
    })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.isDragging || !p.isDown) return
      this.targetScrollY = Phaser.Math.Clamp(this.dragStartY - p.y, 0, this.maxScroll)
    })
    this.input.on('pointerup', () => { this.isDragging = false })
  }

  update() {
    // Smooth scroll via caméra (les hit areas sont correctement recalculés)
    const newY = Phaser.Math.Linear(this.cameras.main.scrollY, this.targetScrollY, 0.12)
    this.cameras.main.setScroll(0, newY)
  }
}
