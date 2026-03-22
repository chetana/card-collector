import Phaser from 'phaser'
import { MangaCard } from '../objects/MangaCard'
import { unlockedCardIds, findMyProgress, type CollectionData, type FlashCard } from '../api/progress'
import type { GoogleUser } from '../api/auth'

export class PackScene extends Phaser.Scene {
  constructor() { super('PackScene') }

  init(data: { user: GoogleUser; collection: CollectionData; cards: FlashCard[]; meKey: string | null }) {
    this.data.set('user', data.user)
    this.data.set('collection', data.collection)
    this.data.set('flashcards', data.cards)
    this.data.set('meKey', data.meKey)
  }

  create() {
    const { width, height } = this.scale
    const user     = this.data.get('user')       as GoogleUser
    const collection = this.data.get('collection') as CollectionData
    const flashcards = this.data.get('flashcards') as FlashCard[]
    const meKey    = this.data.get('meKey')      as string | null
    const firstName = user.name.split(' ')[0]

    const me = (meKey && collection[meKey]) ? collection[meKey] : findMyProgress(collection, firstName)
    const unlocked = unlockedCardIds(me)
    const unlockedCards = flashcards.filter(c => unlocked.has(c.id))

    this.drawBackground(width, height)
    this.drawTitle(width)
    this.drawBackBreadcrumb(user, collection, flashcards, meKey)

    if (unlockedCards.length === 0) {
      this.drawEmptyState(width, height, user, collection, flashcards, meKey)
    } else {
      this.drawPack(width, height, user, collection, flashcards, meKey, unlockedCards)
    }
  }

  private drawBackground(width: number, height: number) {
    const g = this.add.graphics()
    g.fillGradientStyle(0x0a0a1e, 0x0a0a1e, 0x1a0838, 0x1a0838, 1)
    g.fillRect(0, 0, width, height)

    // Étoiles
    const rng = Phaser.Math.RND
    for (let i = 0; i < 70; i++) {
      const sx = rng.frac() * width
      const sy = rng.frac() * height
      const sa = rng.frac() * 0.6 + 0.2
      const sr = rng.frac() * 1.5 + 0.3
      g.fillStyle(0xffffff, sa)
      g.fillCircle(sx, sy, sr)
    }

    // Nébuleuse subtile au centre
    g.fillStyle(0x4a1880, 0.08)
    g.fillCircle(width / 2, height / 2, 220)
    g.fillStyle(0x1a4880, 0.06)
    g.fillCircle(width / 2, height * 0.4, 160)
  }

  private drawTitle(width: number) {
    const g = this.add.graphics().setDepth(2)
    g.fillStyle(0x000000, 0.4)
    g.fillRect(0, 0, width, 50)

    this.add.text(width / 2, 25, '📦  OUVRIR UN PAQUET', {
      fontSize: '14px', color: '#ffd700',
      fontFamily: 'Cinzel, serif', fontStyle: 'bold', letterSpacing: 3,
    }).setOrigin(0.5).setDepth(3)
  }

  private drawBackBreadcrumb(
    user: GoogleUser, collection: CollectionData,
    flashcards: FlashCard[], meKey: string | null,
  ) {
    const btn = this.add.text(14, 58, '← Village', {
      fontSize: '11px', color: '#4488aa', fontFamily: 'Nunito, sans-serif',
    }).setDepth(3).setInteractive({ useHandCursor: true })

    btn.on('pointerover', () => btn.setColor('#58c4dc'))
    btn.on('pointerout',  () => btn.setColor('#4488aa'))
    btn.on('pointerdown', () => {
      this.scene.start('VillageScene', { user, collection, cards: flashcards, meKey })
    })
  }

  private drawPack(
    width: number, height: number,
    user: GoogleUser, collection: CollectionData,
    flashcards: FlashCard[], meKey: string | null,
    unlockedCards: FlashCard[],
  ) {
    const cx = width / 2
    const cy = height * 0.46
    const pw = 138, ph = 210

    const g = this.add.graphics().setDepth(4)

    // Ombre
    g.fillStyle(0x000000, 0.5)
    g.fillRoundedRect(cx - pw / 2 + 7, cy - ph / 2 + 9, pw, ph, 14)

    // Corps dégradé
    g.fillGradientStyle(0x1a2a5e, 0x2a3a7e, 0x0e1a42, 0x1a2a5e, 1)
    g.fillRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 14)

