/**
 * Utilitaires d'ambiance atmosphérique partagés entre les scènes.
 * Chaque style correspond à un moment de la journée / ambiance narrative.
 */

export type SkyStyle = 'dawn' | 'dusk' | 'night' | 'storm'

interface SkyConfig {
  topColor: number; botColor: number
  sunColor?: number; sunY?: number; sunSize?: number
  moonY?: number; hasMoon?: boolean; hasStars?: boolean
  hillColor: number
  groundTop: number; groundBot: number
}

const SKY: Record<SkyStyle, SkyConfig> = {
  dawn: {
    topColor: 0x08061e, botColor: 0xe8703a,
    sunColor: 0xffb347, sunY: 0.72, sunSize: 28,
    hasMoon: true, moonY: 0.12, hasStars: true,
    hillColor: 0x1a2a3a,
    groundTop: 0x3d5e2a, groundBot: 0x253a1a,
  },
  dusk: {
    topColor: 0x1a0e54, botColor: 0xf0723a,
    sunColor: 0xff8c42, sunY: 0.65, sunSize: 36,
    hasMoon: false, hasStars: true,
    hillColor: 0x2a1a3e,
    groundTop: 0x4a6a2a, groundBot: 0x2a3e18,
  },
  night: {
    topColor: 0x020612, botColor: 0x180840,
    hasMoon: true, moonY: 0.10, hasStars: true,
    hillColor: 0x0a0e1a,
    groundTop: 0x0e1a0e, groundBot: 0x080e08,
  },
  storm: {
    topColor: 0x1a0818, botColor: 0x3a1840,
    hasMoon: false, hasStars: false,
    hillColor: 0x0e0818,
    groundTop: 0x1a1620, groundBot: 0x0e0c14,
  },
}

