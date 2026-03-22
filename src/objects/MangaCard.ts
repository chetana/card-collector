import Phaser from 'phaser'
import type { FlashCard } from '../api/progress'

export type CardState = 'locked' | 'unlocked' | 'mastered'

const CARD_W = 110
const CARD_H = 155
const RADIUS = 10

// Palette manga
const COL = {
  bg_locked:    0x1a1a2e,
  bg_unlocked:  0x16213e,
  bg_mastered:  0x0f3460,
  border_locked:   0x333355,
  border_unlocked: 0x58c4dc,
  border_mastered: 0xffd700,
  text:    0xf0f0ff,
  muted:   0x667788,
  phonetic: 0x58c4dc,
  tone_dot: 0x1e2a3a,
}

export class MangaCard extends Phaser.GameObjects.Container {
  private _state: CardState
  private card: FlashCard
  private bg!: Phaser.GameObjects.Graphics
  private glowFx?: Phaser.FX.Glow
  private flipTween?: Phaser.Tweens.Tween

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
    this.bg = g

    const borderCol = this._state === 'mastered' ? COL.border_mastered
                    : this._state === 'unlocked'  ? COL.border_unlocked
                    : COL.border_locked
    const bgCol     = this._state === 'mastered' ? COL.bg_mastered
                    : this._state === 'unlocked'  ? COL.bg_unlocked
                    : COL.bg_locked

    // Ombre portée
    g.fillStyle(0x000000, 0.4)
    g.fillRoundedRect(3, 4, CARD_W, CARD_H, RADIUS)

    // Fond
    g.fillStyle(bgCol, 1)
    g.fillRoundedRect(0, 0, CARD_W, CARD_H, RADIUS)

    // Tramé manga (screen tone) — grille de petits points
    if (this._state !== 'locked') {
      g.fillStyle(COL.tone_dot, 0.35)
      for (let row = 0; row < 12; row++) {
        for (let col = 0; col < 8; col++) {
          const ox = col % 2 === 0 ? 0 : 6
          g.fillCircle(10 + col * 13 + ox, 10 + row * 13, 1.2)
        }
      }
    }

    // Bordure principale
    g.lineStyle(this._state === 'mastered' ? 2.5 : 1.5, borderCol, 1)
    g.strokeRoundedRect(0, 0, CARD_W, CARD_H, RADIUS)

    // Ligne décorative intérieure
    if (this._state !== 'locked') {
      g.lineStyle(0.5, borderCol, 0.4)
      g.strokeRoundedRect(5, 5, CARD_W - 10, CARD_H - 10, RADIUS - 3)
    }

    // Coins dorés si mastered
    if (this._state === 'mastered') {
      this.drawCornerAccents(g)
    }

    this.add(g)

    // Numéro de carte (coin haut gauche)
    const numText = this.scene.add.text(8, 6, `#${this.card.id}`, {
      fontSize: '9px', color: this._state === 'locked' ? '#445' : '#58c4dc',
      fontFamily: '"Courier New", monospace', fontStyle: 'bold',
    })
    this.add(numText)

    if (this._state === 'locked') {
      this.drawLocked()
    } else {
      this.drawContent()
    }

