// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


interface IDynamicToken is IERC20 {
    error InvalidTimeSupplied(uint256 lastMintTime, uint256 currentTime);
    error InvalidInflationRatesArray(uint16[] ratesPassed);
    error NoInitialSupplyProvided();

    function baseSupply() external view returns (uint256);

    function calculateMintableTokens(uint256 currentTime) external view returns (uint256);

    function lastMintTime() external view returns (uint256);

    // solhint-disable-next-line func-name-mixedcase
    function DEPLOY_TIME() external view returns (uint256);

    function yearSinceDeploy(uint256 time) external view returns (uint256);

    // solhint-disable-next-line func-name-mixedcase
    function ANNUAL_INFLATION_RATES(uint256 index) external view returns (uint16);

    // solhint-disable-next-line func-name-mixedcase
    function FINAL_INFLATION_RATE() external view returns (uint16);

    function currentInflationRate(uint256 yearIndex) external view returns (uint256);

    function tokensPerYear(uint256 yearIndex) external view returns (uint256);
}
