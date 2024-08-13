// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IZToken } from "./IZToken.sol";
import { InflationaryToken } from "./InflationaryToken.sol";


contract ZToken is InflationaryToken, AccessControl, IZToken {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /*** Constants ***/
    uint256 public constant INITIAL_SUPPLY_BASE = 10101010101;

    /*
     * @notice Address that will receive all the minted tokens. Can be updated by the ADMIN_ROLE.
     */
    address public override mintBeneficiary;

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
    ) InflationaryToken("MEOW", "MEOW", _inflationRates, _finalInflationRate) {
        if (
            _defaultAdmin == address(0)
            || _minter == address(0)
            || _mintBeneficiary == address(0)
        ) revert ZeroAddressPassed();

        _mint(_mintBeneficiary, baseSupply());
        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);
        _grantRole(MINTER_ROLE, _minter);

        mintBeneficiary = _mintBeneficiary;
    }

    /**
     * @notice Returns the initial token supply at deploy time that is used in the inflation calculations.
     */
    function baseSupply() public view override(InflationaryToken, IZToken) returns (uint256) {
        return INITIAL_SUPPLY_BASE * 10 ** decimals();
    }

    /**
     * @notice Mints tokens to the `mintBeneficiary` address based on the inflation formula and rates per year.
     */
    function mint() public override onlyRole(MINTER_ROLE) {
        _mintInflationary(mintBeneficiary);
    }

    /**
     * @notice Updates the address that will receive all the minted tokens. Only ADMIN can call.
     * @param _mintBeneficiary The new address that will receive all the minted tokens
     */
    function setMintBeneficiary(address _mintBeneficiary) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_mintBeneficiary == address(0)) revert ZeroAddressPassed();
        mintBeneficiary = _mintBeneficiary;
        emit MintBeneficiaryUpdated(_mintBeneficiary);
    }

    /**
     * @dev Overriden ERC20 function that will burn the amount of tokens transferred to this address.
     */
    function _update(address from, address to, uint256 value) internal override {
        if (to == address(this)) {
            return super._update(from, address(0), value);
        }

        return super._update(from, to, value);
    }
}
