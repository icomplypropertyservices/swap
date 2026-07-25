import fs from 'fs'

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      let v = l.slice(i + 1)
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      return [l.slice(0, i), v]
    }),
)

const key = String(env.XUMM_API_KEY || '').trim()
const secret = String(env.XUMM_API_SECRET || '').trim()
console.log('keyLen', key.length, 'secretLen', secret.length, 'keyPrefix', key.slice(0, 6))

const res = await fetch('https://xumm.app/api/v1/platform/payload', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-API-Key': key,
    'X-API-Secret': secret,
  },
  body: JSON.stringify({
    txjson: { TransactionType: 'SignIn' },
    options: { submit: false, expire: 5 },
    custom_meta: { instruction: 'test connect' },
  }),
})
const text = await res.text()
console.log('status', res.status)
console.log(text.slice(0, 500))
