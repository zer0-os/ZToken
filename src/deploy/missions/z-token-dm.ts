import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { zTokenNames } from "./constants";
import { IZTokenCampaignConfig, IZTokenContracts } from "../campaign/types";


export class ZTokenDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZTokenCampaignConfig,
IZTokenContracts
> {
  proxyData = {
    isProxy: false,
  };

  contractName = zTokenNames.zToken.contract;
  instanceName = zTokenNames.zToken.instance;

  get dbName () : string {
    return this.campaign.config.zTokenSymbol;
  }

  async deployArgs () : Promise<TDeployArgs> {
    const {
      zTokenName,
      zTokenSymbol,
      tokenAdminAddress,
      minterAddress,
      mintBeneficiaryAddress,
      initialTotalSupply,
      annualInflationRates,
      finalInflationRate,
    } = this.campaign.config;

    return [
      zTokenName,
      zTokenSymbol,
      tokenAdminAddress,
      minterAddress,
      mintBeneficiaryAddress,
      initialTotalSupply,
      annualInflationRates,
      finalInflationRate,
    ];
  }
}
