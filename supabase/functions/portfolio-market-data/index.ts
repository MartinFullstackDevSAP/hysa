const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const MIC_BY_FIGI_EXCHANGE: Record<string, string> = {
  LN: 'XLON',
  GR: 'XETR',
  GF: 'XFRA',
  GD: 'XDUS',
  GS: 'XSTU',
  GM: 'XMUN',
  GH: 'XHAM',
  GT: 'XETR',
  NA: 'XAMS',
  IM: 'XMIL',
  SW: 'XSWX',
  SE: 'XSWX',
};

const OUTPUTSIZE_BY_RANGE: Record<string, number> = {
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
  all: 5000,
};

const YAHOO_RANGE_BY_RANGE: Record<string, string> = {
  '1m': '1mo',
  '3m': '3mo',
  '6m': '6mo',
  '1y': '1y',
  all: 'max',
};

const YAHOO_SYMBOLS_BY_ISIN: Record<string, { symbol: string; currency: string }[]> = {
  'IE000VAHT5T0': [{ symbol: 'VGLA.DE', currency: 'EUR' }],
};

const getTwelveDataJson = async (path: string, apiKey: string) => {
  const url = new URL(`https://api.twelvedata.com/${path}`);
  url.searchParams.set('apikey', apiKey);
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    console.error('Twelve Data returned invalid JSON:', error);
    throw new Error('Poskytovateľ trhových dát vrátil neplatnú odpoveď.');
  }
  if (!response.ok || !isRecord(data) || data.status === 'error') {
    const message = isRecord(data) && typeof data.message === 'string'
      ? data.message
      : `Poskytovateľ trhových dát vrátil chybu (${response.status}).`;
    throw new Error(message);
  }
  return data;
};

const getYahooFinanceJson = async (url: URL) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(15000),
  });
  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    console.error('Yahoo Finance returned invalid JSON:', error);
    throw new Error('Yahoo Finance vrátil neplatnú odpoveď.');
  }
  if (!response.ok || !isRecord(data)) {
    throw new Error(`Yahoo Finance vrátil chybu (${response.status}).`);
  }
  if (isRecord(data.chart) && data.chart.error) {
    const message = isRecord(data.chart.error) && typeof data.chart.error.description === 'string'
      ? data.chart.error.description
      : 'Yahoo Finance nenašiel cenové údaje.';
    throw new Error(message);
  }
  return data;
};

