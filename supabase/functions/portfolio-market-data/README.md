# Portfolio market data function

The function loads daily price history from Twelve Data for active portfolio positions. If Twelve Data does not cover a symbol on the configured plan, it searches Yahoo Finance by ISIN and uses an available listing of the same security as a fallback. For ISIN `IE000VAHT5T0`, it prefers Yahoo Finance symbol `VGLA.DE` when the transaction is in EUR, instead of the GBP-denominated London listing. The Yahoo Finance listing may be on a different exchange; its symbol and provider are shown under the price. Currency conversion uses Twelve Data first and Frankfurter's latest ECB reference rate if Twelve Data cannot provide the rate. Market-data API keys stay in Supabase and are never sent to the browser.

Twelve Data is an optional primary source. If used, create an API key and set it as a Supabase Function secret; Yahoo Finance and Frankfurter fallbacks can still provide data when the key is absent. Do not commit the key or place it in a `VITE_` environment variable:

```sh
supabase secrets set TWELVE_DATA_API_KEY=your_api_key --project-ref fysdpicaetzkxapvixcy
supabase functions deploy portfolio-market-data --project-ref fysdpicaetzkxapvixcy
```

The function supports the OpenFIGI exchange codes configured in `index.ts`. Yahoo Finance fallback requires a valid ISIN on the transaction, and provider coverage, delays, and quotas determine which listings and history are available.
