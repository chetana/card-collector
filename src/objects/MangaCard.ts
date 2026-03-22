import Phaser from 'phaser'
import type { FlashCard } from '../api/progress'

export type CardState = 'locked' | 'unlocked' | 'mastered'

const CARD_W = 112
const CARD_H = 158
const RADIUS = 10

// Palette bois chaud + accents lumineux
const COL = {
  wood_dark:  0x2c1a0e,
  wood_mid:   0x3d2410,
  wood_light: 0x5c3820,
  wood_grain: 0x4a2d14,
  border_locked:   0x6b4c2a,
  border_unlocked: 0x58c4dc,
  border_mastered: 0xffd700,
  text_main:  0xfff5e6,
  text_kh:    0xffe8cc,
  phonetic:   0x7dd8f0,
  phonetic_fr: 0xf0c070,
  locked_fg:  0x8b6040,
}

export class MangaCard extends Phaser.GameObjects.Container {
  private _state: CardState
  private card: FlashCard

  constructor(scene: Phaser.Scene, x: number, y: number, card: FlashCard, state: CardState) {
    super(scene, x, y)
    this.card = card
    this._state = state
    this.setSize(CARD_W, CARD_H)
    this.draw()
    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject)
  }

  get cardState() { return this._state }

  setCardState(s: CardState) {
    this._state = s
    this.redraw()
  }

  private draw() {
    this.removeAll(true)

    const g = this.scene.add.graphics()

    // ── Ombre portée ──────────────────────────────────────────
    g.fillStyle(0x000000, 0.45)
    g.fillRoundedRect(4, 5, CARD_W, CARD_H, RADIUS)

    // ── Fond bois ─────────────────────────────────────────────
    g.fillStyle(COL.wood_mid, 1)
    g.fillRoundedRect(0, 0, CARD_W, CARD_H, RADIUS)

    // Grain de bois — lignes horizontales légèrement ondulées
    for (let y = 6; y < CARD_H - 6; y += 7) {
      const alpha = 0.06 + (y % 21 === 0 ? 0.1 : 0)
      g.lineStyle(y % 14 === 0 ? 1 : 0.5, COL.wood_grain, alpha)
      g.lineBetween(4, y, CARD_W - 4, y + (Math.sin(y * 0.4) * 1.5))
    }

    // Vignette bords sombres (profondeur)
    g.fillStyle(COL.wood_dark, 0.4)
    g.fillRoundedRect(0, 0, CARD_W, 18, { tl: RADIUS, tr: RADIUS, bl: 0, br: 0 })
    g.fillRoundedRect(0, CARD_H - 18, CARD_W, 18, { tl: 0, tr: 0, bl: RADIUS, br: RADIUS })

    // ── Bordure principale ────────────────────────────────────
    const borderCol = this._state === 'mastered' ? COL.border_mastered
                    : this._state === 'unlocked'  ? COL.border_unlocked
                    : COL.border_locked
    const borderW   = this._state === 'mastered' ? 2.5
                    : this._state === 'unlocked'  ? 2
                    : 1.2

    g.lineStyle(borderW, borderCol, 1)
    g.strokeRoundedRect(0.5, 0.5, CARD_W - 1, CARD_H - 1, RADIUS)

    // Bordure intérieure fine
    g.lineStyle(0.5, borderCol, this._state === 'locked' ? 0.2 : 0.35)
    g.strokeRoundedRect(5, 5, CARD_W - 10, CARD_H - 10, RADIUS - 3)

    // Coins dorés si mastered
    if (this._state === 'mastered') this.drawCornerAccents(g)

    this.add(g)

    // Numéro de carte
    const numText = this.scene.add.text(9, 7, `#${this.card.id}`, {
      fontSize: '8px',
      color: this._state === 'locked' ? '#7a5535' : '#58c4dc',
      fontFamily: 'Cinzel, serif',
      fontStyle: 'bold',
    })
    this.add(numText)

    if (this._state === 'locked') {
      this.drawLocked()
    } else {
      this.drawContent()
    }

    // Glow WebGL
    if (this._state !== 'locked' && this.postFX) {
      this.postFX.addGlow(
        this._state === 'mastered' ? 0xffd700 : 0x58c4dc,
        this._state === 'mastered' ? 5 : 3,
        0, false, 0.1, 10
      )
    }
  }

  private drawCornerAccents(g: Phaser.GameObjects.Graphics) {
    g.lineStyle(2, COL.border_mastered, 0.9)
    const d = 14
    g.beginPath(); g.moveTo(3, 3 + d); g.lineTo(3, 3); g.lineTo(3 + d, 3); g.strokePath()
    g.beginPath(); g.moveTo(CARD_W - 3 - d, 3); g.lineTo(CARD_W - 3, 3); g.lineTo(CARD_W - 3, 3 + d); g.strokePath()
    g.beginPath(); g.moveTo(3, CARD_H - 3 - d); g.lineTo(3, CARD_H - 3); g.lineTo(3 + d, CARD_H - 3); g.strokePath()
    g.beginPath(); g.moveTo(CARD_W - 3 - d, CARD_H - 3); g.lineTo(CARD_W - 3, CARD_H - 3); g.lineTo(CARD_W - 3, CARD_H - 3 - d); g.strokePath()
  }

  private drawLocked() {
    // Hint emoji (grand, centré, style "silhouette mystère")
    const hint = this.card.hint ?? '🎴'
    const hintText = this.scene.add.text(CARD_W / 2, CARD_H / 2 - 16, hint, {
      fontSize: '38px',
    }).setOrigin(0.5).setAlpha(0.28)

    // Overlay sombre sur le hint
    const overlay = this.scene.add.graphics()
    overlay.fillStyle(COL.wood_dark, 0.55)
    overlay.fillRoundedRect(6, 22, CARD_W - 12, CARD_H - 32, 7)

    // Icône cadenas
    const lock = this.scene.add.text(CARD_W / 2, CARD_H / 2 - 10, '🔒', {
      fontSize: '22px',
    }).setOrigin(0.5)

    // Texte "À débloquer"
    const txt = this.scene.add.text(CARD_W / 2, CARD_H / 2 + 18, 'À DÉBLOQUER', {
      fontSize: '7px',
      color: '#7a5535',
      fontFamily: 'Cinzel, serif',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5)

    // XP hint
    const xpTxt = this.scene.add.text(CARD_W / 2, CARD_H - 16, 'Joue pour débloquer', {
      fontSize: '6px',
      color: '#6b4c2a',
      fontFamily: 'Nunito, sans-serif',
    }).setOrigin(0.5)

    this.add([hintText, overlay, lock, txt, xpTxt])
  }

  private drawContent() {
    // Flag KH + texte
    const flag = this.scene.add.text(CARD_W / 2, 20, '🇰🇭', {
      fontSize: '13px',
    }).setOrigin(0.5)

    const khText = this.scene.add.text(CARD_W / 2, 46, this.card.kh, {
      fontSize: this.card.kh.length > 10 ? '11px' : '14px',
      color: '#' + COL.text_kh.toString(16).padStart(6, '0'),
      fontFamily: '"Noto Sans Khmer", Nunito, sans-serif',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: CARD_W - 14 },
    }).setOrigin(0.5)

    const phonKh = this.scene.add.text(CARD_W / 2, 70, this.card.phonetic_kh ?? '', {
      fontSize: '7.5px',
      color: '#' + COL.phonetic.toString(16).padStart(6, '0'),
      fontFamily: 'Nunito, sans-serif',
      fontStyle: 'italic',
      align: 'center',
      wordWrap: { width: CARD_W - 14 },
    }).setOrigin(0.5)

    // Séparateur décoratif
    const sep = this.scene.add.graphics()
    sep.lineStyle(1, 0x58c4dc, 0.4)
    const mid = CARD_H / 2
    sep.lineBetween(18, mid - 4, CARD_W - 18, mid - 4)
    // Petits losanges aux extrémités
    sep.fillStyle(0x58c4dc, 0.6)
    sep.fillTriangle(14, mid - 4, 18, mid - 7, 18, mid - 1)
    sep.fillTriangle(CARD_W - 14, mid - 4, CARD_W - 18, mid - 7, CARD_W - 18, mid - 1)

    // Hint emoji (mini, visible sur cartes débloquées)
    const hintMini = this.scene.add.text(CARD_W - 14, 8, this.card.hint ?? '', {
      fontSize: '11px',
    }).setOrigin(0.5)

    const frFlag = this.scene.add.text(CARD_W / 2, mid + 8, '🇫🇷', {
      fontSize: '11px',
    }).setOrigin(0.5)

    const frText = this.scene.add.text(CARD_W / 2, mid + 24, this.card.fr, {
      fontSize: this.card.fr.length > 14 ? '8px' : '10px',
      color: '#' + COL.text_main.toString(16).padStart(6, '0'),
      fontFamily: 'Nunito, sans-serif',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: CARD_W - 14 },
    }).setOrigin(0.5)

    const phonFr = this.scene.add.text(CARD_W / 2, mid + 42, this.card.phonetic_fr ?? '', {
      fontSize: '7px',
      color: '#' + COL.phonetic_fr.toString(16).padStart(6, '0'),
      fontFamily: 'Nunito, sans-serif',
      fontStyle: 'italic',
      align: 'center',
      wordWrap: { width: CARD_W - 12 },
    }).setOrigin(0.5)

    if (this._state === 'mastered') {
      const star = this.scene.add.text(CARD_W - 13, 8, '⭐', { fontSize: '11px' }).setOrigin(0.5)
      this.add(star)
    }

    this.add([flag, khText, phonKh, sep, hintMini, frFlag, frText, phonFr])
  }

  private redraw() {
    if (this.postFX) this.postFX.clear()
    this.draw()
  }

  reveal(delay = 0) {
    this.setScale(0.1).setAlpha(0)
    this.scene.tweens.add({
      targets: this, scaleX: 1, scaleY: 1, alpha: 1,
      duration: 400, delay, ease: 'Back.easeOut',
    })
  }

  flip(onMid?: () => void) {
    this.scene.tweens.add({
      targets: this, scaleX: 0,
      duration: 180, ease: 'Sine.easeIn',
      onComplete: () => {
        onMid?.()
        this.scene.tweens.add({ targets: this, scaleX: 1, duration: 180, ease: 'Sine.easeOut' })
      },
    })
  }

  pulseUnlock() {
    this.scene.tweens.add({
      targets: this, scaleX: 1.12, scaleY: 1.12,
      duration: 200, yoyo: true, repeat: 2, ease: 'Sine.easeInOut',
    })
  }

  static get WIDTH() { return CARD_W }
  static get HEIGHT() { return CARD_H }
}
