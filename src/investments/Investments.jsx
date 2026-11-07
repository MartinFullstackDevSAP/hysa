import { useEffect, useMemo, useState } from 'react';
import { Activity, TrendingDown, TrendingUp } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { calculateHoldings, transactionKey } from './portfolio';
import { EXCHANGE_NAMES, getSecurityLogo } from '../securityMetadata';
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

const formatWholeMoney = (value, currency) => {
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('sk-SK', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value)} ${currency}`;
  }
};

const formatQuantity = (value) => new Intl.NumberFormat('sk-SK', {
  maximumFractionDigits: 6,
}).format(value);

const getExchangeName = (row) => {
  const providerExchange = row.quote?.exchange;
  if (!providerExchange) return EXCHANGE_NAMES[row.exchange] || row.exchange;
  const exchangeName = providerExchange.toLowerCase();
  if (exchangeName.includes('nasdaq')) return 'Nasdaq';
  if (exchangeName.includes('new york stock exchange') || exchangeName === 'nyse') return 'NYSE';
  if (exchangeName.includes('arca')) return 'NYSE Arca';
  if (exchangeName.includes('american')) return 'NYSE American';
  return providerExchange;
};

const SecurityLogo = ({ isin, ticker, name }) => {
  const [failed, setFailed] = useState(false);
  const logo = getSecurityLogo(isin);

  return (
    <span className="portfolio-security-logo">
      {logo && !failed ? (
        <img src={logo} alt="" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden="true">{ticker?.slice(0, 1) || name?.slice(0, 1) || '?'}</span>
      )}
    </span>
  );
};

const formatPercent = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)} %`;

const formatAxisMoney = (value, currency) => {
  try {
    return new Intl.NumberFormat('sk-SK', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value)} ${currency}`;
  }
};

const formatChartDate = (date) => new Intl.DateTimeFormat('sk-SK', {
  day: 'numeric',
  month: 'short',
}).format(date);

const formatTooltipDate = (date) => new Intl.DateTimeFormat('sk-SK', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(date);

const pickEvenlySpaced = (items, count) => {
  if (items.length <= count) return items.map((item, index) => ({ item, index }));
  const lastIndex = items.length - 1;
  return Array.from({ length: count }, (_, step) => {
    const index = Math.round((step / (count - 1)) * lastIndex);
    return { item: items[index], index };
  });
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

const PortfolioChart = ({ points, currency, netContributions, loading }) => {
  const [activeIndex, setActiveIndex] = useState(null);

  if (points.length < 2) {
    return <div className="portfolio-chart-empty">Pre zvolené obdobie zatiaľ nie sú dostupné cenové údaje.</div>;
  }

  const width = 800;
  const height = 280;
  const padding = { top: 22, right: 18, bottom: 36, left: 72 };
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || Math.max(Math.abs(max) * 0.05, 1);
  const paddedMin = min - spread * 0.08;
  const paddedMax = max + spread * 0.08;
  const paddedSpread = paddedMax - paddedMin;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const yTicks = 5;
  const dateTickCount = Math.min(6, points.length);
  const coordinates = points.map((point, index) => ({
    ...point,
    x: padding.left + (index / (points.length - 1)) * chartWidth,
    y: padding.top + ((paddedMax - point.value) / paddedSpread) * chartHeight,
  }));
  const linePath = coordinates.map((point, index) =>
    `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const areaPath = `${linePath} L ${coordinates.at(-1).x} ${height - padding.bottom} L ${coordinates[0].x} ${height - padding.bottom} Z`;
  const lastPoint = coordinates.at(-1);
  const activePoint = activeIndex === null ? null : coordinates[activeIndex];
  const firstValue = points[0].value;
  const changeValue = lastPoint.value - firstValue - netContributions.total;
  const investedValue = firstValue + netContributions.buys;
  const changePercent = investedValue > 0 ? (changeValue / investedValue) * 100 : 0;

  const handlePointerMove = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * width;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    coordinates.forEach((point, index) => {
      const distance = Math.abs(point.x - pointerX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    setActiveIndex(nearestIndex);
  };

  return (
    <div className="portfolio-chart">
      <div className="portfolio-chart-stats">
        <span>
          Min. {formatWholeMoney(min, currency)}
        </span>
        <span>
          Max. {formatWholeMoney(max, currency)}
        </span>
        <span className={changeValue >= 0 ? 'is-positive' : 'is-negative'}>
          Výnos {formatWholeMoney(changeValue, currency)} ({formatPercent(changePercent)})
        </span>
      </div>
      <div className="portfolio-chart-plot" aria-busy={loading}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Vývoj hodnoty portfólia"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setActiveIndex(null)}
      >
        <defs>
          <linearGradient id="portfolio-chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-purple)" stopOpacity="0.24" />
            <stop offset="100%" stopColor="var(--accent-purple)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {Array.from({ length: yTicks }, (_, index) => {
          const fraction = index / (yTicks - 1);
          const value = paddedMax - fraction * paddedSpread;
          const y = padding.top + fraction * chartHeight;
          return (
            <g key={`y-${index}`}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="portfolio-chart-gridline" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" className="portfolio-chart-axis">
                {formatAxisMoney(value, currency)}
              </text>
            </g>
          );
        })}
        <path d={areaPath} fill="url(#portfolio-chart-fill)" />
        <path d={linePath} className="portfolio-chart-line" />
        {pickEvenlySpaced(coordinates, dateTickCount).map(({ item: point }) => (
          <text key={point.date} x={point.x} y={height - 8} textAnchor="middle" className="portfolio-chart-date">
            {formatChartDate(new Date(`${point.date}T00:00:00`))}
          </text>
        ))}
        {activePoint && (
          <>
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={padding.top}
              y2={height - padding.bottom}
              className="portfolio-chart-crosshair"
            />
            <circle cx={activePoint.x} cy={activePoint.y} r="5" className="portfolio-chart-dot" />
          </>
        )}
      </svg>
      {activePoint && (
        <div
          className="portfolio-chart-tooltip"
          style={{
            left: `${(activePoint.x / width) * 100}%`,
            top: `${(activePoint.y / height) * 100}%`,
          }}
        >
          <strong>{formatWholeMoney(activePoint.value, currency)}</strong>
          <span>{formatTooltipDate(new Date(`${activePoint.date}T00:00:00`))}</span>
        </div>
      )}
      </div>
    </div>
  );
};

