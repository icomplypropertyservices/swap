/**
 * GET /api/health — public readiness (no secrets).
 */
export default function handler(_req, res) {
  const xummKey = String(process.env.XUMM_API_KEY || '').trim()
  const xummSecret = String(process.env.XUMM_API_SECRET || '').trim()
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.status(200).json({
    ok: true,
    brand: 'Riddle Swap',
    domain: 'swap.riddlewallet.com',
    xamanReady: Boolean(xummKey && xummSecret),
  })
}
