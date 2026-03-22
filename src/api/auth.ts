// Google Identity Services auth — même pattern que chet_lys
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

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
    // Charger le script GIS si pas déjà là
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
    client_id: CLIENT_ID,
    use_fedcm_for_prompt: true,
    callback: (resp: any) => handleCredential(resp.credential),
  })
  google.accounts.id.prompt()
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