    // Effet glow sur les cartes débloquées/maîtrisées
    if (this._state !== 'locked' && this.postFX) {
      this.glowFx = this.postFX.addGlow(
        this._state === 'mastered' ? 0xffd700 : 0x58c4dc,
        this._state === 'mastered' ? 4 : 2,
        0, false, 0.1, 8
      )
    }
  }

  private drawCornerAccents(g: Phaser.GameObjects.Graphics) {
    g.lineStyle(1.5, 0xffd700, 0.8)
    const d = 12
    // Top-left
    g.beginPath(); g.moveTo(3, 3 + d); g.lineTo(3, 3); g.lineTo(3 + d, 3); g.strokePath()
    // Top-right
    g.beginPath(); g.moveTo(CARD_W - 3 - d, 3); g.lineTo(CARD_W - 3, 3); g.lineTo(CARD_W - 3, 3 + d); g.strokePath()
    // Bottom-left
    g.beginPath(); g.moveTo(3, CARD_H - 3 - d); g.lineTo(3, CARD_H - 3); g.lineTo(3 + d, CARD_H - 3); g.strokePath()
    // Bottom-right
    g.beginPath(); g.moveTo(CARD_W - 3 - d, CARD_H - 3); g.lineTo(CARD_W - 3, CARD_H - 3); g.lineTo(CARD_W - 3, CARD_H - 3 - d); g.strokePath()
  }

  private drawLocked() {
    // Cadenas
    const lock = this.scene.add.text(CARD_W / 2, CARD_H / 2 - 8, '🔒', {
      fontSize: '28px',
    }).setOrigin(0.5)
    const lockedTxt = this.scene.add.text(CARD_W / 2, CARD_H / 2 + 22, 'À débloquer', {
      fontSize: '8px', color: '#445566', fontFamily: 'sans-serif',
    }).setOrigin(0.5)
    this.add([lock, lockedTxt])
  }

  private drawContent() {
    // Flag langue (haut centre)
    const flag = this.scene.add.text(CARD_W / 2, 18, '🇰🇭', {
      fontSize: '14px',
    }).setOrigin(0.5)

    // Texte KH (principal)
    const khText = this.scene.add.text(CARD_W / 2, 52, this.card.kh, {
      fontSize: this.card.kh.length > 8 ? '11px' : '14px',
      color: '#f0f0ff',
      fontFamily: '"Noto Sans Khmer", sans-serif',
      align: 'center',
      wordWrap: { width: CARD_W - 14 },
    }).setOrigin(0.5)

    // Phonétique KH
    const phonKh = this.scene.add.text(CARD_W / 2, 76, this.card.phonetic_kh ?? '', {
      fontSize: '7.5px', color: '#58c4dc', fontStyle: 'italic',
      fontFamily: 'sans-serif', align: 'center',
      wordWrap: { width: CARD_W - 12 },
    }).setOrigin(0.5)

    // Séparateur
    const sep = this.scene.add.graphics()
    sep.lineStyle(0.5, 0x58c4dc, 0.5)
    sep.lineBetween(14, 90, CARD_W - 14, 90)

    // Texte FR
    const frFlag = this.scene.add.text(CARD_W / 2, 100, '🇫🇷', {
      fontSize: '11px',
    }).setOrigin(0.5)

    const frText = this.scene.add.text(CARD_W / 2, 116, this.card.fr, {
      fontSize: this.card.fr.length > 12 ? '8px' : '10px',
      color: '#e0e8f0', fontFamily: 'sans-serif',
      align: 'center', wordWrap: { width: CARD_W - 14 },
    }).setOrigin(0.5)

    // Phonétique FR
    const phonFr = this.scene.add.text(CARD_W / 2, 133, this.card.phonetic_fr ?? '', {
      fontSize: '7px', color: '#a0b8cc', fontStyle: 'italic',
      fontFamily: 'sans-serif', align: 'center',
      wordWrap: { width: CARD_W - 12 },
    }).setOrigin(0.5)

    // Badge mastered
    if (this._state === 'mastered') {
      const star = this.scene.add.text(CARD_W - 12, 8, '⭐', { fontSize: '12px' }).setOrigin(0.5)
      this.add(star)
    }

    this.add([flag, khText, phonKh, sep, frFlag, frText, phonFr])
  }

  private redraw() {
    if (this.postFX) this.postFX.clear()
    this.draw()
  }

  // Animation d'apparition
  reveal(delay = 0) {
    this.setScale(0.1)
    this.setAlpha(0)
    this.scene.tweens.add({
      targets: this,
      scaleX: 1, scaleY: 1, alpha: 1,
      duration: 400,
      delay,
      ease: 'Back.easeOut',
    })
  }

  // Flip 3D (scaleX 1→0→1)
  flip(onMid?: () => void) {
    const t = this.scene.tweens.add({
      targets: this,
      scaleX: 0,
      duration: 180,
      ease: 'Sine.easeIn',
      onComplete: () => {
        onMid?.()
        this.scene.tweens.add({
          targets: this,
          scaleX: 1,
          duration: 180,
          ease: 'Sine.easeOut',
        })
      },
    })
    this.flipTween = t
  }

  // Pulse glow (pour unlock)
  pulseUnlock() {
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.12, scaleY: 1.12,
      duration: 200,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
    })
  }

  static get WIDTH() { return CARD_W }
  static get HEIGHT() { return CARD_H }
}
