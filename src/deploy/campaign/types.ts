import { IContractState, IDeployCampaignConfig } from "@zero-tech/zdc";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ZToken } from "../../../typechain";


export interface IZTokenCampaignConfig extends IDeployCampaignConfig<SignerWithAddress> {
  zTokenName : string;
  zTokenSymbol : string;
  tokenAdminAddress : string;
  minterAddress : string;
  mintBeneficiaryAddress : string;
  initialAdminDelay : bigint;
  initialTotalSupply : bigint;
  annualInflationRates : Array<bigint>;
  finalInflationRate : bigint;
}

export type ZTokenContract = ZToken;

export interface IZTokenContracts extends IContractState<ZTokenContract> {
  zToken : ZToken;
}
