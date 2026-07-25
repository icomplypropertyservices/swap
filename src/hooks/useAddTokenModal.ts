import { useState } from 'react'
import { toast } from 'sonner'
import type { Token } from '../types'

export function useAddTokenModal(addCustomToken: (token: Token) => void) {
  const [showAddToken, setShowAddToken] = useState(false)
  const [addTokenPrefill, setAddTokenPrefill] = useState<string | undefined>(undefined)

  const openAddToken = (prefill?: string) => {
    setAddTokenPrefill(prefill)
    setShowAddToken(true)
  }

  const closeAddToken = () => {
    setShowAddToken(false)
    setAddTokenPrefill(undefined)
  }

  const handleAddToken = (newTok: Token) => {
    addCustomToken(newTok)
    toast.success(`Added ${newTok.symbol}`)
    closeAddToken()
  }

  return {
    showAddToken,
    addTokenPrefill,
    openAddToken,
    closeAddToken,
    handleAddToken,
  }
}
