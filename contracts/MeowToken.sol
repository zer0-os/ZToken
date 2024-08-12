// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IMeowToken } from "./IMeowToken.sol";


// TODO:
//  1. possibly split into multiple contracts and inherit
//  3. pass name and symbol as constructor arguments
//  4. consider passing inflation rates as arguments to the constructor
contract MeowToken is ERC20, AccessControl, IMeowToken {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /*** Inflation Constants ***/
    uint256 public constant INITIAL_SUPPLY_BASE = 10101010101;
    uint256 public constant MIN_INFLATION_RATE = 150; // 1.5%
    uint256 public constant BASIS_POINTS = 10000;

    uint256 public immutable deployTime;
    uint256 public lastMintTime;

    // TODO: is this a good name?
    address public mintBeneficiary;

    // TODO: possibly initialize this from constructor!
    uint16[12] public YEARLY_INFLATION_RATES = [0, 900, 765, 650, 552, 469, 398, 338, 287, 243, 206, 175];

    // TODO: add name and symbol as constructor arguments
    constructor(
        address _defaultAdmin,
        address _minter,
        address _mintBeneficiary
    ) ERC20("MEOW", "MEOW") {
        if (
            _mintBeneficiary == address(0)
            || _defaultAdmin == address(0)
            || _minter == address(0)
        ) revert ZeroAddressPassed();

        _mint(_mintBeneficiary, baseSupply());
        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);
        _grantRole(MINTER_ROLE, _minter);

        mintBeneficiary = _mintBeneficiary;

        deployTime = block.timestamp;
        lastMintTime = block.timestamp;
    }

    function mint() public override onlyRole(MINTER_ROLE) {
        uint256 totalToMint = calculateMintableTokens(block.timestamp);
        lastMintTime = block.timestamp;
        _mint(mintBeneficiary, totalToMint);
    }

    function yearSinceDeploy(uint256 time) public view override returns (uint256) {
        return (time - deployTime) / 365 days + 1;
    }

    function currentInflationRate(uint256 yearIndex) public view override returns (uint256) {
        if (yearIndex >= YEARLY_INFLATION_RATES.length) {
            return MIN_INFLATION_RATE;
        }
        return YEARLY_INFLATION_RATES[yearIndex];
    }

    function tokensPerYear(uint256 yearIdx) public view override returns (uint256) {
        uint256 inflationRate = currentInflationRate(yearIdx);
        return baseSupply() * inflationRate / BASIS_POINTS;
    }

    function baseSupply() public view override returns (uint256) {
        return INITIAL_SUPPLY_BASE * 10 ** decimals();
    }

    function calculateMintableTokens(uint256 time) public view override returns (uint256) {
        uint256 lastTime = lastMintTime;

        if (time <= lastTime) {
            revert InvalidTime(lastTime, time);
        }

        uint256 currentYear = yearSinceDeploy(time);
        uint256 yearOfLastMint = yearSinceDeploy(lastTime);

        uint256 yearStartPoint = deployTime + yearOfLastMint * 365 days;

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
            mintableTokens = _getTotalYearlyTokens(
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

    function setMintBeneficiary(address _mintBeneficiary) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_mintBeneficiary == address(0)) revert ZeroAddressPassed();
        mintBeneficiary = _mintBeneficiary;
        emit MintBeneficiaryUpdated(_mintBeneficiary);
    }

    function _getTotalYearlyTokens(
        uint256 lastMintYearIdx,
        uint256 currentYearIdx
    ) internal view returns (uint256) {
        uint256 mintableTokens;
        for (uint256 i = lastMintYearIdx; i < currentYearIdx; i++) {
            mintableTokens += tokensPerYear(i);
        }

        return mintableTokens;
    }

    function _tokensPerPeriod(uint256 tokensPerYear, uint256 periodSeconds) internal pure returns (uint256) {
        return tokensPerYear * periodSeconds / 365 days;
    }

    /**
     * @dev Burn from totalSupply when sent to this contract.
     */
    function _update(address from, address to, uint256 value) internal override {
        if (to == address(this)) {
            return super._update(from, address(0), value);
        }

        return super._update(from, to, value);
    }
}
