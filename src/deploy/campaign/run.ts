import * as hre from "hardhat";
import { createDeployCampaign } from "@zero-tech/zdc";
import { getZTokenCampaignConfig } from "./config";
import { ZTokenDM } from "../missions/z-token-dm";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


const runCampaign = async () => {
  const config = await getZTokenCampaignConfig({});

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
};
