export const EXCHANGE_NAMES = {
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
  US: 'United States',
  XNYS: 'NYSE',
  XNAS: 'Nasdaq',
  XASE: 'NYSE American',
  ARCX: 'NYSE Arca',
};

const SECURITY_LOGO_DOMAINS_BY_ISIN = {
  IE000VAHT5T0: 'vanguardinvestor.co.uk',
  KYG6683N1034: 'nubank.com.br',
};

export const getSecurityLogo = (isin) => {
  const domain = SECURITY_LOGO_DOMAINS_BY_ISIN[isin];
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;
};
