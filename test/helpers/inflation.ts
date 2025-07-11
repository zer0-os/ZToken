import * as hre from "hardhat";
import {
  FINAL_INFLATION_RATE_DEFAULT,
  FINAL_MINTABLE_YEARLY_TOKENS_REF_DEFAULT,
  INFLATION_RATES_DEFAULT,
  INITIAL_SUPPLY_DEFAULT,
  YEAR_IN_SECONDS,
} from "./constants";

export const getMintableTokensForYear = (
  year : bigint,
  inflationRates ?: Array<bigint>,
  finalInflationRate ?: bigint,
  initialSupply ?: bigint,
) : bigint => {
  const rates : Array<bigint> = inflationRates
    ? inflationRates
    : INFLATION_RATES_DEFAULT.length;
  const final : bigint = finalInflationRate
    ? finalInflationRate
    : FINAL_INFLATION_RATE_DEFAULT;
  const inflationRate = year < rates.length
    ? rates[Number(year)]
    : final;
  const supply = initialSupply
    ? initialSupply
    : INITIAL_SUPPLY_DEFAULT;

  return hre.ethers.parseEther(supply.toString()) * inflationRate / 10000n;
};

// Returns the total mintable tokens for the specified year
export const getYearlyMintableTokens = (yearIndex : bigint) : bigint =>
  getMintableTokensForYear(yearIndex) !== undefined
    ? getMintableTokensForYear(yearIndex)
    : FINAL_MINTABLE_YEARLY_TOKENS_REF_DEFAULT;

// Only for period during the specified year
export const getTokensPerPeriod = (yearIndex : bigint, periodLength : bigint) : bigint => {
  const perYear = getYearlyMintableTokens(yearIndex);

  return periodLength * perYear / YEAR_IN_SECONDS;
};
