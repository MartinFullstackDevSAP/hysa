import { useState } from 'react';
import CustomSelect from './CustomSelect';
import '../css/settings.css';

// Zoznam hlavných bánk a inštitúcií v ČR
const CZECH_BANKS = [
  { value: 'Air Bank', label: 'Air Bank' },
  { value: 'Banka CREDITAS', label: 'Banka CREDITAS' },
  { value: 'Česká spořitelna', label: 'Česká spořitelna' },
  { value: 'ČSOB', label: 'ČSOB' },
  { value: 'Dlhopisy Republiky', label: 'Dlhopisy Republiky' },
  { value: 'Fio banka', label: 'Fio banka' },
  { value: 'KB', label: 'Komerční banka (KB)' },
  { value: 'mBank', label: 'mBank' },
  { value: 'Moneta', label: 'MONETA Money Bank' },
  { value: 'PPF Banka', label: 'PPF Banka' },
  { value: 'Raiffeisenbank', label: 'Raiffeisenbank' },
  { value: 'Trinity Bank', label: 'Trinity Bank' },
  { value: 'UniCredit', label: 'UniCredit Bank' },
  { value: 'Iná banka', label: 'Iná inštitúcia' },
];

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

export default function Settings() {
  const [accounts, setAccounts] = useState([]);
  const [bank, setBank] = useState('Air Bank');
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [balance, setBalance] = useState('');
  const [cardPayments, setCardPayments] = useState('10');
  const [tax, setTax] = useState('15');
  const [currency, setCurrency] = useState('CZK');

  const handleInputChange = (setter) => (e) => {
    let value = e.target.value;
    value = value.replace(/[^\d.,]/g, '');
    setter(value);
  };

  const handleBlur = (value, setter) => () => {
    setter(formatOnBlur(value));
  };

  const handleFocus = (value, setter) => () => {
    setter(unformatOnFocus(value));
  };

  const handleAddAccount = (e) => {
    e.preventDefault();
    if (!bank || !rate) return;

    const newAcc = {
      id: Date.now().toString(),
      bank,
      name: name || 'Sporiaci účet',
      rate: parseFormattedNumber(rate),
      balance: parseFormattedNumber(balance),
      cardPayments: Number(cardPayments),
      tax: Number(tax),
      currency,
    };

    setAccounts([...accounts, newAcc]);
    setBank('Air Bank');
    setName('');
    setRate('');
    setBalance('');
    setCardPayments('10');
    setTax('15');
    setCurrency('CZK');
  };

  const handleDeleteAccount = (id) => {
    setAccounts(accounts.filter((acc) => acc.id !== id));
  };

  return (
    <div className="finova-container">
      {/* Formulár na pridanie sporiaceho účtu */}
      <section className="finova-card">
        <h2 className="card-title">✦ Pridať sporiaci účet</h2>
        <form onSubmit={handleAddAccount} className="finova-form">
          <div className="form-group">
            <label className="form-label">Banka / Inštitúcia *</label>
            <CustomSelect
              options={CZECH_BANKS}
              value={bank}
              onChange={(val) => setBank(val)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Názov účtu</label>
            <input
              type="text"
              placeholder="napr. Rezerva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="finova-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Úrok (% p.a.) *</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="napr. 3,5"
              value={rate}
              onChange={handleInputChange(setRate)}
              onFocus={handleFocus(rate, setRate)}
              onBlur={handleBlur(rate, setRate)}
              required
              className="finova-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Zostatok</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
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
            <button type="submit" className="btn-finova-primary">
              + Pridať účet
            </button>
          </div>
        </form>
      </section>

      {/* Zoznam sporiacich účtov */}
      <section className="finova-card">
        <div className="card-header-flex">
          <h2 className="card-title" style={{ margin: 0 }}>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0f172a"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
              <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
            </svg>
            Zoznam sporiacich účtov
          </h2>
          <span className="account-count-badge">
            {accounts.length} {accounts.length === 1 ? 'účet' : 'účty'}
          </span>
        </div>

        {accounts.length === 0 ? (
          <div className="empty-table-container">
            <p style={{ margin: 0, fontWeight: 500 }}>Zatiaľ neboli pridané žiadne sporiace účty.</p>
          </div>
        ) : (
          <div className="finova-list">
            {accounts.map((acc) => (
              <div key={acc.id} className="finova-list-item">
                <div className="list-item-main">
                  <div className="bank-icon">
                    {acc.bank.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="bank-info">
                    <span className="account-name">{acc.name}</span>
                    <span className="bank-name">{acc.bank}</span>
                  </div>
                </div>

                <div className="list-item-details">
                  <span className="rate-badge">{acc.rate.toFixed(2)} % p.a.</span>
                  <span className="info-badge">{acc.cardPayments}× kartou</span>
                  <span className="info-badge">Daň {acc.tax} %</span>
                </div>

                <div className="list-item-right">
                  <div className="balance-box">
                    <span className="balance-amount">
                      {formatCurrency(acc.balance, acc.currency)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-delete-icon"
                    onClick={() => handleDeleteAccount(acc.id)}
                    title="Odstrániť účet"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}