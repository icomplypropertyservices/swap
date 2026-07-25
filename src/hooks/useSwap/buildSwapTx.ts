import { isXRP } from '../../utils/xrpl'
import type { Token } from '../../types'

export interface BuildSwapTxParams {
  address: string
  fromToken: Token
  toToken: Token
  payAmount: string
  receiveAmount: string
}

/** Build a Payment (self) swap txjson with SendMax + Amount. */
export function buildSwapTx({
  address,
  fromToken,
  toToken,
  payAmount,
  receiveAmount,
}: BuildSwapTxParams): any {
  if (!address) throw new Error('No wallet connected')

  // XRP amounts must be integer drops (string) for Xaman Payment payloads
  const toDrops = (human: string) => String(Math.round(parseFloat(human) * 1_000_000))

  let SendMax: any
  if (isXRP(fromToken)) {
    SendMax = toDrops(payAmount)
  } else {
    SendMax = {
      currency: fromToken.currency,
      issuer: fromToken.issuer,
      value: String(payAmount),
    }
  }

  if (!receiveAmount) throw new Error('No quote available yet')

  let Amount: any
  if (isXRP(toToken)) {
    Amount = toDrops(receiveAmount)
  } else {
    Amount = {
      currency: toToken.currency,
      issuer: toToken.issuer,
      value: String(receiveAmount),
    }
  }

  return {
    TransactionType: 'Payment',
    Account: address,
    Destination: address,
    Amount,
    SendMax,
  }
}
