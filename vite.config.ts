import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import fs from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
// @ts-expect-error — plain ESM server helper (no types)
import { createXamanProxy, fromHttpReq } from './server/security.mjs'

function readDotEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    if (!fs.existsSync(filePath)) return out
    for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq <= 0) continue
      let val = t.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      out[t.slice(0, eq).trim()] = val
    }
  } catch {
    /* ignore */
  }
  return out
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function swapApiPlugin(mode: string, cwd: string): Plugin {
  const fromVite = loadEnv(mode, cwd, '')
  const fromFile = {
    ...readDotEnvFile(path.join(cwd, '.env')),
    ...readDotEnvFile(path.join(cwd, `.env.${mode}`)),
    ...readDotEnvFile(path.join(cwd, '.env.local')),
  }
  const env = {
    XUMM_API_KEY: process.env.XUMM_API_KEY || fromVite.XUMM_API_KEY || fromFile.XUMM_API_KEY || '',
    XUMM_API_SECRET:
      process.env.XUMM_API_SECRET || fromVite.XUMM_API_SECRET || fromFile.XUMM_API_SECRET || '',
  }
  const proxy = createXamanProxy({ postLimit: 30 })

  return {
    name: 'riddle-swap-api',
    configureServer(server) {
      server.middlewares.use('/api/health', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            ok: true,
            brand: 'Riddle Swap',
            xamanReady: Boolean(env.XUMM_API_KEY && env.XUMM_API_SECRET),
          }),
        )
      })
      server.middlewares.use('/api/xaman/payload', async (req, res) => {
        try {
          const url = new URL(req.url || '', 'http://local')
          const body =
            req.method === 'POST' || req.method === 'PUT' ? await readBody(req) : undefined
          const out = await proxy(
            fromHttpReq(req as IncomingMessage, {
              uuid: url.searchParams.get('uuid') || undefined,
              body,
              clientIp: '127.0.0.1',
            }),
            env,
          )
          ;(res as ServerResponse).statusCode = out.status
          res.setHeader('Content-Type', out.contentType)
          res.end(out.body)
        } catch (e) {
          ;(res as ServerResponse).statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'proxy error' }))
        }
      })
      // Token logo proxy (avoids xrpl.to 429 in browser)
      server.middlewares.use('/api/thumb', async (req, res) => {
        try {
          const url = new URL(req.url || '', 'http://local')
          let md5 = url.searchParams.get('md5') || ''
          if (!md5) {
            const m = (req.url || '').match(/\/api\/thumb\/([a-f0-9]{32})/i)
            if (m) md5 = m[1]
          }
          if (!/^[a-f0-9]{32}$/i.test(md5)) {
            ;(res as ServerResponse).statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'md5 required' }))
            return
          }
          const up = await fetch(`https://api.xrpl.to/v1/thumb/${md5}`, {
            headers: {
              Accept: 'image/webp,image/*',
              'User-Agent': 'RiddleSwap-dev',
            },
          })
          ;(res as ServerResponse).statusCode = up.status
          res.setHeader('Content-Type', up.headers.get('content-type') || 'image/webp')
          res.setHeader('Cache-Control', 'public, max-age=3600')
          const buf = Buffer.from(await up.arrayBuffer())
          res.end(buf)
        } catch (e) {
          ;(res as ServerResponse).statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'thumb fail' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), swapApiPlugin(mode, process.cwd())],
  // Fleet ads env uses Next-style NEXT_PUBLIC_* in addition to Vite's VITE_*
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
}))
