/** Bottom disclaimer for the XRPL swap app. */
export default function AppFooter() {
  return (
    <div className="text-center text-[10px] text-slate-600 py-10 max-w-md mx-auto">
      XRPL DEX • Market swaps via Payment tx • Limit orders via OfferCreate. All signing through
      Xumm REST API. Tokens loaded live from xrpl.to. Not financial advice.
    </div>
  )
}
