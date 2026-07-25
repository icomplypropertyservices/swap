import { useState, useCallback } from 'react'
import type { Token, Balance } from '../types'
import { NATIVE_XRP, isXRP } from '../utils/xrpl'

export function useTokenPair(balances: Balance) {
  const [fromToken, setFromToken] = useState<Token>(NATIVE_XRP)
  const [toToken, setToToken] = useState<Token>(NATIVE_XRP)

  const selectFrom = useCallback((t: Token) => setFromToken(t), [])
  const selectTo = useCallback((t: Token) => setToToken(t), [])

  const getBalance = useCallback((token: Token): string => {
    if (isXRP(token)) return balances['XRP'] || '0'
    if (token.issuer) {
      const match = Object.entries(balances).find(([k]) => {
        if (k === token.symbol) return true
        return k.includes(token.symbol) && !!token.issuer && !!balances[k]
      })
      if (match) return match[1]
    }
    return balances[token.symbol] || '0'
  }, [balances])

  return {
    fromToken,
    toToken,
    setFromToken,
    setToToken,
    selectFrom,
    selectTo,
    getBalance,
  }
}
