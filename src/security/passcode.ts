const PASSCODE_SALT = '928dbeb1b1f4980656d6f17d2a53f30166d7816a7b10886dbc9568b81dd9c959'
const PASSCODE_SHA256 = 'da6c1eee3aa20261ab5a9645f00fca3ba33b17a940e4b05c4b978fc917e4646f'

export async function verifyPasscode(passcode: string) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure passcode verification is unavailable in this browser.')
  }
  const input = new TextEncoder().encode(`${PASSCODE_SALT}:${passcode}`)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', input)
  const actual = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return actual === PASSCODE_SHA256
}
