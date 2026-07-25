export function formatAmount(amount: string | number, decimals = 4): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(n)) return '0'
  if (n < 0.0001) return n.toExponential(2)
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals })
}

export function shortAddr(addr: string): string {
  if (!addr) return ''
  return addr.slice(0, 6) + '...' + addr.slice(-6)
}
