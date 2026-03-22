import Phaser from 'phaser'
import { initAuth, type GoogleUser } from '../api/auth'
import { fetchCollection, fetchCards, type CollectionData, type FlashCard } from '../api/progress'

export class LoadScene extends Phaser.Scene {
  constructor() { super('LoadScene') }

  create() {
    const { width, height } = this.scale
    const cx = width / 2
    const cy = height / 2

    // Fond dégradé manga — encre sombre
    this.drawBackground()

    // Logo / titre
    this.add.text(cx, cy - 80, '❤️', { fontSize: '42px' }).setOrigin(0.5)
    this.add.text(cx, cy - 28, 'CARD COLLECTOR', {
      fontSize: '22px', color: '#58c4dc',
      fontFamily: '"Courier New", monospace',
      fontStyle: 'bold', letterSpacing: 4,
    }).setOrigin(0.5)
    this.add.text(cx, cy + 4, 'Chet & Lys', {
      fontSize: '13px', color: '#a0b8cc',
      fontFamily: 'sans-serif', fontStyle: 'italic',
    }).setOrigin(0.5)

    // Status text
    const status = this.add.text(cx, cy + 50, 'Connexion Google…', {
      fontSize: '11px', color: '#667788', fontFamily: 'sans-serif',
    }).setOrigin(0.5)

    // Barre de chargement
    const barBg = this.add.graphics()
    barBg.fillStyle(0x1a2a3a, 1)
    barBg.fillRoundedRect(cx - 100, cy + 70, 200, 6, 3)

    const bar = this.add.graphics()

    const setProgress = (pct: number) => {
      bar.clear()
      bar.fillStyle(0x58c4dc, 1)
      bar.fillRoundedRect(cx - 100, cy + 70, 200 * pct, 6, 3)
    }
    setProgress(0.1)

    // Lignes vitesse manga en arrière-plan
    this.drawSpeedLines(cx, cy)

    // Auth + fetch
    this.startLoad(status, setProgress)
  }

  private async startLoad(
    status: Phaser.GameObjects.Text,
    setProgress: (p: number) => void
  ) {
    try {
      status.setText('Connexion Google…')
      const user = await initAuth()
      setProgress(0.4)

      status.setText('Chargement de la collection…')
      const [collection, cards] = await Promise.all([
        fetchCollection(user.token),
        fetchCards(user.token),
      ])
      setProgress(0.9)

      // Petit délai pour l'effet
      await new Promise(r => setTimeout(r, 300))
      setProgress(1)

      this.time.delayedCall(200, () => {
        this.scene.start('CollectionScene', { user, collection, cards })
      })
    } catch (e) {
      status.setText('Erreur de connexion — réessaie').setColor('#ff6b6b')
      console.error(e)
    }
  }

  private drawBackground() {
    const { width, height } = this.scale
    const g = this.add.graphics()

    // Fond principal
    g.fillStyle(0x0d0d1a, 1)
    g.fillRect(0, 0, width, height)

    // Dégradé radial simulé — cercles concentriques
    const colors = [0x0d1a2e, 0x0a1525, 0x0d0d1a]
    colors.forEach((c, i) => {
      g.fillStyle(c, 0.5)
      g.fillCircle(width / 2, height / 2, (3 - i) * 180)
    })

    // Grille tramée en fond
    g.fillStyle(0x1a2a3a, 0.15)
    for (let x = 0; x < width; x += 20) {
      for (let y = 0; y < height; y += 20) {
        g.fillCircle(x, y, 0.8)
      }
    }
  }

  private drawSpeedLines(cx: number, cy: number) {
    const { width, height } = this.scale
    const g = this.add.graphics()
    g.lineStyle(0.5, 0x1e3a5a, 0.6)

    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2
      const r1 = 140
      const r2 = Math.max(width, height)
      g.lineBetween(
        cx + Math.cos(angle) * r1,
        cy + Math.sin(angle) * r1,
        cx + Math.cos(angle) * r2,
        cy + Math.sin(angle) * r2,
      )
    }
  }
}
