import fs from 'fs'
import path from 'path'

const src = process.argv[2] || path.join('C:/Users/E-Store/docs/swap/.env.local')
const dest = process.argv[3] || path.join(process.cwd(), '.env.local')

const text = fs.readFileSync(src, 'utf8')
const map = {}
for (const line of text.split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i < 1) continue
  let v = t.slice(i + 1).trim()
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1)
  }
  map[t.slice(0, i).trim()] = v
}

const key = map.XUMM_API_KEY || ''
const secret = map.XUMM_API_SECRET || ''
if (key.length < 20 || secret.length < 20) {
  console.error('missing keys in source', { keyLen: key.length, secretLen: secret.length })
  process.exit(1)
}

// Preserve other local vars if present
let existing = {}
if (fs.existsSync(dest)) {
  for (const line of fs.readFileSync(dest, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 1) continue
    existing[t.slice(0, i).trim()] = t.slice(i + 1)
  }
}

existing.XUMM_API_KEY = key
existing.XUMM_API_SECRET = secret
const out = Object.entries(existing)
  .map(([k, v]) => `${k}=${v}`)
  .join('\n')
fs.writeFileSync(dest, out + '\n', 'utf8')
console.log('wrote', dest, 'keyLen', key.length, 'secretLen', secret.length)