export function drawAtmosphere(
  scene: Phaser.Scene,
  style: SkyStyle,
  depthStart = 0,
) {
  const { width, height } = scene.scale
  const cfg = SKY[style]
  const g = scene.add.graphics().setDepth(depthStart)

  // ── Ciel dégradé ──────────────────────────────────────────
  g.fillGradientStyle(cfg.topColor, cfg.topColor, cfg.botColor, cfg.botColor, 1)
  g.fillRect(0, 0, width, height * 0.68)

  // ── Étoiles ───────────────────────────────────────────────
  if (cfg.hasStars) {
    const count = style === 'night' ? 90 : 50
    const maxY  = style === 'dusk'  ? height * 0.5 : height * 0.6
    const rng   = Phaser.Math.RND
    for (let i = 0; i < count; i++) {
      const sx = rng.frac() * width
      const sy = rng.frac() * maxY
      const sa = rng.frac() * 0.7 + 0.2
      const sr = rng.frac() * 1.4 + 0.3
      g.fillStyle(0xffffff, sa)
      g.fillCircle(sx, sy, sr)
    }
  }

  // ── Soleil ────────────────────────────────────────────────
  if (cfg.sunColor && cfg.sunY && cfg.sunSize) {
    const sx = width * 0.78
    const sy = height * cfg.sunY
    const sg = scene.add.graphics().setDepth(depthStart + 1)
    sg.fillStyle(cfg.sunColor, 0.15); sg.fillCircle(sx, sy, cfg.sunSize * 2.4)
    sg.fillStyle(cfg.sunColor, 0.3);  sg.fillCircle(sx, sy, cfg.sunSize * 1.6)
    sg.fillStyle(cfg.sunColor, 0.6);  sg.fillCircle(sx, sy, cfg.sunSize)
    sg.fillStyle(0xffffff,     0.9);  sg.fillCircle(sx, sy, cfg.sunSize * 0.55)
  }

  // ── Lune ──────────────────────────────────────────────────
  if (cfg.hasMoon && cfg.moonY !== undefined) {
    const mx = width * 0.15
    const my = height * cfg.moonY
    const mg = scene.add.graphics().setDepth(depthStart + 1)
    mg.fillStyle(0xd0d8f8, 0.15); mg.fillCircle(mx, my, 28)
    mg.fillStyle(0xd0d8f8, 0.35); mg.fillCircle(mx, my, 20)
    mg.fillStyle(0xe8eeff, 1);    mg.fillCircle(mx, my, 14)
    // Croissant : cercle sombre pour créer l'effet
    mg.fillStyle(cfg.topColor, 1); mg.fillCircle(mx + 7, my - 5, 11)
  }

  // ── Collines silhouette ───────────────────────────────────
  const hg = scene.add.graphics().setDepth(depthStart + 1)
  hg.fillStyle(cfg.hillColor, 1)
  hg.fillEllipse(width * 0.10, height * 0.60, 260, 140)
  hg.fillEllipse(width * 0.50, height * 0.57, 320, 160)
  hg.fillEllipse(width * 0.90, height * 0.60, 240, 130)

  // ── Sol ───────────────────────────────────────────────────
  const gg = scene.add.graphics().setDepth(depthStart + 2)
  gg.fillGradientStyle(cfg.groundTop, cfg.groundTop, cfg.groundBot, cfg.groundBot, 1)
  gg.fillRect(0, height * 0.63, width, height * 0.37)

  // Ligne de sol lumineuse
  if (style === 'dusk' || style === 'dawn') {
    gg.fillStyle(0xffaa44, 0.18)
    gg.fillRect(0, height * 0.63, width, 4)
  }

  // ── Aurora (nuit uniquement) ──────────────────────────────
  if (style === 'night') {
    const ag = scene.add.graphics().setDepth(depthStart + 1)
    ag.fillStyle(0x00e8b8, 0.05); ag.fillEllipse(width * 0.3, height * 0.2, 340, 80)
    ag.fillStyle(0x8844ff, 0.04); ag.fillEllipse(width * 0.6, height * 0.15, 280, 60)
    ag.fillStyle(0x00aaff, 0.04); ag.fillEllipse(width * 0.5, height * 0.25, 260, 50)
  }

  // ── Nuages d'orage (storm uniquement) ────────────────────
  if (style === 'storm') {
    const cg = scene.add.graphics().setDepth(depthStart + 1)
    cg.fillStyle(0x2a1838, 0.85)
    cg.fillEllipse(width * 0.20, height * 0.18, 200, 80)
    cg.fillEllipse(width * 0.55, height * 0.12, 260, 90)
    cg.fillEllipse(width * 0.82, height * 0.20, 180, 70)
    cg.fillStyle(0x1e1028, 1)
    cg.fillEllipse(width * 0.35, height * 0.22, 240, 95)
    cg.fillEllipse(width * 0.70, height * 0.16, 200, 85)
    // Éclairs subtils
    cg.lineStyle(1.5, 0xd4b8ff, 0.35)
    cg.lineBetween(width * 0.55, height * 0.18, width * 0.50, height * 0.35)
    cg.lineBetween(width * 0.50, height * 0.35, width * 0.55, height * 0.42)
    cg.lineStyle(1, 0xd4b8ff, 0.2)
    cg.lineBetween(width * 0.22, height * 0.22, width * 0.18, height * 0.40)
  }

  return g
}

/**
 * Ajoute des arbres silhouette le long de l'horizon.
 */
export function drawTreeSilhouettes(scene: Phaser.Scene, style: SkyStyle, depth = 3) {
  const { width, height } = scene.scale
  const dark = style === 'storm' ? 0x0e0c14 : style === 'night' ? 0x060c06 : 0x1a2a10
  const positions = [
    { x: 0.06, s: 1.1 }, { x: 0.15, s: 0.85 },
    { x: 0.84, s: 1.1 }, { x: 0.93, s: 0.85 },
  ]
  const g = scene.add.graphics().setDepth(depth)
  for (const p of positions) {
    const tx = width * p.x
    const ty = height * 0.67
    const r  = 18 * p.s
    // Tronc
    g.fillStyle(dark, 1)
    g.fillRect(tx - 3, ty, 6, 30 * p.s)
    // Feuillage (3 ellipses empilées)
    g.fillStyle(dark, 1)
    g.fillEllipse(tx, ty - 8,  r * 2,       r * 1.4)
    g.fillEllipse(tx, ty - 20, r * 1.6,     r * 1.2)
    g.fillEllipse(tx, ty - 30, r * 1.1,     r)
  }
}
