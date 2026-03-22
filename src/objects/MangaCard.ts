import Phaser from 'phaser'
import type { FlashCard } from '../api/progress'

export type CardState = 'locked' | 'unlocked' | 'mastered'

const CARD_W = 112
const CARD_H = 158
const RADIUS = 8

// Palette par état
const PAL = {
  unlocked: { panel: 0x1e3a8a, border: 0x2d55cc, accent: 0x60a5fa },
  mastered: { panel: 0xb45309, border: 0xd97706, accent: 0xfcd34d },
  locked:   { bg: 0x1e2d5a, line: 0x2d4a8a, border: 0x3d5aaa },
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

  setCardState(s: CardState) { this._state = s; this.redraw() }

  private draw() {
    this.removeAll(true)
    const g = this.scene.add.graphics()

    // Ombre portée
    g.fillStyle(0x000000, 0.3)
    g.fillRoundedRect(3, 4, CARD_W, CARD_H, RADIUS)

    if (this._state === 'locked') {
      this.drawBack(g)
    } else {
      this.drawFace(g)
    }
    this.add(g)
  }

  // ── Dos de carte (verrouillée) ────────────────────────────────
  private drawBack(g: Phaser.GameObjects.Graphics) {
    const { bg, line, border } = PAL.locked

    // Fond bleu nuit
    g.fillStyle(bg, 1)
    g.fillRoundedRect(0, 0, CARD_W, CARD_H, RADIUS)

    // Motif croisillons (classic card back)
    g.lineStyle(0.6, line, 0.5)
    for (let i = -CARD_H; i < CARD_W + CARD_H; i += 7) {
      g.lineBetween(Math.max(0, i), i < 0 ? -i : 0, Math.min(CARD_W, i + CARD_H), i < 0 ? CARD_H : CARD_H - i)
      g.lineBetween(Math.min(CARD_W, CARD_W - i), i < 0 ? -i : 0, Math.max(0, CARD_W - i - CARD_H), i < 0 ? CARD_H : CARD_H - i)
    }

    // Cadre intérieur doré fin
    g.lineStyle(1, 0xd4af37, 0.5)
    g.strokeRoundedRect(5, 5, CARD_W - 10, CARD_H - 10, RADIUS - 2)

    // Bordure extérieure
    g.lineStyle(2, border, 1)
    g.strokeRoundedRect(0.5, 0.5, CARD_W - 1, CARD_H - 1, RADIUS)

    // Ornement central
    const cx = CARD_W / 2, cy = CARD_H / 2
    g.fillStyle(0xd4af37, 0.15); g.fillCircle(cx, cy, 28)
    g.fillStyle(0xd4af37, 0.25); g.fillCircle(cx, cy, 18)

    // Hint emoji (très discret)
    const hint = this.scene.add.text(cx, cy - 14, this.card.hint ?? '❓', {
      fontSize: '22px',
    }).setOrigin(0.5).setAlpha(0.22)

    // Cadenas
    const lock = this.scene.add.text(cx, cy + 14, '🔒', {
      fontSize: '16px',
    }).setOrigin(0.5).setAlpha(0.7)

    // "À débloquer" en bas
    const label = this.scene.add.text(cx, CARD_H - 13, 'À DÉBLOQUER', {
      fontSize: '6px', color: '#6080c0',
      fontFamily: 'Cinzel, serif', fontStyle: 'bold', letterSpacing: 1,
    }).setOrigin(0.5)

    this.add([hint, lock, label])
  }

  // ── Face de carte (débloquée / maîtrisée) ─────────────────────
  private drawFace(g: Phaser.GameObjects.Graphics) {
    const pal = this._state === 'mastered' ? PAL.mastered : PAL.unlocked
    const panelH = 70  // hauteur du panneau haut (section KH)
    const divY   = panelH

    // Fond blanc cassé
    g.fillStyle(0xfbf8f2, 1)
    g.fillRoundedRect(0, 0, CARD_W, CARD_H, RADIUS)

    // Panneau supérieur coloré (section KH)
    g.fillStyle(pal.panel, 1)
    g.fillRoundedRect(0, 0, CARD_W, panelH, { tl: RADIUS, tr: RADIUS, bl: 0, br: 0 })

    // Séparateur avec losange central
    g.lineStyle(1, pal.border, 0.4)
    g.lineBetween(10, divY, CARD_W / 2 - 6, divY)
    g.lineBetween(CARD_W / 2 + 6, divY, CARD_W - 10, divY)
    // Losange
    const dx = CARD_W / 2, dy = divY
    g.fillStyle(pal.border, 0.7)
    g.fillTriangle(dx, dy - 4, dx + 4, dy, dx, dy + 4)
    g.fillTriangle(dx, dy - 4, dx - 4, dy, dx, dy + 4)

    // Bordure extérieure
    g.lineStyle(2, pal.border, 1)
    g.strokeRoundedRect(0.5, 0.5, CARD_W - 1, CARD_H - 1, RADIUS)

    // Glow si mastered
    if (this._state === 'mastered' && g.postFX) {
      g.postFX.addGlow(PAL.mastered.accent, 4, 0, false, 0.1, 8)
    }

    // ── Numéro coin haut-gauche ──
    this.add(this.scene.add.text(6, 4, `${this.card.id}`, {
      fontSize: '8px', color: '#ffffff',
      fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
    }))

    // ── Hint coin haut-droit ──
    this.add(this.scene.add.text(CARD_W - 5, 4, this.card.hint ?? '', {
      fontSize: '10px',
    }).setOrigin(1, 0))

    // ── Section KH (fond coloré) ──
    const flag = this.scene.add.text(CARD_W / 2, 13, '🇰🇭', {
      fontSize: '11px',
    }).setOrigin(0.5)

    const khText = this.scene.add.text(CARD_W / 2, 32, this.card.kh, {
      fontSize: this.card.kh.length > 10 ? '10px' : '12px',
      color: '#ffffff', fontFamily: '"Noto Sans Khmer", Nunito, sans-serif',
      fontStyle: 'bold', align: 'center',
      wordWrap: { width: CARD_W - 12 },
    }).setOrigin(0.5)

    const phonKh = this.scene.add.text(CARD_W / 2, 56, this.card.phonetic_kh ?? '', {
      fontSize: '7px', color: '#bfdbfe',
      fontFamily: 'Nunito, sans-serif', fontStyle: 'italic',
      align: 'center', wordWrap: { width: CARD_W - 12 },
    }).setOrigin(0.5)

    // ── Section FR (fond blanc) ──
    const frFlag = this.scene.add.text(CARD_W / 2, divY + 12, '🇫🇷', {
      fontSize: '11px',
    }).setOrigin(0.5)

    const frText = this.scene.add.text(CARD_W / 2, divY + 32, this.card.fr, {
      fontSize: this.card.fr.length > 14 ? '9px' : '11px',
      color: '#1e3a8a', fontFamily: 'Nunito, sans-serif',
      fontStyle: 'bold', align: 'center',
      wordWrap: { width: CARD_W - 12 },
    }).setOrigin(0.5)

    const phonFr = this.scene.add.text(CARD_W / 2, divY + 54, this.card.phonetic_fr ?? '', {
      fontSize: '7px', color: '#6b7280',
      fontFamily: 'Nunito, sans-serif', fontStyle: 'italic',
      align: 'center', wordWrap: { width: CARD_W - 12 },
    }).setOrigin(0.5)

    // ── Étoile si mastered ──
    if (this._state === 'mastered') {
      this.add(this.scene.add.text(CARD_W / 2, CARD_H - 12, '★ MAÎTRISÉE ★', {
        fontSize: '6px', color: '#' + PAL.mastered.accent.toString(16).padStart(6, '0'),
        fontFamily: 'Cinzel, serif', fontStyle: 'bold',
      }).setOrigin(0.5))
    }

    this.add([flag, khText, phonKh, frFlag, frText, phonFr])
  }

  private redraw() {
    if (this.postFX) this.postFX.clear()
    this.draw()
  }

  reveal(delay = 0) {
    this.setScale(0.1).setAlpha(0)
    this.scene.tweens.add({
      targets: this, scaleX: 1, scaleY: 1, alpha: 1,
      duration: 380, delay, ease: 'Back.easeOut',
    })
  }

  flip(onMid?: () => void) {
    this.scene.tweens.add({
      targets: this, scaleX: 0,
      duration: 160, ease: 'Sine.easeIn',
      onComplete: () => {
        onMid?.()
        this.scene.tweens.add({ targets: this, scaleX: 1, duration: 160, ease: 'Sine.easeOut' })
      },
    })
  }

  pulseUnlock() {
    this.scene.tweens.add({
      targets: this, scaleX: 1.12, scaleY: 1.12,
      duration: 180, yoyo: true, repeat: 2, ease: 'Sine.easeInOut',
    })
  }

  static get WIDTH()  { return CARD_W }
  static get HEIGHT() { return CARD_H }
}
