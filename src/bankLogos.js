const BANK_DOMAINS = {
  'Air Bank': 'airbank.cz',
  'Banka CREDITAS': 'creditas.cz',
  'Česká spořitelna': 'csas.cz',
  'ČSOB': 'csob.cz',
  'Fio banka': 'fio.cz',
  'Komerční banka': 'kb.cz',
  mBank: 'mbank.cz',
  Moneta: 'moneta.cz',
  'Partners Banka': 'partnersbanka.cz',
  'PPF Banka': 'ppfbanka.cz',
  Raiffeisenbank: 'raiffeisen.cz',
  'Trinity Bank': 'trinitybank.cz',
  'UniCredit Bank': 'unicreditbank.cz',
  'VÚB': 'vub.sk',
  Inbank: 'inbank.cz',
};

export const BANK_LOGOS = {
  'Air Bank': '/bank-icons/air.png',
  'Banka CREDITAS': '/bank-icons/creditas.png',
  'Česká spořitelna': '/bank-icons/csob.jpg',
  'ČSOB': '/bank-icons/csob.jpg',
  'Dlhopisy Republiky': '/bank-icons/dlhopisy.jpeg',
  'Fio banka': '/bank-icons/fio.png',
  'Komerční banka': '/bank-icons/kb.png',
  mBank: '/bank-icons/mbank.png',
  Moneta: '/bank-icons/moneta.png',
  'Partners Banka': '/bank-icons/partners.jpg',
  'PPF Banka': '/bank-icons/ppf.png',
  Raiffeisenbank: '/bank-icons/reif.png',
  'Trinity Bank': '/bank-icons/trinity.png',
  'UniCredit Bank': '/bank-icons/unicredit.png',
  'VÚB': '/bank-icons/vub.png',
  Inbank: '/bank-icons/inbank.jpg',
};

export const getBankLogo = (bankName) => {
  const domain = BANK_DOMAINS[bankName];
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;
};