const getYahooFinanceQuote = async (position: Record<string, unknown>, range: string) => {
  const isin = typeof position.isin === 'string' ? position.isin : '';
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)) {
    throw new Error('Pre vyhľadanie záložnej ceny je potrebný platný ISIN.');
  }

  const searchUrl = new URL('https://query1.finance.yahoo.com/v1/finance/search');
  searchUrl.searchParams.set('q', isin);
  searchUrl.searchParams.set('quotesCount', '10');
  searchUrl.searchParams.set('newsCount', '0');
  const search = await getYahooFinanceJson(searchUrl);
  const candidates = isRecord(search)
    && Array.isArray(search.quotes)
    ? search.quotes.filter((candidate) =>
      isRecord(candidate)
      && typeof candidate.symbol === 'string'
      && ['ETF', 'MUTUALFUND'].includes(String(candidate.quoteType))
      && getSymbolNameScore(
        typeof candidate.shortname === 'string' ? candidate.shortname : '',
        String(position.name),
      ) > 0)
    : [];
  const preferredListings = (YAHOO_SYMBOLS_BY_ISIN[isin] || [])
    .filter((listing) => listing.currency === position.currency);
  const symbols = [...new Set([
    ...preferredListings.map((listing) => listing.symbol),
    ...candidates.map((candidate) => String(candidate.symbol)),
  ])];
  const candidateErrors: string[] = [];

  for (const symbol of symbols) {
    const chartUrl = new URL(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
    );
    chartUrl.searchParams.set('range', YAHOO_RANGE_BY_RANGE[range] || '1mo');
    chartUrl.searchParams.set('interval', '1d');

    try {
      const chart = await getYahooFinanceJson(chartUrl);
      const result = isRecord(chart.chart) && Array.isArray(chart.chart.result)
        ? chart.chart.result[0]
        : null;
      if (!isRecord(result) || !isRecord(result.meta)) {
        throw new Error(`Pre symbol ${symbol} nie sú dostupné cenové údaje.`);
      }

      const meta = result.meta;
      const dailyQuoteUrl = new URL(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
      );
      dailyQuoteUrl.searchParams.set('range', '1d');
      dailyQuoteUrl.searchParams.set('interval', '1d');
      const dailyQuote = await getYahooFinanceJson(dailyQuoteUrl);
      const dailyQuoteResult = isRecord(dailyQuote.chart) && Array.isArray(dailyQuote.chart.result)
        ? dailyQuote.chart.result[0]
        : null;
      if (!isRecord(dailyQuoteResult) || !isRecord(dailyQuoteResult.meta)) {
        throw new Error(`Pre symbol ${symbol} Yahoo Finance nevrátilo dennú zmenu.`);
      }
      const dailyMeta = dailyQuoteResult.meta;
      const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
      const indicators = isRecord(result.indicators) && Array.isArray(result.indicators.quote)
        ? result.indicators.quote[0]
        : null;
      const closes = isRecord(indicators) && Array.isArray(indicators.close)
        ? indicators.close
        : [];
      const history = timestamps.flatMap((timestamp, index) => {
        const close = Number(closes[index]);
        if (!Number.isFinite(Number(timestamp)) || !Number.isFinite(close) || close <= 0) return [];
        return [{
          date: new Date(Number(timestamp) * 1000).toISOString().slice(0, 10),
          close,
        }];
      });
      const marketPrice = Number(dailyMeta.regularMarketPrice || meta.regularMarketPrice);
      const price = Number.isFinite(marketPrice) && marketPrice > 0
        ? marketPrice
        : history.at(-1)?.close;
      if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || typeof meta.currency !== 'string') {
        throw new Error(`Pre symbol ${symbol} Yahoo Finance nevrátil platnú cenu.`);
      }
      if (preferredListings.length && meta.currency !== position.currency) {
        throw new Error(`Pre ISIN ${isin} sa vyžaduje listing v mene ${String(position.currency)}.`);
      }

      const previousClose = Number(dailyMeta.chartPreviousClose || dailyMeta.previousClose)
        || history.at(-2)?.close
        || price;
      return {
        symbol,
        currency: meta.currency,
        exchange: typeof meta.fullExchangeName === 'string' ? meta.fullExchangeName : '',
        price,
        previousClose,
        changePercent: previousClose ? ((price - previousClose) / previousClose) * 100 : 0,
        history,
        source: 'Yahoo Finance',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cenu sa nepodarilo načítať.';
      candidateErrors.push(`${symbol}: ${message}`);
    }
  }

  throw new Error(candidateErrors.length
    ? `Yahoo Finance nenašiel použiteľnú cenu pre ISIN ${isin}. ${candidateErrors.join(' ')}`
    : `Yahoo Finance nenašiel listing pre ISIN ${isin}.`);
};

const getSymbolNameScore = (providerName: string, securityName: string) => {
  const providerWords = new Set(providerName.toUpperCase().match(/[A-Z0-9]+/g) || []);
  const securityWords = new Set(securityName.toUpperCase().match(/[A-Z0-9]+/g) || []);
  let matches = 0;
  for (const word of securityWords) {
    if (word.length > 2 && providerWords.has(word)) matches += 1;
  }
  return matches;
};

