import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { BANK_LOGOS, getBankLogo } from '../bankLogos';
import '../css/mainlayout.css';

const CHART_COLORS = ['#8b5cf6', '#ec4899', '#06b6d4', '#f59e0b', '#10b981', '#6366f1'];

const Dashboard = ({ currency = 'CZK' }) => {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('accounts')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error) {
            setAccounts(data || []);
        }
        setLoading(false);
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

    const formatCurrencyInteger = (amount, currencySymbol = 'CZK') => {
        const formatted = Math.round(amount || 0).toLocaleString('cs-CZ', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        });
        return `${formatted} ${currencySymbol}`;
    };

    return (
        <div className="finova-dashboard">
            <div className="stats-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                                    <span>Účty</span>
                                    <strong>{accounts.length}</strong>
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
                                            {formatCurrencyInteger(balance, currency)}
                                            <small>{percentage.toFixed(1)} %</small>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default Dashboard;