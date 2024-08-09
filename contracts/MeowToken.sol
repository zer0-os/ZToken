// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";


contract MeowToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /*** Inflation Constants ***/
//    uint256 public constant INITIAL_SUPPLY_BASE = 10101010101;
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
    uint256 public lastMintTime;
    uint256 public mintedLastYear;

    uint16[13] public YEARLY_INFLATION_RATES = [
        0,
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
        _mint(msg.sender, initialSupply());
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter);
        deployTime = block.timestamp;
    }

    // TODO: inflation formula goes here!
    //  Do we want to specify address each time or use a state var?
//    function mint(address to) public onlyRole(MINTER_ROLE) {
//        (
//            uint256 totalToMint,
//            uint256 inflationRate,
//            uint256 tokensForYear,
//            uint256 currentYearMintableTokens
//        ) = getMintableTokensAmount(block.timestamp);
//        lastMintLeftoverTokens = tokensForYear - currentYearMintableTokens;
//        lastMintYear = yearsSinceDeploy(block.timestamp);
//        _mint(to, totalToMint);
//    }

    function mint(address to) public onlyRole(MINTER_ROLE) {
        uint256 totalToMint = simpleGetTokens(block.timestamp);
        lastMintTime = block.timestamp;
        // TODO: this shows total tokens for the whole time and needs to just show current year minted!
        mintedLastYear = totalToMint;
        _mint(to, totalToMint);
    }

    // TODO: should this function return current year instead to not use +1 everywhere?
    function yearSinceDeploy(uint256 time) public view returns (uint256) {
        if (time == 0) return 1;

        if (time < deployTime) {
            // TODO: improve error here!
            revert("Impossible case!");
        }

        return (time - deployTime) / 365 days + 1;
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
        uint256 yearsFromDeploy = yearSinceDeploy(currentTime);

        uint256 inflationRate;
        uint256 mintableTokens = lastMintLeftoverTokens;
        uint256 totalSupply = totalSupply() + mintableTokens;
        uint256 yearsTokens;
        // TODO: possibly change for an updated state variable after every year pass!
        uint256 currentYearStart = deployTime + yearsFromDeploy * 365 days;
        uint256 incompleteYearSeconds = currentTime - currentYearStart;
        // TODO: refactor this later!
        uint256 periodTokens;

        uint256 lastYear = lastMintLeftoverTokens == 0 ? lastMintYear : lastMintYear + 1;
        for (uint256 i = lastYear; i <= yearsFromDeploy; i++) {
            inflationRate = currentInflationRate(i);
            if (lastMintYear == yearsFromDeploy && mintableTokens > 0) {
                break;
            }

            yearsTokens = totalSupply * inflationRate / BASIS_POINTS;

            if (i != yearsFromDeploy) {
                totalSupply += yearsTokens;
                mintableTokens += yearsTokens;
            } else {
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

    function getTotalYearlyTokens(
        uint256 lastMintYearIdx,
        uint256 currentYearIdx,
        uint256 totalSupply
    ) public view returns (uint256) {
        uint256 inflationRate;
        uint256 mintableTokens;
        uint256 perYear;
        for (uint256 i = lastMintYearIdx; i < currentYearIdx; i++) {
            perYear = tokensPerYear(i, totalSupply);
            mintableTokens += perYear;
            totalSupply += perYear;
        }

        return mintableTokens;
    }

    function tokensPerYear(uint256 yearIdx, uint256 totalSupply) public view returns (uint256) {
        uint256 inflationRate = currentInflationRate(yearIdx);
        return totalSupply * inflationRate / BASIS_POINTS;
    }

    function _tokensPerPeriod(uint256 tokensPerYear, uint256 periodSeconds) internal pure returns (uint256) {
        return tokensPerYear * periodSeconds / 365 days;
    }

    function getTimeData(uint256 time) public view returns (uint256) {
        uint256 lastMintYearLocal = lastMintTime == 0 ? 0 : yearSinceDeploy(lastMintTime);
        // TODO: fix formula!
        uint256 lastMintYearEnd = lastMintYearLocal == 0 ? deployTime : deployTime + lastMintYearLocal * 365 days - 1;
        uint256 yearsSinceLastMint = time < lastMintYearEnd ? 0 : (time - lastMintYearEnd) / 365 days;
        uint256 newYearPeriodLength = time < lastMintYearEnd ? 0 : (time - lastMintYearEnd) % 365 days;

        uint256 periodTokens;
        uint256 yearTokens;
        uint256 mintableTokens;

        if (time == lastMintYearEnd) {
            yearTokens = tokensPerYear(
                lastMintYearLocal,
                totalSupply() - mintedLastYear
            );
            periodTokens = _tokensPerPeriod(yearTokens, lastMintYearEnd - lastMintTime);
            mintableTokens = periodTokens;
        } else if (time < lastMintYearEnd) {
            yearTokens = tokensPerYear(
                lastMintYearLocal,
            // TODO: can this be better?
                totalSupply() - mintedLastYear
            );
            // calc percentage of seconds
            periodTokens = _tokensPerPeriod(yearTokens, time - lastMintTime);
            mintableTokens = periodTokens;
        } else {
            yearTokens = tokensPerYear(
                lastMintYearLocal,
                totalSupply() - mintedLastYear
            );
            periodTokens = _tokensPerPeriod(yearTokens, lastMintYearEnd - lastMintTime);

            if (yearsSinceLastMint > 0) {
                uint256 yearSinceDeploy = yearSinceDeploy(time);
                uint256 totalYearly = getTotalYearlyTokens(
                    lastMintYearLocal + 1,
                    yearSinceDeploy,
                    totalSupply() + periodTokens
                );
                uint256 tokensPerYear = tokensPerYear(
                    yearSinceDeploy,
                    totalSupply() + periodTokens + totalYearly
                );
                periodTokens += _tokensPerPeriod(
                    tokensPerYear,
                    newYearPeriodLength
                );
                mintableTokens = totalYearly + periodTokens;
            } else {
                uint256 lastYearTokens = tokensPerYear(
                    lastMintYearLocal + 1,
                    totalSupply() + periodTokens
                );
                periodTokens += _tokensPerPeriod(lastYearTokens, newYearPeriodLength);
                mintableTokens = periodTokens;
            }
        }

        return mintableTokens;
    }

//    function getTokens(uint256 time) public view returns (uint256) {
//        uint256 lastMintYearLocal = yearSinceDeploy(lastMintTime);
//
//        uint256 lastMintYearly = tokensPerYear(
//            lastMintYearLocal,
//            totalSupply() - mintedLastYear
//        );
//
//        return 0;
//    }

    function initialSupply() public view returns (uint256) {
        return INITIAL_SUPPLY_BASE * 10 ** decimals();
    }

    event Test(
        string place,
        uint256 one,
        uint256 two,
        uint256 three,
        uint256 four
    );

    // 1. Only INITIAL SUPPLY is used for all years
    function simpleGetTokens(uint256 time) public returns (uint256) {
        uint256 currentYear = yearSinceDeploy(time);
//        uint256 currentYearStart = deployTime + currentYear * 365 days;
//        uint256 currentYearEnd = deployTime + (currentYear + 1) * 365 days - 1;

        uint256 yearOfLastMint = yearSinceDeploy(lastMintTime);
        uint256 yearStartPoint = lastMintTime == 0 ? deployTime + 365 days : deployTime + yearOfLastMint * 365 days;

        uint256 mintableTokens;
        uint256 yearTokens;
        uint256 mintedCurrentYear;
        uint256 lastTime = lastMintTime == 0 ? deployTime : lastMintTime;

        if (time < yearStartPoint) {
            yearTokens = tokensPerYear(
                yearOfLastMint,
                initialSupply()
            );
            mintableTokens = _tokensPerPeriod(yearTokens, time - lastTime);
        } else {
            uint256 yearsSinceLastMint = (time - yearStartPoint) / 365 days;
            uint256 newYearPeriodLength = (time - yearStartPoint) % 365 days;

            yearTokens = tokensPerYear(
                yearOfLastMint,
                initialSupply()
            );
            mintableTokens = _tokensPerPeriod(yearTokens, yearStartPoint - lastTime);

            if (yearsSinceLastMint > 0) {
                mintableTokens += getTotalYearlyTokens(
                    yearOfLastMint + 1,
                    currentYear,
                    initialSupply()
                );
                yearTokens = tokensPerYear(
                    currentYear,
                    initialSupply()
                );
                mintableTokens += _tokensPerPeriod(yearTokens, newYearPeriodLength);
            } else {
                yearTokens = tokensPerYear(
                    currentYear,
                    initialSupply()
                );
                mintableTokens += _tokensPerPeriod(yearTokens, newYearPeriodLength);
            }
        }

        return mintableTokens;
    }

    // TODO: delete this function when done testing!
    function setDeployTime(uint256 newDeployTime) public {
        deployTime = newDeployTime;
    }
}
