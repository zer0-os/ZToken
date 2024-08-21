import * as hre from "hardhat";
import { expect } from "chai";
import { ZToken, ZToken__factory } from "../typechain/index.ts";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  AUTH_ERROR,
  INVALID_DEFAULT_ADMIN_ERR,
  INVALID_INFLATION_ARRAY_ERR,
  INVALID_TIME_ERR,
  ZERO_ADDRESS_ERR,
  ZERO_INITIAL_SUPPLY_ERR,
} from "./helpers/errors.ts";
import {
  FINAL_INFLATION_RATE_DEFAULT,
  INFLATION_RATES_DEFAULT,
  INITIAL_SUPPLY_DEFAULT,
  YEAR_IN_SECONDS,
  ADMIN_DELAY_DEFAULT,
  FINAL_MINTABLE_YEARLY_TOKENS_REF_DEFAULT,
} from "./helpers/constants.ts";

import {
  getTokensPerPeriod,
  getYearlyMintableTokens,
  getMintableTokensForYear,
} from "./helpers/calculates.ts";


const tokenName = "Z";
const tokenSymbol = "Z";


describe("ZToken Test", () => {
  let zToken : ZToken;
  let admin : SignerWithAddress;
  let beneficiary : SignerWithAddress;
  let randomAcc : SignerWithAddress;
  let ZTokenFactory : ZToken__factory;

  let deployTime : bigint;
  let initialTotalSupply : bigint;

  before(async () => {
    [admin, beneficiary, randomAcc] = await hre.ethers.getSigners();

    ZTokenFactory = await hre.ethers.getContractFactory("ZToken");
    zToken = await ZTokenFactory.deploy(
      tokenName,
      tokenSymbol,
      admin.address,
      ADMIN_DELAY_DEFAULT,
      admin.address,
      beneficiary.address,
      INITIAL_SUPPLY_DEFAULT,
      INFLATION_RATES_DEFAULT,
      FINAL_INFLATION_RATE_DEFAULT,
    );
    initialTotalSupply = await zToken.baseSupply();

    deployTime = await zToken.DEPLOY_TIME();
  });

  describe("Deployment and Access Control", () => {
    it("should mint the provided initial supply to the beneficiary address upon deployment", async () => {
      const beneficiaryBal = await zToken.balanceOf(beneficiary.address);
      expect(beneficiaryBal).to.eq(hre.ethers.parseEther(INITIAL_SUPPLY_DEFAULT.toString()));
    });

    it("should revert if initial supply is passed as 0", async () => {
      await expect(
        ZTokenFactory.deploy(
          tokenName,
          tokenSymbol,
          admin.address,
          ADMIN_DELAY_DEFAULT,
          admin.address,
          beneficiary.address,
          0,
          INFLATION_RATES_DEFAULT,
          FINAL_INFLATION_RATE_DEFAULT,
        )
      ).to.be.revertedWithCustomError(
        zToken,
        ZERO_INITIAL_SUPPLY_ERR
      );
    });

    it("should revert when inflation rates array is empty", async () => {
      const inflationRatesEmpty : Array<bigint> = [];

      await expect(
        ZTokenFactory.deploy(
          tokenName,
          tokenSymbol,
          admin.address,
          ADMIN_DELAY_DEFAULT,
          admin.address,
          beneficiary.address,
          INITIAL_SUPPLY_DEFAULT,
          inflationRatesEmpty,
          FINAL_INFLATION_RATE_DEFAULT,
        )
      ).to.be.revertedWithCustomError(
        zToken,
        INVALID_INFLATION_ARRAY_ERR
      ).withArgs(inflationRatesEmpty);
    });

    it("should revert if inflation rates array does NOT start from 0", async () => {
      const inflationRatesInvalid = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n, 10n, 11n, 12n];

      await expect(
        ZTokenFactory.deploy(
          tokenName,
          tokenSymbol,
          admin.address,
          ADMIN_DELAY_DEFAULT,
          admin.address,
          beneficiary.address,
          INITIAL_SUPPLY_DEFAULT,
          inflationRatesInvalid,
          FINAL_INFLATION_RATE_DEFAULT,
        )
      ).to.be.revertedWithCustomError(
        zToken,
        INVALID_INFLATION_ARRAY_ERR
      ).withArgs(inflationRatesInvalid);
    });

    it("Should return 0 each year if INLFATION RATES passed as zeros", async () => {
      const inflationRatesInvalid = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];

      const token = await ZTokenFactory.deploy(
        tokenName,
        tokenSymbol,
        admin.address,
        ADMIN_DELAY_DEFAULT,
        admin.address,
        beneficiary.address,
        INITIAL_SUPPLY_DEFAULT,
        inflationRatesInvalid,
        FINAL_INFLATION_RATE_DEFAULT,
      );

      let time = deployTime;

      // From 1 `year` to `inflationRatesInvalid.length` - 1 cause first rate is 0n,
      // and last rate should be 1.5%
      for (let year = 1; year < inflationRatesInvalid.length; year++) {
        time += YEAR_IN_SECONDS;

        expect(
          await token.calculateMintableTokens(time)
        ).to.be.equal(
          0n
        );
      }
    });

    it("Should return 0 tokens in 13 year if FINAL INLFATION RATE is passed as 0n", async () => {
      const finalRate = 0n;

      const token = await ZTokenFactory.deploy(
        tokenName,
        tokenSymbol,
        admin.address,
        ADMIN_DELAY_DEFAULT,
        admin.address,
        beneficiary.address,
        INITIAL_SUPPLY_DEFAULT,
        INFLATION_RATES_DEFAULT,
        finalRate,
      );

      const time = deployTime + YEAR_IN_SECONDS * 13n;

      const mintAmount = await token.calculateMintableTokens(time);

      let sum = 0n;
      for (let year = 1; year < INFLATION_RATES_DEFAULT.length; year++) {
        sum += hre.ethers.parseEther(INITIAL_SUPPLY_DEFAULT.toString()) *
        INFLATION_RATES_DEFAULT[year] / 10000n;
      }

      const rate = await token.currentInflationRate(
        (time - deployTime) / YEAR_IN_SECONDS
      );

      expect(
        mintAmount
      ).to.be.equal(
        sum
      );

      expect(
        rate
      ).to.be.equal(
        0n
      );
    });

    it("should deploy with infation rates array of any length and return final rate correctly", async () => {
      const rates = [
        0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n, 10n, 11n, 12n, 13n, 14n, 15n, 16n, 17n, 18n, 19n, 20n,
      ];

      const zToken2 = await ZTokenFactory.deploy(
        tokenName,
        tokenSymbol,
        admin.address,
        ADMIN_DELAY_DEFAULT,
        admin.address,
        beneficiary.address,
        INITIAL_SUPPLY_DEFAULT,
        rates,
        FINAL_INFLATION_RATE_DEFAULT,
      );

      const rateFromContract = await zToken2.currentInflationRate(rates.length + 2);
      expect(rateFromContract).to.eq(FINAL_INFLATION_RATE_DEFAULT);

      const rateFromRates = await zToken2.ANNUAL_INFLATION_RATES(3);
      expect(rateFromRates).to.eq(rates[3]);
    });

    it("should revert if any of the addresses passed as 0x0", async () => {
      await expect(
        ZTokenFactory.deploy(
          tokenName,
          tokenSymbol,
          hre.ethers.ZeroAddress,
          ADMIN_DELAY_DEFAULT,
          admin.address,
          beneficiary.address,
          INITIAL_SUPPLY_DEFAULT,
          INFLATION_RATES_DEFAULT,
          FINAL_INFLATION_RATE_DEFAULT,
        )
      ).to.be.revertedWithCustomError(
        zToken,
        INVALID_DEFAULT_ADMIN_ERR
      );

      await expect(
        ZTokenFactory.deploy(
          tokenName,
          tokenSymbol,
          admin.address,
          ADMIN_DELAY_DEFAULT,
          hre.ethers.ZeroAddress,
          beneficiary.address,
          INITIAL_SUPPLY_DEFAULT,
          INFLATION_RATES_DEFAULT,
          FINAL_INFLATION_RATE_DEFAULT,
        )
      ).to.be.revertedWithCustomError(
        zToken,
        ZERO_ADDRESS_ERR
      );

      await expect(
        ZTokenFactory.deploy(
          tokenName,
          tokenSymbol,
          admin.address,
          ADMIN_DELAY_DEFAULT,
          admin.address,
          hre.ethers.ZeroAddress,
          INITIAL_SUPPLY_DEFAULT,
          INFLATION_RATES_DEFAULT,
          FINAL_INFLATION_RATE_DEFAULT,
        )
      ).to.be.revertedWithCustomError(
        zToken,
        ZERO_ADDRESS_ERR
      );
    });

    it("should set the given address as the admin and minter of the contract", async () => {
      expect(await zToken.hasRole(await zToken.MINTER_ROLE(), admin.address)).to.be.true;
      expect(await zToken.hasRole(await zToken.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
    });

    it("should not set other addresses with roles on deployment", async () => {
      expect(await zToken.hasRole(await zToken.MINTER_ROLE(), beneficiary.address)).to.be.false;
      expect(await zToken.hasRole(await zToken.DEFAULT_ADMIN_ROLE(), beneficiary.address)).to.be.false;

      expect(await zToken.hasRole(await zToken.MINTER_ROLE(), randomAcc.address)).to.be.false;
      expect(await zToken.hasRole(await zToken.DEFAULT_ADMIN_ROLE(), randomAcc.address)).to.be.false;
    });

    it("should fail when an address that does not have the MINTER_ROLE tries to mint", async () => {
      await expect(
        zToken.connect(beneficiary).mint()
      ).to.be.revertedWithCustomError(zToken, AUTH_ERROR)
        .withArgs(beneficiary.address, hre.ethers.solidityPackedKeccak256(["string"], ["MINTER_ROLE"]));
    });

    it("should be able to reassign the minter role to another address", async () => {
      const minterRole = await zToken.MINTER_ROLE();

      expect(await zToken.hasRole(minterRole, beneficiary.address)).to.be.false;

      await zToken.connect(admin).grantRole(minterRole, beneficiary.address);

      expect(await zToken.hasRole(minterRole, admin.address)).to.be.true;
      expect(await zToken.hasRole(minterRole, beneficiary.address)).to.be.true;

      await zToken.connect(admin).revokeRole(minterRole, admin.address);

      expect(await zToken.hasRole(minterRole, admin.address)).to.be.false;

      // assign back
      await zToken.connect(admin).grantRole(minterRole, admin.address);

      expect(await zToken.hasRole(minterRole, admin.address)).to.be.true;
    });
  });

  describe("AccessControl Default Admin Rules", () => {
    it("should be able to reassign DEFAULT_ADMIN_ROLE to another address with default delay", async () => {
      const adminRole = await zToken.DEFAULT_ADMIN_ROLE();
      expect(await zToken.hasRole(adminRole, beneficiary.address)).to.be.false;

      await zToken.connect(admin).beginDefaultAdminTransfer(beneficiary.address);
      const curTime = await time.latest();

      const [ pendingAdmin, schedule ] = await zToken.pendingDefaultAdmin();
      expect(pendingAdmin).to.eq(beneficiary.address);
      expect(schedule).to.eq(BigInt(curTime) + ADMIN_DELAY_DEFAULT);

      await time.increase(ADMIN_DELAY_DEFAULT + 1n);

      await zToken.connect(beneficiary).acceptDefaultAdminTransfer();

      expect(await zToken.hasRole(adminRole, admin.address)).to.be.false;
      expect(await zToken.hasRole(adminRole, beneficiary.address)).to.be.true;
      expect(await zToken.defaultAdmin()).to.eq(beneficiary.address);

      // assign back
      await zToken.connect(beneficiary).beginDefaultAdminTransfer(admin.address);

      await time.increase(ADMIN_DELAY_DEFAULT + 1n);

      await zToken.connect(admin).acceptDefaultAdminTransfer();

      expect(await zToken.hasRole(adminRole, admin.address)).to.be.true;
      expect(await zToken.defaultAdmin()).to.eq(admin.address);
    });

    it("should successfully change admin delay and change to new admin after", async () => {
      const newDelay = 71231n;

      await zToken.connect(admin).changeDefaultAdminDelay(newDelay);

      expect(await zToken.defaultAdminDelay()).to.eq(ADMIN_DELAY_DEFAULT);

      await time.increase(ADMIN_DELAY_DEFAULT - newDelay + 1n); // as per contract rules

      expect(await zToken.defaultAdminDelay()).to.eq(newDelay);

      await zToken.connect(admin).beginDefaultAdminTransfer(randomAcc.address);

      await time.increase(newDelay);

      await zToken.connect(randomAcc).acceptDefaultAdminTransfer();

      expect(await zToken.defaultAdmin()).to.eq(randomAcc.address);

      // assign back
      await zToken.connect(randomAcc).beginDefaultAdminTransfer(admin.address);

      await time.increase(newDelay);

      await zToken.connect(admin).acceptDefaultAdminTransfer();
    });

    it("should cancel the admin transfer during the delay period", async () => {
      await zToken.connect(admin).beginDefaultAdminTransfer(beneficiary.address);

      await time.increase(ADMIN_DELAY_DEFAULT / 2n);

      await zToken.connect(admin).cancelDefaultAdminTransfer();

      const [ pendingAdmin, schedule ] = await zToken.pendingDefaultAdmin();
      expect(pendingAdmin).to.eq(hre.ethers.ZeroAddress);
      expect(schedule).to.eq(0n);
    });
  });

  describe("#calculateMintableTokens()", () => {
    it("should revert when calculating tokens for time that is less than last mint time", async () => {
      const lastMintTime = await zToken.lastMintTime();
      await expect(
        zToken.calculateMintableTokens(lastMintTime - 1n)
      ).to.be.revertedWithCustomError(
        zToken,
        INVALID_TIME_ERR
      ).withArgs(lastMintTime, lastMintTime - 1n);
    });

    it("#calculateMintableTokens() should return 0 tokens when no time has passed", async () => {
      const tokensFromContract = await zToken.calculateMintableTokens(deployTime);

      expect(tokensFromContract).to.be.equal(0n);
    });
  });

  describe("Helper math functions", () => {
    // eslint-disable-next-line max-len
    it("#currentInflationRate() should return the correct inflation rate for a given year and return final at the end of array", async () => {
      const inflationRate = await zToken.currentInflationRate(7);
      expect(inflationRate).to.eq(INFLATION_RATES_DEFAULT[7]);

      let finalRate = await zToken.currentInflationRate(100);
      expect(finalRate).to.eq(FINAL_INFLATION_RATE_DEFAULT);
      finalRate = await zToken.currentInflationRate(INFLATION_RATES_DEFAULT.length + 1);
      expect(finalRate).to.eq(FINAL_INFLATION_RATE_DEFAULT);
    });

    it("#yearSinceDeploy() should return the correct year since deploy", async () => {
      let year = await zToken.yearSinceDeploy(deployTime + YEAR_IN_SECONDS * 2n + 3n);
      expect(year).to.eq(3n);

      year = await zToken.yearSinceDeploy(deployTime + YEAR_IN_SECONDS * 17n + 18231n);
      expect(year).to.eq(18n);

      year = await zToken.yearSinceDeploy(deployTime + 1n);
      expect(year).to.eq(1n);
    });

    it("#yearSinceDeploy() should revert if time passed is less than deploy time", async () => {
      await expect(
        zToken.yearSinceDeploy(deployTime - 1n)
      ).to.be.revertedWithCustomError(
        zToken,
        INVALID_TIME_ERR
      ).withArgs(deployTime, deployTime - 1n);
    });

    it("#tokensPerYear() should return the correct tokens per year for a given year", async () => {
      const baseSupply = await zToken.baseSupply();
      const year = 3;
      let tokensPerYear = await zToken.tokensPerYear(year);
      const tokensPerYearRef = baseSupply / 10000n * INFLATION_RATES_DEFAULT[year];

      expect(tokensPerYear).to.eq(tokensPerYearRef);

      const fixedFinalRateAmtRef = FINAL_MINTABLE_YEARLY_TOKENS_REF_DEFAULT;

      tokensPerYear = await zToken.tokensPerYear(INFLATION_RATES_DEFAULT.length + 1);
      expect(tokensPerYear).to.eq(fixedFinalRateAmtRef);
      tokensPerYear = await zToken.tokensPerYear(100);
      expect(tokensPerYear).to.eq(fixedFinalRateAmtRef);
    });
  });

  describe("Minting Scenarios on the same state. One after another.", () => {
    let lastMintTime : bigint;
    let totalSupply : bigint;
    let firstMintAmtRef : bigint;
    let secondMintAmtRef : bigint;
    let year3Period : bigint;
    let year4Period : bigint;
    let year12Period : bigint;

    it("[1st year] middle of the first year", async () => {
      totalSupply = await zToken.totalSupply();

      let timeOfMint1 = deployTime + YEAR_IN_SECONDS / 2n - 1n;
      const inflationRate = await zToken.ANNUAL_INFLATION_RATES(1);
      const tokensPerYearRef = totalSupply * inflationRate / 10000n;
      firstMintAmtRef = tokensPerYearRef / 2n;

      await time.increaseTo(timeOfMint1);
      timeOfMint1 += 1n;

      const beneficiaryBalBefore = await zToken.balanceOf(beneficiary.address);
      await zToken.connect(admin).mint();
      const beneficiaryBalAfter = await zToken.balanceOf(beneficiary.address);

      const balDiff = beneficiaryBalAfter - beneficiaryBalBefore;
      expect(balDiff).to.eq(firstMintAmtRef);

      // check that all state values set properly!
      lastMintTime = await zToken.lastMintTime();
      totalSupply = await zToken.totalSupply();

      expect(lastMintTime).to.eq(timeOfMint1);
      expect(totalSupply).to.eq(initialTotalSupply + firstMintAmtRef);
    });

    it("[3rd year] 2 years + 260825 sec after", async () => {
      const tokensPerYear = initialTotalSupply * 900n / 10000n;
      const tokensPerYear2 = initialTotalSupply * 765n / 10000n;
      const tokensPerYear3 = initialTotalSupply * 650n / 10000n;

      const balanceBefore = await zToken.balanceOf(beneficiary.address);

      year3Period = 260825n;
      let timeOfMint2 = deployTime + (YEAR_IN_SECONDS) * 2n + year3Period;
      await time.increaseTo(timeOfMint2);
      timeOfMint2 += 1n;

      await zToken.connect(admin).mint();

      const balanceAfter = await zToken.balanceOf(beneficiary.address);
      const balanceDiff = balanceAfter - balanceBefore;

      const periodAmt = tokensPerYear3 * (year3Period + 1n) / YEAR_IN_SECONDS;
      secondMintAmtRef = tokensPerYear * (YEAR_IN_SECONDS / 2n) / YEAR_IN_SECONDS + tokensPerYear2 + periodAmt;

      expect(balanceDiff).to.eq(secondMintAmtRef);

      lastMintTime = await zToken.lastMintTime();
      totalSupply = await zToken.totalSupply();

      expect(lastMintTime).to.eq(timeOfMint2);
      expect(totalSupply).to.eq(initialTotalSupply + firstMintAmtRef + secondMintAmtRef);
    });

    it("[3rd + 4th year] end of 3rd year and 3 times in one 4th year", async () => {
      const year3End = deployTime + YEAR_IN_SECONDS * 3n - 1n;

      await time.increaseTo(year3End);

      // mint leftovers to close out 3rd year
      const balanceBefore1 = await zToken.balanceOf(beneficiary.address);
      await zToken.connect(admin).mint();
      const balanceAfter1 = await zToken.balanceOf(beneficiary.address);

      const fullYear3 = getMintableTokensForYear(3);
      const closeoutRefAmt = (YEAR_IN_SECONDS - year3Period - 1n) * fullYear3 / YEAR_IN_SECONDS;
      expect(balanceAfter1 - balanceBefore1).to.eq(closeoutRefAmt);

      const periods = [
        100000n, // 11 days, 13 hours, 46 min, 40 sec
        31215n, // 8 hours, 40 min, 15 sec
        9776132n, // 113 days, 3 hours, 35 min, 32 sec
      ];
      year4Period = periods.reduce((acc, period) => acc + period, 0n);

      let timeOfMint = year3End + 1n;
      await periods.reduce(
        async (acc, period, idx) => {
          await acc;
          timeOfMint += period;

          await time.increaseTo(timeOfMint);
          const balanceBefore = await zToken.balanceOf(beneficiary.address);
          await zToken.connect(admin).mint();
          const balanceAfter = await zToken.balanceOf(beneficiary.address);
          timeOfMint = BigInt(await time.latest());

          const yearly = getMintableTokensForYear(4);
          const periodAmtRef = yearly * (period + 1n) / YEAR_IN_SECONDS;

          expect(balanceAfter - balanceBefore).to.eq(periodAmtRef, idx.toString());
        }, Promise.resolve()
      );
    });

    it("[12th year] after 8 years and 8919854 seconds where the inflation plateaus", async () => {
      year12Period = 8919854n; // 103 days, 5 hours, 44 min, 14 sec
      const timeOfMint = deployTime + YEAR_IN_SECONDS * 11n + year12Period - 1n;

      await time.increaseTo(timeOfMint);

      const balanceBefore = await zToken.balanceOf(beneficiary.address);
      await zToken.connect(admin).mint();
      const balanceAfter = await zToken.balanceOf(beneficiary.address);

      let tokenAmountRef = getTokensPerPeriod(4, YEAR_IN_SECONDS - (year4Period + 3n));
      for (let year = 5; year < 12; year++) {
        tokenAmountRef += getMintableTokensForYear(year);
      }

      tokenAmountRef += getTokensPerPeriod(12, year12Period);

      expect(balanceAfter - balanceBefore).to.eq(tokenAmountRef);
    });

    it("[33rd year] during the inflation plateau", async () => {
      const newYearPeriod = 31545n;
      const timeOfMint = deployTime + YEAR_IN_SECONDS * 32n + newYearPeriod - 1n;

      await time.increaseTo(timeOfMint);

      const balanceBefore = await zToken.balanceOf(beneficiary.address);
      await zToken.connect(admin).mint();
      const balanceAfter = await zToken.balanceOf(beneficiary.address);

      // previous 12th year leftoved
      let tokenAmountRef = getTokensPerPeriod(33, YEAR_IN_SECONDS - year12Period);
      // full years passed
      // all of the years will have the same amount minted, because we start after the plateau, so rate is always 1.5%
      tokenAmountRef += getYearlyMintableTokens(13) * 20n; // 13th to 32nd year
      // 33rd year period
      tokenAmountRef += getTokensPerPeriod(33, newYearPeriod);

      expect(balanceAfter - balanceBefore).to.eq(tokenAmountRef);
    });
  });

  describe("Burn on Transfer to Token Address", () => {
    it("should burn token upon transfer to token address", async () => {
      const adminBalanceBefore = await zToken.balanceOf(beneficiary.address);
      const tokenSupplyBefore = await zToken.totalSupply();
      const transferAmt = 13546846845n;

      await zToken.connect(beneficiary).transfer(zToken.target, transferAmt);

      const adminBalanceAfter = await zToken.balanceOf(beneficiary.address);
      const tokenSupplyAfter = await zToken.totalSupply();

      expect(adminBalanceBefore - adminBalanceAfter).to.eq(transferAmt);
      expect(tokenSupplyBefore - tokenSupplyAfter).to.eq(transferAmt);

      // make sure we can't transfer to 0x0 address
      await expect(
        zToken.connect(beneficiary).transfer(hre.ethers.ZeroAddress, transferAmt)
      ).to.be.revertedWithCustomError(
        zToken,
        "ERC20InvalidReceiver"
      ).withArgs(hre.ethers.ZeroAddress);
    });

    it("should NOT burn tokens if transferred to any regular address", async () => {
      const adminBalanceBefore = await zToken.balanceOf(beneficiary.address);
      const tokenSupplyBefore = await zToken.totalSupply();
      const transferAmt = 13546846845n;

      await zToken.connect(beneficiary).transfer(randomAcc.address, transferAmt);

      const adminBalanceAfter = await zToken.balanceOf(beneficiary.address);
      const tokenSupplyAfter = await zToken.totalSupply();

      expect(adminBalanceBefore - adminBalanceAfter).to.eq(transferAmt);
      expect(tokenSupplyBefore - tokenSupplyAfter).to.eq(0n);
    });

    it("should emit TWO Transfer events upon transfer to token address", async () => {
      const transferAmt = 13546846845n;

      await expect(
        zToken.connect(beneficiary).transfer(zToken.target, transferAmt)
      ).to.emit(zToken, "Transfer").withArgs(beneficiary.address, zToken.target, transferAmt)
        .and.to.emit(zToken, "Transfer").withArgs(beneficiary.address, hre.ethers.ZeroAddress, transferAmt);
    });
  });

  describe("#setMintBeneficiary()", () => {
    it("#setMintBeneficiary() should set the new address correctly", async () => {
      const newBeneficiary = randomAcc.address;
      await zToken.connect(admin).setMintBeneficiary(newBeneficiary);

      const mintBeneficiary = await zToken.mintBeneficiary();
      expect(mintBeneficiary).to.eq(newBeneficiary);
    });

    it("#setMintBeneficiary() should revert if called by non-admin", async () => {
      await expect(
        zToken.connect(randomAcc).setMintBeneficiary(randomAcc.address)
      ).to.be.revertedWithCustomError(
        zToken,
        "AccessControlUnauthorizedAccount"
      ).withArgs(randomAcc.address, hre.ethers.ZeroHash);
    });

    it("#setMintBeneficiary() should revert if called with 0x0 address", async () => {
      await expect(
        zToken.connect(admin).setMintBeneficiary(hre.ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(
        zToken,
        "ZeroAddressPassed"
      );
    });
  });
});

describe("Minting scenarios on clean state.", () => {
  let zToken : ZToken;
  let admin : SignerWithAddress;
  let beneficiary : SignerWithAddress;
  let ZTokenFactory : ZToken__factory;

  let deployTime : bigint;

  beforeEach(async () => {
    [admin, beneficiary] = await hre.ethers.getSigners();

    ZTokenFactory = await hre.ethers.getContractFactory("ZToken");
    zToken = await ZTokenFactory.deploy(
      tokenName,
      tokenSymbol,
      admin.address,
      ADMIN_DELAY_DEFAULT,
      admin.address,
      beneficiary.address,
      INITIAL_SUPPLY_DEFAULT,
      INFLATION_RATES_DEFAULT,
      FINAL_INFLATION_RATE_DEFAULT,
    );

    deployTime = await zToken.DEPLOY_TIME();
  });

  it("should mint the correct amount of tokens when minted every second", async () => {
    for (let second = 1; second < 13; second++) {
      const beneficiaryBalBefore = await zToken.balanceOf(beneficiary.address);
      await zToken.connect(admin).mint();
      const beneficiaryBalAfter = await zToken.balanceOf(beneficiary.address);

      const minted = beneficiaryBalAfter - beneficiaryBalBefore;

      expect(
        minted
      ).to.be.equal(
        getTokensPerPeriod(1, 1n),
        second.toString()
      );
    }
  });

  it("#calculateMintableTokens() should return correct years amount of tokens, increased each year", async () => {
    let currentTime = deployTime;
    let amountRef = 0n;

    for (let year = 0; year < 16; year++) {
      const tokensFromContract = await zToken.calculateMintableTokens(currentTime);
      // + year each iteration
      currentTime += YEAR_IN_SECONDS;
      amountRef += getYearlyMintableTokens(year);

      expect(
        tokensFromContract
      ).to.be.equal(
        amountRef,
        year.toString()
      );
    }
  });

  it("should mint the correct amount of tokens per year exactly", async () => {
    let currentTime = deployTime;
    let minted = 0n;

    for (let year = 1; year < 10; year++) {
      currentTime += YEAR_IN_SECONDS;

      await time.increaseTo(currentTime - 1n);

      const beneficiaryBalBefore = await zToken.balanceOf(beneficiary.address);
      await zToken.connect(admin).mint();
      const beneficiaryBalAfter = await zToken.balanceOf(beneficiary.address);

      minted = beneficiaryBalAfter - beneficiaryBalBefore;

      expect(
        minted
      ).to.be.equal(
        getYearlyMintableTokens(year)
      );
    }
  });

  // eslint-disable-next-line max-len
  it("should correctly account totalSupply and mintable tokens when burning by transfer to token contract", async () => {
    // mint some tokens after a year and a half
    const firstMintTime = deployTime + YEAR_IN_SECONDS / 2n - 1n;
    await time.increaseTo(firstMintTime);

    const totalSupplyBefore = await zToken.totalSupply();

    await zToken.connect(admin).mint();

    const totalSupplyAfter = await zToken.totalSupply();

    const mintedAmtRef = getTokensPerPeriod(1, YEAR_IN_SECONDS / 2n);

    expect(totalSupplyAfter - totalSupplyBefore).to.eq(mintedAmtRef);

    // burn some tokens by transferring to token contract
    const transferAmt = mintedAmtRef / 3n;
    await zToken.connect(beneficiary).transfer(zToken.target, transferAmt);

    const totalSupplyAfterBurn = await zToken.totalSupply();

    expect(totalSupplyAfterBurn).to.eq(totalSupplyAfter - transferAmt);

    // mint more tokens
    const newMintPeriod = 31545n;
    // we do not do - 1n here because previous tx already moved it by 1 second
    const secondMintTime = firstMintTime + newMintPeriod;
    await time.increaseTo(secondMintTime);

    const totalSupplyBefore2 = await zToken.totalSupply();
    await zToken.connect(admin).mint();
    const totalSupplyAfter2 = await zToken.totalSupply();

    const mintedAmtRef2 = getTokensPerPeriod(1, newMintPeriod);

    expect(totalSupplyAfter2 - totalSupplyBefore2).to.eq(mintedAmtRef2);
  });
});
