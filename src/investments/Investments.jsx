import { useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { supabase } from '../supabaseClient';
import '../css/investments.css';

const CHART_RANGES = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'Celé obdobie' },
];
const EMPTY_OBJECT = {};

const formatMoney = (value, currency) => {
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('sk-SK', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
};

const formatQuantity = (value) => new Intl.NumberFormat('sk-SK', {
  maximumFractionDigits: 6,
}).format(value);

const formatPercent = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)} %`;

const transactionKey = (transaction) => [
  transaction.figi || transaction.ticker,
  transaction.exchange,
  transaction.currency || 'CZK',
].join(':');

const calculateHoldings = (transactions) => {
  const positions = new Map();
  const orderedTransactions = [...transactions].sort((first, second) =>
    `${first.trade_date}:${first.created_at || ''}`.localeCompare(
      `${second.trade_date}:${second.created_at || ''}`,
    ));

  for (const transaction of orderedTransactions) {
    const quantity = Number(transaction.quantity);
    const unitPrice = Number(transaction.unit_price);
    const commission = Number(transaction.commission) || 0;
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) continue;

    const key = transactionKey(transaction);
    const position = positions.get(key) || {
      id: key,
      figi: transaction.figi,
      ticker: transaction.ticker,
      exchange: transaction.exchange,
      name: transaction.security_name || transaction.ticker,
      assetType: transaction.asset_type,
      currency: transaction.currency || 'CZK',
      quantity: 0,
      costBasis: 0,
      realizedProfit: 0,
    };

    if (transaction.transaction_type === 'buy') {
      position.quantity += quantity;
      position.costBasis += quantity * unitPrice + commission;
    } else if (transaction.transaction_type === 'sell') {
      if (position.quantity <= 0 || quantity > position.quantity) continue;
      const averageCost = position.costBasis / position.quantity;
      position.realizedProfit += quantity * unitPrice - commission - averageCost * quantity;
      position.quantity -= quantity;
      position.costBasis = Math.max(0, position.costBasis - averageCost * quantity);
    }

    positions.set(key, position);
  }

  return [...positions.values()].filter((position) => position.quantity > 0);
};

const getHistoryQuantity = (transactions, positionId, date) => {
  const quantity = transactions
    .filter((transaction) => transactionKey(transaction) === positionId && transaction.trade_date <= date)
    .reduce((total, transaction) => {
      const transactionQuantity = Number(transaction.quantity) || 0;
      return total + (transaction.transaction_type === 'buy' ? transactionQuantity : -transactionQuantity);
    }, 0);
  return Math.max(0, quantity);
};

const PortfolioChart = ({ points, currency }) => {
  if (points.length < 2) {
    return <div className="portfolio-chart-empty">Pre zvolené obdobie zatiaľ nie sú dostupné cenové údaje.</div>;
  }

  const width = 800;
  const height = 260;
  const padding = { top: 18, right: 12, bottom: 30, left: 12 };
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || Math.max(Math.abs(max) * 0.05, 1);
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const coordinates = points.map((point, index) => ({
    ...point,
    x: padding.left + (index / (points.length - 1)) * chartWidth,
    y: padding.top + ((max - point.value) / spread) * chartHeight,
  }));
  const linePath = coordinates.map((point, index) =>
    `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const areaPath = `${linePath} L ${coordinates.at(-1).x} ${height - padding.bottom} L ${coordinates[0].x} ${height - padding.bottom} Z`;
  const firstDate = new Date(`${points[0].date}T00:00:00`);
  const lastDate = new Date(`${points.at(-1).date}T00:00:00`);

  return (
    <div className="portfolio-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Vývoj hodnoty portfólia">
        <defs>
          <linearGradient id="portfolio-chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-purple)" stopOpacity="0.24" />
            <stop offset="100%" stopColor="var(--accent-purple)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((fraction) => {
          const y = padding.top + fraction * chartHeight;
          return <line key={fraction} x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="portfolio-chart-gridline" />;
        })}
        <path d={areaPath} fill="url(#portfolio-chart-fill)" />
        <path d={linePath} className="portfolio-chart-line" />
        <text x={padding.left} y={height - 5} className="portfolio-chart-date">
          {new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'short' }).format(firstDate)}
        </text>
        <text x={width - padding.right} y={height - 5} textAnchor="end" className="portfolio-chart-date">
          {new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'short' }).format(lastDate)}
        </text>
      </svg>
      <span className="portfolio-chart-currency">Hodnoty prepočítané aktuálnym kurzom · {currency}</span>
    </div>
  );
};

