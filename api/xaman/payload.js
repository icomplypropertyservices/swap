/**
 * POST/GET /api/xaman/payload — server Xaman Platform proxy (keys stay server-side).
 */
import { fromHttpReq, createXamanProxy } from '../../server/security.mjs'

const proxyXaman = createXamanProxy({ postLimit: 30, label: 'swap' })

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const out = await proxyXaman(
    fromHttpReq(req, {
      uuid: req.query?.uuid ? String(req.query.uuid) : undefined,
    }),
    process.env,
  )
  res.status(out.status)
  res.setHeader('Content-Type', out.contentType)
  if (out.headers) {
    for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v)
  }
  res.send(out.body)
}
