import { Info } from 'lucide-react'

interface ApiKeySectionProps {
  apiKey: string
  showApiKey: boolean
  onChange: (val: string) => void
  onToggleShow: () => void
}

export default function ApiKeySection({ apiKey, showApiKey, onChange, onToggleShow }: ApiKeySectionProps) {
  return (
    <div className="mb-6 px-1">
      <div className="text-xs uppercase tracking-[2px] text-blue-400 mb-1.5 flex items-center gap-2">
        <Info size={13} /> XUMM API KEY REQUIRED
      </div>
      <div className="flex gap-2 items-center">
        <input
          type={showApiKey ? 'text' : 'password'}
          value={apiKey}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste Xumm API key (apps.xumm.dev)"
          className="flex-1 bg-[#0a0c12] border border-[#23262f] rounded-2xl px-4 py-2.5 text-sm font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-600"
        />
        <button
          onClick={onToggleShow}
          className="px-4 py-2.5 text-xs border border-[#23262f] rounded-2xl hover:bg-[#111318]"
        >
          {showApiKey ? 'HIDE' : 'SHOW'}
        </button>
      </div>
      <div className="text-[10px] mt-1 text-slate-500">
        Create free key at <a href="https://apps.xumm.dev" className="underline" target="_blank" rel="noreferrer">apps.xumm.dev</a>. This UI uses the same REST endpoints as the official SDK.
      </div>
    </div>
  )
}
