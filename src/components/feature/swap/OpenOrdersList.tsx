interface OpenOrder {
  seq: number
  taker_gets: string
  taker_pays: string
}

interface OpenOrdersListProps {
  orders: OpenOrder[]
  onRefresh: () => void
  onCancel: (seq: number) => void
  /** Disable cancel while another payload is in flight. */
  disabled?: boolean
}

/** Compact list of the user's open XRPL limit orders. */
export default function OpenOrdersList({ orders, onRefresh, onCancel, disabled = false }: OpenOrdersListProps) {
  if (orders.length === 0) return null

  return (
    <div className="border border-[#23262f] rounded-2xl p-4 text-xs bg-[#0a0c12]">
      <div className="flex justify-between items-center mb-2 text-slate-400">
        <span className="font-medium">Your open orders ({orders.length})</span>
        <button type="button" onClick={onRefresh} disabled={disabled} className="text-blue-400 disabled:opacity-40">
          REFRESH
        </button>
      </div>
      <div className="space-y-1.5">
        {orders.slice(0, 4).map((o, i) => (
          <div key={i} className="flex justify-between items-center bg-black/30 rounded-xl px-3 py-2">
            <div>
              #{o.seq} • {o.taker_gets} → {o.taker_pays}
            </div>
            <button
              type="button"
              onClick={() => onCancel(o.seq)}
              disabled={disabled}
              className="text-red-400 hover:text-red-300 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {disabled ? '…' : 'CANCEL'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
