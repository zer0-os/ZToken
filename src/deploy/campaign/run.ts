import * as hre from "hardhat";
import { createDeployCampaign, getLogger } from "@zero-tech/zdc";
import { getZTokenCampaignConfig } from "./config";
import { ZTokenDM } from "../missions/z-token-dm";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

const logger = getLogger();

const runCampaign = async () => {
  const config = await getZTokenCampaignConfig();

  const campaign = await createDeployCampaign<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IZTokenCampaignConfig,
  IZTokenContracts
  >({
    hre,
    config,
    missions: [
      ZTokenDM,
    ],
  });

  await campaign.execute();

  return campaign;
};

runCampaign().catch(error => {
  logger.error(error.stack);
  process.exit(1);
}).finally(() => {
  process.exit(0);
});