export default function Investments({
  currency = 'CZK',
  refreshKey = 0,
  refreshIntervalMinutes = 2,
  onLoadingChange,
}) {
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionError, setTransactionError] = useState('');
  const [range, setRange] = useState('1m');
  const [marketData, setMarketData] = useState({ quotes: {}, fxRates: {}, errors: [] });
  const [marketDataLoading, setMarketDataLoading] = useState(false);
  const [marketDataError, setMarketDataError] = useState('');
  const [autoRefreshKey, setAutoRefreshKey] = useState(0);

  useEffect(() => {
    let lastRefreshAt = Date.now();
    const refreshIntervalMs = refreshIntervalMinutes * 60 * 1000;
    const refreshIfDue = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastRefreshAt < refreshIntervalMs) return;
      lastRefreshAt = Date.now();
      setAutoRefreshKey((key) => key + 1);
    };
    const intervalId = window.setInterval(refreshIfDue, refreshIntervalMs);
    document.addEventListener('visibilitychange', refreshIfDue);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshIfDue);
    };
  }, [refreshIntervalMinutes]);

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
          .select('figi, isin, ticker, exchange, security_name, asset_type, trade_date, transaction_type, quantity, unit_price, currency, commission, created_at')
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
  }, [autoRefreshKey, refreshKey]);

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
            positions: holdings.map(({ id, isin, ticker, exchange, name, currency: costCurrency }) => ({
              id,
              isin,
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
    const nativeValue = Number.isFinite(price) && price > 0
      ? holding.quantity * price
      : null;
    const currentValue = nativeValue !== null && marketRate ? nativeValue * marketRate : null;
    const costBasis = costRate ? holding.costBasis * costRate : null;
    const profitLoss = currentValue !== null && costBasis !== null ? currentValue - costBasis : null;
    const dayChange = Number.isFinite(price) && Number.isFinite(previousClose) && marketRate
      ? holding.quantity * (price - previousClose) * marketRate
      : null;

    return {
      ...holding,
      quote,
      nativeValue,
      currentValue,
      costBasis,
      averagePurchasePrice: holding.quantity > 0 ? holding.costBasis / holding.quantity : null,
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

  const chartNetContributions = useMemo(() => {
    if (chartPoints.length < 2) return { total: 0, buys: 0 };

    const firstDate = chartPoints[0].date;
    const lastDate = chartPoints.at(-1).date;
    return transactions.reduce((contributions, transaction) => {
      if (transaction.trade_date <= firstDate || transaction.trade_date > lastDate) return contributions;

      const quantity = Number(transaction.quantity);
      const unitPrice = Number(transaction.unit_price);
      const commission = Number(transaction.commission) || 0;
      const rate = Number(fxRates[transaction.currency || 'CZK']);
      if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice) || !rate) return contributions;

      if (transaction.transaction_type === 'buy') {
        const contribution = (quantity * unitPrice + commission) * rate;
        contributions.total += contribution;
        contributions.buys += contribution;
      } else if (transaction.transaction_type === 'sell') {
        contributions.total -= (quantity * unitPrice - commission) * rate;
      }

      return contributions;
    }, { total: 0, buys: 0 });
  }, [chartPoints, fxRates, transactions]);

  const isLoading = transactionsLoading || marketDataLoading;
  const hasTransactions = transactions.length > 0;
  const hasMarketPrices = pricedRows.length > 0;
  const positionErrors = (marketData.errors || []).filter((error) => !error.id.startsWith('fx:'));
  const fxErrors = (marketData.errors || []).filter((error) => error.id.startsWith('fx:'));

  useEffect(() => {
    onLoadingChange?.(isLoading);
    return () => onLoadingChange?.(false);
  }, [isLoading, onLoadingChange]);

  return (
    <div className="finova-container investments-container">
      {transactionError && <div className="settings-error" role="alert">{transactionError}</div>}
      {marketDataError && hasTransactions && (
        <div className="settings-error" role="alert">
          {marketDataError} Nastavte secret <code>TWELVE_DATA_API_KEY</code> v Supabase.
        </div>
      )}
      {!marketDataError && marketData.errors?.length > 0 && (
        <div className="portfolio-partial-warning" role="status">
          {positionErrors.length > 0 && (
            <>
              <p>
                Ceny sa nepodarilo načítať pre {positionErrors.length} pozícií. Celkové hodnoty zahŕňajú len dostupné ceny.
              </p>
              <ul>
                {positionErrors.map((error) => {
                  const holding = holdings.find((position) => position.id === error.id);
                  return (
                    <li key={error.id}>
                      <strong>{holding ? `${holding.ticker} (${holding.exchange})` : error.id}:</strong> {error.error}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {fxErrors.length > 0 && (
            <p>
              Menové kurzy sa nepodarilo načítať: {fxErrors.map((error) => error.id.slice(3)).join(', ')}.
              {' '}Hodnoty v inej mene môžu byť neúplné.
            </p>
          )}
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
                  : hasMarketPrices ? formatWholeMoney(totalValue, currency) : '—'}
              </strong>
                            <span className={`portfolio-summary-change ${totalDayChange >= 0 ? 'is-positive' : 'is-negative'}`}>
                {totalDayChange >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {hasMarketPrices
                  ? `${formatWholeMoney(totalDayChange, currency)} (${formatPercent(totalDayChangePercent)})`
                  : ''}
              </span>
            </article>
            <article className="stat-card portfolio-summary-card">
              <span className="stat-label">Nerealizovaný zisk / strata</span>
              <strong className={`portfolio-summary-value ${totalProfitLoss >= 0 ? 'is-positive' : 'is-negative'}`}>
                {formatWholeMoney(totalProfitLoss, currency)}
              </strong>
            </article>
            <article className="stat-card portfolio-summary-card">
              <span className="stat-label">Realizovaný zisk / strata</span>
              <strong className={`portfolio-summary-value ${totalRealizedProfit >= 0 ? 'is-positive' : 'is-negative'}`}>
                {formatWholeMoney(totalRealizedProfit, currency)}
              </strong>
            </article>
          </section>

          <section className="finova-card portfolio-card">
            <div className="portfolio-section-header portfolio-chart-header">
              <h2 className="portfolio-section-title">Vývoj portfólia</h2>
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
            <PortfolioChart
              points={chartPoints}
              currency={currency}
              netContributions={chartNetContributions}
              loading={marketDataLoading}
            />
          </section>

          <section className="finova-card portfolio-card">
            <div className="portfolio-section-header">
              <div>
                <h2 className="portfolio-section-title">Moje pozície</h2>
              </div>
            </div>
            <div className="portfolio-table-scroll">
              <table className="portfolio-table">
                <thead>
                  <tr>
                    <th scope="col">Cenný papier</th>
                    <th scope="col">Počet</th>
                    <th scope="col">Cena</th>
                    <th scope="col">Nákupná cena</th>
                    <th scope="col">Denná zmena</th>
                    <th scope="col">Hodnota</th>
                    <th scope="col">Zisk / strata</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="portfolio-security">
                          <SecurityLogo isin={row.isin} ticker={row.ticker} name={row.name} />
                          <div>
                            <span className="portfolio-security-symbol">{row.ticker}</span>
                            <span className="portfolio-security-name">{row.name}</span>
                            <span className="portfolio-security-market">
                              {getExchangeName(row)} · {row.assetType === 'etf' ? 'ETF' : 'Akcia'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td data-label="Počet">
                        {formatQuantity(row.quantity)}
                      </td>
                      <td data-label="Cena">
                        {row.quote ? (
                          formatMoney(row.quote.price, row.quote.currency)
                        ) : '—'}
                      </td>
                      <td data-label="Nákupná cena">
                        {row.averagePurchasePrice !== null
                          ? formatMoney(row.averagePurchasePrice, row.currency)
                          : '—'}
                      </td>
                      <td data-label="Denná zmena" className={row.dayChangePercent >= 0 ? 'is-positive' : 'is-negative'}>
                        {Number.isFinite(row.dayChangePercent) ? formatPercent(row.dayChangePercent) : '—'}
                      </td>
                      <td data-label="Hodnota">
                        {row.currentValue !== null ? (
                          <>
                            {formatWholeMoney(row.currentValue, currency)}
                            {row.nativeValue !== null && row.quote?.currency !== currency && (
                              <span className="portfolio-table-secondary">
                                {formatWholeMoney(row.nativeValue, row.quote?.currency || row.currency)}
                              </span>
                            )}
                          </>
                        ) : '—'}
                      </td>
                      <td data-label="Zisk / strata" className={row.profitLoss !== null && row.profitLoss >= 0 ? 'is-positive' : 'is-negative'}>
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
        </>
      )}
    </div>
  );
}
