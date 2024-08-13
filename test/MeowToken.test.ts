/* eslint-disable prefer-arrow/prefer-arrow-functions */
import * as hre from "hardhat";
import { expect } from "chai";
import { MeowToken } from "../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { parseEther } from "ethers";


const YEAR_IN_SECONDS = 31536000n;
let initialTotalSupply : bigint;


// initial supply * inflation percent of each year
const mintableTokensEachYear = [
  909090909n,
  772727272n,
  656565656n,
  557575757n,
  473737373n,
  402020202n,
  341414141n,
  289898989n,
  245454545n,
  208080808n,
  176767676n,
  151515151n,
];

// initial_supply * inflation_percent of each year - initial_supply
const accumulatedMintableTokens = [
  909090909n,
  1681818181n,
  2338383838n,
  2895959595n,
  3369696969n,
  3771717171n,
  4113131313n,
  4403030303n,
  4648484848n,
  4856565656n,
  5033333333n,
  5184848484n,
];

describe("MeowToken Test", () => {
  let meowToken : MeowToken;
  let admin : SignerWithAddress;
  let beneficiary : SignerWithAddress;
  let randomAcc : SignerWithAddress;

  let deployTime : bigint;

  before(async () => {
    [admin, beneficiary, randomAcc] = await hre.ethers.getSigners();

    const MeowTokenFactory = await hre.ethers.getContractFactory("MeowToken");
    meowToken = await MeowTokenFactory.deploy(
      admin.address,
      admin.address,
      beneficiary.address,
    );
    initialTotalSupply = await meowToken.totalSupply();

    deployTime = await meowToken.deployTime();
  });

  describe("Inflation Calculations", () => {
    it("#currentInflationRate()", async () => {

      let newTime;
      let inflationRate = 900n;
      for (let i = 0; i < 20; i++) {
        newTime = deployTime + 31536000n * BigInt(i);

        inflationRate = await meowToken.currentInflationRate(i);
      }

      inflationRate = await meowToken.currentInflationRate(deployTime + 1175n);

      // TODO myself: compare with expected result
    });

    // TODO: adapt this to the latest solidity code or delete!
    it("reference formula", async () => {
      const inflationRate = [
        900n,
        765n,
        650n,
        552n,
        469n,
        398n,
        338n,
        287n,
        243n,
        206n,
        175n,
        150n,
      ];

      for (let k = 0; k < 20; k++) {
        const getTotalSupplyForYear = (year : bigint) => {
          const yearIdx = Number(year);
          let totalSupply = 1000000000n * 10n ** 18n;
          let tokensPerYear = 0n;
          for (let i = 0; i <= yearIdx; i++) {
            const rate = inflationRate[i] || 150n;
            tokensPerYear = totalSupply / 10000n * rate;
            totalSupply = i !== yearIdx ? totalSupply + tokensPerYear : totalSupply;
          }

          return {
            totalSupply,
            tokensPerYear,
          };
        };

        const initialSupply = 1000000000n * 10n ** 18n;
        const startTime = 1722542400n;
        const currentTime = startTime + 31536000n * BigInt(k);
        const timeDiff = currentTime - startTime;

        const yearsPassed = timeDiff / 31536000n;
        const {
          totalSupply,
          tokensPerYear,
        } = getTotalSupplyForYear(yearsPassed);

        const yearStartTime = startTime + yearsPassed * 31536000n;
        const tokensPerPeriod = tokensPerYear * (currentTime - yearStartTime) / 31536000n;
        const mintableTokens = totalSupply - initialSupply + tokensPerPeriod;
        // console.log(
        //   "Years Passed:", yearsPassed.toString(), ", ",
        //   "Inflation Rate (out of 10,000%):", inflationRate[Number(yearsPassed)] || 150n, ", ",
        //   "Mintable Tokens Per Year:", mintableTokens.toString(), ", ",
        //   "Total Supply:", totalSupply.toString()
        // );
      }
    });
  });

  describe("#calculateMintableTokens()", () => {
    it("should revert when calculating tokens for time that is equal or less than last mint time", async () => {
      const lastMintTime = await meowToken.lastMintTime();
      await expect(
        meowToken.calculateMintableTokens(lastMintTime)
      ).to.be.revertedWithCustomError(
        meowToken,
        "InvalidTime"
      ).withArgs(lastMintTime, lastMintTime);
    });
  });

  describe("Minting Scenarios", () => {
    let lastMintTime : bigint;
    let totalSupply : bigint;
    let timeOfMint1 : bigint;
    let firstMintAmtRef : bigint;

    it("Should mint proper amount based on seconds if called in the middle of the first year", async () => {
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


  //
  // MY
  // MY
  // MY
  // MY
  // MY
  // MY
  // MY
  // MY
  //


  describe("Minting scenarios, where each test has clear contract", () => {

    const getYearMintableTokensAmount = async (year : number) => {

      const inflationRate = await meowToken.YEARLY_INFLATION_RATES(year);
      const tokensPerYearRef = (initialTotalSupply * inflationRate) / 10000n;

      return tokensPerYearRef;
    };

    beforeEach(async () => {
      [admin, beneficiary] = await hre.ethers.getSigners();

      const MeowTokenFactory = await hre.ethers.getContractFactory("MeowToken");
      meowToken = await MeowTokenFactory.deploy(admin.address, admin.address, beneficiary.address);
      initialTotalSupply = await meowToken.totalSupply();

      deployTime = await meowToken.deployTime();
    });

    it("Should revert with `InvalidTime` error with 0 passed time", async () => {

      deployTime = await meowToken.deployTime();

      // spend 0 seconds
      const firstMintTime = deployTime;

      await expect(
        await meowToken.calculateMintableTokens(firstMintTime)
      ).to.be.revertedWithCustomError(
        meowToken,
        "InvalidTime",
      ).withArgs(
        firstMintTime - 2n,
        deployTime - 2n
      );
    });

    it("Should revert with `InvalidTime` when passed time earlier than deploytime", async () => {
      deployTime = await meowToken.deployTime();

      await expect(
        await meowToken.calculateMintableTokens(deployTime - 31536000n)
      ).to.be.revertedWithCustomError(
        meowToken,
        "InvalidTime",
      ).withArgs(
        deployTime - 31536000n,
        deployTime - 31536000n
      );
    });

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