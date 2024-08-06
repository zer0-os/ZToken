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
    uint256 public constant BASE_MULTI = 10 ** 18;

    // TODO: make immutable when done testing!
    uint256 public deployTime;
    uint256 public lastMintTime;

    uint256 public lastInflationRate = BASE_INFLATION_RATE;

    constructor(address defaultAdmin, address minter) ERC20("MEOW", "MEOW") {
        _mint(msg.sender, INITIAL_SUPPLY_BASE * 10 ** decimals());
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter);
        deployTime = block.timestamp;
        lastMintTime = deployTime;
    }

    // TODO: inflation formula goes here!
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

//    function calcInflation() public view returns (uint256) {
//        uint256 timePassed = block.timestamp - deployTime;
//        uint256 yearsPassed = timePassed / 1 years;
//        uint256 exponent = BASE_MULTI / 365 days;
//
//        uint256 inflation = BASE_INFLATION_RATE * (
//            ((BASIS_POINTS - INFLATION_RATE_DECAY) ** exponent)
//        ) ** timePassed;
//
//        if (inflation < MIN_INFLATION_RATE) {
//            return MIN_INFLATION_RATE;
//        }
//
//        return inflation;
//    }

    function yearsSinceDeploy(uint256 currentTime) public view returns (uint256) {
        // TODO: figure out overflow here when start using block.timestamp!
        return (currentTime >= deployTime) ? (currentTime - deployTime) / 365 days : 0;
    }

    function currentInflationRate(uint256 yearIndex) public view returns (uint256) {
        uint256 newInflationRate = lastInflationRate;
        for (uint256 i = 0; i < yearIndex; i++) {
            if (newInflationRate > MIN_INFLATION_RATE) {
                newInflationRate = newInflationRate * (BASIS_POINTS - INFLATION_RATE_DECAY) / BASIS_POINTS;
                if (newInflationRate < MIN_INFLATION_RATE) {
                    newInflationRate = MIN_INFLATION_RATE;
                    break;
                }
            } else {
                newInflationRate = MIN_INFLATION_RATE;
                break;
            }
        }

        return newInflationRate;
    }

    function tokens(uint256 currentTime) public view returns (uint256, uint256, uint256, uint256, uint256) {
        // TODO: should this be years since last mint instead of deploy?
        uint256 yearsElapsed = yearsSinceDeploy(currentTime);
        // TODO: change to dynamic totalSupply!
        uint256 totalSupply = INITIAL_SUPPLY_BASE * 10 ** decimals();
        uint256 inflationRate = lastInflationRate;

        uint256 tokensAccumulated;
        uint256 yearsTokens = totalSupply;
        // TODO: possibly change for an updated state variable after every year pass!
        //  Figure out when to add 1 to yearsElapsed !
        // TODO: should there be a +1 to the year start?
        uint256 currentYearStart = deployTime + yearsElapsed * 365 days;
        // TODO: refactor this later!
        uint256 periodTokens;
        for (uint256 i = 0; i <= yearsElapsed; i++) {
            inflationRate = currentInflationRate(i);
            yearsTokens = totalSupply * inflationRate / BASIS_POINTS;
            totalSupply += yearsTokens;
            if (i != yearsElapsed) {
                tokensAccumulated += yearsTokens;
            } else {
                uint256 incompleteYearSeconds = currentTime - currentYearStart;
                periodTokens = yearsTokens * incompleteYearSeconds / 365 days;
                tokensAccumulated += periodTokens;
            }
        }

        return (
            tokensAccumulated,
            currentTime - currentYearStart,
            yearsTokens,
            periodTokens,
            inflationRate
        );
    }

    function calculateMintableTokens(uint256 currentTime) public view returns (uint256, uint256) {
        uint256 yearsPassed = yearsSinceDeploy(currentTime);
        uint256 currentYearStart = deployTime + yearsPassed * 365 days;

        uint256 totalSupply = INITIAL_SUPPLY_BASE * 10 ** decimals();
        uint256 yearlyInflationRate;
        for (uint256 i = 0; i < yearsPassed; i++) {
            uint256 yearStart = deployTime + (i * 365 days);
            uint256 yearlyInflationRate = currentInflationRate(yearStart);
            totalSupply += totalSupply * yearlyInflationRate / BASIS_POINTS;
        }

        yearlyInflationRate = currentInflationRate(currentYearStart);
        uint256 totalMintableForYear = totalSupply * yearlyInflationRate / BASIS_POINTS;

        // Calculate the proportion of the year elapsed
        uint256 timeElapsedInYear = currentTime - currentYearStart;
        uint256 proportionOfYearElapsed = timeElapsedInYear * BASIS_POINTS / 365 days;

        // Calculate mintable tokens based on the proportion of the year elapsed
        uint256 tokensTotal = totalMintableForYear * proportionOfYearElapsed / BASIS_POINTS;
        return (tokensTotal, yearsPassed);
    }

    // TODO: delete this function when done testing!
    function setDeployTime(uint256 newDeployTime) public {
        deployTime = newDeployTime;
    }

    function mintableTokens(uint256 currentTime) public view returns (uint256, uint256, uint256, uint256) {
        uint256 totalMintable = 0;
        // TODO: uncomment this and remove the param when done testing!
//        uint256 currentTime = block.timestamp;
        uint256 time = deployTime;

        uint256 yearlyMintableTokens;
        uint256 periodMintableTokens;
        while (time < currentTime) {
            uint256 yearsElapsed = yearsSinceDeploy(currentTime);
            uint256 inflationRate = currentInflationRate(currentTime);
            uint256 yearStart = deployTime + yearsElapsed * 365 days;
            uint256 yearEnd = yearStart + 65 days;
            uint256 secondsInPeriod;

            if (currentTime < yearEnd) {
                secondsInPeriod = currentTime - time;
                time = currentTime;
            } else {
                secondsInPeriod = yearEnd - time;
                time = yearEnd;
            }

            yearlyMintableTokens = (totalSupply() * inflationRate) / BASIS_POINTS;
            periodMintableTokens = (yearlyMintableTokens * secondsInPeriod) / 365 days;
            totalMintable += periodMintableTokens;
        }

        return (
            totalMintable,
            yearlyMintableTokens,
            periodMintableTokens,
            (currentTime - lastMintTime) * BASIS_POINTS / 365 days
        );
    }

    // write a function that calculates how many tokens can be minted based on the following rules:
    // 1. 9% inflation rate per year that decreases by 15% every year until it hits overall 1.5% inflation rate
    // 2. it should be dynamic, meaning the minter can mint at any time and the inflation rate should be calculated based on the current block timestamp
    // 3. if minter is minting half way though a year, then he should be able to only mint half the amount
    // 4. the function should return the amount of tokens that can be minted
    // function code goes below

    function getInflation(uint256 currentTime) public view returns (uint256, uint256, uint256) {
        uint256 tokenForMaxInflation = INITIAL_SUPPLY_BASE * 10 ** decimals() * BASE_INFLATION_RATE / BASIS_POINTS;
        uint256 inflationDecreasePerSec = BASE_INFLATION_RATE * INFLATION_RATE_DECAY * 1e18 / 365 days;
        uint256 timePassed = currentTime - deployTime;

        uint256 decreasePerPeriod = inflationDecreasePerSec * timePassed;

        uint256 currentTempRate = BASE_INFLATION_RATE * 1e18 - decreasePerPeriod;

        uint256 finalRate;
        if (currentTempRate < MIN_INFLATION_RATE * 1e18) {
            finalRate = MIN_INFLATION_RATE * 1e18;
        } else {
            finalRate = currentTempRate;
        }

        uint256 mintableTokens = INITIAL_SUPPLY_BASE * 10 ** decimals() * finalRate / (BASIS_POINTS * 1e18);

        return (
            mintableTokens,
            finalRate,
            decreasePerPeriod
        );
    }
}