export default function Investments({ currency = 'CZK' }) {
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionError, setTransactionError] = useState('');
  const [range, setRange] = useState('1m');
  const [marketData, setMarketData] = useState({ quotes: {}, fxRates: {}, errors: [] });
  const [marketDataLoading, setMarketDataLoading] = useState(false);
  const [marketDataError, setMarketDataError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    const loadTransactions = async () => {
      setTransactionsLoading(true);
      setTransactionError('');
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) {
          setTransactionError('Pre zobrazenie portfólia sa musíte prihlásiť.');
          return;
        }

        const { data, error } = await supabase
          .from('investment_transactions')
          .select('figi, ticker, exchange, security_name, asset_type, trade_date, transaction_type, quantity, unit_price, currency, commission, created_at')
          .eq('user_id', authData.user.id)
          .order('trade_date', { ascending: true });
        if (error) throw error;
        if (active) setTransactions(data || []);
      } catch (error) {
        console.error('Chyba pri načítaní investičných transakcií:', error);
        if (active) setTransactionError('Transakcie sa nepodarilo načítať.');
      } finally {
        if (active) setTransactionsLoading(false);
      }
    };

    loadTransactions();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const holdings = useMemo(() => calculateHoldings(transactions), [transactions]);

  useEffect(() => {
    let active = true;
    const loadMarketData = async () => {
      if (transactionsLoading || !holdings.length) {
        setMarketData({ quotes: {}, fxRates: {}, errors: [] });
        setMarketDataError('');
        setMarketDataLoading(false);
        return;
      }

      setMarketDataLoading(true);
      setMarketDataError('');
      try {
        const { data, error } = await supabase.functions.invoke('portfolio-market-data', {
          body: {
            currency,
            range,
            positions: holdings.map(({ id, ticker, exchange, name, currency: costCurrency }) => ({
              id,
              ticker,
              exchange,
              name,
              currency: costCurrency,
            })),
          },
        });
        if (error) {
          console.error('Chyba pri načítaní trhových údajov portfólia:', error.message);
          const errorResponse = error.context instanceof Response
            ? await error.context.clone().json().catch(() => null)
            : null;
          throw new Error(errorResponse?.error || 'Ceny sa nepodarilo načítať.');
        }
        if (active) {
          setMarketData(data || { quotes: {}, fxRates: {}, errors: [] });
        }
      } catch (error) {
        console.error('Chyba pri načítaní trhových údajov portfólia:', error);
        if (active) setMarketDataError(error.message || 'Ceny sa nepodarilo načítať.');
      } finally {
        if (active) setMarketDataLoading(false);
      }
    };

    loadMarketData();
    return () => {
      active = false;
    };
  }, [currency, holdings, range, transactionsLoading]);

  const quotes = marketData.quotes || EMPTY_OBJECT;
  const fxRates = marketData.fxRates || EMPTY_OBJECT;
  const portfolioRows = holdings.map((holding) => {
    const quote = quotes[holding.id];
    const marketRate = Number(fxRates[quote?.currency || holding.currency]) || 0;
    const costRate = Number(fxRates[holding.currency]) || 0;
    const price = Number(quote?.price);
    const previousClose = Number(quote?.previousClose);
    const currentValue = Number.isFinite(price) && marketRate ? holding.quantity * price * marketRate : null;
    const costBasis = costRate ? holding.costBasis * costRate : null;
    const profitLoss = currentValue !== null && costBasis !== null ? currentValue - costBasis : null;
    const dayChange = Number.isFinite(price) && Number.isFinite(previousClose) && marketRate
      ? holding.quantity * (price - previousClose) * marketRate
      : null;

    return {
      ...holding,
      quote,
      currentValue,
      costBasis,
      profitLoss,
      profitLossPercent: costBasis > 0 ? (profitLoss / costBasis) * 100 : null,
      dayChange,
      dayChangePercent: Number(quote?.changePercent),
      realizedProfit: costRate ? holding.realizedProfit * costRate : null,
    };
  });

  const pricedRows = portfolioRows.filter((row) => row.currentValue !== null);
  const totalValue = pricedRows.reduce((sum, row) => sum + row.currentValue, 0);
  const totalCostBasis = portfolioRows.reduce((sum, row) => sum + (row.costBasis || 0), 0);
  const totalProfitLoss = totalValue - totalCostBasis;
  const totalDayChange = pricedRows.reduce((sum, row) => sum + (row.dayChange || 0), 0);
  const totalDayChangePercent = totalValue - totalDayChange > 0
    ? (totalDayChange / (totalValue - totalDayChange)) * 100
    : 0;
  const totalRealizedProfit = portfolioRows.reduce((sum, row) => sum + (row.realizedProfit || 0), 0);

  const chartPoints = useMemo(() => {
    const historyByPosition = new Map();
    const allDates = new Set();
    for (const holding of holdings) {
      const quote = quotes[holding.id];
      const rate = Number(fxRates[quote?.currency || holding.currency]) || 0;
      if (!Array.isArray(quote?.history) || !rate) continue;
      const history = [...quote.history]
        .sort((first, second) => first.date.localeCompare(second.date))
        .map((point) => ({ ...point, close: Number(point.close) * rate }));
      historyByPosition.set(holding.id, { history, index: 0, latestClose: null });
      history.forEach((point) => allDates.add(point.date));
    }

    return [...allDates].sort().map((date) => {
      let value = 0;
      for (const holding of holdings) {
        const positionHistory = historyByPosition.get(holding.id);
        if (!positionHistory) continue;
        while (positionHistory.index < positionHistory.history.length
          && positionHistory.history[positionHistory.index].date <= date) {
          positionHistory.latestClose = positionHistory.history[positionHistory.index].close;
          positionHistory.index += 1;
        }
        const quantity = getHistoryQuantity(transactions, holding.id, date);
        value += quantity * (positionHistory.latestClose || 0);
      }
      return { date, value };
    }).filter((point) => point.value > 0);
  }, [fxRates, holdings, quotes, transactions]);

  const isLoading = transactionsLoading || marketDataLoading;
  const hasTransactions = transactions.length > 0;
  const hasMarketPrices = pricedRows.length > 0;

  return (
    <div className="finova-container investments-container">
      <div className="investments-header">
        <div>
          <h1 className="finova-title">Investície</h1>
          <p className="finova-subtitle">Prehľad hodnoty a výkonnosti tvojho portfólia</p>
        </div>
        <button
          type="button"
          className="portfolio-refresh-button"
          onClick={() => setRefreshKey((key) => key + 1)}
          disabled={isLoading}
          aria-label="Obnoviť portfólio"
        >
          <RefreshCw size={17} className={isLoading ? 'portfolio-refresh-spinning' : ''} aria-hidden="true" />
          <span>Obnoviť</span>
        </button>
      </div>

      {transactionError && <div className="settings-error" role="alert">{transactionError}</div>}
      {marketDataError && hasTransactions && (
        <div className="settings-error" role="alert">
          {marketDataError} Nastavte secret <code>TWELVE_DATA_API_KEY</code> v Supabase.
        </div>
      )}
      {!marketDataError && marketData.errors?.length > 0 && (
        <div className="portfolio-partial-warning" role="status">
          Ceny sa nepodarilo načítať pre {marketData.errors.length} pozícií. Celkové hodnoty zahŕňajú len dostupné ceny.
        </div>
      )}

      {transactionsLoading ? (
        <div className="portfolio-loading" role="status">
          <span className="busy-spinner" aria-hidden="true" />
          <span>Načítavam portfólio</span>
        </div>
      ) : !hasTransactions ? (
        <section className="finova-card portfolio-empty">
          <Activity size={30} aria-hidden="true" />
          <h2>Portfólio zatiaľ nemá transakcie</h2>
          <p>Pridaj nákup cenného papiera v Nastaveniach a tvoje pozície sa zobrazia tu.</p>
        </section>
      ) : (
        <>
          <section className="portfolio-summary-grid" aria-label="Súhrn portfólia">
            <article className="stat-card portfolio-summary-card">
              <span className="stat-label">Hodnota portfólia</span>
              <strong className="portfolio-summary-value">
                {marketDataLoading && !pricedRows.length
                  ? 'Načítavam…'
                  : hasMarketPrices ? formatMoney(totalValue, currency) : '—'}
              </strong>
              <span className={`portfolio-summary-change ${totalDayChange >= 0 ? 'is-positive' : 'is-negative'}`}>
                {totalDayChange >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {hasMarketPrices
                  ? `${formatMoney(totalDayChange, currency)} (${formatPercent(totalDayChangePercent)}) dnes`
                  : 'Denná zmena nedostupná'}
              </span>
            </article>
            <article className="stat-card portfolio-summary-card">
              <span className="stat-label">Nerealizovaný zisk / strata</span>
              <strong className={`portfolio-summary-value ${totalProfitLoss >= 0 ? 'is-positive' : 'is-negative'}`}>
                {formatMoney(totalProfitLoss, currency)}
              </strong>
              <span className="portfolio-summary-caption">
                Nákladová cena: {formatMoney(totalCostBasis, currency)}
              </span>
            </article>
            <article className="stat-card portfolio-summary-card">
              <span className="stat-label">Realizovaný zisk / strata</span>
              <strong className={`portfolio-summary-value ${totalRealizedProfit >= 0 ? 'is-positive' : 'is-negative'}`}>
                {formatMoney(totalRealizedProfit, currency)}
              </strong>
              <span className="portfolio-summary-caption">Z uzavretých častí pozícií</span>
            </article>
          </section>

          <section className="finova-card portfolio-card">
            <div className="portfolio-section-header">
              <div>
                <h2 className="portfolio-section-title">Vývoj portfólia</h2>
                <p className="portfolio-section-subtitle">Denná hodnota pozícií prepočítaná do {currency}</p>
              </div>
              <div className="portfolio-range-selector" aria-label="Obdobie grafu">
                {CHART_RANGES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={range === option.value ? 'active' : ''}
                    aria-pressed={range === option.value}
                    onClick={() => setRange(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <PortfolioChart points={chartPoints} currency={currency} />
          </section>

          <section className="finova-card portfolio-card">
            <div className="portfolio-section-header">
              <div>
                <h2 className="portfolio-section-title">Moje pozície</h2>
                <p className="portfolio-section-subtitle">{holdings.length} otvorených pozícií · ceny z Twelve Data</p>
              </div>
            </div>
            <div className="portfolio-table-scroll">
              <table className="portfolio-table">
                <thead>
                  <tr>
                    <th scope="col">Cenný papier</th>
                    <th scope="col">Počet</th>
                    <th scope="col">Cena</th>
                    <th scope="col">Denná zmena</th>
                    <th scope="col">Hodnota</th>
                    <th scope="col">Zisk / strata</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span className="portfolio-security-symbol">{row.ticker}</span>
                        <span className="portfolio-security-name">{row.name}</span>
                        <span className="portfolio-security-market">{row.exchange} · {row.assetType === 'etf' ? 'ETF' : 'Akcia'}</span>
                      </td>
                      <td>{formatQuantity(row.quantity)}</td>
                      <td>{row.quote ? formatMoney(row.quote.price, row.quote.currency) : '—'}</td>
                      <td className={row.dayChangePercent >= 0 ? 'is-positive' : 'is-negative'}>
                        {Number.isFinite(row.dayChangePercent) ? formatPercent(row.dayChangePercent) : '—'}
                      </td>
                      <td>{row.currentValue !== null ? formatMoney(row.currentValue, currency) : '—'}</td>
                      <td className={row.profitLoss !== null && row.profitLoss >= 0 ? 'is-positive' : 'is-negative'}>
                        {row.profitLoss !== null ? (
                          <>
                            {formatMoney(row.profitLoss, currency)}
                            <span className="portfolio-table-secondary">{formatPercent(row.profitLossPercent)}</span>
                          </>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <p className="portfolio-data-note">
            Trhové ceny a kurzy sú oneskorené podľa dostupnosti poskytovateľa. Zisk/strata používa váženú priemernú nákupnú cenu a zahŕňa poplatky; historický graf používa aktuálne FX kurzy.
          </p>
        </>
      )}
    </div>
  );
}
