# Security search function

The transaction form calls this function to look up stocks and ETFs by ticker or ISIN. It proxies requests to [OpenFIGI's mapping API](https://www.openfigi.com/api/documentation) because the provider does not allow direct browser requests.

Log in to the Supabase CLI and link the project used by this app:

```sh
supabase login
supabase link --project-ref fysdpicaetzkxapvixcy
supabase functions deploy security-search
```
