import { X } from 'lucide-react'
import type { XummPayloadResponse } from '../types'
import { deepLinks, openXamanUrls } from '../utils/xamanSession'

interface PayloadModalProps {
  open: boolean
  payload: XummPayloadResponse | null
  status: 'pending' | 'signed' | 'rejected' | 'expired'
  txHash: string
  onClose: () => void
}

export default function PayloadModal({ open, payload, status, txHash, onClose }: PayloadModalProps) {
  if (!open || !payload) return null

  const links = deepLinks(payload.uuid, payload.next?.always)

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[80] p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 max-w-md w-full rounded-3xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start">
          <div>
            <div className="font-semibold text-xl">Sign with Xaman</div>
            <div className="text-sm text-slate-400">
              Scan QR, or open the app — return here after approving
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1" aria-label="Close">
            <X />
          </button>
        </div>

        {payload.refs?.qr_png && (
          <div className="qr-container mx-auto mt-6">
            <img src={payload.refs.qr_png} alt="Xumm QR code" className="w-[220px] h-[220px]" />
          </div>
        )}

        <button
          type="button"
          onClick={() => openXamanUrls(payload.uuid, payload.next?.always)}
          className="mt-4 block w-full text-center bg-blue-600 hover:bg-blue-700 py-3 rounded-2xl font-medium"
        >
          Open in Xaman app →
        </button>

        <a
          href={links.web}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block text-center text-sm text-slate-400 hover:text-slate-200 underline"
        >
          Open sign link in browser
        </a>

        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          <span className={`status-dot ${status === 'pending' ? 'pending' : status === 'signed' ? 'signed' : 'rejected'}`} />
          <span className="capitalize">
            {status === 'pending' ? 'Waiting for approval…' : status}
          </span>
        </div>

        {status === 'signed' && txHash && (
          <div className="mt-4 p-3 bg-emerald-950 border border-emerald-900 rounded-2xl text-xs">
            <div className="text-emerald-400 mb-1">Transaction submitted</div>
            <a
              href={`https://xrpscan.com/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="tx-link text-blue-400 underline break-all"
            >
              {txHash}
            </a>
          </div>
        )}

        <div className="mt-5 text-[11px] text-center text-slate-500">
          Powered by Xumm payload · {payload.uuid}
        </div>
      </div>
    </div>
  )
}
