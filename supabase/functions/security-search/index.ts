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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Táto požiadavka nie je podporovaná.' }, 405);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Požiadavku sa nepodarilo spracovať.' }, 400);
  }

  if (!isRecord(body)) {
    return jsonResponse({ error: 'Zadajte ticker alebo ISIN a typ aktíva.' }, 400);
  }

  if (
    typeof body.query !== 'string'
    || typeof body.assetType !== 'string'
    || !['stock', 'etf'].includes(body.assetType)
  ) {
    return jsonResponse({ error: 'Zadajte ticker alebo ISIN a typ aktíva.' }, 400);
  }

  const query = body.query.trim().toUpperCase();
  const isIsin = /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(query);
  if ((!isIsin && !/^[A-Z0-9._-]{2,20}$/.test(query)) || query.length > 20) {
    return jsonResponse({ error: 'Zadajte platný ticker alebo 12-znakový ISIN.' }, 400);
  }

  const assetType = body.assetType;
  let mappingResponse: Response;
  try {
    mappingResponse = await fetch('https://api.openfigi.com/v3/mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        idType: isIsin ? 'ID_ISIN' : 'TICKER',
        idValue: query,
      }]),
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    console.error('OpenFIGI security lookup failed:', error);
    return jsonResponse({ error: 'Poskytovateľa vyhľadávania sa nepodarilo kontaktovať.' }, 502);
  }

  if (!mappingResponse.ok) {
    const message = mappingResponse.status === 429
      ? 'Limit vyhľadávania bol dosiahnutý. Skúste to o chvíľu znova.'
      : `Poskytovateľ vyhľadávania vrátil chybu (${mappingResponse.status}).`;
    return jsonResponse({ error: message }, mappingResponse.status === 429 ? 429 : 502);
  }

  let responseBody: unknown;
  try {
    responseBody = await mappingResponse.json();
  } catch (error) {
    console.error('OpenFIGI returned invalid JSON:', error);
    return jsonResponse({ error: 'Poskytovateľ vyhľadávania vrátil neplatnú odpoveď.' }, 502);
  }
  const mappings = Array.isArray(responseBody) ? responseBody : [responseBody];
  const uniqueSecurities = new Map();
  for (const mapping of mappings) {
    if (!isRecord(mapping) || !Array.isArray(mapping.data)) continue;
    for (const candidate of mapping.data) {
      if (!isRecord(candidate)) continue;
      const securityType = typeof candidate.securityType === 'string' ? candidate.securityType : '';
      const securityType2 = typeof candidate.securityType2 === 'string' ? candidate.securityType2 : '';
      const marketSector = typeof candidate.marketSector === 'string' ? candidate.marketSector : '';
      const type = `${securityType} ${securityType2} ${marketSector}`;
      const matchesAssetType = assetType === 'etf'
        ? /(etf|etp|exchange.?traded)/i.test(type)
        : /(common stock|preferred stock|depositary receipt)/i.test(type);
      const ticker = typeof candidate.ticker === 'string' ? candidate.ticker : '';
      const name = typeof candidate.name === 'string' ? candidate.name : '';
      if (!matchesAssetType || !ticker || !name) continue;

      const exchCode = typeof candidate.exchCode === 'string' ? candidate.exchCode : '';
      const compositeFIGI = typeof candidate.compositeFIGI === 'string' ? candidate.compositeFIGI : '';
      const shareClassFIGI = typeof candidate.shareClassFIGI === 'string' ? candidate.shareClassFIGI : '';
      const key = compositeFIGI || shareClassFIGI || `${ticker}:${name}`;
      if (!uniqueSecurities.has(key)) {
        uniqueSecurities.set(key, {
          figi: typeof candidate.figi === 'string' ? candidate.figi : '',
          ticker,
          name,
          exchCodes: exchCode ? [exchCode] : [],
          isin: isIsin ? query : '',
          currency: typeof candidate.currency === 'string' ? candidate.currency : '',
          securityType: securityType2 || securityType,
        });
      } else if (exchCode && !uniqueSecurities.get(key).exchCodes.includes(exchCode)) {
        uniqueSecurities.get(key).exchCodes.push(exchCode);
      }
    }
  }

  return jsonResponse({ results: [...uniqueSecurities.values()].slice(0, 8) });
});
