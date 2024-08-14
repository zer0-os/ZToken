// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IDynamicToken } from "./IDynamicToken.sol";


interface IZToken is IDynamicToken {
    error ZeroAddressPassed();

    event MintBeneficiaryUpdated(address indexed newBeneficiary);

    function mint() external;

    function setMintBeneficiary(address newBeneficiary) external;

    function mintBeneficiary() external view returns (address);
}
