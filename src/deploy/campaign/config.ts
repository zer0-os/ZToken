import * as hre from "hardhat";

export const getZTokenCampaignConfig = () => {
  //   zTokenName,
  //   zTokenSymbol,
  //   tokenAdminAddress,
  //   minterAddress,
  //   mintBeneficiaryAddress,
  //   annualInflationRates,
  //   finalInflationRate,

  const envVars = {
    Z_TOKEN_NAME: process.env.Z_TOKEN_NAME,
    Z_TOKEN_SYMBOL: process.env.Z_TOKEN_SYMBOL,
    TOKEN_ADMIN_ADDRESS: process.env.TOKEN_ADMIN_ADDRESS,
    TOKEN_MINTER_ADDRESS: process.env.TOKEN_MINTER_ADDRESS,
    TOKEN_MINT_BENEFICIARY_ADDRESS: process.env.TOKEN_MINT_BENEFICIARY_ADDRESS,
    ANNUAL_INFLATION_RATES: process.env.ANNUAL_INFLATION_RATES,
    FINAL_INFLATION_RATE: process.env.FINAL_INFLATION_RATE,
  };

  Object.entries(envVars).forEach(
    ([key, value]) => {
      if (!value) {
        throw new Error(`Missing environment variable: ${key}`);
      }
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const annualInflationRates = envVars.ANNUAL_INFLATION_RATES!.split(",");

  if (annualInflationRates.length === 0)
    throw new Error("ANNUAL_INFLATION_RATES array is empty!");
  if (annualInflationRates[0] === "0")
    throw new Error("ANNUAL_INFLATION_RATES array is invalid! First element has to be 0!");

  if (envVars.FINAL_INFLATION_RATE === "0")
    throw new Error("FINAL_INFLATION_RATE cannot be 0!");

  if (
    envVars.TOKEN_ADMIN_ADDRESS ||
    envVars.TOKEN_MINTER_ADDRESS ||
    envVars.TOKEN_MINT_BENEFICIARY_ADDRESS === hre.ethers.ZeroAddress
  ) throw new Error("Address cannot be 0x0!");

  return {
    envVars,
  };
};
