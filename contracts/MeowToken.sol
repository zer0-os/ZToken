// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";


contract MeowToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /*** Inflation Constants ***/
    uint256 public constant INITIAL_SUPPLY_BASE = 10101010101;
    uint256 public constant MIN_INFLATION_RATE = 150; // 1.5%
    uint256 public constant BASIS_POINTS = 10000;

    uint256 public immutable deployTime;
    uint256 public lastMintTime;

    // TODO: possibly initialize this from constructor!
    uint16[12] public YEARLY_INFLATION_RATES = [0, 900, 765, 650, 552, 469, 398, 338, 287, 243, 206, 175];

    constructor(address defaultAdmin, address minter) ERC20("MEOW", "MEOW") {
        _mint(msg.sender, baseSupply());
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter);
        deployTime = block.timestamp;
        lastMintTime = block.timestamp;
    }

    function mint(address to) public onlyRole(MINTER_ROLE) {
        uint256 totalToMint = calculateMintableTokens(block.timestamp);
        lastMintTime = block.timestamp;
        _mint(to, totalToMint);
    }

    function yearSinceDeploy(uint256 time) public view returns (uint256) {
        return (time - deployTime) / 365 days + 1;
    }

    function currentInflationRate(uint256 yearIndex) public view returns (uint256) {
        if (yearIndex >= YEARLY_INFLATION_RATES.length) {
            return MIN_INFLATION_RATE;
        }
        return YEARLY_INFLATION_RATES[yearIndex];
    }

    function getTotalYearlyTokens(
        uint256 lastMintYearIdx,
        uint256 currentYearIdx
    ) public view returns (uint256) {
        uint256 mintableTokens;
        for (uint256 i = lastMintYearIdx; i < currentYearIdx; i++) {
            mintableTokens += tokensPerYear(i);
        }

        return mintableTokens;
    }

    function tokensPerYear(uint256 yearIdx) public view returns (uint256) {
        uint256 inflationRate = currentInflationRate(yearIdx);
        return baseSupply() * inflationRate / BASIS_POINTS;
    }

    function baseSupply() public view returns (uint256) {
        return INITIAL_SUPPLY_BASE * 10 ** decimals();
    }

    function calculateMintableTokens(uint256 time) public view returns (uint256) {
        uint256 currentYear = yearSinceDeploy(time);
        uint256 yearOfLastMint = yearSinceDeploy(lastMintTime);

        uint256 yearStartPoint = deployTime + yearOfLastMint * 365 days;
        uint256 lastTime = lastMintTime;

        uint256 lastYearTokens;
        // less than year passed since last mint/deploy
        if (time < yearStartPoint) {
            lastYearTokens = tokensPerYear(yearOfLastMint);
            return _tokensPerPeriod(lastYearTokens, time - lastTime);
        }

        uint256 yearsSinceLastMint = (time - yearStartPoint) / 365 days;
        uint256 newYearPeriodLength = (time - yearStartPoint) % 365 days;

        uint256 mintableTokens;
        if (yearsSinceLastMint > 0) {
            mintableTokens = getTotalYearlyTokens(
                yearOfLastMint + 1,
                currentYear
            );
        }

        lastYearTokens = tokensPerYear(yearOfLastMint);
        mintableTokens += _tokensPerPeriod(lastYearTokens, yearStartPoint - lastTime);

        uint256 newYearTokens = tokensPerYear(currentYear);
        mintableTokens += _tokensPerPeriod(newYearTokens, newYearPeriodLength);

        return mintableTokens;
    }

    function _tokensPerPeriod(uint256 tokensPerYear, uint256 periodSeconds) internal pure returns (uint256) {
        return tokensPerYear * periodSeconds / 365 days;
    }
}
