export const ADMIN_DELAY_DEFAULT = 259200n; // 3 days

export const YEAR_IN_SECONDS = 31536000n;
export const INITIAL_SUPPLY_DEFAULT = 369000000n;
export const INFLATION_RATES_DEFAULT = [0n, 900n, 765n, 650n, 552n, 469n, 398n, 338n, 287n, 243n, 206n, 175n];
export const FINAL_INFLATION_RATE_DEFAULT = 150n;

export const getMintableTokensForYear = (year : number) : bigint => {
  const inflationRatesLength = INFLATION_RATES_DEFAULT.length;
  const inflationRate = year < inflationRatesLength
    ? INFLATION_RATES_DEFAULT[year]
    : FINAL_INFLATION_RATE_DEFAULT;

  return INITIAL_SUPPLY_DEFAULT * 10n**18n * inflationRate / 10000n;
};

export const FINAL_MINTABLE_YEARLY_TOKENS_REF_DEFAULT = 5535000000000000000000000n;

export const getYearlyMintableTokens = (yearIndex : number) : bigint =>
  getMintableTokensForYear(yearIndex) !== undefined
    ? getMintableTokensForYear(yearIndex)
    : FINAL_MINTABLE_YEARLY_TOKENS_REF_DEFAULT;

export const getTokensPerPeriod = (yearIndex : number, periodLength : bigint) : bigint => {
  const perYear = getYearlyMintableTokens(yearIndex);

  return periodLength * perYear / YEAR_IN_SECONDS;
};
