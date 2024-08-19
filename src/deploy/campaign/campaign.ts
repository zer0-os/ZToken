import { createDeployCampaign } from "@zero-tech/zdc";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZTokenCampaignConfig, IZTokenContracts } from "./types";
import * as hre from "hardhat";
import { getZTokenCampaignConfig } from "./config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ZTokenDM } from "../missions/z-token-dm";


export const runZTokenCampaign = async ({
  deployAdmin,
  config,
} : {
  deployAdmin ?: SignerWithAddress;
  config ?: IZTokenCampaignConfig;
} = {}) => {
  if (!deployAdmin) {
    [deployAdmin] = await hre.ethers.getSigners();
  }

  if (!config) {
    config = getZTokenCampaignConfig({
      deployAdmin,
    });
  }

  const campaign = await createDeployCampaign<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IZTokenCampaignConfig,
  IZTokenContracts
  >({
    hre,
    config,
    contractsVersion: process.env.CONTRACTS_GIT_VERSION || "1.0.0",
    missions: [ZTokenDM],
  });

  await campaign.execute();

  await campaign.dbAdapter.finalize();

  return campaign;
};