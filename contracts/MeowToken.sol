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

    /*** Constants ***/
    uint256 public constant INITIAL_SUPPLY_BASE = 10101010101;
    uint256 public constant BASIS_POINTS = 10000;

    /*** Inflation Immutable Vars ***/
    /**
     * @notice Array of yearly inflation rates in basis points. Only set once during deployment.
     * @dev Since Solidity still doesn't support immutable state arrays, this is a state var with no setters,
     * and is set only once in the constructor, so it can be considered immutable.
     * We use capitalized snake case to signify that.
     */
    uint16[] public override YEARLY_INFLATION_RATES;
    /**
     * @notice The final inflation rate after all the yearly rates have been applied.
     * @dev This is the last inflation rate after all the yearly rates have been applied.
     * It is returned when `yearIndex` goes past the length of the `YEARLY_INFLATION_RATES` array
     * and the inflation plateaus at this rate forever once reached.
     */
    uint16 public immutable override FINAL_INFLATION_RATE;

    /*** Time Vars ***/
    /**
     * @notice Timestamp of contract deployment. Immutable.
     */
    uint256 public immutable override deployTime;
    /**
     * @notice Timestamp of the last mint operation. Updated on every mint.
     */
    uint256 public override lastMintTime;

    /*
     * @notice Address that will receive all the minted tokens. Can be updated by the ADMIN_ROLE.
     */
    address public override mintBeneficiary;

    // TODO: add name and symbol as constructor arguments
    /**
     * @dev Please note the param comments!
     * @param _defaultAdmin is the address that will be granted the DEFAULT_ADMIN_ROLE
     * @param _minter is the address that will be granted the MINTER_ROLE
     * @param _mintBeneficiary is the address that will receive all the minted tokens, it's state var can be reset later
     * @param _inflationRates array can NOT be empty, and the first element must be 0! Need to be passed as
     *  basis points (where 100% is 10,000), so 1% is 100, 2% is 200, etc.
     * @param _finalInflationRate is the last inflation rate after all the yearly rates have been applied.
     *  It is returned when `yearIndex` goes past the length of the `YEARLY_INFLATION_RATES` array
     *  and the inflation plateaus at this rate forever once reached. Also passed as basis points.
     */
    constructor(
        address _defaultAdmin,
        address _minter,
        address _mintBeneficiary,
        uint16[] memory _inflationRates,
        uint16 _finalInflationRate
    ) ERC20("MEOW", "MEOW") {
        if (
            _defaultAdmin == address(0)
            || _minter == address(0)
            || _mintBeneficiary == address(0)
        ) revert ZeroAddressPassed();

        if (_inflationRates.length == 0 || _inflationRates[0] != 0)
            revert InvalidInflationRatesArray(_inflationRates);

        _mint(_mintBeneficiary, baseSupply());
        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);
        _grantRole(MINTER_ROLE, _minter);

        mintBeneficiary = _mintBeneficiary;
        YEARLY_INFLATION_RATES = _inflationRates;
        FINAL_INFLATION_RATE = _finalInflationRate;

        deployTime = block.timestamp;
        lastMintTime = block.timestamp;
    }

    function mint() public override onlyRole(MINTER_ROLE) {
        uint256 totalToMint = calculateMintableTokens(block.timestamp);
        lastMintTime = block.timestamp;
        _mint(mintBeneficiary, totalToMint);
    }

    function yearSinceDeploy(uint256 time) public view override returns (uint256) {
        if (time < deployTime) {
            revert InvalidTimeSupplied(deployTime, time);
        }

        return (time - deployTime) / 365 days + 1;
    }

    function currentInflationRate(uint256 yearIndex) public view override returns (uint256) {
        if (yearIndex >= YEARLY_INFLATION_RATES.length) {
            return FINAL_INFLATION_RATE;
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

        if (time < lastTime) {
            revert InvalidTimeSupplied(lastTime, time);
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

    function _tokensPerPeriod(uint256 yearlyTokens, uint256 periodSeconds) internal pure returns (uint256) {
        return yearlyTokens * periodSeconds / 365 days;
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