    // Bande centrale colorée
    g.fillStyle(0x58c4dc, 0.18)
    g.fillRect(cx - pw / 2 + 5, cy - 24, pw - 10, 48)

    // Bordure dorée + intérieure fine
    g.lineStyle(2.5, 0xffd700, 0.9)
    g.strokeRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 14)
    g.lineStyle(0.5, 0xffd700, 0.3)
    g.strokeRoundedRect(cx - pw / 2 + 6, cy - ph / 2 + 6, pw - 12, ph - 12, 10)

    // Reflet diagonal
    g.lineStyle(22, 0xffffff, 0.055)
    g.lineBetween(cx - pw / 2 + 18, cy - ph / 2, cx - pw / 2 + 62, cy + ph / 2)

    // Glow sur le pack
    if (g.postFX) g.postFX.addGlow(0x58c4dc, 5, 0, false, 0.1, 10)

    // Contenu du paquet (texte)
    this.add.text(cx, cy - 52, '❤️', { fontSize: '28px' }).setOrigin(0.5).setDepth(5)
    this.add.text(cx, cy - 16, 'CHET', {
      fontSize: '13px', color: '#58c4dc', fontFamily: 'Cinzel, serif', fontStyle: 'bold', letterSpacing: 3,
    }).setOrigin(0.5).setDepth(5)
    this.add.text(cx, cy + 5, '& LYS', {
      fontSize: '13px', color: '#ffd700', fontFamily: 'Cinzel, serif', fontStyle: 'bold', letterSpacing: 3,
    }).setOrigin(0.5).setDepth(5)
    this.add.text(cx, cy + 38, `${unlockedCards.length} carte${unlockedCards.length > 1 ? 's' : ''}`, {
      fontSize: '9px', color: '#7899bb', fontFamily: 'Nunito, sans-serif',
    }).setOrigin(0.5).setDepth(5)
    this.add.text(cx, cy + 54, '★  ★  ★', {
      fontSize: '10px', color: '#ffd700', letterSpacing: 5,
    }).setOrigin(0.5).setDepth(5)
    this.add.text(cx, cy + 72, `Nv. ${Math.ceil(unlockedCards.length / 4)}`, {
      fontSize: '8px', color: '#5588aa', fontFamily: 'Nunito, sans-serif',
    }).setOrigin(0.5).setDepth(5)

    // Hint pulsé
    const hint = this.add.text(cx, cy + ph / 2 + 28, '✦  Touche pour ouvrir  ✦', {
      fontSize: '11px', color: '#7799bb', fontFamily: 'Nunito, sans-serif', fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(5)

    this.tweens.add({
      targets: hint, alpha: 0.25,
      duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })

    // Zone interactive
    const zone = this.add.zone(cx, cy, pw + 24, ph + 24)
      .setInteractive({ useHandCursor: true }).setDepth(6)

    let opened = false
    zone.on('pointerdown', () => {
      if (opened) return
      opened = true
      hint.destroy()
      this.openPackAnim(g, cx, cy, user, collection, flashcards, meKey, unlockedCards)
    })
  }

  private openPackAnim(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number,
    user: GoogleUser, collection: CollectionData,
    flashcards: FlashCard[], meKey: string | null,
    unlockedCards: FlashCard[],
  ) {
    // Shake
    this.tweens.add({
      targets: g, x: 8, duration: 55, yoyo: true, repeat: 5, ease: 'Sine.easeInOut',
      onComplete: () => {
        // Flash blanc
        this.cameras.main.flash(280, 220, 220, 255, true)
        // Explosion du paquet
        this.tweens.add({
          targets: g, alpha: 0, scaleX: 1.4, scaleY: 1.4,
          duration: 220, ease: 'Back.easeIn',
          onComplete: () => {
            g.destroy()
            this.spawnParticles(cx, cy)
            this.time.delayedCall(380, () => {
              this.revealCards(cx, user, collection, flashcards, meKey, unlockedCards)
            })
          },
        })
      },
    })
  }

  private spawnParticles(cx: number, cy: number) {
    const colors = [0xffd700, 0x58c4dc, 0xff79b8, 0x98fba8, 0xffa07a, 0xd4a0ff]
    for (let i = 0; i < 26; i++) {
      const pg = this.add.graphics().setDepth(8)
      pg.fillStyle(colors[Math.floor(Math.random() * colors.length)], 1)
      pg.fillCircle(0, 0, Math.random() * 6 + 2)
      pg.setPosition(cx, cy)
      const angle = Math.random() * Math.PI * 2
      const dist  = Math.random() * 130 + 50
      this.tweens.add({
        targets: pg,
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        alpha: 0, scaleX: 0, scaleY: 0,
        duration: 600 + Math.random() * 500,
        ease: 'Power2',
        onComplete: () => pg.destroy(),
      })
    }
  }

  private revealCards(
    cx: number,
    user: GoogleUser, collection: CollectionData,
    flashcards: FlashCard[], meKey: string | null,
    unlockedCards: FlashCard[],
  ) {
    const { height } = this.scale
    const shuffled = [...unlockedCards].sort(() => Math.random() - 0.5)
    const toShow   = shuffled.slice(0, Math.min(3, shuffled.length))
    const count    = toShow.length
    const spacing  = count === 1 ? 0 : 130
    const startX   = cx - ((count - 1) * spacing) / 2
    const cardY    = height * 0.46

    toShow.forEach((card, i) => {
      const mc = new MangaCard(this, startX + i * spacing, cardY, card, 'unlocked')
      mc.setDepth(7)
      mc.reveal(i * 200)
    })

    this.time.delayedCall(count * 200 + 500, () => {
      const txt = this.add.text(cx, cardY + MangaCard.HEIGHT / 2 + 28, '✨  Cartes révélées !', {
        fontSize: '14px', color: '#ffd700',
        fontFamily: 'Cinzel, serif', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(9).setAlpha(0)

      this.tweens.add({ targets: txt, alpha: 1, duration: 400 })

      const btn = this.add.text(cx, cardY + MangaCard.HEIGHT / 2 + 64, '🏘️  Retour au village', {
        fontSize: '13px', color: '#58c4dc',
        fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
        backgroundColor: '#0a1525', padding: { x: 18, y: 9 },
      }).setOrigin(0.5).setDepth(9).setAlpha(0).setInteractive({ useHandCursor: true })

      this.tweens.add({ targets: btn, alpha: 1, duration: 400, delay: 200 })

      btn.on('pointerover',  () => btn.setColor('#ffffff'))
      btn.on('pointerout',   () => btn.setColor('#58c4dc'))
      btn.on('pointerdown',  () => {
        this.scene.start('VillageScene', { user, collection, cards: flashcards, meKey })
      })
    })
  }

  private drawEmptyState(
    width: number, height: number,
    user: GoogleUser, collection: CollectionData,
    flashcards: FlashCard[], meKey: string | null,
  ) {
    const cx = width / 2, cy = height / 2
    this.add.text(cx, cy - 40, '🔒',  { fontSize: '52px' }).setOrigin(0.5).setDepth(3)
    this.add.text(cx, cy + 30, 'Joue au jeu de flashcards\npour débloquer tes premières cartes !', {
      fontSize: '13px', color: '#7788aa', fontFamily: 'Nunito, sans-serif', align: 'center',
    }).setOrigin(0.5).setDepth(3)

    const btn = this.add.text(cx, cy + 96, '🏘️  Retour au village', {
      fontSize: '13px', color: '#58c4dc',
      fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
      backgroundColor: '#0a1525', padding: { x: 18, y: 9 },
    }).setOrigin(0.5).setDepth(3).setInteractive({ useHandCursor: true })

    btn.on('pointerover', () => btn.setColor('#ffffff'))
    btn.on('pointerout',  () => btn.setColor('#58c4dc'))
    btn.on('pointerdown', () => {
      this.scene.start('VillageScene', { user, collection, cards: flashcards, meKey })
    })
  }
}
