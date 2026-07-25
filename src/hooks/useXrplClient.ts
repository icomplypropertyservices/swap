import { useState, useCallback } from 'react'
import { Client } from 'xrpl'
import { XRPL_WS } from '../utils/xrpl'

export function useXrplClient() {
  const [xrplClient, setXrplClient] = useState<Client | null>(null)

  const getClient = useCallback(async (): Promise<Client> => {
    if (xrplClient && xrplClient.isConnected()) return xrplClient
    const client = new Client(XRPL_WS)
    await client.connect()
    setXrplClient(client)
    return client
  }, [xrplClient])

  // Cleanup on unmount
  const disconnectClient = useCallback(() => {
    if (xrplClient) {
      xrplClient.disconnect().catch(() => {})
    }
  }, [xrplClient])

  return { getClient, disconnectClient, xrplClient }
}
