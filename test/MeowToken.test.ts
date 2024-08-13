import * as hre from "hardhat";
import { expect } from "chai";
import { ZToken, ZToken__factory } from "../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { parseEther } from "ethers";
import { AUTH_ERROR, INVALID_INFLATION_ARRAY_ERR, INVALID_TIME_ERR, ZERO_ADDRESS_ERR } from "./helpers/errors.ts";
import {
  FINAL_INFLATION_RATE_DEFAULT, getTokensPerPeriod,
  INFLATION_RATES_DEFAULT,
  MINTABLE_YEARLY_TOKENS_REF_DEFAULT,
  YEAR_IN_SECONDS,
} from "./helpers/inflation.ts";


describe("MeowToken Test", () => {
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
      admin.address,
      admin.address,
      beneficiary.address,
      INFLATION_RATES_DEFAULT,
      FINAL_INFLATION_RATE_DEFAULT,
    );
    initialTotalSupply = await zToken.baseSupply();

    deployTime = await zToken.deployTime();
  });

  describe("Deployment", () => {
    it("should revert when inflation rates array is empty", async () => {
      const inflationRatesEmpty : Array<bigint> = [];

      await expect(
        ZTokenFactory.deploy(
          admin.address,
          admin.address,
          beneficiary.address,
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
          admin.address,
          admin.address,
          beneficiary.address,
          inflationRatesInvalid,
          FINAL_INFLATION_RATE_DEFAULT,
        )
      ).to.be.revertedWithCustomError(
        zToken,
        INVALID_INFLATION_ARRAY_ERR
      ).withArgs(inflationRatesInvalid);
    });

    it("should deploy with infation rates array of any length and return final rate correctly", async () => {
      const rates = [
        0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n, 10n, 11n, 12n, 13n, 14n, 15n, 16n, 17n, 18n, 19n, 20n,
      ];

      const meowToken2 = await ZTokenFactory.deploy(
        admin.address,
        admin.address,
        beneficiary.address,
        rates,
        FINAL_INFLATION_RATE_DEFAULT,
      );

      const rateFromContract = await meowToken2.currentInflationRate(rates.length + 2);
      expect(rateFromContract).to.eq(FINAL_INFLATION_RATE_DEFAULT);

      const rateFromRates = await meowToken2.YEARLY_INFLATION_RATES(3);
      expect(rateFromRates).to.eq(rates[3]);
    });

    it("should revert if any of the addresses passed as 0x0", async () => {
      await expect(
        ZTokenFactory.deploy(
          hre.ethers.ZeroAddress,
          admin.address,
          beneficiary.address,
          INFLATION_RATES_DEFAULT,
          FINAL_INFLATION_RATE_DEFAULT,
        )
      ).to.be.revertedWithCustomError(
        zToken,
        ZERO_ADDRESS_ERR
      );

      await expect(
        ZTokenFactory.deploy(
          admin.address,
          hre.ethers.ZeroAddress,
          beneficiary.address,
          INFLATION_RATES_DEFAULT,
          FINAL_INFLATION_RATE_DEFAULT,
        )
      ).to.be.revertedWithCustomError(
        zToken,
        ZERO_ADDRESS_ERR
      );

      await expect(
        ZTokenFactory.deploy(
          admin.address,
          admin.address,
          hre.ethers.ZeroAddress,
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

    it("Fails when an address that does not have the MINTER_ROLE tries to mint", async () => {
      await expect(
        zToken.connect(beneficiary).mint()
      ).to.be.revertedWithCustomError(zToken, AUTH_ERROR)
        .withArgs(beneficiary.address, hre.ethers.solidityPackedKeccak256(["string"], ["MINTER_ROLE"]));
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

      const fixedFinalRateAmtRef = 151515151515000000000000000n;

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

    it("[1st year] middle of the first year", async () => {
      totalSupply = await zToken.totalSupply();

      let timeOfMint1 = deployTime + YEAR_IN_SECONDS / 2n - 1n;
      const inflationRate = await zToken.YEARLY_INFLATION_RATES(1);
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
      secondMintAmtRef = tokensPerYear * (YEAR_IN_SECONDS / 2n) / 31536000n + tokensPerYear2 + periodAmt;

      expect(balanceDiff).to.eq(secondMintAmtRef);

      lastMintTime = await zToken.lastMintTime();
      totalSupply = await zToken.totalSupply();

      expect(lastMintTime).to.eq(timeOfMint2);
      expect(totalSupply).to.eq(initialTotalSupply + firstMintAmtRef + secondMintAmtRef);
    });

    it("[3rd + 4th year] end of 3rd year and 3 times in one 4th year", async () => {
      const year4Start = deployTime + (YEAR_IN_SECONDS) * 3n - 1n;

      await time.increaseTo(year4Start);

      // mint leftovers to close out 3rd year
      const balanceBefore1 = await zToken.balanceOf(beneficiary.address);
      await zToken.connect(admin).mint();
      const balanceAfter1 = await zToken.balanceOf(beneficiary.address);

      const fullYear3 = MINTABLE_YEARLY_TOKENS_REF_DEFAULT[3];
      const closeoutRefAmt = (YEAR_IN_SECONDS - year3Period - 1n) * fullYear3 / YEAR_IN_SECONDS;
      expect(balanceAfter1 - balanceBefore1).to.eq(closeoutRefAmt);

      const periods = [
        100000n, // 11 days, 13 hours, 46 min, 40 sec
        31215n, // 8 hours, 40 min, 15 sec
        9776132n, // 113 days, 3 hours, 35 min, 32 sec
      ];
      year4Period = periods.reduce((acc, period) => acc + period, 0n);

      let timeOfMint = year4Start + 1n;
      await periods.reduce(
        async (acc, period, idx) => {
          await acc;
          timeOfMint += period;

          await time.increaseTo(timeOfMint);
          const balanceBefore = await zToken.balanceOf(beneficiary.address);
          await zToken.connect(admin).mint();
          const balanceAfter = await zToken.balanceOf(beneficiary.address);
          timeOfMint = BigInt(await time.latest());

          const yearly = MINTABLE_YEARLY_TOKENS_REF_DEFAULT[4];
          const periodAmtRef = yearly * (period + 1n) / YEAR_IN_SECONDS;

          expect(balanceAfter - balanceBefore).to.eq(periodAmtRef, idx.toString());
        }, Promise.resolve()
      );
    });

    it("[12th year] after 8 years and 8919854 seconds where the inflation plateaus", async () => {
      const periodSinceYearStart = 8919854n; // 103 days, 5 hours, 44 min, 14 sec
      const timeOfMint = deployTime + YEAR_IN_SECONDS * 11n + periodSinceYearStart - 1n;

      await time.increaseTo(timeOfMint);

      const balanceBefore = await zToken.balanceOf(beneficiary.address);
      await zToken.connect(admin).mint();
      const balanceAfter = await zToken.balanceOf(beneficiary.address);

      let tokenAmountRef = getTokensPerPeriod(4, YEAR_IN_SECONDS - (year4Period + 3n));
      for (let year = 5; year < 12; year++) {
        tokenAmountRef += MINTABLE_YEARLY_TOKENS_REF_DEFAULT[year];
      }

      tokenAmountRef += getTokensPerPeriod(12, periodSinceYearStart);

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

describe.skip("Minting scenarios, where each test has clear contract", () => {
  // TODO: create a separate deploy for this!
  it("Should return correct years amount of tokens, increased each year (non-mint)", async () => {
    let currentTime = deployTime;

    for (let year = 0; year < 10; year++) {
      // + year each iteration
      currentTime += 31536000n;

      const tokensFromContract = await meowToken.calculateMintableTokens(currentTime);

      expect(
        tokensFromContract / parseEther("1")
      ).to.be.equal(
        accumulatedMintableTokens[year]
      );
    }
  });

  it("Should return correct years amount of tokens, increased each year (mint)", async () => {
    let currentTime = deployTime;

    let timeOfMint = 0n;
    let minted = 0n;

    for (let year = 1; year < 10; year++) {
      currentTime += 31536000n;
      timeOfMint = currentTime;

      const tokensFromContract = await meowToken.calculateMintableTokens(currentTime);
      const expectedAmount = await getYearMintableTokensAmount(year);

      expect(
        tokensFromContract
      ).to.be.equal(
        expectedAmount
      );

      await time.increaseTo(timeOfMint - 1n);
      timeOfMint += 1n;

      const beneficiaryBalBefore = await meowToken.balanceOf(beneficiary.address);
      await meowToken.connect(admin).mint();
      const beneficiaryBalAfter = await meowToken.balanceOf(beneficiary.address);

      minted = beneficiaryBalAfter - initialTotalSupply;

      console.log(beneficiaryBalBefore);
      console.log(beneficiaryBalAfter);
    }
  });

  it("Should return correct amount of tokens, increased each 10.512.000 sec (1/3 part of year)", async () => {
    let currentTime = deployTime;

    for (let timeInterval = 0; timeInterval < 14; timeInterval++) {
      currentTime += 10512000n;

      await expect(
        await meowToken.calculateMintableTokens(currentTime) / parseEther("1")
      ).to.be.equal(
        mintableTokensEachYear[timeInterval] / 3n
      );
    }
  });

  it("", async () => {
    // TODO myself: deploy, wait some time (31536000 and 31535999), mint, then wait and mint again
  });

  it("", async () => {
    let currentTime = deployTime;

    currentTime += 31536000n;

    await meowToken.connect(admin).mint();

    // TODO myself: deploy, wait some years and then mint (like after 2y and some seconds)
  });

  it("", async () => {
    // TODO myself: each second
  });

  it("", async () => {
    // TODO myself: a lot of years. SHould be 1.5% inflation and a lot of tokens
  });

  it("", async () => {
    // TODO myself: 1000000 years
  });
});