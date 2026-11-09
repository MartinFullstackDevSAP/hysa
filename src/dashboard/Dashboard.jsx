import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, CreditCard, Minus, Plus } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { BANK_LOGOS, getBankLogo } from '../bankLogos';
import { calculateHoldings } from '../investments/portfolio';
import AccountList from './AccountList';
import '../css/mainlayout.css';

const getCurrentMonthStart = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
};

const getCurrentMonthLabel = () => new Intl.DateTimeFormat('sk-SK', {
    month: 'long',
    year: 'numeric',
}).format(new Date());

const formatExpirationDate = (expiration) => {
    if (!expiration) return 'Expirácia neuvedená';
    const [year, month, day] = expiration.split('-');
    if (!year || !month || !day) return expiration;
    return `${day}.${month}.${year}`;
};

const calculateFixedTermNetInterest = (account) => {
    const expirationMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(account.expiration || '');
    if (!expirationMatch) return null;

    const [, yearText, monthText, dayText] = expirationMatch;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const expirationDate = new Date(Date.UTC(year, month - 1, day));
    if (
        expirationDate.getUTCFullYear() !== year
        || expirationDate.getUTCMonth() !== month - 1
        || expirationDate.getUTCDate() !== day
    ) {
        return null;
    }

    const today = new Date();
    const todayDate = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const daysUntilMaturity = Math.max(0, (expirationDate.getTime() - todayDate) / 86400000);
    const balance = Number(account.balance) || 0;
    const rate = Number(account.rate) || 0;
    const tax = Number(account.tax) || 0;
    const netInterest = balance * (rate / 100) * (daysUntilMaturity / 365) * (1 - tax / 100);

    return netInterest;
};

