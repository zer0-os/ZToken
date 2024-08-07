// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";


contract MeowToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /*** Inflation Constants ***/
    uint256 public constant INITIAL_SUPPLY_BASE = 10101010101;
    // TODO: remove this constant when done testing!
    uint256 public constant INITIAL_SUPPLY_BASE = 1000000000;

    uint256 public constant BASE_INFLATION_RATE = 900; // 9%
    uint256 public constant INFLATION_RATE_DECAY = 1500; // 15%
    uint256 public constant MIN_INFLATION_RATE = 150; // 1.5%
    uint256 public constant BASIS_POINTS = 10000;

    // TODO: make immutable when done testing! DO we actually need both??
    uint256 public deployTime;

    uint256 public lastMintYear;
    uint256 public lastMintLeftoverTokens;

    uint16[12] public YEARLY_INFLATION_RATES = [
        900,
        765,
        650,
        552,
        469,
        398,
        338,
        287,
        243,
        206,
        175,
        150
    ];

    constructor(address defaultAdmin, address minter) ERC20("MEOW", "MEOW") {
        _mint(msg.sender, INITIAL_SUPPLY_BASE * 10 ** decimals());
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter);
        deployTime = block.timestamp;
    }

    // TODO: inflation formula goes here!
    //  Do we want to specify address each time or use a state var?
    function mint(address to) public onlyRole(MINTER_ROLE) {
        (
            uint256 totalToMint,
            uint256 inflationRate,
            uint256 tokensForYear,
            uint256 currentYearMintableTokens
        ) = getMintableTokensAmount(block.timestamp);
        lastMintLeftoverTokens = tokensForYear - currentYearMintableTokens;
        lastMintYear = yearsSinceDeploy(block.timestamp) + 1;
        _mint(to, totalToMint);
    }

    // TODO: should this function return current year instead to not use +1 everywhere?
    function yearsSinceDeploy(uint256 time) public view returns (uint256) {
        // TODO: figure out overflow here when start using block.timestamp!
        return (time >= deployTime) ? (time - deployTime) / 365 days : 0;
    }

    function currentInflationRate(uint256 yearIndex) public view returns (uint256) {
        if (yearIndex >= YEARLY_INFLATION_RATES.length) {
            return MIN_INFLATION_RATE;
        }
        return YEARLY_INFLATION_RATES[yearIndex];

//        uint256 newInflationRate = lastInflationRate;
//        for (uint256 i = 0; i < yearIndex; i++) {
//            if (newInflationRate > MIN_INFLATION_RATE) {
//                newInflationRate = newInflationRate * (BASIS_POINTS - INFLATION_RATE_DECAY) / BASIS_POINTS;
//                if (newInflationRate < MIN_INFLATION_RATE) {
//                    newInflationRate = MIN_INFLATION_RATE;
//                    break;
//                }
//            } else {
//                newInflationRate = MIN_INFLATION_RATE;
//                break;
//            }
//        }
//
//        return newInflationRate;
    }

    function _tokensPerPeriod(uint256 tokensPerYear, uint256 periodSeconds) internal pure returns (uint256) {
        return tokensPerYear * periodSeconds / 365 days;
    }

//    function getFullYearsElapsed(uint256 time) public view returns (uint256) {
//        // TODO: SLOAD per call here! 2 total!
//        uint256 yearsElapsedSinceDeploy = yearsSinceDeploy(time);
//
//        // TODO: `lastMintYear` - SLOAD twice!
//        uint256 yearsSinceLastMint = yearsElapsedSinceDeploy <= lastMintYear
//            ? 0 : yearsElapsedSinceDeploy - lastMintYear;
//
//        return (
//            yearsElapsedSinceDeploy,
//            yearsSinceLastMint
//        );
//    }

    function getMintableTokensAmount(uint256 currentTime) public view returns (uint256, uint256, uint256, uint256) {
        uint256 yearsFromDeploy = yearsSinceDeploy(currentTime);

        uint256 totalSupply = totalSupply();
        uint256 inflationRate;
        uint256 mintableTokens;
        uint256 yearsTokens;
        // TODO: possibly change for an updated state variable after every year pass!
        uint256 currentYearStart = deployTime + yearsFromDeploy * 365 days;
        // TODO: refactor this later!
        uint256 periodTokens;
        for (uint256 i = lastMintYear; i <= yearsFromDeploy + 1; i++) {
            inflationRate = currentInflationRate(i);
            yearsTokens = totalSupply * inflationRate / BASIS_POINTS;
            totalSupply += yearsTokens;
            if (i != yearsFromDeploy + 1) {
                mintableTokens += yearsTokens;
            } else {
                uint256 incompleteYearSeconds = currentTime - currentYearStart;
                periodTokens = yearsTokens * incompleteYearSeconds / 365 days;
                mintableTokens += periodTokens;
            }
        }

        // TODO: remove extra returns!
        return (
            mintableTokens,
            inflationRate,
            yearsTokens,
            periodTokens
        );
    }

    // TODO: delete this function when done testing!
    function setDeployTime(uint256 newDeployTime) public {
        deployTime = newDeployTime;
    }
}
