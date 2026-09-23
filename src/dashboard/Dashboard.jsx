import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { BANK_LOGOS, getBankLogo } from '../bankLogos';
import '../css/mainlayout.css';

const CHART_COLORS = ['#8b5cf6', '#ec4899', '#06b6d4', '#f59e0b', '#10b981', '#6366f1'];

const getCurrentMonthStart = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
};

const Dashboard = ({ currency = 'CZK' }) => {
    const [accounts, setAccounts] = useState([]);
    const [paymentProgress, setPaymentProgress] = useState({});
    const [loading, setLoading] = useState(true);
    const [paymentLoading, setPaymentLoading] = useState(true);
    const [paymentError, setPaymentError] = useState('');
    const [showResetConfirmation, setShowResetConfirmation] = useState(false);

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        setLoading(true);
        setPaymentLoading(true);
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

        if (!error) {
            setAccounts(data || []);
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
    };

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

    const resetAllPaymentProgress = async () => {
        const cardAccounts = accounts.filter((account) => Number(account.card_payments) > 0);
        if (cardAccounts.length === 0) {
            setShowResetConfirmation(false);
            return;
        }

        setPaymentError('');
        const { data, error } = await supabase
            .from('card_payment_progress')
            .upsert(cardAccounts.map((account) => ({
                account_id: account.id,
                month_start: getCurrentMonthStart(),
                payments_made: 0,
            })), { onConflict: 'account_id,month_start' })
            .select('account_id, payments_made');

        if (error) {
            console.error('Chyba pri resete platieb kartou:', error.message);
            setPaymentError('Platby kartou sa nepodarilo resetovať.');
            return;
        }

        setPaymentProgress((current) => ({
            ...current,
            ...(data || []).reduce((progress, item) => ({
                ...progress,
                [item.account_id]: Number(item.payments_made) || 0,
            }), {}),
        }));
        setShowResetConfirmation(false);
    };

    const totalBalance = accounts.reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0);

    const netYieldSum = accounts.reduce((acc, curr) => {
        const bal = Number(curr.balance) || 0;
        const rateDecimal = (Number(curr.rate) || 0) / 100;
        const taxDecimal = (Number(curr.tax) || 0) / 100;
        return acc + bal * rateDecimal * (1.00 - taxDecimal);
    }, 0);

    const weightedRateNet = totalBalance > 0 ? (netYieldSum / totalBalance) * 100 : 0;
    const monthlyYield = netYieldSum / 12;

    const balancesByBank = accounts.reduce((banks, account) => {
        const bank = account.bank || 'Neznáma banka';
        const balance = Number(account.balance) || 0;
        banks[bank] = (banks[bank] || 0) + balance;
        return banks;
    }, {});
    const bankBalances = Object.entries(balancesByBank)
        .sort(([, firstBalance], [, secondBalance]) => secondBalance - firstBalance)
        .map(([bank, balance], index) => ({
            bank,
            balance,
            color: CHART_COLORS[index % CHART_COLORS.length],
            percentage: totalBalance > 0 ? (balance / totalBalance) * 100 : 0,
        }));
    let chartOffset = 0;
    const chartGradient = bankBalances.length > 0
        ? bankBalances.map(({ color, percentage }) => {
            const start = chartOffset;
            chartOffset += percentage;
            return `${color} ${start}% ${chartOffset}%`;
        }).join(', ')
        : '#34234d 0% 100%';
    const cardPaymentAccounts = accounts.filter((account) => Number(account.card_payments) > 0);
    const totalRequiredPayments = cardPaymentAccounts.reduce((sum, account) => sum + Number(account.card_payments), 0);
    const totalMadePayments = cardPaymentAccounts.reduce((sum, account) => (
        sum + Math.min(Number(paymentProgress[account.id] || 0), Number(account.card_payments))
    ), 0);

    const formatIntegerWithDots = (amount) => Math.round(amount || 0)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    const formatCurrencyInteger = (amount, currencySymbol = 'CZK') => {
        return `${formatIntegerWithDots(amount)} ${currencySymbol}`;
    };

    const formatAmountInteger = (amount) => formatIntegerWithDots(amount);

    return (
        <div className="finova-dashboard">
            <div className="stats-grid dashboard-stats-grid">
                {/* Hlavná karta: zostatok, mesačný výnos a čistý úrok */}
                <div className="stat-card finova-hero-card">
                    <div className="hero-balance-section">
                        <div className="stat-label">Celkový zostatok</div>
                        <div className="stat-value">
                            {loading ? '...' : formatCurrencyInteger(totalBalance, currency)}
                        </div>
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
                        <span
                            className="rate-badge"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: '0.9rem',
                                padding: '0.45rem 1rem',
                                borderRadius: '9999px',
                                whiteSpace: 'nowrap',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                color: '#059669',
                                border: '1px solid rgba(16, 185, 129, 0.2)'
                            }}
                        >
                            <span>Čistý úrok p.a.</span>
                            <span style={{ fontWeight: 700 }}>
                                {loading ? '...' : `${weightedRateNet.toFixed(2)} %`}
                            </span>
                        </span>
                    </div>
                </div>
                <section className="stat-card card-payment-card">
                    <div className="card-payment-header">
                        <div>
                            <h2 className="bank-distribution-title">Platby kartou</h2>
                            <p className="card-payment-summary">
                                {paymentLoading
                                    ? 'Načítavam progress...'
                                    : `${formatIntegerWithDots(totalMadePayments)} z ${formatIntegerWithDots(totalRequiredPayments)} platieb vykonaných`}
                            </p>
                        </div>
                        <button
                            type="button"
                            className="card-payment-reset-all"
                            onClick={() => setShowResetConfirmation(true)}
                            disabled={cardPaymentAccounts.length === 0 || paymentLoading}
                        >
                            Reset všetkých
                        </button>
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
                                            {formatIntegerWithDots(made)}/{formatIntegerWithDots(required)}
                                        </strong>
                                        <div className="card-payment-actions">
                                            <button
                                                type="button"
                                                className="payment-step-button"
                                                onClick={() => savePaymentProgress(account.id, required, -1)}
                                                disabled={made === 0 || paymentLoading}
                                                aria-label={`Odpočítať platbu pre ${account.name}`}
                                            >
                                                −
                                            </button>
                                            <button
                                                type="button"
                                                className="payment-step-button"
                                                onClick={() => savePaymentProgress(account.id, required, 1)}
                                                disabled={made >= required || paymentLoading}
                                                aria-label={`Pridať platbu pre ${account.name}`}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
                <section className="stat-card bank-distribution-card">
                    <h2 className="bank-distribution-title">Rozloženie účtov</h2>
                    {loading ? (
                        <div className="bank-distribution-empty">Načítavam dáta...</div>
                    ) : bankBalances.length === 0 ? (
                        <div className="bank-distribution-empty">Zatiaľ nemáš žiadne účty.</div>
                    ) : (
                        <div className="bank-distribution-content">
                            <div className="bank-donut" style={{ '--bank-donut-gradient': `conic-gradient(${chartGradient})` }}>
                                <div className="bank-donut-center">
                                    <strong>{accounts.length} účtov</strong>
                                </div>
                            </div>
                            <div className="bank-distribution-legend">
                                {bankBalances.map(({ bank, balance, color, percentage }) => (
                                    <div className="bank-legend-item" key={bank}>
                                        <span className="bank-legend-color" style={{ backgroundColor: color }} />
                                        <span className="bank-legend-logo">
                                            <img
                                                src={BANK_LOGOS[bank] || getBankLogo(bank)}
                                                alt=""
                                                onError={(event) => {
                                                    event.currentTarget.style.display = 'none';
                                                }}
                                            />
                                        </span>
                                        <span className="bank-legend-value">
                                            {formatAmountInteger(balance)}
                                            <small>{percentage.toFixed(1)} %</small>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            </div>
            {showResetConfirmation && (
                <div className="dashboard-modal-overlay" role="presentation">
                    <div className="dashboard-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="reset-payments-title">
                        <h3 id="reset-payments-title">Potvrdenie resetu</h3>
                        <p>Naozaj si želáte resetovať všetky platby kartou?</p>
                        <div className="dashboard-confirm-actions">
                            <button
                                type="button"
                                className="dashboard-confirm-button dashboard-confirm-cancel"
                                onClick={() => setShowResetConfirmation(false)}
                            >
                                Zrušiť
                            </button>
                            <button
                                type="button"
                                className="dashboard-confirm-button"
                                onClick={resetAllPaymentProgress}
                                disabled={paymentLoading}
                            >
                                Potvrdiť
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;