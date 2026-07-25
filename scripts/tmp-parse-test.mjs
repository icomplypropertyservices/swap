function currencyToHex(cur) {
  if (!cur || cur === 'XRP') return 'XRP'
  if (cur.length > 3) return cur.toUpperCase()
  const hex = Array.from(cur).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').toUpperCase()
  return hex.padEnd(40, '0')
}

function parseQuickToken(input) {
  const s = input.trim()
  if (!s) return null
  const parts = s.split(/[\s:]+/).filter(Boolean)
  if (!parts.length) return null
  let symbol = parts[0].toUpperCase()
  let issuer = parts.find(p => /^r[0-9A-Za-z]{25,}$/.test(p))
  let currency = parts.find(p => /^[A-F0-9]{40}$/i.test(p) || (p.length <= 3 && /^[A-Z0-9]{3}$/i.test(p)))
  if (!currency) {
    currency = currencyToHex(symbol.length > 3 ? symbol : symbol)
  } else if (currency.length <= 3) {
    currency = currencyToHex(currency)
  }
  return {
    symbol: symbol.length > 12 ? symbol.slice(0, 8) : symbol,
    currency: currency.toUpperCase(),
    issuer: issuer || undefined,
    name: symbol
  }
}

console.log('Test1:', parseQuickToken('FUZZY rJvv1w9R4p5j2H3f1p4q3v5sabc123def456ghi789jklmn'))
console.log('Test2:', parseQuickToken('FUZZY 46555A5A59000000000000000000000000000000 rJvv1w9R4p5j2H3f1p4q3v5sabc123def456ghi789jklmn'))
console.log('Test3:', parseQuickToken('SOLO'))
