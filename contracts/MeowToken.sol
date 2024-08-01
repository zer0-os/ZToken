// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";


contract MeowToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /*** Inflation Constants ***/
    uint256 public constant INITIAL_SUPPLY_BASE = 10101010101;
    uint256 public constant BASE_INFLATION_RATE = 900; // 9%
    uint256 public constant INFLATION_RATE_DECAY = 1500; // 15%
    uint256 public constant MIN_INFLATION_RATE = 150; // 1.5%
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant BASE_MULTI = 10 ** 18;

    uint256 public immutable deployTime;

    uint256 public currentInflationRate = BASE_INFLATION_RATE;

    constructor(address defaultAdmin, address minter) ERC20("MEOW", "MEOW") {
        _mint(msg.sender, INITIAL_SUPPLY_BASE * 10 ** decimals());
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter);
        deployTime = block.timestamp;
    }

    // TODO: inflation formula goes here!
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

//if (inflation < minInflation) return minInflation
//else {
//inflation = 9% * ((0.85 ^  (1 / 31536000)) ^ timeInSeconds)
//}

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

    function calculateInflationRate(uint256 currentTime) public view returns (uint256) {
        uint256 elapsedTime = currentTime - deployTime;
        uint256 yearsElapsed = elapsedTime / 365 days;

        uint256 newInflationRate = currentInflationRate;
        for (uint256 i = 0; i < yearsElapsed; i++) {
            newInflationRate = newInflationRate * (BASIS_POINTS - INFLATION_RATE_DECAY) / BASIS_POINTS;
            if (newInflationRate <= MIN_INFLATION_RATE) {
                newInflationRate = MIN_INFLATION_RATE;
                break;
            }
        }

        return newInflationRate;
    }

    // write a function that calculates how many tokens can be minted based on the following rules:
    // 1. 9% inflation rate per year that decreases by 15% every year until it hits overall 1.5% inflation rate
    // 2. it should be dynamic, meaning the minter can mint at any time and the inflation rate should be calculated based on the current block timestamp
    // 3. if minter is minting half way though a year, then he should be able to only mint half the amount
    // 4. the function should return the amount of tokens that can be minted
    // function code goes below
}
