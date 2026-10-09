# Security search function

The transaction form searches stocks and ETFs by ticker or ISIN through this Supabase Edge Function. The function uses OpenFIGI's mapping API. Ticker searches are filtered by the selected asset type; ISIN searches determine the asset type from OpenFIGI so an ETF can be found even while the form defaults to stocks. When OpenFIGI returns multiple exchange listings for the same composite FIGI, the function keeps one representative listing and prefers the primary FIGI match before limiting results to eight. Selecting an ISIN result updates the transaction form's asset type. Each selectable result includes its listing ticker, exchange code and FIGI; ISIN is retained when the search was made by ISIN, and is optional for ticker searches.

Before deploying the function, update the existing `public.investment_transactions` table using the migration in `supabase/migrations/20261008135000_add_security_listing_identifiers.sql`. It makes `isin` optional and adds `exchange` and `figi` columns.

Log in to the Supabase CLI, link the project used by this app, apply the SQL migration in the Supabase SQL Editor, then deploy the function:

```sh
supabase login
supabase link --project-ref fysdpicaetzkxapvixcy
supabase functions deploy security-search
```

No third-party API key is required for security lookup.
