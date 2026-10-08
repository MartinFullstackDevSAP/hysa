# Security search function

The transaction form calls this function to look up stocks and ETFs by ticker or ISIN. It proxies requests to [OpenFIGI's mapping API](https://www.openfigi.com/api/documentation) because the provider does not allow direct browser requests.

Deploy it to the Supabase project linked to this app with:

```sh
supabase functions deploy security-search
```
