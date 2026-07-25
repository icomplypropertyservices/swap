import { isXRP } from '../../utils/xrpl'
import { formatAmount } from '../../utils/format'
import type { Token } from '../../types'

export interface QuoteResult {
  receiveAmount: string
  quoteRate: string
}

/** Book-offers weighted quote for payAmount with slippage applied to receive. */
export async function fetchDexQuote(
  getClient: () => Promise<any>,
  fromToken: Token,
  toToken: Token,
  payAmount: string,
  slippage: number
): Promise<QuoteResult> {
  const client = await getClient()

  const takerPays = isXRP(fromToken)
    ? { currency: 'XRP' }
    : { currency: fromToken.currency, issuer: fromToken.issuer }

  const takerGets = isXRP(toToken)
    ? { currency: 'XRP' }
    : { currency: toToken.currency, issuer: toToken.issuer }

  const book = await client.request({
    command: 'book_offers',
    taker_pays: takerPays,
    taker_gets: takerGets,
    limit: 20,
  } as any)

  const offers = (book.result as any).offers || []
  if (!offers.length) {
    throw new Error('No liquidity found for this pair on the DEX')
  }

  let totalPays = 0
  let totalGets = 0
  let used = 0

  for (const offer of offers) {
    const pays = offer.TakerPays
    const gets = offer.TakerGets
    const payVal = typeof pays === 'string' ? parseInt(pays) / 1e6 : parseFloat(pays.value || '0')
    const getVal = typeof gets === 'string' ? parseInt(gets) / 1e6 : parseFloat(gets.value || '0')

    if (payVal > 0 && getVal > 0) {
      totalPays += payVal
      totalGets += getVal
      used++
      if (used >= 3) break
    }
  }

  if (totalPays === 0) throw new Error('No usable offers')

  const rate = totalGets / totalPays
  const receive = parseFloat(payAmount) * rate
  const adjustedReceive = receive * (1 - slippage / 100)

  return {
    receiveAmount: adjustedReceive.toFixed(6),
    quoteRate: `${formatAmount(rate, 6)} ${toToken.symbol} per ${fromToken.symbol}`,
  }
}
