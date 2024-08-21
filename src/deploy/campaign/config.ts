/* eslint-disable @typescript-eslint/no-non-null-assertion */
import assert from "assert";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZTokenCampaignConfig } from "./types";

export const getZTokenCampaignConfig = ({
  env,
  deployAdmin,
} : {
  env ?: string;
  deployAdmin : SignerWithAddress;
}) : IZTokenCampaignConfig => {
  let envLevel = process.env.ENV_LEVEL;
  if (env) {
    envLevel = env;
  }

  if (
    envLevel !== "dev" &&
    envLevel !== "test" &&
    envLevel !== "prod"
  ) {
    throw new Error("Provide correct ENV_LEVEL (dev / test / prod)");
  }

  const envVars = {
    Z_TOKEN_NAME: process.env.Z_TOKEN_NAME,
    Z_TOKEN_SYMBOL: process.env.Z_TOKEN_SYMBOL,
    TOKEN_ADMIN_ADDRESS: process.env.TOKEN_ADMIN_ADDRESS,
    TOKEN_MINTER_ADDRESS: process.env.TOKEN_MINTER_ADDRESS,
    TOKEN_MINT_BENEFICIARY_ADDRESS: process.env.TOKEN_MINT_BENEFICIARY_ADDRESS,
    INITIAL_ADMIN_DELAY: process.env.INITIAL_ADMIN_DELAY,
    INITIAL_TOKEN_SUPPLY: process.env.INITIAL_TOKEN_SUPPLY,
    ANNUAL_INFLATION_RATES: process.env.ANNUAL_INFLATION_RATES,
    FINAL_INFLATION_RATE: process.env.FINAL_INFLATION_RATE,
    MONGO_DB_URI: process.env.MONGO_DB_URI,
    MONGO_DB_NAME: process.env.MONGO_DB_NAME,
    ARCHIVE_PREVIOUS_DB_VERSION: process.env.ARCHIVE_PREVIOUS_DB_VERSION,
    VERIFY_CONTRACTS: process.env.VERIFY_CONTRACTS,
  };

  if (env !== "dev") {
    Object.entries(envVars).forEach(
      ([key, value]) => {
        if (!value) {
          throw new Error(`Missing environment variable: ${key}`);
        }
      }
    );

    assert.ok(
      !process.env.MONGO_DB_URI?.includes("localhost"),
      "Cannot use local mongo URI in 'prod' or 'test' environment!"
    );
  } else {
    assert.ok(
      process.env.MONGO_DB_URI?.includes("localhost"),
      "Possibly connecting to production MONGO DB Instance! In DEV env should only connect to local MONGO!"
    );
  }

  const annualInflationRates = envVars.ANNUAL_INFLATION_RATES!.split(",").map(r => BigInt(r));

  if (annualInflationRates.length === 0)
    throw new Error("ANNUAL_INFLATION_RATES array is empty!");

  if (annualInflationRates[0] === 0n)
    throw new Error("ANNUAL_INFLATION_RATES array is invalid! First element has to be 0!");

  const finalInflationRate = BigInt(envVars.FINAL_INFLATION_RATE!);

  annualInflationRates.concat(finalInflationRate).forEach(
    (rate, idx) => {
      if (BigInt(rate) > 10000n)
        throw new Error(`Annual inflation rate: ${rate} at index: ${idx} is too high! Maximum is 10,000 (100%).`);
    }
  );

  const initialTotalSupply = BigInt(envVars.INITIAL_TOKEN_SUPPLY!);
  if (initialTotalSupply <= 0n)
    throw new Error("INITIAL_TOKEN_SUPPLY has to be greater than 0!");

  const config : IZTokenCampaignConfig = {
    env: envLevel,
    deployAdmin,
    zTokenName: envVars.Z_TOKEN_NAME!,
    zTokenSymbol: envVars.Z_TOKEN_SYMBOL!,
    tokenAdminAddress: envVars.TOKEN_ADMIN_ADDRESS!,
    minterAddress: envVars.TOKEN_MINTER_ADDRESS!,
    mintBeneficiaryAddress: envVars.TOKEN_MINT_BENEFICIARY_ADDRESS!,
    initialAdminDelay: BigInt(envVars.INITIAL_ADMIN_DELAY!),
    initialTotalSupply,
    annualInflationRates,
    finalInflationRate,
    postDeploy: {
      tenderlyProjectSlug: process.env.TENDERLY_PROJECT_SLUG!,
      monitorContracts: process.env.MONITOR_CONTRACTS === "true",
      verifyContracts: envVars.VERIFY_CONTRACTS === "true",
    },
  };

  return config;
};
