# Portfolio market data function

The function loads delayed daily price history from Twelve Data for active portfolio positions. It resolves each security to a Twelve Data symbol using its ticker and MIC, then returns daily prices, the previous close, and current FX rates in the selected portfolio currency. Market-data API keys stay in Supabase and are never sent to the browser.

In the Twelve Data account, create an API key and set it as a Supabase Function secret. Do not commit the key or place it in a `VITE_` environment variable:

```sh
supabase secrets set TWELVE_DATA_API_KEY=your_api_key --project-ref fysdpicaetzkxapvixcy
supabase functions deploy portfolio-market-data --project-ref fysdpicaetzkxapvixcy
```

The function supports the OpenFIGI exchange codes configured in `index.ts`. Listings on other exchange codes are reported as unavailable rather than silently using a different market. Twelve Data plan entitlements and request quotas determine which listings and history are available.
