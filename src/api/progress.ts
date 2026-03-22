export interface FlashProgress {
  name: string
  email?: string
  xp: number
  sessions: { date: string; correct: number; approx: number; wrong: number; xp_gained: number }[]
}

// Clés dynamiques : prénom normalisé (chétana, vornsok, lys, etc.)
export type CollectionData = Record<string, FlashProgress>

export interface FlashCard {
  id: string; fr: string; kh: string; en?: string
  phonetic_kh?: string; phonetic_fr?: string; hint?: string
}

// XP seuils pour chaque carte (débloquée si score cumulé suffisant)
const XP_PER_CARD_UNLOCK = 5 // 1 session correcte = unlockée

export function unlockedCardIds(progress: FlashProgress): Set<string> {
  // Une carte est débloquée si elle a été correctement répondue au moins une fois
  // On utilise le XP total comme proxy (simplifié : toutes débloquées progressivement)
  const total = progress.sessions.reduce((s, sess) => s + sess.correct + sess.approx, 0)
  const unlocked = new Set<string>()
  for (let i = 1; i <= Math.min(20, Math.floor(total / XP_PER_CARD_UNLOCK) + 1); i++) {
    unlocked.add(String(i))
  }
  return unlocked
}

// Normalise un prénom : enlève les accents, lowercase — "Chétana" → "chetana"
export function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// Trouve la progression de l'utilisateur connecté dans le map dynamique
export function findMyProgress(collection: CollectionData, firstName: string): FlashProgress {
  const norm = normalizeName(firstName)
  // Cherche une clé dont la normalisation correspond
  const key = Object.keys(collection).find(k => normalizeName(k) === norm)
  return key ? collection[key] : { name: firstName, xp: 0, sessions: [] }
}

// Retourne les progressions des autres joueurs
export function findOthers(collection: CollectionData, firstName: string): FlashProgress[] {
  const norm = normalizeName(firstName)
  return Object.values(collection).filter(p => normalizeName(p.name ?? '') !== norm)
}

const API_BASE = import.meta.env.VITE_API_BASE ?? 'https://lys-267131866578.europe-west1.run.app'

export async function fetchCollection(token: string): Promise<{ data: CollectionData; meKey: string | null }> {
  const res = await fetch(`${API_BASE}/api/flashcards/collection`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Collection fetch failed: ${res.status}`)
  const raw = await res.json()
  const { _meKey, ...data } = raw
  return { data: data as CollectionData, meKey: _meKey ?? null }
}

export async function fetchCards(token: string): Promise<FlashCard[]> {
  const res = await fetch(`${API_BASE}/api/flashcards`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Cards fetch failed: ${res.status}`)
  return res.json()
}

// ── Level helpers ────────────────────────────────────────────────
export interface FlashLevel {
  level: number; minXp: number; title: string; avatar: string; color: number
}

export const LEVELS: FlashLevel[] = [
  { level: 1, minXp: 0,    title: 'Bébé',         avatar: '👶',    color: 0x94a3b8 },
  { level: 2, minXp: 60,   title: 'Enfant',        avatar: '🧒',    color: 0x6ee7b7 },
  { level: 3, minXp: 180,  title: 'Écolier',       avatar: '👦',    color: 0x67e8f9 },
  { level: 4, minXp: 400,  title: 'Ado',           avatar: '🧑',    color: 0x93c5fd },
  { level: 5, minXp: 700,  title: 'Jeune adulte',  avatar: '👨',    color: 0xc4b5fd },
  { level: 6, minXp: 1200, title: 'Diplômé',       avatar: '👨‍🎓', color: 0xfde68a },
  { level: 7, minXp: 2000, title: 'Expert',        avatar: '👨‍🏫', color: 0xfca5a5 },
  { level: 8, minXp: 3500, title: 'Maître',        avatar: '🧙‍♂️', color: 0xf0abfc },
  { level: 9, minXp: 5500, title: 'Légende',       avatar: '🤴',    color: 0xfcd34d },
]

export function getLevel(xp: number): FlashLevel {
  return [...LEVELS].reverse().find(l => xp >= l.minXp) ?? LEVELS[0]
}

export function xpPct(xp: number): number {
  const cur = getLevel(xp)
  const next = LEVELS.find(l => l.minXp > xp)
  if (!next) return 100
  return ((xp - cur.minXp) / (next.minXp - cur.minXp)) * 100
}