const Dashboard = ({ currency = 'CZK', navigationKey = 0, onLoadingChange }) => {
    const [accounts, setAccounts] = useState([]);
    const [paymentProgress, setPaymentProgress] = useState({});
    const [loading, setLoading] = useState(true);
    const [paymentLoading, setPaymentLoading] = useState(true);
    const [paymentError, setPaymentError] = useState('');
    const [accountError, setAccountError] = useState('');
    const [portfolioValue, setPortfolioValue] = useState(null);
    const [portfolioLoading, setPortfolioLoading] = useState(true);
    const [portfolioError, setPortfolioError] = useState('');
    const [portfolioIncomplete, setPortfolioIncomplete] = useState(false);

    const fetchAccounts = useCallback(async () => {
        setLoading(true);
        setPaymentLoading(true);
        onLoadingChange?.(true, navigationKey);
        const [{ data, error }, { data: progressData, error: progressError }] = await Promise.all([
            supabase
                .from('accounts')
                .select('*')
                .order('created_at', { ascending: false }),
            supabase
                .from('card_payment_progress')
                .select('account_id, payments_made')
                .eq('month_start', getCurrentMonthStart()),
        ]);

        if (error) {
            console.error('Chyba pri načítaní účtov:', error.message);
            setAccountError('Účty sa nepodarilo načítať.');
        } else {
            setAccounts(data || []);
            setAccountError('');
        }
        if (progressError) {
            console.error('Chyba pri načítaní platieb kartou:', progressError.message);
            setPaymentError('Platby kartou sa nepodarilo načítať.');
        } else {
            setPaymentProgress((progressData || []).reduce((progress, item) => ({
                ...progress,
                [item.account_id]: Number(item.payments_made) || 0,
            }), {}));
        }
        setLoading(false);
        setPaymentLoading(false);
    }, [navigationKey, onLoadingChange]);

    useEffect(() => {
        let active = true;
        Promise.resolve().then(() => {
            if (active) fetchAccounts();
        });

        return () => {
            active = false;
        };
    }, [fetchAccounts]);

    useEffect(() => {
        let active = true;

        const fetchPortfolioValue = async () => {
            try {
                const { data: transactions, error: transactionError } = await supabase
                    .from('investment_transactions')
                    .select('figi, isin, ticker, exchange, security_name, asset_type, trade_date, transaction_type, quantity, unit_price, currency, commission, created_at')
                    .order('trade_date', { ascending: true });
                if (transactionError) throw transactionError;

                const holdings = calculateHoldings(transactions || []);
                if (!holdings.length) {
                    if (active) setPortfolioValue(0);
                    return;
                }

                const { data, error } = await supabase.functions.invoke('portfolio-market-data', {
                    body: {
                        currency,
                        range: '1m',
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
                    const errorResponse = error.context instanceof Response
                        ? await error.context.clone().json().catch(() => null)
                        : null;
                    throw new Error(errorResponse?.error || error.message || 'Ceny portfólia sa nepodarilo načítať.');
                }
                if (!data) throw new Error('Trhové údaje portfólia neobsahujú odpoveď.');

                const quotes = data.quotes || {};
                const fxRates = data.fxRates || {};
                const value = holdings.reduce((total, holding) => {
                    const quote = quotes[holding.id];
                    const price = Number(quote?.price);
                    const rate = Number(fxRates[quote?.currency || holding.currency]);
                    return Number.isFinite(price) && price > 0 && Number.isFinite(rate) && rate > 0
                        ? total + holding.quantity * price * rate
                        : total;
                }, 0);

                if (active) {
                    setPortfolioValue(value);
                    setPortfolioIncomplete(Array.isArray(data.errors) && data.errors.length > 0);
                }
            } catch (error) {
                console.error('Chyba pri načítaní hodnoty portfólia na prehľade:', error);
                if (active) setPortfolioError(error.message || 'Hodnotu portfólia sa nepodarilo načítať.');
            } finally {
                if (active) setPortfolioLoading(false);
            }
        };

        fetchPortfolioValue();
        return () => {
            active = false;
        };
    }, [currency]);

    useEffect(() => {
        if (!loading && !portfolioLoading) {
            onLoadingChange?.(false, navigationKey);
        }
    }, [loading, navigationKey, onLoadingChange, portfolioLoading]);

    const savePaymentProgress = async (accountId, requiredPayments, change) => {
        setPaymentError('');
        const currentPayments = Number(paymentProgress[accountId] || 0);
        const nextPayments = Math.max(0, Math.min(requiredPayments, currentPayments + change));
        const { data, error } = await supabase
            .from('card_payment_progress')
            .upsert({
                account_id: accountId,
                month_start: getCurrentMonthStart(),
                payments_made: nextPayments,
            }, { onConflict: 'account_id,month_start' })
            .select('account_id, payments_made')
            .single();

        if (error) {
            console.error('Chyba pri ukladaní platieb kartou:', error.message);
            setPaymentError('Platby kartou sa nepodarilo uložiť.');
            return;
        }

        setPaymentProgress((current) => ({
            ...current,
            [data.account_id]: Number(data.payments_made) || 0,
        }));
    };

    const accountBalance = accounts.reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0);
    const totalBalance = accountBalance + (portfolioValue || 0);

    const netYieldSum = accounts.reduce((acc, curr) => {
        const bal = Number(curr.balance) || 0;
        const rateDecimal = (Number(curr.rate) || 0) / 100;
        const taxDecimal = (Number(curr.tax) || 0) / 100;
        return acc + bal * rateDecimal * (1.00 - taxDecimal);
    }, 0);

    const weightedRateNet = totalBalance > 0 ? (netYieldSum / totalBalance) * 100 : 0;
    const monthlyYield = netYieldSum / 12;

    const cardPaymentAccounts = accounts.filter((account) => Number(account.card_payments) > 0);
    const fixedTermAccounts = accounts
        .filter((account) => account.name === 'Termínovaný vklad')
        .sort((firstAccount, secondAccount) => (firstAccount.expiration || '9999-12-31')
            .localeCompare(secondAccount.expiration || '9999-12-31'));
    const totalRequiredPayments = cardPaymentAccounts.reduce((sum, account) => sum + Number(account.card_payments), 0);
    const totalMadePayments = cardPaymentAccounts.reduce((sum, account) => (
        sum + Math.min(Number(paymentProgress[account.id] || 0), Number(account.card_payments))
    ), 0);

    const formatIntegerWithSpaces = (amount) => Math.round(amount || 0)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    const formatCurrencyInteger = (amount, currencySymbol = 'CZK') => {
        return `${formatIntegerWithSpaces(amount)} ${currencySymbol}`;
    };

    return (
        <div className="finova-dashboard">
            <div className="stats-grid dashboard-stats-grid">
                {/* Hlavná karta: zostatok, mesačný výnos a čistý úrok */}
                <div className="stat-card finova-hero-card">
                    <div className="hero-balance-section">
                        <div className="stat-label">Celkový zostatok</div>
                        <div className="stat-value">
                            {loading || portfolioLoading ? '...' : formatCurrencyInteger(totalBalance, currency)}
                        </div>
                        {(portfolioError || portfolioIncomplete) && (
                            <div className="dashboard-portfolio-detail" role="status">
                                {portfolioError
                                    ? `Hodnotu portfólia sa nepodarilo načítať: ${portfolioError}`
                                    : 'Niektoré ceny alebo kurzy portfólia nie sú dostupné.'}
                            </div>
                        )}
                    </div>
                    <div className="hero-divider"></div>
                    <div className="hero-yield-section">
                        <div className="stat-label">Mesačný pasívny výnos (netto)</div>
                        <div className="stat-value">
                            {loading ? '...' : formatCurrencyInteger(monthlyYield, currency)}
                        </div>
                    </div>
                    <div className="hero-divider"></div>
                    <div className="hero-rate-section">
                        <span className="dashboard-badge dashboard-badge-success hero-net-interest-badge">
                            <span>Čistý úrok p.a.</span>
                            <span className="hero-net-interest-value">
                                {loading ? '...' : `${weightedRateNet.toFixed(2)} %`}
                            </span>
                        </span>
                    </div>
                </div>
                <section className="stat-card card-payment-card">
                    <div className="card-payment-header">
                        <div className="card-payment-heading">
                            <h2 className="bank-distribution-title card-payment-title">
                                <CreditCard size={20} aria-hidden="true" />
                                <span>Platby kartou</span>
                            </h2>
                            <p className="card-payment-summary">
                                {paymentLoading
                                    ? 'Načítavam progress...'
                                    : `${formatIntegerWithSpaces(totalMadePayments)} z ${formatIntegerWithSpaces(totalRequiredPayments)} platieb vykonaných`}
                            </p>
                        </div>
                        <time className="dashboard-badge dashboard-badge-success" dateTime={getCurrentMonthStart()}>
                            {getCurrentMonthLabel()}
                        </time>
                    </div>
                    {paymentError && <div className="settings-error" role="alert">{paymentError}</div>}
                    {cardPaymentAccounts.length === 0 ? (
                        <div className="bank-distribution-empty">
                            Zatiaľ nemáš nastavené žiadne platby kartou.
                        </div>
                    ) : (
                        <div className="card-payment-list">
                            {cardPaymentAccounts.map((account) => {
                                const required = Number(account.card_payments);
                                const made = Math.min(Number(paymentProgress[account.id] || 0), required);
                                const percentage = required > 0 ? (made / required) * 100 : 0;

                                return (
                                    <div className="card-payment-row" key={account.id}>
                                        <div className="card-payment-account">
                                            <span className="card-payment-bank-logo">
                                                <img
                                                    src={BANK_LOGOS[account.bank] || getBankLogo(account.bank)}
                                                    alt=""
                                                    onError={(event) => {
                                                        event.currentTarget.style.display = 'none';
                                                    }}
                                                />
                                            </span>
                                            <span className="card-payment-account-bank">{account.bank || 'Neznáma banka'}</span>
                                        </div>
                                        <div className="card-payment-progress-track" aria-label={`Progress ${made} z ${required}`}>
                                            <span style={{ width: `${percentage}%` }} />
                                        </div>
                                        <strong className="card-payment-count">
                                            {formatIntegerWithSpaces(made)} / {formatIntegerWithSpaces(required)}
                                        </strong>
                                        <div className="card-payment-actions">
                                            <button
                                                type="button"
                                                className="payment-step-button"
                                                onClick={() => savePaymentProgress(account.id, required, -1)}
                                                disabled={made === 0 || paymentLoading}
                                                aria-label={`Odpočítať platbu pre ${account.name}`}
                                            >
                                                <Minus size={18} strokeWidth={2.5} aria-hidden="true" />
                                            </button>
                                            <button
                                                type="button"
                                                className="payment-step-button"
                                                onClick={() => savePaymentProgress(account.id, required, 1)}
                                                disabled={made >= required || paymentLoading}
                                                aria-label={`Pridať platbu pre ${account.name}`}
                                            >
                                                <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
                <section className="stat-card fixed-term-card">
                    <div className="fixed-term-header">
                        <h2 className="bank-distribution-title card-payment-title">
                            <CalendarClock size={20} aria-hidden="true" />
                            <span>Termínované vklady</span>
                        </h2>
                        <span className="dashboard-badge dashboard-badge-success fixed-term-count">
                            {fixedTermAccounts.length}{' '}
                            {fixedTermAccounts.length === 1
                                ? 'vklad'
                                : fixedTermAccounts.length >= 2 && fixedTermAccounts.length <= 4
                                    ? 'vklady'
                                    : 'vkladov'}
                        </span>
                    </div>
                    {loading ? (
                        <div className="bank-distribution-empty">Načítavam dáta...</div>
                    ) : fixedTermAccounts.length === 0 ? (
                        <div className="bank-distribution-empty">Zatiaľ nemáš žiadne termínované vklady.</div>
                    ) : (
                        <div className="fixed-term-list">
                            {fixedTermAccounts.map((account) => {
                                const netInterest = calculateFixedTermNetInterest(account);
                                const accountCurrency = account.currency || currency;

                                return (
                                    <div className="fixed-term-row" key={account.id}>
                                        <div className="fixed-term-account">
                                            <span className="card-payment-bank-logo">
                                                <img
                                                    src={BANK_LOGOS[account.bank] || getBankLogo(account.bank)}
                                                    alt=""
                                                    onError={(event) => {
                                                        event.currentTarget.style.display = 'none';
                                                    }}
                                                />
                                            </span>
                                            <div className="fixed-term-account-info">
                                                <span className="card-payment-account-bank">
                                                    {account.bank || 'Neznáma banka'}
                                                </span>
                                                <div className="fixed-term-account-meta">
                                                    <span className="dashboard-badge dashboard-badge-success fixed-term-rate">
                                                        {Number(account.rate).toFixed(2)} % p.a.
                                                    </span>
                                                    <span className="dashboard-badge dashboard-badge-danger fixed-term-expiration">
                                                        {account.expiration
                                                            ? `Expirácia: ${formatExpirationDate(account.expiration)}`
                                                            : formatExpirationDate(account.expiration)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="fixed-term-balance-info">
                                            <span className="fixed-term-balance">
                                                {formatCurrencyInteger(account.balance, accountCurrency)}
                                            </span>
                                            {netInterest !== null && (
                                                <span className="fixed-term-maturity-value">
                                                    Úrok: {formatCurrencyInteger(
                                                        netInterest,
                                                        accountCurrency,
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
                <div className="accounts-list-wrapper">
                    {accountError && <div className="settings-error" role="alert">{accountError}</div>}
                    <AccountList accounts={accounts} loading={loading} onAccountsChange={setAccounts} />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;