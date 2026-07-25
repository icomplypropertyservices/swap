import { useState, useEffect } from 'react'

export function useApiKey() {
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('xummApiKey')
    if (saved) setApiKey(saved)
  }, [])

  useEffect(() => {
    if (apiKey) localStorage.setItem('xummApiKey', apiKey)
  }, [apiKey])

  const toggleShowApiKey = () => setShowApiKey((v) => !v)

  return {
    apiKey,
    setApiKey,
    showApiKey,
    setShowApiKey,
    toggleShowApiKey,
  }
}
