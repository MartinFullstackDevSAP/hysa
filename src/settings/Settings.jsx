import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import CustomSelect from './CustomSelect';
import '../css/settings.css';

// Zoznam hlavných bánk a inštitúcií v ČR s prázdnou predvolenou voľbou
const CZECH_BANKS = [
  { value: '', label: '-- Vyberte banku --' },
  { value: 'Air Bank', label: 'Air Bank' },
  { value: 'Banka CREDITAS', label: 'Banka CREDITAS' },
  { value: 'Česká spořitelna', label: 'Česká spořitelna' },
  { value: 'ČSOB', label: 'ČSOB' },
  { value: 'Dlhopisy Republiky', label: 'Dlhopisy Republiky' },
  { value: 'Fio banka', label: 'Fio banka' },
  { value: 'KB', label: 'Komerční banka (KB)' },
  { value: 'mBank', label: 'mBank' },
  { value: 'Moneta', label: 'MONETA Money Bank' },
  { value: 'Partners Banka', label: 'Partners Banka' },
  { value: 'PPF Banka', label: 'PPF Banka' },
  { value: 'Raiffeisenbank', label: 'Raiffeisenbank' },
  { value: 'Trinity Bank', label: 'Trinity Bank' },
  { value: 'UniCredit', label: 'UniCredit Bank' },
  { value: 'VÚB', label: 'VÚB' },
  { value: 'Inbank', label: 'Inbank' },
  { value: 'Iná banka', label: 'Iná inštitúcia' },
];

const ACCOUNT_TYPES = [
  { value: 'Sporiaci účet', label: 'Sporiaci účet' },
  { value: 'Termínovaný vklad', label: 'Termínovaný vklad' },
  { value: 'Dlhopis', label: 'Dlhopis' },
];

const BANK_DOMAINS = {
  "Air Bank": "airbank.cz",
  "Banka CREDITAS": "creditas.cz",
  "Česká spořitelna": "csas.cz",
  "ČSOB": "csob.cz",
  "Fio banka": "fio.cz",
  "Komerční banka": "kb.cz",
  "mBank": "mbank.cz",
  "Moneta": "moneta.cz",
  "Partners Banka": "partnersbanka.cz",
  "PPF Banka": "ppfbanka.cz",
  "Raiffeisenbank": "raiffeisen.cz",
  "Trinity Bank": "trinitybank.cz",
  "UniCredit Bank": "unicreditbank.cz",
  "VÚB": "vub.sk",
  "Inbank": "inbank.cz"
};

export const getBankLogo = (bankName) => {
  const domain = BANK_DOMAINS[bankName];
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;
};

export const BANK_LOGOS = {
  "Air Bank": "/bank-icons/air.png",
  "Banka CREDITAS": "/bank-icons/creditas.png",
  "Česká spořitelna": "/bank-icons/csob.jpg",
  "ČSOB": "/bank-icons/csob.jpg",
  "Dlhopisy Republiky": "/bank-icons/dlhopisy.jpeg",
  "Fio banka": "/bank-icons/fio.png",
  "Komerční banka": "/bank-icons/kb.png",
  "mBank": "/bank-icons/mbank.png",
  "Moneta": "/bank-icons/moneta.png",
  "Partners Banka": "/bank-icons/partners.jpg",
  "PPF Banka": "/bank-icons/ppf.png",
  "Raiffeisenbank": "/bank-icons/reif.png",
  "Trinity Bank": "/bank-icons/trinity.png",
  "UniCredit Bank": "/bank-icons/unicredit.png",
  "VÚB": "/bank-icons/vub.png",
  "Inbank": "/bank-icons/inbank.jpg", 
};

const formatOnBlur = (val) => {
  if (!val && val !== 0) return '';
  const strVal = val.toString().replace(',', '.');
  const [integerPart, decimalPart] = strVal.split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimalPart !== undefined ? `${formattedInteger},${decimalPart}` : formattedInteger;
};

const unformatOnFocus = (val) => {
  if (!val) return '';
  return val.toString().replace(/\./g, '');
};

const parseFormattedNumber = (val) => {
  if (!val) return 0;
  const normalized = val.toString().replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized) || 0;
};

