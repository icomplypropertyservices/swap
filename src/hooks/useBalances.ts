import { useState, useCallback } from 'react'
import type { Token, Balance } from '../types'
import { toast } from 'sonner'
// isXRP kept for future use inside hook
// import { isXRP } from '../utils/xrpl'

interface UseBalancesParams {
  getClient: () => Promise<any>
  tokens: Token[]
}

export function useBalances({ getClient, tokens }: UseBalancesParams) {
  const [balances, setBalances] = useState<Balance>({})
  const [isLoadingBalances, setIsLoadingBalances] = useState(false)

  const fetchBalances = useCallback(async (addr: string) => {
    if (!addr) return
    setIsLoadingBalances(true)
    try {
      const client = await getClient()
      const info = await client.request({
        command: 'account_info',
        account: addr,
        ledger_index: 'validated',
      })
      const xrpBalance = (parseInt(info.result.account_data.Balance) / 1_000_000).toString()

      const lines = await client.request({
        command: 'account_lines',
        account: addr,
        ledger_index: 'validated',
        limit: 200,
      })

      const bal: Balance = { XRP: xrpBalance }

      for (const line of lines.result.lines || []) {
        const sym = line.currency.length > 3 ? line.currency.slice(0, 8) : line.currency
        const match = tokens.find(
          (t) => t.currency.toUpperCase() === line.currency.toUpperCase() && t.issuer === line.account
        )
        const key = match ? match.symbol : `${sym}:${line.account.slice(0, 6)}`
        bal[key] = line.balance
      }

      setBalances(bal)
    } catch (e: any) {
      console.error('Balance fetch failed', e)
      toast.error('Failed to load balances: ' + (e?.message || e))
    } finally {
      setIsLoadingBalances(false)
    }
  }, [getClient, tokens])

  return { balances, isLoadingBalances, fetchBalances, setBalances }
}
