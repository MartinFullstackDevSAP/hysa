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

const getSymbolNameScore = (providerName: string, securityName: string) => {
  const providerWords = new Set(providerName.toUpperCase().match(/[A-Z0-9]+/g) || []);
  const securityWords = new Set(securityName.toUpperCase().match(/[A-Z0-9]+/g) || []);
  let matches = 0;
  for (const word of securityWords) {
    if (word.length > 2 && providerWords.has(word)) matches += 1;
  }
  return matches;
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
  if (!apiKey) {
    return jsonResponse({
      error: 'Ceny portfólia nie sú nakonfigurované. V Supabase nastavte secret TWELVE_DATA_API_KEY.',
    }, 503);
  }

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
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cenu sa nepodarilo načítať.';
      console.error(`Twelve Data portfolio quote failed for ${String(position.ticker)}:`, message);
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
      const message = error instanceof Error ? error.message : 'Kurz sa nepodarilo načítať.';
      console.error(`Twelve Data FX lookup failed for ${sourceCurrency}/${body.currency}:`, message);
      errors.push({ id: `fx:${sourceCurrency}`, error: message });
    }
  });

  return jsonResponse({ quotes, fxRates, errors });
});
