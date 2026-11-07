export const transactionKey = (transaction) => [
  transaction.figi || transaction.ticker,
  transaction.exchange,
  transaction.currency || 'CZK',
].join(':');

export const calculateHoldings = (transactions) => {
  const positions = new Map();
  const orderedTransactions = [...transactions].sort((first, second) =>
    `${first.trade_date}:${first.created_at || ''}`.localeCompare(
      `${second.trade_date}:${second.created_at || ''}`,
    ));

  for (const transaction of orderedTransactions) {
    const quantity = Number(transaction.quantity);
    const unitPrice = Number(transaction.unit_price);
    const commission = Number(transaction.commission) || 0;
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) continue;

    const key = transactionKey(transaction);
    const position = positions.get(key) || {
      id: key,
      figi: transaction.figi,
      isin: transaction.isin,
      ticker: transaction.ticker,
      exchange: transaction.exchange,
      name: transaction.security_name || transaction.ticker,
      assetType: transaction.asset_type,
      currency: transaction.currency || 'CZK',
      quantity: 0,
      costBasis: 0,
      realizedProfit: 0,
    };

    if (transaction.transaction_type === 'buy') {
      position.quantity += quantity;
      position.costBasis += quantity * unitPrice + commission;
    } else if (transaction.transaction_type === 'sell') {
      if (position.quantity <= 0 || quantity > position.quantity) continue;
      const averageCost = position.costBasis / position.quantity;
      position.realizedProfit += quantity * unitPrice - commission - averageCost * quantity;
      position.quantity -= quantity;
      position.costBasis = Math.max(0, position.costBasis - averageCost * quantity);
    }

    positions.set(key, position);
  }

  return [...positions.values()].filter((position) => position.quantity > 0);
};
