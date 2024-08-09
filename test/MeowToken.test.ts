/* eslint-disable prefer-arrow/prefer-arrow-functions */
import * as hre from "hardhat";
import { expect } from "chai";
import { MeowToken } from "../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";


const YEAR_IN_SECONDS = 31536000n;
let initialTotalSupply : bigint;

const mintableTokensEachYear = [
  // should be values with result amounts of tokens
];

describe("MeowToken Test", () => {
  let meowToken : MeowToken;
  let admin : SignerWithAddress;
  let beneficiary : SignerWithAddress;

  before(async () => {
    [admin, beneficiary] = await hre.ethers.getSigners();

    const MeowTokenFactory = await hre.ethers.getContractFactory("MeowToken");
    meowToken = await MeowTokenFactory.deploy(admin.address, admin.address);
    initialTotalSupply = await meowToken.totalSupply();
  });

  describe("Inflation Calculations", () => {
    it("#currentInflationRate()", async () => {
      const deployTime = await meowToken.deployTime();

      let newTime;
      let inflationRate = 900n;
      for (let i = 0; i < 20; i++) {
        newTime = deployTime + 31536000n * BigInt(i);

        inflationRate = await meowToken.currentInflationRate(i);

        console.log("IDX: ", i,"New Time: ", newTime.toString(), "Inflation Rate: ", inflationRate.toString());
      }

      inflationRate = await meowToken.currentInflationRate(deployTime + 1175n);
      console.log("Inflation Rate: ", inflationRate.toString());
    });

    it("#mintableTokens()", async () => {
      const newDeployTime = 1722542400n;
      await meowToken.setDeployTime(newDeployTime);

      // const curTime = newDeployTime + 31536000n / 5n;
      const curTime = 1770498000n;
      // const refAmount = 710031064917234384471793251n;

      const tokens = await meowToken.mintableTokens(curTime);
      console.log("Tokens: ", tokens.toString());
    });

    it("#getMintableTokensAmount()", async () => {
      // const newDeployTime = 1722542400n;
      // await meowToken.setDeployTime(newDeployTime);
      const deployTime = await meowToken.deployTime();
      // const lastMintTime = await meowToken.lastMintTime();

      for (let i = 0; i < 16; i++) {
        const curTime = newDeployTime + 31536000n * BigInt(i);
        // const curTime = 1770498000n;

        const tokens = await meowToken.tokens(curTime);
        console.log("Tokens: ", tokens.toString());
      }
    });

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
        console.log(
          "Years Passed:", yearsPassed.toString(), ", ",
          "Inflation Rate (out of 10,000%):", inflationRate[Number(yearsPassed)] || 150n, ", ",
          "Mintable Tokens Per Year:", mintableTokens.toString(), ", ",
          "Total Supply:", totalSupply.toString()
        );
      }
    });

    it("Should return 0 mintable tokens with 0 passed time", async () => {
      const deployTime = 1722542400n;
      await meowToken.setDeployTime(deployTime);

      // spend 0 seconds
      const firstMintTime = deployTime;

      await expect(
        await meowToken.getMintableTokensAmount(firstMintTime)
      ).to.be.equal(
        0n
      );
    });

    it("Should return correct years amount of tokens, increased each year", async () => {

      // TODO myself: why do we dont pass initial supply?

      const deployTime = 1722542400n;

      let currentTime = deployTime;
      let currentTokens = 0n;

      for (let year = 1; year < 10; year++) {
        // + year each iteration
        currentTime += 31536000n;

        const tokensFromContract = await meowToken.getMintableTokensAmount(currentTime);

        expect(
          tokensFromContract
        ).to.be.equal(
          currentTokens += currentTokens / 100n * percents[year]
        );
      }
    });

    it("Should return correct years amount of tokens, increased each year (another)", async () => {
      const deployTime = 1722542400n;
      let currentTime = deployTime;

      for (let year = 0; year < 13; year++) {
        currentTime += 31536000n;

        await expect(
          await meowToken.getMintableTokensAmount(currentTime)
        ).to.be.equal(
          mintableTokensEachYear[year]
        );
      }
    });

    it("Should return correct amount of tokens, increased each 10.512.000 sec (1/3 part of year)", async () => {
      const deployTime = 1722542400n;
      let currentTime = deployTime;

      for (let timeInterval = 0; timeInterval < 14; timeInterval++) {
        currentTime += 10512000n;

        await expect(
          await meowToken.getMintableTokensAmount(currentTime)
        ).to.be.equal(
          mintableTokensEachYear[timeInterval] / 3n
        );
      }
    });

    it("", async () => {
      // TODO myself: deploy, wait some time, mint, then wait and mint again
    });
  });

  describe.only("Minting Scenarios", () => {
    let lastMintTime : bigint;
    let mintedLastYear : bigint;
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
      await meowToken.connect(admin).mint(beneficiary.address);
      const beneficiaryBalAfter = await meowToken.balanceOf(beneficiary.address);

      const balDiff = beneficiaryBalAfter - beneficiaryBalBefore;
      console.log("Bal Diff: ", balDiff.toString());
      expect(balDiff).to.eq(firstMintAmtRef);

      // check that all state values set properly!
      lastMintTime = await meowToken.lastMintTime();
      totalSupply = await meowToken.totalSupply();

      expect(lastMintTime).to.eq(timeOfMint1);
      expect(totalSupply).to.eq(initialTotalSupply + firstMintAmtRef);
    });

    it("should mint proper amount at the end of the year based on `lastMintLeftoverTokens`", async () => {
      const deployTime = await meowToken.deployTime();

      const tokensPerYear = initialTotalSupply * 900n / 10000n;
      const tokensPerYear2 = initialTotalSupply * 765n / 10000n;
      const tokensPerYear3 = initialTotalSupply * 650n / 10000n;

      const balanceBefore = await meowToken.balanceOf(beneficiary.address);

      const periodSeconds = 260825n;
      const secondMintTime = deployTime + (YEAR_IN_SECONDS) * 2n + periodSeconds;
      await time.increaseTo(secondMintTime);

      await meowToken.connect(admin).mint(beneficiary.address);

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
});
