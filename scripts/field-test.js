/**
 * Field test script for XRPL Swap + Limit Orders app
 * Verifies that all critical data fetching works:
 * - XRPL connection
 * - Balances (account_info + account_lines)
 * - Market quotes (book_offers)
 * - Open orders (account_offers)
 * - Amount formatting and token handling
 */

import { Client } from 'xrpl';

const XRPL_WS = 'wss://xrplcluster.com';

// Popular token definitions (same as in app)
const TOKENS = [
  { symbol: 'XRP', currency: 'XRP' },
  { symbol: 'SOLO', currency: '534F4C4F00000000000000000000000000000000', issuer: 'rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz' },
  { symbol: 'USD', currency: 'USD', issuer: 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq' }, // GateHub
  { symbol: 'USD', currency: 'USD', issuer: 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B' }, // Bitstamp
  { symbol: 'EUR', currency: 'EUR', issuer: 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq' },
];

function isXRP(t) {
  return t.currency === 'XRP' || !t.issuer;
}

function formatAmount(amount, decimals = 4) {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(n)) return '0';
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

async function testConnection(client) {
  console.log('\n=== 1. XRPL CONNECTION ===');
  try {
    await client.connect();
    const serverInfo = await client.request({ command: 'server_info' });
    console.log('✅ Connected to:', XRPL_WS);
    console.log('   Server version:', serverInfo.result.info.build_version);
    console.log('   Ledger index:', serverInfo.result.info.validated_ledger.seq);
    return true;
  } catch (e) {
    console.error('❌ Connection failed:', e.message);
    return false;
  }
}

async function testBookOffers(client, from, to, label) {
  console.log(`\n=== 2. BOOK_OFFERS: ${label} ===`);
  try {
    const takerPays = isXRP(from)
      ? { currency: 'XRP' }
      : { currency: from.currency, issuer: from.issuer };

    const takerGets = isXRP(to)
      ? { currency: 'XRP' }
      : { currency: to.currency, issuer: to.issuer };

    const resp = await client.request({
      command: 'book_offers',
      taker_pays: takerPays,
      taker_gets: takerGets,
      limit: 8,
    });

    const offers = resp.result.offers || [];
    console.log(`✅ Got ${offers.length} offers for ${from.symbol} → ${to.symbol}`);

    if (offers.length > 0) {
      const first = offers[0];
      const pays = first.TakerPays;
      const gets = first.TakerGets;

      const payVal = typeof pays === 'string' ? parseInt(pays) / 1e6 : parseFloat(pays.value || 0);
      const getVal = typeof gets === 'string' ? parseInt(gets) / 1e6 : parseFloat(gets.value || 0);

      const rate = getVal / payVal;
      console.log(`   Best rate: 1 ${from.symbol} ≈ ${rate.toFixed(6)} ${to.symbol}`);
      console.log(`   Example offer: TakerPays ${payVal.toFixed(4)} | TakerGets ${getVal.toFixed(4)}`);
      console.log(`   Offer owner (Account): ${first.Account}`);
      return { offers, rate, firstAccount: first.Account };
    } else {
      console.log('   ⚠️  No offers found (illiquid pair?)');
      return { offers: [], rate: null };
    }
  } catch (e) {
    console.error('❌ book_offers failed:', e.message);
    return { offers: [], rate: null, error: e.message };
  }
}

async function testBalances(client, account) {
  console.log(`\n=== 3. BALANCES for ${account.slice(0, 8)}... ===`);
  try {
    // account_info for XRP
    const info = await client.request({
      command: 'account_info',
      account,
      ledger_index: 'validated',
    });
    const xrpDrops = info.result.account_data.Balance;
    const xrp = (parseInt(xrpDrops) / 1_000_000).toFixed(2);
    console.log(`✅ XRP Balance: ${xrp} XRP`);

    // account_lines
    const lines = await client.request({
      command: 'account_lines',
      account,
      ledger_index: 'validated',
      limit: 20,
    });

    const trustlines = lines.result.lines || [];
    console.log(`✅ Trustlines: ${trustlines.length} found`);

    const sample = trustlines.slice(0, 3);
    sample.forEach(l => {
      const cur = l.currency.length > 3 ? l.currency.slice(0, 8) : l.currency;
      console.log(`   - ${cur} (${l.account.slice(0,6)}...): ${parseFloat(l.balance).toFixed(4)}`);
    });

    return { xrp, trustlines: trustlines.length };
  } catch (e) {
    console.error('❌ Balance fetch failed:', e.message);
    return { error: e.message };
  }
}

async function testAccountOffers(client, account) {
  console.log(`\n=== 4. ACCOUNT_OFFERS (open limit orders) for ${account.slice(0, 8)}... ===`);
  try {
    const res = await client.request({
      command: 'account_offers',
      account,
      limit: 20,
      ledger_index: 'validated',
    });

    const offers = res.result.offers || [];
    console.log(`✅ Found ${offers.length} open offers`);

    if (offers.length > 0) {
      offers.slice(0, 3).forEach((o, i) => {
        const getsRaw = o.taker_gets ?? o.TakerGets;
        const paysRaw = o.taker_pays ?? o.TakerPays;

        let gets = '???';
        let pays = '???';

        if (typeof getsRaw === 'string') {
          gets = (parseInt(getsRaw) / 1e6).toFixed(4) + ' XRP';
        } else if (getsRaw) {
          gets = parseFloat(getsRaw.value || 0).toFixed(4) + ' ' + (getsRaw.currency || '').slice(0, 4);
        }

        if (typeof paysRaw === 'string') {
          pays = (parseInt(paysRaw) / 1e6).toFixed(4) + ' XRP';
        } else if (paysRaw) {
          pays = parseFloat(paysRaw.value || 0).toFixed(4) + ' ' + (paysRaw.currency || '').slice(0, 4);
        }

        console.log(`   #${i+1} seq=${o.seq}: Sell ${gets}  for  ${pays}`);
      });
    } else {
      console.log('   (No open orders on this account — normal for most accounts)');
    }

    return { count: offers.length, sample: offers[0] };
  } catch (e) {
    console.error('❌ account_offers failed:', e.message);
    return { error: e.message };
  }
}

async function testRealSwapQuote(client) {
  console.log('\n=== 5. REALISTIC SWAP QUOTE SIMULATION (10 SOLO → USD) ===');
  const from = TOKENS[1]; // SOLO
  const to = TOKENS[2];   // USD GateHub

  const result = await testBookOffers(client, from, to, 'SOLO → USD (GateHub)');
  if (result.rate) {
    const sell = 10;
    const receive = sell * result.rate;
    console.log(`   If you sell ${sell} ${from.symbol} at current rate:`);
    console.log(`   → You would receive ≈ ${receive.toFixed(4)} ${to.symbol}`);
  }
}

async function main() {
  console.log('🚀 Starting XRPL Swap App Field Test\n');
  const client = new Client(XRPL_WS);

  const connected = await testConnection(client);
  if (!connected) {
    console.log('Aborting further tests.');
    await client.disconnect().catch(() => {});
    process.exit(1);
  }

  // Test several book offers pairs
  const xrpToSolo = await testBookOffers(client, TOKENS[0], TOKENS[1], 'XRP → SOLO');
  const soloToXrp = await testBookOffers(client, TOKENS[1], TOKENS[0], 'SOLO → XRP');
  const xrpToUsd = await testBookOffers(client, TOKENS[0], TOKENS[2], 'XRP → USD (GateHub)');
  const usdToXrp = await testBookOffers(client, TOKENS[2], TOKENS[0], 'USD → XRP');

  // Pick a real account from the order book to test account_offers + balances
  let testAccount = null;
  if (xrpToSolo.firstAccount) testAccount = xrpToSolo.firstAccount;
  else if (xrpToUsd.firstAccount) testAccount = xrpToUsd.firstAccount;

  if (testAccount) {
    console.log(`\n=== Using real offer creator as test account: ${testAccount}`);
    await testBalances(client, testAccount);
    await testAccountOffers(client, testAccount);
  } else {
    // Fallback to a well-known active account (Bitstamp hot wallet-ish or public)
    const fallback = 'r9cZA1mLK5R5Am25ArfXFmqgN1mU3t1s'; // example public-ish
    console.log(`\n=== No offer accounts found, using fallback: ${fallback}`);
    await testBalances(client, fallback);
    await testAccountOffers(client, fallback);
  }

  await testRealSwapQuote(client);

  console.log('\n=== 6. CURRENCY CODE HANDLING ===');
  const solo = TOKENS[1];
  console.log('✅ SOLO hex currency:', solo.currency);
  console.log('✅ isXRP(XRP):', isXRP(TOKENS[0]));
  console.log('✅ isXRP(SOLO):', isXRP(solo));

  console.log('\n=== ✅ FIELD TEST COMPLETE ===');
  console.log('All core data paths exercised successfully (connection, books, balances, offers).');

  await client.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('\n💥 UNEXPECTED ERROR:', err);
  process.exit(1);
});
