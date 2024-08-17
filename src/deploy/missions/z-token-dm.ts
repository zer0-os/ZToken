import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { zTokenNames } from "./constants";


export class ZTokenDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZTokenConfig,
IZTokenContracts
> {
  proxyData = {
    isProxy: false,
  };

  contractName = zTokenNames.zToken.contract;
  instanceName = zTokenNames.zToken.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const {
      zTokenName,
      zTokenSymbol,
      tokenAdminAddress,
      minterAddress,
      mintBeneficiaryAddress,
      annualInflationRates,
      finalInflationRate,
    } = this.campaign.config;

    return [
      zTokenName,
      zTokenSymbol,
      tokenAdminAddress,
      minterAddress,
      mintBeneficiaryAddress,
      annualInflationRates,
      finalInflationRate,
    ];
  }
}
