import { useState } from 'react';
import { Landmark } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { BANK_LOGOS, getBankLogo } from '../bankLogos';
import CustomSelect from '../settings/CustomSelect';

const formatCurrency = (amount, currency) => (
    `${Number(amount || 0).toLocaleString('cs-CZ', {
        maximumFractionDigits: 0,
    })} ${currency || 'CZK'}`
);

const formatExpirationForInput = (isoDate) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || '');
    return match ? `${match[3]}.${match[2]}.${match[1]}` : isoDate || '';
};

const parseExpirationInput = (date) => {
    if (!date) return '';
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(date);
    if (!match) return null;

    const [, day, month, year] = match;
    const parsedDate = new Date(0);
    parsedDate.setUTCHours(0, 0, 0, 0);
    parsedDate.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
    if (
        parsedDate.getUTCFullYear() !== Number(year)
        || parsedDate.getUTCMonth() !== Number(month) - 1
        || parsedDate.getUTCDate() !== Number(day)
    ) {
        return null;
    }

    return `${year}-${month}-${day}`;
};

const AccountList = ({ accounts, loading, onAccountsChange }) => {
    const [editingAccount, setEditingAccount] = useState(null);
    const [editValues, setEditValues] = useState(null);
    const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const openEditModal = (account) => {
        setEditingAccount(account);
        setEditValues({
            rate: String(account.rate ?? ''),
            balance: String(account.balance ?? ''),
            cardPayments: String(account.card_payments ?? account.cardPayments ?? 0),
            expiration: formatExpirationForInput(account.expiration),
        });
        setError('');
    };

    const closeEditModal = () => {
        setEditingAccount(null);
        setEditValues(null);
        setError('');
    };

    const saveEditedAccount = async (event) => {
        event.preventDefault();
        if (!editingAccount || !editValues) return;

        const rate = Number(editValues.rate.replace(',', '.'));
        const balance = Number(editValues.balance.replace(',', '.'));
        if (!Number.isFinite(rate) || !Number.isFinite(balance)) {
            setError('Zadajte platný úrok a zostatok.');
            return;
        }

        const expiration = parseExpirationInput(editValues.expiration);
        if (expiration === null) {
            setError('Zadajte expiráciu vo formáte DD.MM.RRRR.');
            return;
        }

        setSaving(true);
        setError('');
        const { data, error: updateError } = await supabase
            .from('accounts')
            .update({
                rate,
                balance,
                card_payments: Number(editValues.cardPayments),
                expiration: expiration || null,
            })
            .eq('id', editingAccount.id)
            .select()
            .single();

        if (updateError) {
            console.error('Chyba pri úprave účtu:', updateError.message);
            setError('Účet sa nepodarilo upraviť.');
        } else {
            onAccountsChange((current) => current.map((account) => (
                account.id === data.id ? data : account
            )));
            closeEditModal();
        }
        setSaving(false);
    };

    const deleteAccount = async () => {
        if (!confirmDeleteAccount) return;

        setSaving(true);
        setError('');
        const { error: deleteError } = await supabase
            .from('accounts')
            .delete()
            .eq('id', confirmDeleteAccount.id);

        if (deleteError) {
            console.error('Chyba pri mazaní účtu:', deleteError.message);
            setError('Účet sa nepodarilo odstrániť.');
        } else {
            onAccountsChange((current) => current.filter((account) => (
                account.id !== confirmDeleteAccount.id
            )));
            setConfirmDeleteAccount(null);
        }
        setSaving(false);
    };

    const updateEditValue = (field) => (event) => {
        setEditValues((current) => ({ ...current, [field]: event.target.value }));
    };

    return (
        <>
            <section className="stat-card accounts-list-card">
                <div className="card-header-flex">
                    <h2 className="bank-distribution-title card-payment-title accounts-list-title">
                        <Landmark size={20} aria-hidden="true" />
                        <span>Zoznam účtov</span>
                    </h2>
                    <span className="dashboard-badge dashboard-badge-success">
                        {accounts.length}{' '}
                        {accounts.length === 1 ? 'účet' : accounts.length >= 2 && accounts.length <= 4 ? 'účty' : 'účtov'}
                    </span>
                </div>
                {loading ? (
                    <div className="bank-distribution-empty">Načítavam účty z databázy...</div>
                ) : accounts.length === 0 ? (
                    <div className="bank-distribution-empty">Zatiaľ neboli pridané žiadne účty.</div>
                ) : (
                    <div className="finova-list">
                        {accounts.map((account) => {
                            const cardCount = Number(account.card_payments ?? account.cardPayments ?? 0);
                            const tax = Number(account.tax ?? 0);
                            const logo = BANK_LOGOS[account.bank] || getBankLogo(account.bank);

                            return (
                                <div key={account.id} className="finova-list-item">
                                    <div className="list-item-main">
                                        <div className="bank-icon">
                                            {logo ? (
                                                <img
                                                    src={logo}
                                                    alt={account.bank || ''}
                                                    onError={(event) => {
                                                        event.currentTarget.style.display = 'none';
                                                    }}
                                                />
                                            ) : (
                                                account.bank ? account.bank.substring(0, 2).toUpperCase() : '?'
                                            )}
                                        </div>
                                        <div className="bank-info">
                                            <span className="account-name">{account.name}</span>
                                            <span className="bank-name">{account.bank || 'Neznáma banka'}</span>
                                        </div>
                                    </div>
                                    <div className="list-item-details">
                                        <span className="dashboard-badge dashboard-badge-success">
                                            {Number(account.rate).toFixed(2)} % p.a.
                                        </span>
                                        {tax > 0 && (
                                            <span className="dashboard-badge dashboard-badge-success">Daň {tax} %</span>
                                        )}
                                        {cardCount > 0 && (
                                            <span className="dashboard-badge dashboard-badge-success">{cardCount}× kartou</span>
                                        )}
                                        {account.expiration && (
                                            <span className="dashboard-badge dashboard-badge-danger">
                                                Expirácia: {new Date(`${account.expiration}T00:00:00`).toLocaleDateString('sk-SK')}
                                            </span>
                                        )}
                                    </div>
                                    <div className="list-item-right">
                                        <div className="balance-box">
                                            <span className="balance-amount">
                                                {formatCurrency(account.balance, account.currency)}
                                            </span>
                                        </div>
                                        <div className="account-list-actions">
                                            <button
                                                type="button"
                                                className="btn-edit-icon"
                                                onClick={() => {
                                                    setError('');
                                                    setConfirmDeleteAccount(account);
                                                }}
                                                title="Odstrániť účet"
                                                aria-label={`Odstrániť účet ${account.bank || ''}`}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                    <polyline points="3 6 5 6 21 6" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-edit-icon"
                                                onClick={() => openEditModal(account)}
                                                title="Upraviť účet"
                                                aria-label={`Upraviť účet ${account.bank || ''}`}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {editingAccount && editValues && (
                <div className="finova-modal-overlay" role="presentation">
                    <form className="finova-modal account-edit-modal" onSubmit={saveEditedAccount} role="dialog" aria-modal="true" aria-labelledby="account-edit-title">
                        <div className="finova-modal-header">
                            <h2 className="finova-modal-title" id="account-edit-title">
                                Upraviť účet: {editingAccount.bank}
                            </h2>
                        </div>
                        <div className="finova-modal-body">
                            {error && <div className="settings-error" role="alert">{error}</div>}
                            <label className="form-group">
                                <span className="form-label">Úrok (% p.a.)</span>
                                <input className="finova-input finova-input-control" type="number" step="any" value={editValues.rate} onChange={updateEditValue('rate')} required />
                            </label>
                            <label className="form-group">
                                <span className="form-label">Zostatok</span>
                                <input className="finova-input finova-input-control" type="number" step="any" value={editValues.balance} onChange={updateEditValue('balance')} required />
                            </label>
                            <label className="form-group">
                                <span className="form-label">Platby kartou</span>
                                <CustomSelect
                                    ariaLabel="Platby kartou"
                                    options={[0, 5, 10, 15].map((count) => ({
                                        value: String(count),
                                        label: String(count),
                                    }))}
                                    value={editValues.cardPayments}
                                    onChange={(value) => setEditValues((current) => ({
                                        ...current,
                                        cardPayments: value,
                                    }))}
                                />
                            </label>
                            <label className="form-group">
                                <span className="form-label">Expirácia</span>
                                <input
                                    className="finova-input finova-input-control"
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="DD.MM.RRRR"
                                    value={editValues.expiration}
                                    onChange={updateEditValue('expiration')}
                                />
                            </label>
                        </div>
                        <div className="finova-modal-footer">
                            <button type="button" className="btn-finova-secondary" onClick={closeEditModal} disabled={saving}>
                                Zrušiť
                            </button>
                            <button type="submit" className="btn-finova-primary-sm" disabled={saving}>
                                {saving ? 'Ukladám...' : 'Uložiť zmeny'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {confirmDeleteAccount && (
                <div className="finova-modal-overlay" role="presentation">
                    <div className="finova-modal" role="dialog" aria-modal="true" aria-labelledby="account-delete-title">
                        <div className="finova-modal-header">
                            <h2 className="finova-modal-title" id="account-delete-title">Potvrdenie odstránenia</h2>
                        </div>
                        <div className="finova-modal-body">
                            <p>Naozaj si želáte odstrániť účet {confirmDeleteAccount.bank || ''}?</p>
                            {error && <div className="settings-error" role="alert">{error}</div>}
                        </div>
                        <div className="finova-modal-footer">
                            <button type="button" className="btn-finova-secondary" onClick={() => setConfirmDeleteAccount(null)} disabled={saving}>
                                Zrušiť
                            </button>
                            <button type="button" className="btn-finova-primary-sm" onClick={deleteAccount} disabled={saving}>
                                {saving ? 'Odstraňujem...' : 'Potvrdiť'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AccountList;
