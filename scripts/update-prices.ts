/**
 * scripts/update-prices.ts
 * Fetch latest prices and upsert to Supabase.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/update-prices.ts
 *
 * Env (set in .env.local or shell):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY  (or SUPABASE_SERVICE_ROLE_KEY for bypassing RLS)
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Types ───────────────────────────────────────────────────────────────────

interface Holding {
  id: string;
  ticker: string;
  qty: number;
  avg_price: number;
  currency: string;
  group_code: string;
}

interface PriceMap {
  [ticker: string]: { price: number; currency: string };
}

// ─── Price Fetchers ───────────────────────────────────────────────────────────

/** Yahoo Finance v8 chart API — US stocks & ETFs & FX */
async function fetchYahooPrices(tickers: string[]): Promise<PriceMap> {
  const result: PriceMap = {};
  for (const ticker of tickers) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!res.ok) {
        console.warn(`[Yahoo] ${ticker}: HTTP ${res.status}`);
        continue;
      }
      const json = await res.json();
      const meta = json?.chart?.result?.[0]?.meta;
      if (!meta) {
        console.warn(`[Yahoo] ${ticker}: no meta`);
        continue;
      }
      const price: number = meta.regularMarketPrice ?? meta.previousClose;
      const currency: string = meta.currency ?? 'USD';
      result[ticker] = { price, currency };
      console.log(`[Yahoo] ${ticker}: ${price} ${currency}`);
    } catch (e) {
      console.warn(`[Yahoo] ${ticker}: error`, e);
    }
  }
  return result;
}

/** Upbit REST API — Korean crypto prices (KRW markets) */
async function fetchUpbitPrices(tickers: string[]): Promise<PriceMap> {
  if (tickers.length === 0) return {};
  const markets = tickers.map(t => `KRW-${t}`).join(',');
  const result: PriceMap = {};
  try {
    const url = `https://api.upbit.com/v1/ticker?markets=${markets}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      console.warn(`[Upbit] HTTP ${res.status}`);
      return result;
    }
    const json: Array<{ market: string; trade_price: number }> = await res.json();
    for (const item of json) {
      const coin = item.market.replace('KRW-', '');
      result[coin] = { price: item.trade_price, currency: 'KRW' };
      console.log(`[Upbit] ${coin}: ${item.trade_price} KRW`);
    }
  } catch (e) {
    console.warn('[Upbit] error', e);
  }
  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== update-prices.ts ===');
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // 1. Load holdings from Supabase
  const { data: holdings, error: hErr } = await supabase
    .from('holdings')
    .select('id, ticker, qty, avg_price, currency, group_code');
  if (hErr) throw new Error(`Holdings fetch failed: ${hErr.message}`);
  if (!holdings || holdings.length === 0) {
    console.log('No holdings found. Exiting.');
    return;
  }

  // Tickers always fetched from Upbit (KRW)
  const UPBIT_ONLY = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'DOGE']);

  // Separate tickers by currency type
  const usdTickers: string[] = [];
  const cryptoTickers: string[] = [];

  for (const h of holdings as Holding[]) {
    if (UPBIT_ONLY.has(h.ticker) || (h.currency === 'KRW' && !h.ticker.startsWith('KRW-'))) {
      // KRW-denominated crypto on Upbit
      cryptoTickers.push(h.ticker);
    } else {
      // USD stocks/ETFs via Yahoo Finance
      usdTickers.push(h.ticker);
    }
  }

  // Always fetch USD/KRW exchange rate
  const fxTickers = ['USDKRW=X'];
  const allYahooTickers = Array.from(new Set([...usdTickers, ...fxTickers]));

  // 2. Fetch prices
  const [yahooPrices, upbitPrices] = await Promise.all([
    fetchYahooPrices(allYahooTickers),
    fetchUpbitPrices(Array.from(new Set(cryptoTickers))),
  ]);

  const usdkrw = yahooPrices['USDKRW=X']?.price ?? 1380; // fallback
  console.log(`[FX] USD/KRW = ${usdkrw}`);

  // 3. Build price_snapshots upsert payload
  const snapshotRows: Array<{
    holding_id: string;
    snapshot_date: string;
    current_price: number;
    eval_krw: number;
    usd_krw_rate: number;
  }> = [];

  for (const h of holdings as Holding[]) {
    const isUpbit =
      UPBIT_ONLY.has(h.ticker) || (h.currency === 'KRW' && !h.ticker.startsWith('KRW-'));
    const priceInfo = isUpbit ? upbitPrices[h.ticker] : yahooPrices[h.ticker];
    if (!priceInfo) continue;

    const toKrw = priceInfo.currency === 'USD' ? usdkrw : 1;
    const eval_krw = priceInfo.price * h.qty * toKrw;

    snapshotRows.push({
      holding_id: h.id,
      snapshot_date: today,
      current_price: priceInfo.price,
      eval_krw,
      usd_krw_rate: usdkrw,
    });
  }

  if (snapshotRows.length > 0) {
    const { error: snapErr } = await supabase
      .from('price_snapshots')
      .upsert(snapshotRows, { onConflict: 'holding_id,snapshot_date' });
    if (snapErr) console.error('price_snapshots upsert error:', snapErr.message);
    else console.log(`Upserted ${snapshotRows.length} price snapshots.`);
  }

  // 4. Compute portfolio_daily (single row per day)
  let total_krw = 0;

  for (const h of holdings as Holding[]) {
    const priceInfo =
      UPBIT_ONLY.has(h.ticker) || (h.currency === 'KRW' && !h.ticker.startsWith('KRW-'))
        ? upbitPrices[h.ticker]
        : yahooPrices[h.ticker];

    if (!priceInfo) {
      console.warn(`No price for ${h.ticker}, skipping portfolio calc.`);
      continue;
    }

    const toKrw = priceInfo.currency === 'USD' ? usdkrw : 1;
    total_krw += priceInfo.price * h.qty * toKrw;
  }

  const dailyRow = { snapshot_date: today, total_krw, usd_krw_rate: usdkrw, fund_krw: 0, memo: null };

  const { error: dailyErr } = await supabase
    .from('portfolio_daily')
    .upsert(dailyRow, { onConflict: 'snapshot_date' });
  if (dailyErr) console.error('portfolio_daily upsert error:', dailyErr.message);
  else console.log(`Upserted portfolio_daily for ${today}: total_krw=${Math.round(total_krw).toLocaleString()}`);

  console.log('=== Done ===');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
