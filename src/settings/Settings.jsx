import { useState, useEffect, useRef } from 'react';
import { ArrowLeftRight, CalendarDays, SlidersHorizontal } from 'lucide-react';
import { supabase } from '../supabaseClient';
import CustomSelect from './CustomSelect';
import { DEFAULT_GLOBAL_SETTINGS } from '../globalSettings';
import '../css/settings.css';

const EXCHANGE_NAMES = {
  LN: 'Tradepoint Investment Exchange',
  GR: 'Germany (composite market)',
  GF: 'Frankfurt Stock Exchange',
  GD: 'Dusseldorf Stock Exchange',
  GS: 'Stuttgart Stock Exchange',
  GM: 'Munich Stock Exchange',
  GH: 'Hamburg Stock Exchange',
  GT: 'Xetra ETF Exchange',
  LA: 'LSXExchange',
  LU: 'LSX LSSI',
  NA: 'Euronext Amsterdam Stock Exchange',
  IM: 'Milan NM',
  SW: 'SIX Swiss Exchange',
  SE: 'SIX Swiss Exchange',
  QX: 'Aquis Exchange',
  EU: 'European Composite',
  EP: 'European Lit Primaries Composite',
  EZ: 'European Lit Composite',
  EO: 'OTC Composite',
  X2: 'CBOE APA',
  XH: 'Budapest Stock Exchange OTC',
  BW: 'BX Worldcaps',
  B3: 'Blockmatch',
  TH: 'Tradegate',
};

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

