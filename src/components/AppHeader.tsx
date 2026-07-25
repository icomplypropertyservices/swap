import { X } from 'lucide-react'

interface AppHeaderProps {
  address: string
  onDisconnect: () => void
}

export default function AppHeader({ address, onDisconnect }: AppHeaderProps) {
  return (
    <header className="border-b border-[#1f232c] bg-[#0a0c12]/95 backdrop-blur sticky top-0 z-50">
      <div className="max-w-[720px] mx-auto px-5 py-4 flex items-center justify-between">
        <a
          href="https://riddlewallet.com"
          className="flex items-center gap-3 no-underline text-inherit"
        >
          <img
            src="/logo.jpg"
            alt="Riddle Swap"
            className="w-8 h-8 rounded-2xl object-cover ring-1 ring-white/10"
            width={32}
            height={32}
          />
          <div>
            <div className="font-semibold text-[21px] tracking-[-0.6px]">Riddle Swap</div>
            <div className="text-[9px] text-slate-500 -mt-1 font-medium">
              XRPL DEX · XAMAN · SUITE
            </div>
          </div>
        </a>

        <div className="flex items-center gap-2 text-sm">
          <a
            href="https://riddlewallet.com"
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#111318] hover:bg-[#16181f] text-xs text-slate-400"
          >
            Suite
          </a>
          <a
            href="https://xrpl.to"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#111318] hover:bg-[#16181f] text-xs text-slate-400"
          >
            xrpl.to
          </a>
          {address ? (
            <button
              type="button"
              onClick={onDisconnect}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1c2028] hover:bg-red-950/70 rounded-2xl text-xs font-medium"
            >
              <X size={15} /> DISCONNECT
            </button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
