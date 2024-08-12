// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IInflationaryToken } from "./IInflationaryToken.sol";


interface IMeowToken is IInflationaryToken {
    error ZeroAddressPassed();

    event MintBeneficiaryUpdated(address indexed newBeneficiary);

    function mint() external;

    function baseSupply() external view returns (uint256);

    function setMintBeneficiary(address newBeneficiary) external;

    function mintBeneficiary() external view returns (address);
}