export default function Settings({ globalSettings = DEFAULT_GLOBAL_SETTINGS, onGlobalSettingsChange }) {
  const [errorMsg, setErrorMsg] = useState('');
  const [globalSettingsForm, setGlobalSettingsForm] = useState(globalSettings);
  const [globalSettingsSaving, setGlobalSettingsSaving] = useState(false);
  const [globalSettingsError, setGlobalSettingsError] = useState('');

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalText, setSuccessModalText] = useState('Operácia prebehla úspešne.');

  // Form State pre pridávanie
  const [bank, setBank] = useState('');
  const [accountType, setAccountType] = useState('Sporiaci účet');
  const [rate, setRate] = useState('');
  const [balance, setBalance] = useState('');
  const [cardPayments, setCardPayments] = useState('0');
  const [tax, setTax] = useState('15');
  const [currency, setCurrency] = useState('CZK');
  const [expirationSk, setExpirationSk] = useState('');
  const [transactionType, setTransactionType] = useState('buy');
  const [transactionAssetType, setTransactionAssetType] = useState('stock');
  const [transactionCurrency, setTransactionCurrency] = useState('CZK');
  const [transactionDateSk, setTransactionDateSk] = useState('');
  const [securityQuery, setSecurityQuery] = useState('');
  const [securitySuggestions, setSecuritySuggestions] = useState([]);
  const [selectedSecurity, setSelectedSecurity] = useState(null);
  const [securitySearchLoading, setSecuritySearchLoading] = useState(false);
  const [securitySearchError, setSecuritySearchError] = useState('');
  const [transactionSaving, setTransactionSaving] = useState(false);
  const [transactionSaveError, setTransactionSaveError] = useState('');
  const [transactionSaveSuccess, setTransactionSaveSuccess] = useState('');

  const hiddenDateRef = useRef(null);
  const transactionDateRef = useRef(null);
  const transactionFormRef = useRef(null);
  const securitySearchTimerRef = useRef(null);
  const securitySearchIdRef = useRef(0);

  useEffect(() => {
    setGlobalSettingsForm(globalSettings);
  }, [globalSettings]);

  useEffect(() => () => {
    window.clearTimeout(securitySearchTimerRef.current);
    securitySearchIdRef.current += 1;
  }, []);

  const handleSaveGlobalSettings = async (e) => {
    e.preventDefault();
    setGlobalSettingsSaving(true);
    setGlobalSettingsError('');

    const payload = {
      dark_mode: Boolean(globalSettingsForm.dark_mode),
      dashboard_currency: globalSettingsForm.dashboard_currency,
    };

    const { data: existingSettings, error: fetchError } = await supabase
      .from('global_settings')
      .select('*')
      .limit(1);

    if (fetchError) {
      console.error('Chyba pri načítaní globálnych nastavení:', fetchError.message);
      setGlobalSettingsError('Globálne nastavenia sa nepodarilo načítať.');
      setGlobalSettingsSaving(false);
      return;
    }

    const existingRow = existingSettings?.[0];
    let data;
    let error;

    if (existingRow) {
      let updateQuery = supabase.from('global_settings').update(payload);
      if (existingRow.id) {
        updateQuery = updateQuery.eq('id', existingRow.id);
      } else {
        updateQuery = updateQuery
          .eq('dark_mode', existingRow.dark_mode)
          .eq('dashboard_currency', existingRow.dashboard_currency);
      }

      const result = await updateQuery.select().maybeSingle();
      data = result.data;
      error = result.error;
    }

    if (!data && !error) {
      const result = await supabase.from('global_settings').insert(payload).select().single();
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Chyba pri ukladaní globálnych nastavení:', error.message);
      setGlobalSettingsError('Globálne nastavenia sa nepodarilo uložiť.');
    } else {
      const savedSettings = {
        dark_mode: Boolean(data.dark_mode),
        dashboard_currency: data.dashboard_currency || DEFAULT_GLOBAL_SETTINGS.dashboard_currency,
      };
      setGlobalSettingsForm(savedSettings);
      onGlobalSettingsChange?.(savedSettings);
    }

    setGlobalSettingsSaving(false);
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
      resetForm();
      setSuccessModalText('Účet bol úspešne pridaný.');
      setShowSuccessModal(true);
    }
  };

  const handleSaveTransaction = async (event) => {
    event.preventDefault();
    setTransactionSaveError('');
    setTransactionSaveSuccess('');

    if (!selectedSecurity?.ticker || !selectedSecurity?.figi || !selectedSecurity?.exchange || !selectedSecurity?.name) {
      setTransactionSaveError('Najprv vyhľadajte a vyberte cenný papier podľa tickeru alebo ISIN-u.');
      return;
    }

    const formData = new FormData(event.currentTarget);
    const transactionDate = toIsoDate(transactionDateSk);
    const dateParts = transactionDate.split('-').map(Number);
    const parsedDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
    const isValidDate = transactionDate
      && parsedDate.getUTCFullYear() === dateParts[0]
      && parsedDate.getUTCMonth() === dateParts[1] - 1
      && parsedDate.getUTCDate() === dateParts[2];
    const quantity = Number(formData.get('quantity'));
    const unitPrice = Number(formData.get('unit_price'));
    const commission = Number(formData.get('commission') || 0);
    const isin = typeof selectedSecurity.isin === 'string' ? selectedSecurity.isin.toUpperCase() : null;

    if (!isValidDate) {
      setTransactionSaveError('Zadajte platný dátum obchodu.');
      return;
    }
    if (isin && !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)) {
      setTransactionSaveError('Vybraný cenný papier nemá platný ISIN.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
      setTransactionSaveError('Počet kusov a cena za kus musia byť väčšie ako nula.');
      return;
    }
    if (!Number.isFinite(commission) || commission < 0) {
      setTransactionSaveError('Provízia alebo poplatok nemôže byť záporný.');
      return;
    }

    setTransactionSaving(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('Chyba pri overovaní používateľa transakcie:', authError.message);
        setTransactionSaveError('Používateľa sa nepodarilo overiť. Skúste sa znova prihlásiť.');
        return;
      }
      if (!authData.user) {
        setTransactionSaveError('Pre uloženie transakcie sa musíte prihlásiť.');
        return;
      }

      const payload = {
        user_id: authData.user.id,
        transaction_type: transactionType,
        asset_type: transactionAssetType,
        isin,
        ticker: selectedSecurity.ticker,
        exchange: selectedSecurity.exchange,
        figi: selectedSecurity.figi,
        security_name: selectedSecurity.name,
        trade_date: transactionDate,
        quantity,
        unit_price: unitPrice,
        currency: transactionCurrency,
        commission,
        broker: String(formData.get('broker') || '').trim() || null,
        note: String(formData.get('note') || '').trim() || null,
      };

      const { error } = await supabase
        .from('investment_transactions')
        .insert(payload);

      if (error) {
        console.error('Chyba pri ukladaní investičnej transakcie:', error.message);
        setTransactionSaveError(`Chyba pri ukladaní do databázy: ${error.message}`);
        return;
      }

      transactionFormRef.current?.reset();
      setTransactionType('buy');
      setTransactionAssetType('stock');
      setTransactionCurrency('CZK');
      setTransactionDateSk('');
      setSecurityQuery('');
      setSelectedSecurity(null);
      setSecuritySuggestions([]);
      setTransactionSaveSuccess('Transakcia bola úspešne uložená.');
    } catch (error) {
      console.error('Chyba pri ukladaní investičnej transakcie:', error);
      setTransactionSaveError('Transakciu sa nepodarilo uložiť. Skúste to znova.');
    } finally {
      setTransactionSaving(false);
    }
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

  const handleOpenTransactionDatePicker = () => {
    if (transactionDateRef.current) {
      if (typeof transactionDateRef.current.showPicker === 'function') {
        const iso = toIsoDate(transactionDateSk);
        transactionDateRef.current.value = iso || '';
        transactionDateRef.current.showPicker();
      } else {
        transactionDateRef.current.click();
      }
    }
  };

  const searchSecurity = (query, assetType) => {
    setSecurityQuery(query);
    setSelectedSecurity(null);
    setSecuritySuggestions([]);
    setSecuritySearchError('');
    window.clearTimeout(securitySearchTimerRef.current);

    const normalizedQuery = query.trim().toUpperCase();
    const isIsin = /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(normalizedQuery);
    const isTicker = /^[A-Z0-9._-]{1,20}$/.test(normalizedQuery);
    if (!isIsin && !isTicker) {
      setSecuritySearchLoading(false);
      securitySearchIdRef.current += 1;
      return;
    }

    setSecuritySearchLoading(true);
    const searchId = ++securitySearchIdRef.current;
    securitySearchTimerRef.current = window.setTimeout(() => {
      const fetchSuggestions = async () => {
        try {
          const { data, error } = await supabase.functions.invoke('security-search', {
            body: { query: normalizedQuery, assetType },
          });

          if (searchId !== securitySearchIdRef.current) return;
          if (error) {
            console.error('Chyba pri vyhľadávaní cenného papiera:', error.message);
            if (error.context?.status === 404) {
              setSecuritySearchError('Vyhľadávacia funkcia nie je nasadená v Supabase. Nasadíte ju príkazom uvedeným v návode k projektu.');
              return;
            }
            const errorResponse = error.context instanceof Response
              ? await error.context.clone().json().catch(() => null)
              : null;
            setSecuritySearchError(errorResponse?.error || 'Cenné papiere sa nepodarilo vyhľadať. Skúste to znova.');
            return;
          }

          const uniqueSecurities = new Map();
          for (const security of data?.results || []) {
            if (!security.ticker || !security.figi || !security.exchange || !security.name) continue;
            const key = `${security.figi}:${security.exchange}`;
            if (!uniqueSecurities.has(key)) {
              uniqueSecurities.set(key, security);
            }
          }
          const securities = [...uniqueSecurities.values()];
          const results = isIsin ? securities : securities.slice(0, 8);
          setSecuritySuggestions(results);
          if (!results.length) {
            setSecuritySearchError('Nenašli sa žiadne zodpovedajúce cenné papiere.');
          }
        } catch (error) {
          if (searchId !== securitySearchIdRef.current) return;
          console.error('Chyba pri vyhľadávaní cenného papiera:', error);
          setSecuritySearchError('Cenné papiere sa nepodarilo vyhľadať. Skúste to znova.');
        } finally {
          if (searchId === securitySearchIdRef.current) {
            setSecuritySearchLoading(false);
          }
        }
      };

      fetchSuggestions();
    }, 450);
  };

  const handleSecuritySearchChange = (event) => {
    searchSecurity(event.target.value.trimStart(), transactionAssetType);
  };

  return (
    <div className="finova-container">
      <section className="finova-card">
        <div className="card-header-flex">
          <div>
            <h2 className="card-title global-settings-title" style={{ margin: 0 }}>
              <SlidersHorizontal size={22} aria-hidden="true" />
              Globálne nastavenia
            </h2>
          </div>
        </div>
        {globalSettingsError && (
          <div className="settings-error" role="alert">
            {globalSettingsError}
          </div>
        )}
        <form onSubmit={handleSaveGlobalSettings} className="finova-form global-settings-form">
          <div className="form-group">
            <label className="form-label">Režim zobrazenia</label>
            <CustomSelect
              options={[
                { value: 'light', label: 'Svetlý režim' },
                { value: 'dark', label: 'Tmavý režim' },
              ]}
              value={globalSettingsForm.dark_mode ? 'dark' : 'light'}
              onChange={(value) => setGlobalSettingsForm((current) => ({ ...current, dark_mode: value === 'dark' }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Dashboard mena</label>
            <CustomSelect
              options={[
                { value: 'CZK', label: 'CZK (Kč)' },
                { value: 'EUR', label: 'EUR (€)' },
                { value: 'USD', label: 'USD ($)' },
              ]}
              value={globalSettingsForm.dashboard_currency}
              onChange={(value) => setGlobalSettingsForm((current) => ({ ...current, dashboard_currency: value }))}
            />
          </div>
          <div className="form-group form-group-full">
            <button type="submit" className="btn-finova-primary" disabled={globalSettingsSaving}>
              {globalSettingsSaving ? 'Ukladám...' : 'Uložiť'}
            </button>
          </div>
        </form>
      </section>

      <section className="finova-card">
        <h2 className="card-title">✦ Pridať účet</h2>
        {errorMsg && (
          <div className="settings-error" role="alert">
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
              className="finova-input finova-input-control"
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
              className="finova-input finova-input-control"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Platby kartou</label>
            <CustomSelect
              ariaLabel="Počet platieb kartou"
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
              {/* Vizuálny textový/formátovaný input (prekrýva sa, ale kliknutie smeruje na date picker alebo funguje duálne) */}
              <input
                type="text"
                value={expirationSk}
                placeholder="DD.MM.RRRR"
                onChange={(e) => setExpirationSk(e.target.value)}
                className="finova-input finova-input-control"
                style={{ paddingRight: '38px', width: '100%', boxSizing: 'border-box' }}
              />

              {/* Skutočný interaktívny date input umiestnený cez celú plochu s nulovou opacitou, ale reálnymi eventmi */}
              <input
                ref={hiddenDateRef}
                type="date"
                value={toIsoDate(expirationSk)}
                onChange={(e) => setExpirationSk(toSkDate(e.target.value))}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  opacity: 0,
                  pointerEvents: 'none',
                  width: '1px',
                  height: '1px',
                  boxSizing: 'border-box',
                }}
                title="Vybrať dátum"
              />

              {/* Ikonka len ako vizuálny doplnok, lebo celý wrapper/date picker je clickable */}
              <button
                type="button"
                onClick={handleOpenDatePicker}
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

      <section className="finova-card transaction-card">
        <h2 className="card-title">
          <ArrowLeftRight size={22} aria-hidden="true" />
          Pridať transakciu
        </h2>
        {(securitySearchError || transactionSaveError) && (
          <div className="settings-error" role="alert">{transactionSaveError || securitySearchError}</div>
        )}
        {transactionSaveSuccess && (
          <div className="transaction-save-success" role="status">{transactionSaveSuccess}</div>
        )}
        <form ref={transactionFormRef} onSubmit={handleSaveTransaction} className="finova-form transaction-form">
          <div className="form-group">
            <label className="form-label">Typ obchodu *</label>
            <CustomSelect
              ariaLabel="Typ obchodu"
              options={[
                { value: 'buy', label: 'Nákup' },
                { value: 'sell', label: 'Predaj' },
              ]}
              value={transactionType}
              onChange={setTransactionType}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Typ aktíva *</label>
            <CustomSelect
              ariaLabel="Typ aktíva"
              options={[
                { value: 'stock', label: 'Akcia' },
                { value: 'etf', label: 'ETF' },
              ]}
              value={transactionAssetType}
              onChange={(value) => {
                setTransactionAssetType(value);
                if (securityQuery.trim().length >= 2) {
                  searchSecurity(securityQuery, value);
                }
              }}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="transaction-security-search">Cenný papier (ticker alebo ISIN) *</label>
            <div className="transaction-security-search" aria-busy={securitySearchLoading}>
              <input
                id="transaction-security-search"
                className="finova-input finova-input-control"
                type="text"
                autoComplete="off"
                placeholder="Zadajte ticker alebo 12-znakový ISIN"
                maxLength={20}
                value={securityQuery}
                onChange={handleSecuritySearchChange}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={securitySuggestions.length > 0}
                aria-controls="transaction-security-suggestions"
                required
              />
              {securitySuggestions.length > 0 && (
                <div className="transaction-security-suggestions" id="transaction-security-suggestions" role="listbox">
                  {securitySuggestions.map((security) => (
                    <button
                      key={`${security.figi}-${security.exchange}`}
                      type="button"
                      role="option"
                      aria-selected={selectedSecurity?.figi === security.figi
                        && selectedSecurity?.exchange === security.exchange}
                      className="transaction-security-suggestion"
                      onClick={() => {
                        setSelectedSecurity({
                          ...security,
                          ticker: security.ticker.toUpperCase(),
                          isin: security.isin?.toUpperCase() || null,
                        });
                        setTransactionAssetType(security.assetType);
                        setSecuritySuggestions([]);
                        setSecuritySearchError('');
                      }}
                    >
                      <span className="transaction-security-listing">
                        <span className="transaction-security-ticker">{security.ticker}</span>
                        <span className="transaction-security-exchange">
                          {EXCHANGE_NAMES[security.exchange] || security.exchange}
                        </span>
                      </span>
                      <span className="transaction-security-details">
                        <span className="transaction-security-name">{security.name}</span>
                        {security.securityType && (
                          <span className="transaction-security-type">Typ: {security.securityType}</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="transaction-date-display">Dátum obchodu *</label>
            <div className="account-expiration-input-wrapper">
              <input
                id="transaction-date-display"
                className="finova-input finova-input-control"
                type="text"
                name="trade_date_display"
                value={transactionDateSk}
                placeholder="DD.MM.RRRR"
                onChange={(event) => setTransactionDateSk(event.target.value)}
                required
              />
              <input
                ref={transactionDateRef}
                type="date"
                value={toIsoDate(transactionDateSk)}
                onChange={(event) => setTransactionDateSk(toSkDate(event.target.value))}
                className="account-expiration-native-picker"
                title="Vybrať dátum"
                tabIndex={-1}
              />
              <button
                type="button"
                className="transaction-date-picker-button"
                onClick={handleOpenTransactionDatePicker}
                aria-label="Vybrať dátum obchodu"
              >
                <CalendarDays size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="transaction-quantity">Počet kusov *</label>
            <input
              id="transaction-quantity"
              className="finova-input finova-input-control"
              name="quantity"
              type="number"
              inputMode="decimal"
              min="0.000001"
              step="any"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="transaction-unit-price">Cena za kus *</label>
            <input
              id="transaction-unit-price"
              className="finova-input finova-input-control"
              name="unit_price"
              type="number"
              inputMode="decimal"
              min="0.000001"
              step="any"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mena obchodu *</label>
            <CustomSelect
              ariaLabel="Mena obchodu"
              options={[
                { value: 'CZK', label: 'CZK (Kč)' },
                { value: 'EUR', label: 'EUR (€)' },
                { value: 'USD', label: 'USD ($)' },
              ]}
              value={transactionCurrency}
              onChange={setTransactionCurrency}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="transaction-commission">Provízia / poplatok</label>
            <input
              id="transaction-commission"
              className="finova-input finova-input-control"
              name="commission"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              defaultValue="0"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="transaction-broker">Broker / účet</label>
            <input
              id="transaction-broker"
              className="finova-input finova-input-control"
              name="broker"
              type="text"
              autoComplete="off"
            />
          </div>

          <div className="form-group form-group-full">
            <label className="form-label" htmlFor="transaction-note">Poznámka</label>
            <textarea
              id="transaction-note"
              className="finova-input finova-input-control transaction-note"
              name="note"
              rows="3"
            />
          </div>

          <div className="form-group form-group-full transaction-form-footer">
            <button type="submit" className="btn-finova-primary" disabled={transactionSaving || securitySearchLoading}>
              {transactionSaving ? 'Ukladám...' : 'Pridať transakciu'}
            </button>
          </div>
        </form>
      </section>

      {/* Modálne okno - Úspešné uloženie/pridanie/úprava */}
      {showSuccessModal && (
        <div className="finova-modal-overlay" role="presentation">
          <section className="finova-modal success-modal" role="dialog" aria-modal="true" aria-labelledby="success-modal-title">
            <div className="finova-modal-header">
              <h2 className="finova-modal-title" id="success-modal-title">Informácia</h2>
            </div>
            <div className="finova-modal-body">
              <p>{successModalText}</p>
            </div>
            <div className="finova-modal-footer">
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="btn-finova-primary-sm"
              >
                OK
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}