const formatCurrency = (amount, currencySymbol) => {
  const formatted = amount.toLocaleString('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${currencySymbol}`;
};

const toSkDate = (isoDate) => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}.${month}.${year}`;
};

const toIsoDate = (skDate) => {
  if (!skDate) return '';
  const cleaned = skDate.replace(/[^\d.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    if (day && month && year) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  return '';
};

export default function Settings() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // State pre modal okná
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalText, setSuccessModalText] = useState('Operácia prebehla úspešne.');

  // State pre editovacie modálne okno
  const [editingAccount, setEditingAccount] = useState(null);
  const [editRate, setEditRate] = useState('');
  const [editBalance, setEditBalance] = useState('');
  const [editCardPayments, setEditCardPayments] = useState('0');
  const [editExpirationSk, setEditExpirationSk] = useState('');
  const [hasInitialExpiration, setHasInitialExpiration] = useState(false);
  const [editErrorMsg, setEditErrorMsg] = useState('');

  // Form State pre pridávanie
  const [bank, setBank] = useState('');
  const [accountType, setAccountType] = useState('Sporiaci účet');
  const [rate, setRate] = useState('');
  const [balance, setBalance] = useState('');
  const [cardPayments, setCardPayments] = useState('0');
  const [tax, setTax] = useState('15');
  const [currency, setCurrency] = useState('CZK');
  const [expirationSk, setExpirationSk] = useState('');

  const hiddenDateRef = useRef(null);
  const editHiddenDateRef = useRef(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Chyba pri načítaní účtov:', error.message);
    } else {
      setAccounts(data || []);
    }
    setLoading(false);
  };

  const handleInputChange = (setter) => (e) => {
    let value = e.target.value;
    value = value.replace(/[^\d.,]/g, '');
    setter(value);
    if (errorMsg) setErrorMsg('');
  };

  const handleBlur = (value, setter) => () => {
    setter(formatOnBlur(value));
  };

  const handleFocus = (value, setter) => () => {
    setter(unformatOnFocus(value));
  };

  const resetForm = () => {
    setBank('');
    setAccountType('Sporiaci účet');
    setRate('');
    setBalance('');
    setCardPayments('0');
    setTax('15');
    setCurrency('CZK');
    setExpirationSk('');
  };

  const handleOpenEditModal = (acc) => {
    setEditingAccount(acc);
    setEditRate(formatOnBlur(acc.rate));
    setEditBalance(formatOnBlur(acc.balance));
    setEditCardPayments(String(acc.card_payments ?? acc.cardPayments ?? 0));
    const hasExp = Boolean(acc.expiration);
    setHasInitialExpiration(hasExp);
    setEditExpirationSk(hasExp ? toSkDate(acc.expiration) : '');
    setEditErrorMsg('');
  };

  const handleCloseEditModal = () => {
    setEditingAccount(null);
    setEditErrorMsg('');
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!bank || bank.trim() === '') {
      setErrorMsg('Vyberte banku / inštitúciu.');
      return;
    }
    if (rate === '' || balance === '') {
      setErrorMsg('Vyplňte úrok a zostatok.');
      return;
    }

    const isoExpiration = toIsoDate(expirationSk);

    const payload = {
      bank,
      name: accountType || 'Sporiaci účet',
      rate: parseFormattedNumber(rate),
      balance: parseFormattedNumber(balance),
      card_payments: Number(cardPayments),
      tax: Number(tax),
      currency,
      expiration: isoExpiration || null,
    };

    const { data, error } = await supabase
      .from('accounts')
      .insert([payload])
      .select();

    if (error) {
      console.error('Chyba pri ukladaní účtu:', error.message);
      setErrorMsg('Chyba pri ukladaní do databázy: ' + error.message);
    } else if (data) {
      setAccounts([data[0], ...accounts]);
      resetForm();
      setSuccessModalText('Účet bol úspešne pridaný.');
      setShowSuccessModal(true);
    }
  };

  const handleSaveEditedAccount = async (e) => {
    e.preventDefault();
    if (!editingAccount) return;
    setEditErrorMsg('');

    if (editRate === '' || editBalance === '') {
      setEditErrorMsg('Vyplňte úrok a zostatok.');
      return;
    }

    const isoExpiration = hasInitialExpiration ? toIsoDate(editExpirationSk) : (editingAccount.expiration || null);

    const payload = {
      rate: parseFormattedNumber(editRate),
      balance: parseFormattedNumber(editBalance),
      card_payments: Number(editCardPayments),
      expiration: hasInitialExpiration ? (isoExpiration || null) : editingAccount.expiration,
    };

    const { data, error } = await supabase
      .from('accounts')
      .update(payload)
      .eq('id', editingAccount.id)
      .select();

    if (error) {
      console.error('Chyba pri úprave účtu:', error.message);
      setEditErrorMsg('Chyba pri aktualizácii databázy: ' + error.message);
    } else if (data) {
      setAccounts(accounts.map((acc) => (acc.id === editingAccount.id ? data[0] : acc)));
      handleCloseEditModal();
      setSuccessModalText('Účet bol upravený.');
      setShowSuccessModal(true);
    }
  };

  const confirmDeleteAccount = async () => {
    if (!confirmDeleteId) return;
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', confirmDeleteId);

    if (error) {
      console.error('Chyba pri mazaní účtu:', error.message);
    } else {
      setAccounts(accounts.filter((acc) => acc.id !== confirmDeleteId));
    }
    setConfirmDeleteId(null);
  };

  const handleOpenDatePicker = () => {
    if (hiddenDateRef.current) {
      if (typeof hiddenDateRef.current.showPicker === 'function') {
        const iso = toIsoDate(expirationSk);
        hiddenDateRef.current.value = iso || '';
        hiddenDateRef.current.showPicker();
      } else {
        hiddenDateRef.current.click();
      }
    }
  };

  const handleOpenEditDatePicker = () => {
    if (editHiddenDateRef.current) {
      if (typeof editHiddenDateRef.current.showPicker === 'function') {
        const iso = toIsoDate(editExpirationSk);
        editHiddenDateRef.current.value = iso || '';
        editHiddenDateRef.current.showPicker();
      } else {
        editHiddenDateRef.current.click();
      }
    }
  };

  return (
    <div className="finova-container">
      <section className="finova-card">
        <h2 className="card-title">✦ Pridať účet</h2>
        {errorMsg && (
          <div style={{ color: '#dc2626', background: '#fee2e2', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.875rem', fontWeight: 500 }}>
            {errorMsg}
          </div>
        )}
        <form onSubmit={handleSaveAccount} className="finova-form">
          <div className="form-group">
            <label className="form-label">Banka / Inštitúcia *</label>
            <CustomSelect
              options={CZECH_BANKS}
              value={bank}
              onChange={(val) => {
                setBank(val);
                if (errorMsg) setErrorMsg('');
              }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Typ účtu</label>
            <CustomSelect
              options={ACCOUNT_TYPES}
              value={accountType}
              onChange={(val) => setAccountType(val)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Úrok (% p.a.) *</label>
            <input
              type="text"
              inputMode="decimal"
              value={rate}
              onChange={handleInputChange(setRate)}
              onFocus={handleFocus(rate, setRate)}
              onBlur={handleBlur(rate, setRate)}
              className="finova-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Zostatok *</label>
            <input
              type="text"
              inputMode="decimal"
              value={balance}
              onChange={handleInputChange(setBalance)}
              onFocus={handleFocus(balance, setBalance)}
              onBlur={handleBlur(balance, setBalance)}
              className="finova-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Platby kartou</label>
            <CustomSelect
              options={[
                { value: '0', label: '0' },
                { value: '5', label: '5' },
                { value: '10', label: '10' },
                { value: '15', label: '15' },
              ]}
              value={cardPayments}
              onChange={(val) => setCardPayments(val)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Daň</label>
            <CustomSelect
              options={[
                { value: '0', label: '0 %' },
                { value: '15', label: '15 %' },
                { value: '23', label: '23 %' },
              ]}
              value={tax}
              onChange={(val) => setTax(val)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mena</label>
            <CustomSelect
              options={[
                { value: 'CZK', label: 'CZK (Kč)' },
                { value: 'EUR', label: 'EUR (€)' },
                { value: 'USD', label: 'USD ($)' },
              ]}
              value={currency}
              onChange={(val) => setCurrency(val)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Expirácia</label>
            <div className="finova-input-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                readOnly
                value={expirationSk}
                onClick={handleOpenDatePicker}
                className="finova-input"
                style={{ paddingRight: '38px', width: '100%', cursor: 'pointer', caretColor: 'transparent', boxSizing: 'border-box' }}
              />
              <input
                ref={hiddenDateRef}
                type="date"
                onChange={(e) => setExpirationSk(toSkDate(e.target.value))}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: '1px', height: '1px' }}
              />
              <button
                type="button"
                onClick={handleOpenDatePicker}
                title="Vybrať dátum"
                style={{
                  position: 'absolute',
                  right: '8px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary, #475569)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </button>
            </div>
          </div>

          <div className="form-group form-group-full">
            <button type="submit" className="btn-finova-primary">
              + Pridať účet
            </button>
          </div>
        </form>
      </section>

      <section className="finova-card">
        <div className="card-header-flex">
          <h2 className="card-title" style={{ margin: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
              <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
            </svg>
            Zoznam účtov
          </h2>
          <span className="rate-badge">
            {accounts.length} {accounts.length === 1 ? 'účet' : 'účty'}
          </span>
        </div>

        {loading ? (
          <div className="empty-table-container">
            <p style={{ margin: 0, fontWeight: 500 }}>Načítavam účty z databázy...</p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="empty-table-container">
            <p style={{ margin: 0, fontWeight: 500 }}>Zatiaľ neboli pridané žiadne účty.</p>
          </div>
        ) : (
          <div className="finova-list">
            {accounts.map((acc) => {
              const cardCount = Number(acc.card_payments ?? acc.cardPayments ?? 0);
              const taxVal = Number(acc.tax ?? 0);

              return (
                <div key={acc.id} className="finova-list-item">
                  <div className="list-item-main">
                    <div className="bank-icon">
                      {acc.bank && (BANK_LOGOS[acc.bank] || getBankLogo(acc.bank)) ? (
                        <img
                          src={BANK_LOGOS[acc.bank] || getBankLogo(acc.bank)}
                          alt={acc.bank}
                          onError={(e) => {
                            // Ak zlyhá lokálny asset, skúsi Google favicon fallback skôr než text
                            const fallback = getBankLogo(acc.bank);
                            if (fallback && e.target.src !== fallback) {
                              e.target.src = fallback;
                            } else {
                              e.target.style.display = 'none';
                              if (e.target.parentElement) {
                                e.target.parentElement.innerText = acc.bank ? acc.bank.substring(0, 2).toUpperCase() : '?';
                              }
                            }
                          }}
                        />
                      ) : (
                        acc.bank ? acc.bank.substring(0, 2).toUpperCase() : '?'
                      )}
                    </div>
                    <div className="bank-info">
                      <span className="account-name">{acc.name}</span>
                      <span className="bank-name">{acc.bank || 'Neznáma banka'}</span>
                    </div>
                  </div>

                  <div className="list-item-details">
                    <span className="rate-badge">
                      {Number(acc.rate).toFixed(2)} % p.a.
                    </span>

                    {taxVal > 0 && (
                      <span className="rate-badge" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', fontWeight: 500 }}>
                        Daň {taxVal} %
                      </span>
                    )}

                    {cardCount > 0 && (
                      <span className="rate-badge" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', fontWeight: 500 }}>
                        {cardCount}× kartou
                      </span>
                    )}

                    {acc.expiration && (
                      <span className="rate-badge" style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #dc2626', fontWeight: 600 }}>
                        Expirácia: {toSkDate(acc.expiration)}
                      </span>
                    )}
                  </div>

                  <div className="list-item-right">
                    <div className="balance-box">
                      <span className="balance-amount">
                        {formatCurrency(Number(acc.balance), acc.currency)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn-delete-icon"
                        onClick={() => setConfirmDeleteId(acc.id)}
                        title="Odstrániť účet"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="btn-edit-icon"
                        onClick={() => handleOpenEditModal(acc)}
                        title="Upraviť účet"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
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

      {/* Responzívne modálne okno - Úprava účtu (bez pretekania a scrolu, expirácia len ak pôvodne existovala) */}
      {editingAccount && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: '24px',
              borderRadius: '16px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>
                Upraviť účet: {editingAccount.bank} ({editingAccount.name})
              </h3>
            </div>

            {editErrorMsg && (
              <div style={{ color: '#dc2626', background: '#fee2e2', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.875rem', fontWeight: 500, flexShrink: 0 }}>
                {editErrorMsg}
              </div>
            )}

            <form
              onSubmit={handleSaveEditedAccount}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                overflowY: 'auto',
                maxHeight: 'calc(90vh - 160px)',
                paddingRight: '4px',
                boxSizing: 'border-box',
                width: '100%',
              }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Úrok (% p.a.) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editRate}
                    onChange={handleInputChange(setEditRate)}
                    onFocus={handleFocus(editRate, setEditRate)}
                    onBlur={handleBlur(editRate, setEditRate)}
                    className="finova-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Zostatok *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editBalance}
                    onChange={handleInputChange(setEditBalance)}
                    onFocus={handleFocus(editBalance, setEditBalance)}
                    onBlur={handleBlur(editBalance, setEditBalance)}
                    className="finova-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Platby kartou</label>
                  <CustomSelect
                    options={[
                      { value: '0', label: '0' },
                      { value: '5', label: '5' },
                      { value: '10', label: '10' },
                      { value: '15', label: '15' },
                    ]}
                    value={editCardPayments}
                    onChange={(val) => setEditCardPayments(val)}
                  />
                </div>

                {hasInitialExpiration && (
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Expirácia</label>
                    <div className="finova-input-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="text"
                        readOnly
                        value={editExpirationSk}
                        onClick={handleOpenEditDatePicker}
                        className="finova-input"
                        style={{ paddingRight: '38px', width: '100%', cursor: 'pointer', caretColor: 'transparent', boxSizing: 'border-box' }}
                      />
                      <input
                        ref={editHiddenDateRef}
                        type="date"
                        onChange={(e) => setEditExpirationSk(toSkDate(e.target.value))}
                        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: '1px', height: '1px' }}
                      />
                      <button
                        type="button"
                        onClick={handleOpenEditDatePicker}
                        title="Vybrať dátum"
                        style={{
                          position: 'absolute',
                          right: '8px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-secondary, #475569)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '4px',
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="16" y1="2" x2="16" y2="6"></line>
                          <line x1="8" y1="2" x2="8" y2="6"></line>
                          <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div
                className="modal-actions-container"
                style={{
                  display: 'flex',
                  gap: '12px',
                  marginTop: '12px',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  width: '100%',
                }}
              >
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="btn-finova-primary"
                  style={{
                    flex: '1 1 0',
                    background: '#f1f5f9',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    boxShadow: 'none',
                    boxSizing: 'border-box',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Zrušiť
                </button>
                <button
                  type="submit"
                  className="btn-finova-primary"
                  style={{
                    flex: '1 1 0',
                    boxSizing: 'border-box',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Uložiť zmeny
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Modálne okno - Potvrdenie odstránenia */}
      {confirmDeleteId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: '24px',
              borderRadius: '16px',
              maxWidth: '380px',
              width: '100%',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              boxSizing: 'border-box',
            }}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.15rem', color: '#0f172a' }}>
              Potvrdenie odstránenia
            </h3>
            <p style={{ margin: '0 0 24px 0', color: '#475569', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Naozaj si želáte odstrániť tento účet?
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="btn-finova-primary"
                style={{
                  flex: 1,
                  background: '#f1f5f9',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  boxShadow: 'none',
                }}
              >
                Zrušiť
              </button>
              <button
                type="button"
                onClick={confirmDeleteAccount}
                className="btn-finova-primary"
                style={{ flex: 1 }}
              >
                Potvrdiť
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modálne okno - Úspešné uloženie/pridanie/úprava */}
      {showSuccessModal && (
        <div
          style={{
            position: 'fixed',
            inset: '0',
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: '24px',
              borderRadius: '16px',
              maxWidth: '380px',
              width: '100%',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              boxSizing: 'border-box',
            }}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.15rem', color: '#0f172a' }}>
              Informácia
            </h3>
            <p style={{ margin: '0 0 24px 0', color: '#475569', fontSize: '0.95rem', lineHeight: '1.5' }}>
              {successModalText}
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="btn-finova-primary"
                style={{ flex: 1 }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}