/**
 * Seals a JSON payload for POST /e, POST /check and POST /credential.
 * P-256 ECDH + HKDF-SHA256 + AES-GCM; must match server/box.py.
 */

export interface SealedBox {
  v: 1
  epk: JsonWebKey
  iv: string
  ct: string
}

const INFO = new TextEncoder().encode('claudecookie-box-v1')

let cachedPublic: JsonWebKey | null = null

function b64url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  let bin = ''
  for (const byte of bytes) bin += String.fromCharCode(byte)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export async function fetchBoxPublic(): Promise<JsonWebKey> {
  if (cachedPublic) return cachedPublic
  const response = await fetch('/box', { cache: 'no-store' })
  if (!response.ok) throw new Error('box')
  const jwk = (await response.json()) as JsonWebKey
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.x || !jwk.y) {
    throw new Error('box')
  }
  cachedPublic = jwk
  return jwk
}

export async function sealJsonWithPublic(serverJwk: JsonWebKey, value: unknown): Promise<SealedBox> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('box')

  const serverKey = await subtle.importKey(
    'jwk',
    serverJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const ephemeral = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])
  const shared = await subtle.deriveBits({ name: 'ECDH', public: serverKey }, ephemeral.privateKey, 256)
  const hkdfKey = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveBits'])
  const aesBits = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: INFO },
    hkdfKey,
    256,
  )
  const aesKey = await subtle.importKey('raw', aesBits, { name: 'AES-GCM' }, false, ['encrypt'])
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(JSON.stringify(value))
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext)
  const epk = await subtle.exportKey('jwk', ephemeral.publicKey)
  return {
    v: 1,
    epk: { kty: 'EC', crv: 'P-256', x: epk.x, y: epk.y },
    iv: b64url(iv),
    ct: b64url(ct),
  }
}

export async function sealJson(value: unknown): Promise<SealedBox> {
  return sealJsonWithPublic(await fetchBoxPublic(), value)
}
