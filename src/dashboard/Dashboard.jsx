import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import '../css/mainlayout.css';

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
    const annualYield = netYieldSum;
    const monthlyYield = annualYield / 12;

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
                {/* Hlavná hero karta: Zostatok + Čistý úrok */}
                <div className="stat-card finova-hero-card">
                    <div className="hero-balance-section">
                        <div className="stat-label">Celkový zostatok</div>
                        <div className="stat-value">
                            {loading ? '...' : formatCurrencyInteger(totalBalance, currency)}
                        </div>
                    </div>
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

                {/* Nová karta: Mesačný / Ročný pasívny výnos */}
                <div className="stat-card finova-yield-card">
                    <div className="yield-section">
                        <div className="stat-label">Mesačný pasívny výnos (netto)</div>
                        <div className="stat-value" style={{ fontSize: '1.5rem' }}>
                            {loading ? '...' : formatCurrencyInteger(monthlyYield, currency)}
                        </div>
                    </div>
                    <div className="yield-divider"></div>
                    <div className="yield-section">
                        <div className="stat-label">Ročný pasívny výnos (netto)</div>
                        <div className="stat-value" style={{ fontSize: '1.5rem' }}>
                            {loading ? '...' : formatCurrencyInteger(annualYield, currency)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;