import * as hre from "hardhat";
import { createDeployCampaign, getLogger } from "@zero-tech/zdc";
import { getZTokenCampaignConfig } from "./config";
import { ZTokenDM } from "../missions/z-token-dm";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IZTokenCampaignConfig, IZTokenContracts } from "./types";


const logger = getLogger();

export const runZTokenCampaign = async ({
  deployAdmin,
  config,
} : {
  deployAdmin ?: SignerWithAddress;
  config ?: IZTokenCampaignConfig;
} = {}) => {
  if (!deployAdmin) {
    [ deployAdmin ] = await hre.ethers.getSigners();
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
    missions: [ ZTokenDM ],
  });

  await campaign.execute();

  await campaign.dbAdapter.finalize();

  return campaign;
};

runZTokenCampaign().catch(error => {
  logger.error(error.stack);
  process.exit(1);
}).finally(() => {
  process.exit(0);
});
