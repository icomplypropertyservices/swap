import { Client } from 'xrpl';

(async () => {
  const c = new Client('wss://xrplcluster.com');
  await c.connect();

  // Simulate the exact logic from fetchQuote in App.tsx for XRP -> SOLO
  const from = { symbol: 'XRP', currency: 'XRP' };
  const to = { symbol: 'SOLO', currency: '534F4C4F00000000000000000000000000000000', issuer: 'rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz' };

  const takerPays = { currency: 'XRP' };
  const takerGets = { currency: to.currency, issuer: to.issuer };

  const book = await c.request({
    command: 'book_offers',
    taker_pays: takerPays,
    taker_gets: takerGets,
    limit: 20,
  });

  const offers = (book.result).offers || [];
  console.log('Offers returned:', offers.length);

  let totalPays = 0, totalGets = 0, used = 0;
  for (const offer of offers) {
    const pays = offer.TakerPays;
    const gets = offer.TakerGets;
    const payVal = typeof pays === 'string' ? parseInt(pays) / 1e6 : parseFloat(pays.value || '0');
    const getVal = typeof gets === 'string' ? parseInt(gets) / 1e6 : parseFloat(gets.value || '0');
    if (payVal > 0 && getVal > 0) {
      totalPays += payVal;
      totalGets += getVal;
      used++;
      if (used >= 3) break;
    }
  }

  const rate = totalGets / totalPays;
  const payAmount = 5;
  const receive = payAmount * rate;
  const adjusted = receive * (1 - 1/100); // 1% slippage like in app

  console.log('Pay:', payAmount, from.symbol);
  console.log('Rate (avg top):', rate.toFixed(6), to.symbol, 'per', from.symbol);
  console.log('Raw receive:', receive.toFixed(4));
  console.log('After 1% slippage:', adjusted.toFixed(4));

  await c.disconnect();
  process.exit(0);
})();
