import { isXRP } from '../../utils/xrpl'
import type { Token } from '../../types'
import type { LimitExpiration } from '../useLimitOrders.types'

export interface BuildLimitOrderTxParams {
  address: string
  fromToken: Token
  toToken: Token
  limitSellAmount: string
  limitReceiveAmount: string
  limitExpiration: LimitExpiration
}

/** Build an OfferCreate txjson for a limit order. */
export function buildLimitOrderTx({
  address,
  fromToken,
  toToken,
  limitSellAmount,
  limitReceiveAmount,
  limitExpiration,
}: BuildLimitOrderTxParams): any {
  if (!address) throw new Error('No wallet connected')
  if (!limitSellAmount || parseFloat(limitSellAmount) <= 0) throw new Error('Invalid sell amount')
  if (!limitReceiveAmount || parseFloat(limitReceiveAmount) <= 0) throw new Error('Invalid receive amount')

  let TakerGets: any
  if (isXRP(fromToken)) {
    TakerGets = (parseFloat(limitSellAmount) * 1_000_000).toFixed(0)
  } else {
    TakerGets = {
      currency: fromToken.currency,
      issuer: fromToken.issuer,
      value: limitSellAmount,
    }
  }

  let TakerPays: any
  if (isXRP(toToken)) {
    TakerPays = (parseFloat(limitReceiveAmount) * 1_000_000).toFixed(0)
  } else {
    TakerPays = {
      currency: toToken.currency,
      issuer: toToken.issuer,
      value: limitReceiveAmount,
    }
  }

  const tx: any = {
    TransactionType: 'OfferCreate',
    Account: address,
    TakerGets,
    TakerPays,
  }

  if (limitExpiration !== 'never') {
    const rippleEpoch = Math.floor(Date.now() / 1000) - 946684800
    const hours = limitExpiration === '1h' ? 1 : limitExpiration === '1d' ? 24 : 168
    tx.Expiration = rippleEpoch + hours * 3600
  }

  return tx
}
