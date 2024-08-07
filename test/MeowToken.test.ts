import * as hre from "hardhat";
import { ethers } from "ethers";
import { expect } from "chai";
import { MeowToken } from "../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { percents } from "./helpers/percents";


describe("MeowToken Test", () => {
  let meowToken : MeowToken;
  let admin : SignerWithAddress;

  beforeEach(async () => {
    [admin] = await hre.ethers.getSigners();

    const MeowTokenFactory = await hre.ethers.getContractFactory("MeowToken");
    meowToken = await MeowTokenFactory.deploy(admin.address, admin.address);
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

    it("#calculateMintableTokens()", async () => {
      const newDeployTime = 1722542400n;
      await meowToken.setDeployTime(newDeployTime);

      // const curTime = newDeployTime + 31536000n / 5n;
      const curTime = 1770498000n;
      // const refAmount = 710031064917234384471793251n;

      const tokens = await meowToken.calculateMintableTokens(curTime);
      console.log("Tokens: ", tokens.toString());
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

    it("#tokens()", async () => {
      const newDeployTime = 1722542400n;
      await meowToken.setDeployTime(newDeployTime);

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
        await meowToken.calculateMintableTokens(firstMintTime)
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

        const tokensFromContract = await meowToken.calculateMintableTokens(currentTime);

        expect(
          tokensFromContract
        ).to.be.equal(
          currentTokens += currentTokens / 100n * percents[year]
        );
      }
    });

    it("Should return correct years amount of tokens, increased each year (another)", async () => {
      const resultTokens = [
        0,
        90000000000000000000000000,
        173385000000000000000000000,
        249655025000000000000000000,
        318635982380000000000000000,
        380480009953622000000000000,
        435423114349776155600000000,
        483940415614798589659280000,
        526529505542943309182501336,
        563624172527636831595636118,
        595834830481706150326506222,
        623761940015136007957220080,
        648118369115363048076578381,
        672840144652093493797727056,
        697932746821874896204692961,
        723401738024203019647763355,
      ];

      const initialSupply = 1000000000n * 10n ** 18n;

      const deployTime = 1722542400n;
      let currentTime = deployTime;

      for (let year = 1; year < 15; year++) {
        currentTime += 31536000n;

        const tokensFromContract = await meowToken.tokens(currentTime);

        await expect(
          tokensFromContract
        ).to.be.equal(
          resultTokens[year]
        );
      }

    });

    it("Should return correct amount of tokens, increased each 10000 sec", async () => {

    });
  });

  it("#getInflation()", async () => {
    const newDeployTime = 1722542400n;
    await meowToken.setDeployTime(newDeployTime);

    // timeDiff = 47,955,600
    const curTime = 1770498000n;

    const tokens = await meowToken.getInflation(curTime);
    console.log("Tokens: ", tokens.toString());
  });
});
