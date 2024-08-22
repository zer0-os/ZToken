import * as hre from "hardhat";
import {
  FINAL_INFLATION_RATE_DEFAULT,
  FINAL_MINTABLE_YEARLY_TOKENS_REF_DEFAULT,
  INFLATION_RATES_DEFAULT,
  INITIAL_SUPPLY_DEFAULT,
  YEAR_IN_SECONDS,
} from "./constants";

export const getMintableTokensForYear = (year : number) : bigint => {
  const inflationRatesLength = INFLATION_RATES_DEFAULT.length;
  const inflationRate = year < inflationRatesLength
    ? INFLATION_RATES_DEFAULT[year]
    : FINAL_INFLATION_RATE_DEFAULT;

  return hre.ethers.parseEther(INITIAL_SUPPLY_DEFAULT.toString()) * inflationRate / 10000n;
};

export const getYearlyMintableTokens = (yearIndex : number) : bigint =>
  getMintableTokensForYear(yearIndex) !== undefined
    ? getMintableTokensForYear(yearIndex)
    : FINAL_MINTABLE_YEARLY_TOKENS_REF_DEFAULT;

export const getTokensPerPeriod = (yearIndex : number, periodLength : bigint) : bigint => {
  const perYear = getYearlyMintableTokens(yearIndex);

  return periodLength * perYear / YEAR_IN_SECONDS;
};
