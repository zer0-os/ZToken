// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IDynamicToken } from "./IDynamicToken.sol";


/**
 * @title DynamicToken
 *
 * @notice An abstract token contract that allows for inflation of the token supply based on supplied rate schedule.
 * Rate is supplied as an array of yearly rates in basis points that start from 0 and proceed to include a percentage
 * per year where index equals the year number since deployment. To calculate mintable tokens, the contract uses
 * a fixed number `baseSupply` as the base for the inflation calculations. The contract also has `FINAL_INFLATION_RATE`
 * that is applied after all the years in `YEARLY_INFLATION_RATES` have passed.
 *
 * Tokens can be minted at any time during the year, and all the previously unminted tokens will be included
 * in the final mint amount. The amount of tokens to mint can NOT be specified. The amount always includes
 * all the tokens that have not been minted since the last mint operation based on their yearly rates and time passed.
 *
 * This token also has a burn mechanism that allows the contract to automatically burn tokens sent to it.
 * @author Kirill Korchagin <https://github.com/Whytecrowe>, Michael Korchagin <https://github.com/MichaelKorchagin>
 */
abstract contract DynamicToken is ERC20, IDynamicToken {
    /**
     * @notice The initial supply of the token at the time of deployment. This value is also used
     * in the inflation calculations during minting.
     */
    uint256 public immutable INITIAL_SUPPLY_BASE;
    /**
     * @notice Representation of 100% value in basis points for percentage based calculations.
     */
    uint256 public constant BASIS_POINTS = 10000;

    /**
     * @notice Array of yearly inflation rates in basis points. Only set once during deployment.
     *
     * @dev Since Solidity still doesn't support immutable state arrays, this is a state var with no setters,
     * and is set only once in the constructor, so it can be considered immutable.
     * We use capitalized snake case to signify that.
     */
    // solhint-disable-next-line var-name-mixedcase
    uint16[] public ANNUAL_INFLATION_RATES;
    /**
     * @notice The final inflation rate after all the yearly rates have been applied.
     *
     * @dev This is the last inflation rate after all the yearly rates have been applied.
     * It is returned when `yearIndex` goes past the length of the `YEARLY_INFLATION_RATES` array
     * and the inflation plateaus at this rate forever once reached.
     *
     * Please note that this rate will never increase the amount of minted tokens annually, since
     * a fixed value of `baseSupply()/INITIAL_SUPPLY_BASE` is used to calculate mintable tokens.
     */
    uint16 public immutable FINAL_INFLATION_RATE;

    /**
     * @notice Timestamp of contract deployment. Immutable.
     */
    uint256 public immutable DEPLOY_TIME;
    /**
     * @notice Timestamp of the last mint operation. Updated on every mint.
     */
    uint256 public lastMintTime;

    constructor(
        string memory name,
        string memory symbol,
        uint256 _initialSupplyBase, // without the decimal part!
        uint16[] memory _annualInflationRates, // first element should be 0!
        uint16 _finalInflationRate
    ) ERC20(name, symbol) {
        if (_annualInflationRates.length == 0 || _annualInflationRates[0] != 0) {
            revert InvalidInflationRatesArray(_annualInflationRates);
        }

        if (_initialSupplyBase == 0)
            revert NoInitialSupplyProvided();

        INITIAL_SUPPLY_BASE = _initialSupplyBase;
        ANNUAL_INFLATION_RATES = _annualInflationRates;
        FINAL_INFLATION_RATE = _finalInflationRate;

        DEPLOY_TIME = block.timestamp;
        lastMintTime = block.timestamp;
    }

    /**
     * @notice Returns the initial token supply at deploy time that is used in the mintable tokens calculations,
     * since it's based on an unchanging value for every year.
     *
     *  This also represents the initial supply of the token at the time of deployment
     *  apart from the `totalSupply` which is the accumulated total supply at the time of the query.
     *  The value returned from this function DOES NOT include tokens minted on inflation schedule after deploy!
     */
    function baseSupply() public view override returns (uint256) {
        return INITIAL_SUPPLY_BASE * 10 ** decimals();
    }

    /**
     * @notice Calculates the amount of tokens that can be minted at the current time.
     *
     * @param time The current time to calculate mintable tokens for. `block.timestamp` is passed here when minting.
     */
    function calculateMintableTokens(uint256 time) public view returns (uint256) {
        uint256 lastTime = lastMintTime;

        if (time < lastTime) {
            revert InvalidTimeSupplied(lastTime, time);
        }

        uint256 currentYear = yearSinceDeploy(time);
        uint256 yearOfLastMint = yearSinceDeploy(lastTime);

        uint256 yearStartPoint = DEPLOY_TIME + yearOfLastMint * 365 days;

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

    /**
     * @notice Returns the year number since deployment based on the supplied time.
     *
     * @param time The timestamp to calculate the year number for.
     */
    function yearSinceDeploy(uint256 time) public view returns (uint256) {
        if (time < DEPLOY_TIME) {
            revert InvalidTimeSupplied(DEPLOY_TIME, time);
        }

        return (time - DEPLOY_TIME) / 365 days + 1;
    }

    /**
     * @notice Returns the current inflation rate for the specified year index.
     *
     * @param yearIndex The index of the year to get the inflation rate for.
     */
    function currentInflationRate(uint256 yearIndex) public view returns (uint256) {
        if (yearIndex >= ANNUAL_INFLATION_RATES.length) {
            return FINAL_INFLATION_RATE;
        }
        return ANNUAL_INFLATION_RATES[yearIndex];
    }

    /**
     * @notice Returns the total amount of tokens that can be minted in the specified year based on it's inflation rate.
     *
     * @param yearIdx The index of the year to get the mintable tokens for.
     */
    function tokensPerYear(uint256 yearIdx) public view returns (uint256) {
        uint256 inflationRate = currentInflationRate(yearIdx);
        return baseSupply() * inflationRate / BASIS_POINTS;
    }

    /**
     * @notice Returns the total amount of tokens that can be minted for several years based on their inflation rates.
     *
     * @param lastMintYearIdx The index of the year of the last mint operation or year to start calculating from.
     * @param currentYearIdx The index of the current year or year to stop calculating at.
     */
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

    /**
     * @notice The amount of tokens that can be minted for a period in a specific year based on it's inflation rate.
     *
     * @param yearlyTokens The total amount of tokens that can be minted in a year.
     * @param periodSeconds The length of the period in seconds to calculate the tokens for.
     */
    function _tokensPerPeriod(uint256 yearlyTokens, uint256 periodSeconds) internal pure returns (uint256) {
        return yearlyTokens * periodSeconds / 365 days;
    }

    /**
     * @notice Mints the total amount of tokens that can be minted at the current time to the specified address
     *  and updates the last mint time to the current time.
     *
     * @param to The address to send the minted tokens to.
     */
    function _mintDynamic(address to) internal {
        uint256 totalToMint = calculateMintableTokens(block.timestamp);
        lastMintTime = block.timestamp;
        _mint(to, totalToMint);
    }

    /**
     * @dev Overriden ERC20 function that will burn the amount of tokens transferred to this address.
     *
     * This function will emit 2 Transfer events to signify both operations that happened:
     * 1. Transfer from the sender to this contract address.
     * 2. Transfer from this contract address to the zero address to signify the burn.
     */
    function _update(address from, address to, uint256 value) internal override {
        if (to == address(this)) {
            emit Transfer(from, to, value);
            return super._update(from, address(0), value);
        }

        return super._update(from, to, value);
    }
}
