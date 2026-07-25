import { isXRP } from '../../utils/xrpl'
import type { Token } from '../../types'

/** Best available DEX rate (get/pay) for the pair, or null if none. */
export async function fetchMarketRate(
  getClient: () => Promise<any>,
  fromToken: Token,
  toToken: Token
): Promise<number | null> {
  try {
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
      limit: 5,
    } as any)

    const offers = (book.result as any).offers || []
    if (!offers.length) return null

    for (const offer of offers) {
      const pays = offer.TakerPays
      const gets = offer.TakerGets
      const payVal = typeof pays === 'string' ? parseInt(pays) / 1e6 : parseFloat(pays.value || '0')
      const getVal = typeof gets === 'string' ? parseInt(gets) / 1e6 : parseFloat(gets.value || '0')
      if (payVal > 0 && getVal > 0) return getVal / payVal
    }
    return null
  } catch {
    return null
  }
}

/** Load open OfferCreate rows for an account. */
export async function fetchAccountOffers(
  getClient: () => Promise<any>,
  addr: string
): Promise<any[]> {
  const client = await getClient()
  const res = await client.request({
    command: 'account_offers',
    account: addr,
    limit: 50,
    ledger_index: 'validated',
  } as any)
  return (res.result as any).offers || []
}
