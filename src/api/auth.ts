// Google Identity Services auth — même pattern que chet_lys
// Lire depuis la balise <meta name="google-signin-client_id"> (hardcodée dans index.html)
// ou depuis import.meta.env en dev local
function getClientId(): string {
  const meta = document.querySelector('meta[name="google-signin-client_id"]')
  if (meta) return meta.getAttribute('content') ?? ''
  return import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
}

export interface GoogleUser {
  name: string
  picture: string
  email: string
  token: string
}

let _resolve: ((u: GoogleUser) => void) | null = null
let _currentUser: GoogleUser | null = null
let _listeners: ((u: GoogleUser | null) => void)[] = []

function notify(u: GoogleUser | null) {
  _currentUser = u
  _listeners.forEach(fn => fn(u))
}

export function onAuthChange(fn: (u: GoogleUser | null) => void) {
  _listeners.push(fn)
  if (_currentUser) fn(_currentUser)
}

export function getUser(): GoogleUser | null { return _currentUser }

export function initAuth(): Promise<GoogleUser> {
  return new Promise(resolve => {
    _resolve = resolve
    if (!(window as any).google) {
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.onload = () => setupGIS()
      document.head.appendChild(s)
    } else {
      setupGIS()
    }
  })
}

function setupGIS() {
  const google = (window as any).google
  google.accounts.id.initialize({
    client_id: getClientId(),
    use_fedcm_for_prompt: true,
    callback: (resp: any) => handleCredential(resp.credential),
  })

  // Tenter le one-tap / FedCM — si non supporté, afficher le bouton visible
  google.accounts.id.prompt((notification: any) => {
    const reason = notification.getNotDisplayedReason?.()
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      // FedCM non disponible (UNSUPPORTED_OS, desktop Chrome, etc.) → bouton visible
      showSignInButton()
    }
    if (reason === 'UNSUPPORTED_OS' || reason === 'suppressed_by_user' || reason === 'opt_out_or_no_session') {
      showSignInButton()
    }
  })
}

function showSignInButton() {
  // Vérifier si un bouton existe déjà
  if (document.getElementById('gsi-btn-container')) return

  const container = document.createElement('div')
  container.id = 'gsi-btn-container'
  container.style.cssText = `
    position: fixed; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; z-index: 9999;
    background: rgba(13,13,26,0.95); gap: 16px;
  `
  const label = document.createElement('p')
  label.textContent = '❤️ Connexion requise'
  label.style.cssText = 'color: #58c4dc; font-family: sans-serif; font-size: 15px; font-weight: bold;'

  const btn = document.createElement('div')
  btn.id = 'gsi-btn'
  container.appendChild(label)
  container.appendChild(btn)
  document.body.appendChild(container)

  const google = (window as any).google
  google.accounts.id.renderButton(btn, {
    theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'pill',
  })
}

async function handleCredential(credential: string) {
  // Décoder le JWT pour obtenir nom/photo
  const [, payload] = credential.split('.')
  const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  const user: GoogleUser = {
    name: data.name ?? '',
    picture: data.picture ?? '',
    email: data.email ?? '',
    token: credential,
  }
  notify(user)
  _resolve?.(user)
  _resolve = null
}

export function signOut() {
  notify(null)
  const google = (window as any).google
  if (google) google.accounts.id.disableAutoSelect()
}
