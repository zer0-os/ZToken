import * as hre from "hardhat";
import { expect } from "chai";
import { MeowToken, MeowToken__factory } from "../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { AUTH_ERROR, INVALID_INFLATION_ARRAY_ERR, INVALID_TIME_ERR, ZERO_ADDRESS_ERR } from "./helpers/errors.ts";
import { experimentalAddHardhatNetworkMessageTraceHook } from "hardhat/config";


const YEAR_IN_SECONDS = 31536000n;
let initialTotalSupply : bigint;
const inflationRates = [0n, 900n, 765n, 650n, 552n, 469n, 398n, 338n, 287n, 243n, 206n, 175n];
const finalInflationRate = 150n;


describe("MeowToken Test", () => {
  let meowToken : MeowToken;
  let admin : SignerWithAddress;
  let beneficiary : SignerWithAddress;
  let randomAcc : SignerWithAddress;
  let MeowTokenFactory : MeowToken__factory;

  before(async () => {
    [admin, beneficiary, randomAcc] = await hre.ethers.getSigners();

    MeowTokenFactory = await hre.ethers.getContractFactory("MeowToken");
    meowToken = await MeowTokenFactory.deploy(
      admin.address,
      admin.address,
      beneficiary.address,
      inflationRates,
      finalInflationRate,
    );
    initialTotalSupply = await meowToken.totalSupply();
  });

  describe("Deployment", () => {
    it("should revert when inflation rates array is empty", async () => {
      const inflationRatesEmpty : Array<bigint> = [];

      await expect(
        MeowTokenFactory.deploy(
          admin.address,
          admin.address,
          beneficiary.address,
          inflationRatesEmpty,
          finalInflationRate,
        )
      ).to.be.revertedWithCustomError(
        meowToken,
        INVALID_INFLATION_ARRAY_ERR
      ).withArgs(inflationRatesEmpty);
    });

    it("should revert if inflation rates array does NOT start from 0", async () => {
      const inflationRatesInvalid = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n, 10n, 11n, 12n];

      await expect(
        MeowTokenFactory.deploy(
          admin.address,
          admin.address,
          beneficiary.address,
          inflationRatesInvalid,
          finalInflationRate,
        )
      ).to.be.revertedWithCustomError(
        meowToken,
        INVALID_INFLATION_ARRAY_ERR
      ).withArgs(inflationRatesInvalid);
    });

    it("should deploy with infation rates array of any length and return final rate correctly", async () => {
      const rates = [
        0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n, 10n, 11n, 12n, 13n, 14n, 15n, 16n, 17n, 18n, 19n, 20n,
      ];

      const meowToken2 = await MeowTokenFactory.deploy(
        admin.address,
        admin.address,
        beneficiary.address,
        rates,
        finalInflationRate,
      );

      const rateFromContract = await meowToken2.currentInflationRate(rates.length + 2);
      expect(rateFromContract).to.eq(finalInflationRate);

      const rateFromRates = await meowToken2.YEARLY_INFLATION_RATES(3);
      expect(rateFromRates).to.eq(rates[3]);
    });

    it("should revert if any of the addresses passed as 0x0", async () => {
      await expect(
        MeowTokenFactory.deploy(
          hre.ethers.ZeroAddress,
          admin.address,
          beneficiary.address,
          inflationRates,
          finalInflationRate,
        )
      ).to.be.revertedWithCustomError(
        meowToken,
        ZERO_ADDRESS_ERR
      );

      await expect(
        MeowTokenFactory.deploy(
          admin.address,
          hre.ethers.ZeroAddress,
          beneficiary.address,
          inflationRates,
          finalInflationRate,
        )
      ).to.be.revertedWithCustomError(
        meowToken,
        ZERO_ADDRESS_ERR
      );

      await expect(
        MeowTokenFactory.deploy(
          admin.address,
          admin.address,
          hre.ethers.ZeroAddress,
          inflationRates,
          finalInflationRate,
        )
      ).to.be.revertedWithCustomError(
        meowToken,
        ZERO_ADDRESS_ERR
      );
    });

    it("should set the given address as the admin and minter of the contract", async () => {
      expect(await meowToken.hasRole(await meowToken.MINTER_ROLE(), admin.address)).to.be.true;
      expect(await meowToken.hasRole(await meowToken.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
    });

    it("should not set other addresses with roles on deployment", async () => {
      expect(await meowToken.hasRole(await meowToken.MINTER_ROLE(), beneficiary.address)).to.be.false;
      expect(await meowToken.hasRole(await meowToken.DEFAULT_ADMIN_ROLE(), beneficiary.address)).to.be.false;

      expect(await meowToken.hasRole(await meowToken.MINTER_ROLE(), randomAcc.address)).to.be.false;
      expect(await meowToken.hasRole(await meowToken.DEFAULT_ADMIN_ROLE(), randomAcc.address)).to.be.false;
    });

    it("Fails when an address that does not have the MINTER_ROLE tries to mint", async () => {
      await expect(
        meowToken.connect(beneficiary).mint()
      ).to.be.revertedWithCustomError(meowToken, AUTH_ERROR)
        .withArgs(beneficiary.address, hre.ethers.solidityPackedKeccak256(["string"], ["MINTER_ROLE"]));
    });
  });

  describe("#calculateMintableTokens()", () => {
    it("should revert when calculating tokens for time that is less than last mint time", async () => {
      const lastMintTime = await meowToken.lastMintTime();
      await expect(
        meowToken.calculateMintableTokens(lastMintTime - 1n)
      ).to.be.revertedWithCustomError(
        meowToken,
        INVALID_TIME_ERR
      ).withArgs(lastMintTime, lastMintTime - 1n);
    });
  });

  describe("Helper math functions", () => {
    // eslint-disable-next-line max-len
    it("#currentInflationRate() should return the correct inflation rate for a given year and return final at the end of array", async () => {
      const inflationRate = await meowToken.currentInflationRate(7);
      expect(inflationRate).to.eq(inflationRates[7]);

      let finalRate = await meowToken.currentInflationRate(100);
      expect(finalRate).to.eq(finalInflationRate);
      finalRate = await meowToken.currentInflationRate(inflationRates.length + 1);
      expect(finalRate).to.eq(finalInflationRate);
    });

    it("#yearSinceDeploy() should return the correct year since deploy", async () => {
      const deployTime = await meowToken.deployTime();
      let year = await meowToken.yearSinceDeploy(deployTime + YEAR_IN_SECONDS * 2n + 3n);
      expect(year).to.eq(3n);

      year = await meowToken.yearSinceDeploy(deployTime + YEAR_IN_SECONDS * 17n + 18231n);
      expect(year).to.eq(18n);

      year = await meowToken.yearSinceDeploy(deployTime + 1n);
      expect(year).to.eq(1n);
    });

    it("#yearSinceDeploy() should revert if time passed is less than deploy time", async () => {
      const deployTime = await meowToken.deployTime();
      await expect(
        meowToken.yearSinceDeploy(deployTime - 1n)
      ).to.be.revertedWithCustomError(
        meowToken,
        INVALID_TIME_ERR
      ).withArgs(deployTime, deployTime - 1n);
    });

    it("#tokensPerYear() should return the correct tokens per year for a given year", async () => {
      const baseSupply = await meowToken.baseSupply();
      const year = 3;
      let tokensPerYear = await meowToken.tokensPerYear(year);
      const tokensPerYearRef = baseSupply / 10000n * inflationRates[year];

      expect(tokensPerYear).to.eq(tokensPerYearRef);

      const fixedFinalRateAmtRef = 151515151515000000000000000n;

      tokensPerYear = await meowToken.tokensPerYear(inflationRates.length + 1);
      expect(tokensPerYear).to.eq(fixedFinalRateAmtRef);
      tokensPerYear = await meowToken.tokensPerYear(100);
      expect(tokensPerYear).to.eq(fixedFinalRateAmtRef);
    });

  });

  describe("Minting Scenarios", () => {
    let lastMintTime : bigint;
    let totalSupply : bigint;
    let timeOfMint1 : bigint;
    let firstMintAmtRef : bigint;

    it("should mint proper amount based on seconds if called in the middle of the first year", async () => {
      const deployTime = await meowToken.deployTime();
      totalSupply = await meowToken.totalSupply();

      timeOfMint1 = deployTime + YEAR_IN_SECONDS / 2n - 1n;
      const inflationRate = await meowToken.YEARLY_INFLATION_RATES(1);
      const tokensPerYearRef = totalSupply * inflationRate / 10000n;
      firstMintAmtRef = tokensPerYearRef / 2n;

      await time.increaseTo(timeOfMint1);
      timeOfMint1 += 1n;

      const beneficiaryBalBefore = await meowToken.balanceOf(beneficiary.address);
      await meowToken.connect(admin).mint();
      const beneficiaryBalAfter = await meowToken.balanceOf(beneficiary.address);

      const balDiff = beneficiaryBalAfter - beneficiaryBalBefore;
      expect(balDiff).to.eq(firstMintAmtRef);

      // check that all state values set properly!
      lastMintTime = await meowToken.lastMintTime();
      totalSupply = await meowToken.totalSupply();

      expect(lastMintTime).to.eq(timeOfMint1);
      expect(totalSupply).to.eq(initialTotalSupply + firstMintAmtRef);
    });

    it("should mint proper amount when minted again sometime in the 3rd year", async () => {
      const deployTime = await meowToken.deployTime();

      const tokensPerYear = initialTotalSupply * 900n / 10000n;
      const tokensPerYear2 = initialTotalSupply * 765n / 10000n;
      const tokensPerYear3 = initialTotalSupply * 650n / 10000n;

      const balanceBefore = await meowToken.balanceOf(beneficiary.address);

      const periodSeconds = 260825n;
      const secondMintTime = deployTime + (YEAR_IN_SECONDS) * 2n + periodSeconds;
      await time.increaseTo(secondMintTime);

      await meowToken.connect(admin).mint();

      const balanceAfter = await meowToken.balanceOf(beneficiary.address);
      const balanceDiff = balanceAfter - balanceBefore;

      const periodAmt = tokensPerYear3 * (periodSeconds + 1n) / YEAR_IN_SECONDS;
      const secondMintAmtRef = tokensPerYear * (YEAR_IN_SECONDS / 2n) / 31536000n + tokensPerYear2 + periodAmt;

      expect(balanceDiff).to.eq(secondMintAmtRef);

      lastMintTime = await meowToken.lastMintTime();
      totalSupply = await meowToken.totalSupply();

      expect(lastMintTime).to.eq(secondMintTime + 1n);
      expect(totalSupply).to.eq(initialTotalSupply + firstMintAmtRef + secondMintAmtRef);
    });
  });

  describe("Burn on Transfer to Token Address", () => {
    it("should burn token upon transfer to token address", async () => {
      const adminBalanceBefore = await meowToken.balanceOf(beneficiary.address);
      const tokenSupplyBefore = await meowToken.totalSupply();
      const transferAmt = 13546846845n;

      await meowToken.connect(beneficiary).transfer(meowToken.target, transferAmt);

      const adminBalanceAfter = await meowToken.balanceOf(beneficiary.address);
      const tokenSupplyAfter = await meowToken.totalSupply();

      expect(adminBalanceBefore - adminBalanceAfter).to.eq(transferAmt);
      expect(tokenSupplyBefore - tokenSupplyAfter).to.eq(transferAmt);

      // make sure we can't transfer to 0x0 address
      await expect(
        meowToken.connect(beneficiary).transfer(hre.ethers.ZeroAddress, transferAmt)
      ).to.be.revertedWithCustomError(
        meowToken,
        "ERC20InvalidReceiver"
      ).withArgs(hre.ethers.ZeroAddress);
    });

    it("should NOT burn tokens if transferred to any regular address", async () => {
      const adminBalanceBefore = await meowToken.balanceOf(beneficiary.address);
      const tokenSupplyBefore = await meowToken.totalSupply();
      const transferAmt = 13546846845n;

      await meowToken.connect(beneficiary).transfer(randomAcc.address, transferAmt);

      const adminBalanceAfter = await meowToken.balanceOf(beneficiary.address);
      const tokenSupplyAfter = await meowToken.totalSupply();

      expect(adminBalanceBefore - adminBalanceAfter).to.eq(transferAmt);
      expect(tokenSupplyBefore - tokenSupplyAfter).to.eq(0n);
    });
  });

  describe("#setMintBeneficiary()", () => {
    it("#setMintBeneficiary() should set the new address correctly", async () => {
      const newBeneficiary = randomAcc.address;
      await meowToken.connect(admin).setMintBeneficiary(newBeneficiary);

      const mintBeneficiary = await meowToken.mintBeneficiary();
      expect(mintBeneficiary).to.eq(newBeneficiary);
    });

    it("#setMintBeneficiary() should revert if called by non-admin", async () => {
      await expect(
        meowToken.connect(randomAcc).setMintBeneficiary(randomAcc.address)
      ).to.be.revertedWithCustomError(
        meowToken,
        "AccessControlUnauthorizedAccount"
      ).withArgs(randomAcc.address, hre.ethers.ZeroHash);
    });

    it("#setMintBeneficiary() should revert if called with 0x0 address", async () => {
      await expect(
        meowToken.connect(admin).setMintBeneficiary(hre.ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(
        meowToken,
        "ZeroAddressPassed"
      );
    });
  });
});
