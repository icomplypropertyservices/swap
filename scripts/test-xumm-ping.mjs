import fs from 'fs'

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    }),
)
const headers = {
  Accept: 'application/json',
  'X-API-Key': env.XUMM_API_KEY,
  'X-API-Secret': env.XUMM_API_SECRET,
}

for (const path of [
  '/api/v1/platform/payload',
  '/api/v1/platform/curated-assets',
  '/api/v1/app/details',
  '/api/v1/platform/ping',
]) {
  const res = await fetch(`https://xumm.app${path}`, {
    method: path.includes('payload') ? 'POST' : 'GET',
    headers: {
      ...headers,
      ...(path.includes('payload')
        ? {
            'Content-Type': 'application/json',
          }
        : {}),
    },
    body: path.includes('payload')
      ? JSON.stringify({ txjson: { TransactionType: 'SignIn' } })
      : undefined,
  })
  const text = await res.text()
  console.log(path, res.status, text.slice(0, 120).replace(/\s+/g, ' '))
}