const getFrankfurterRate = async (sourceCurrency: string, targetCurrency: string) => {
  const url = new URL(`https://api.frankfurter.dev/v1/latest`);
  url.searchParams.set('base', sourceCurrency);
  url.searchParams.set('symbols', targetCurrency);
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const data: unknown = await response.json();
  if (!response.ok || !isRecord(data) || !isRecord(data.rates)) {
    throw new Error(`Frankfurter vrátil chybu (${response.status}).`);
  }
  const rate = Number(data.rates[targetCurrency]);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Frankfurter nevrátil platný kurz ${sourceCurrency}/${targetCurrency}.`);
  }
  return rate;
};

const resolveProviderSymbol = async (position: Record<string, unknown>, apiKey: string) => {
  const micCode = MIC_BY_FIGI_EXCHANGE[String(position.exchange)];
  if (!micCode) {
    throw new Error(`Pre burzu ${String(position.exchange)} nie je nakonfigurovaný MIC kód.`);
  }

  const ticker = String(position.ticker);
  const search = await getTwelveDataJson(
    `symbol_search?symbol=${encodeURIComponent(ticker)}&outputsize=100`,
    apiKey,
  );
  const candidates = Array.isArray(search.data)
    ? search.data.filter((candidate) => isRecord(candidate) && candidate.mic_code === micCode)
    : [];
  if (!candidates.length) {
    throw new Error(`Twelve Data nemá listing ${ticker} na trhu ${micCode}.`);
  }

  const bestMatch = candidates
    .map((candidate) => ({
      candidate,
      score: getSymbolNameScore(
        typeof candidate.instrument_name === 'string' ? candidate.instrument_name : '',
        String(position.name),
      ),
    }))
    .sort((first, second) => second.score - first.score)[0].candidate;
  if (typeof bestMatch.symbol !== 'string') {
    throw new Error(`Twelve Data nevrátilo symbol pre ${ticker}.`);
  }
  return { symbol: bestMatch.symbol, micCode };
};

const runWithConcurrency = async <T>(
  values: T[],
  concurrency: number,
  operation: (value: T) => Promise<void>,
) => {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      await operation(values[index]);
    }
  });
  await Promise.all(workers);
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Táto požiadavka nie je podporovaná.' }, 405);
  }

  const apiKey = Deno.env.get('TWELVE_DATA_API_KEY');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Požiadavku sa nepodarilo spracovať.' }, 400);
  }

  if (!isRecord(body) || typeof body.currency !== 'string'
    || !['CZK', 'EUR', 'USD'].includes(body.currency)
    || typeof body.range !== 'string' || !(body.range in OUTPUTSIZE_BY_RANGE)
    || !Array.isArray(body.positions) || body.positions.length > 50) {
    return jsonResponse({ error: 'Zadajte platnú menu, obdobie a najviac 50 pozícií.' }, 400);
  }

  const positions = body.positions.filter((position) =>
    isRecord(position)
    && typeof position.id === 'string'
    && (position.isin === undefined || position.isin === null
      || (typeof position.isin === 'string' && /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(position.isin)))
    && /^[A-Z0-9._-]{1,20}$/.test(String(position.ticker))
    && typeof position.exchange === 'string'
    && typeof position.name === 'string'
    && (position.currency === undefined || /^[A-Z]{3}$/.test(String(position.currency))));
  if (positions.length !== body.positions.length) {
    return jsonResponse({ error: 'Niektoré pozície nemajú platný ticker, burzu alebo názov.' }, 400);
  }

  const quotes: Record<string, unknown> = {};
  const errors: { id: string; error: string }[] = [];
  await runWithConcurrency(positions, 2, async (position) => {
    try {
      try {
        if (!apiKey) {
          throw new Error('Secret TWELVE_DATA_API_KEY nie je nastavený.');
        }
        const { symbol, micCode } = await resolveProviderSymbol(position, apiKey);
        const series = await getTwelveDataJson(
          `time_series?symbol=${encodeURIComponent(symbol)}&mic_code=${micCode}&interval=1day&outputsize=${OUTPUTSIZE_BY_RANGE[body.range as string]}`,
          apiKey,
        );
        if (!isRecord(series.meta) || !Array.isArray(series.values) || !series.values.length) {
          throw new Error(`Pre ${String(position.ticker)} nie sú dostupné cenové údaje.`);
        }

        const values = series.values.filter((value) =>
          isRecord(value) && typeof value.datetime === 'string' && Number.isFinite(Number(value.close)));
        if (!values.length) {
          throw new Error(`Pre ${String(position.ticker)} nie sú dostupné denné ceny.`);
        }
        const price = Number(values[0].close);
        const previousClose = values[1] ? Number(values[1].close) : price;

        quotes[String(position.id)] = {
          symbol,
          currency: typeof series.meta.currency === 'string' ? series.meta.currency : '',
          price,
          previousClose,
          changePercent: previousClose
            ? ((price - previousClose) / previousClose) * 100
            : 0,
          history: values.map((value) => ({
            date: value.datetime,
            close: Number(value.close),
          })).reverse(),
          source: 'Twelve Data',
        };
      } catch (twelveDataError) {
        const primaryMessage = twelveDataError instanceof Error
          ? twelveDataError.message
          : 'Twelve Data nedokázalo načítať cenu.';
        try {
          const quote = await getYahooFinanceQuote(position, String(body.range));
          quotes[String(position.id)] = {
            ...quote,
            sourceSymbol: quote.symbol,
          };
          console.warn(`Using Yahoo Finance fallback for ${String(position.ticker)}: ${primaryMessage}`);
        } catch (yahooError) {
          const fallbackMessage = yahooError instanceof Error
            ? yahooError.message
            : 'Yahoo Finance nedokázal načítať cenu.';
          throw new Error(`Twelve Data: ${primaryMessage} Yahoo Finance: ${fallbackMessage}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cenu sa nepodarilo načítať.';
      console.error(`Portfolio quote failed for ${String(position.ticker)}:`, message);
      errors.push({ id: String(position.id), error: message });
    }
  });

  const currencies = new Set<string>([body.currency]);
  for (const quote of Object.values(quotes)) {
    if (isRecord(quote) && typeof quote.currency === 'string' && /^[A-Z]{3}$/.test(quote.currency)) {
      currencies.add(quote.currency);
    }
  }
  for (const position of positions) {
    if (typeof position.currency === 'string' && /^[A-Z]{3}$/.test(position.currency)) {
      currencies.add(position.currency);
    }
  }
  const fxRates: Record<string, number> = { [body.currency]: 1 };
  await runWithConcurrency([...currencies].filter((currency) => currency !== body.currency), 2, async (sourceCurrency) => {
    try {
      if (!apiKey) {
        throw new Error('Secret TWELVE_DATA_API_KEY nie je nastavený.');
      }
      const rateData = await getTwelveDataJson(
        `exchange_rate?symbol=${sourceCurrency}/${body.currency}`,
        apiKey,
      );
      const rate = Number(rateData.rate);
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error(`Neplatný kurz pre ${sourceCurrency}/${body.currency}.`);
      }
      fxRates[sourceCurrency] = rate;
    } catch (error) {
      const twelveDataMessage = error instanceof Error ? error.message : 'Kurz sa nepodarilo načítať.';
      try {
        fxRates[sourceCurrency] = await getFrankfurterRate(sourceCurrency, body.currency as string);
        console.warn(`Using Frankfurter FX fallback for ${sourceCurrency}/${body.currency}: ${twelveDataMessage}`);
      } catch (frankfurterError) {
        const fallbackMessage = frankfurterError instanceof Error
          ? frankfurterError.message
          : 'Frankfurter nevrátil kurz.';
        const message = `Twelve Data: ${twelveDataMessage} Frankfurter: ${fallbackMessage}`;
        console.error(`Portfolio FX lookup failed for ${sourceCurrency}/${body.currency}:`, message);
        errors.push({ id: `fx:${sourceCurrency}`, error: message });
      }
    }
  });

  return jsonResponse({ quotes, fxRates, errors });
});
