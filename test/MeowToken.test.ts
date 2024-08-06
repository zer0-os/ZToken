import * as hre from "hardhat";
import { ethers } from "ethers";
import { expect } from "chai";
import { MeowToken } from "../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


describe("MeowToken Test", () => {
  let meowToken : MeowToken;
  let admin : SignerWithAddress;

  before(async () => {
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

    it.only("reference formula", async () => {
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

// 909,090,909,090,000,000,000,000,000 - 1 year
// 772,727,272,726,500,000,000,000,000 - 2 year
// 0.5206621004566210045662100456621 - portion of year passed

// 909,090,909.09 - year 1
// 772,727,272.7265 - year 2
// 0.5206621004566210045662100456621 - portion of year passed
// 402,329,804.89789571917808219178082 - from start of year 2
// 1,311,420,713.9878957191780821917808 - total

// FOR 1000000000 INITIAL SUPPLY
// 90,000,000 - year 1
// 76,500,000 - year 2 (from INITIAL) or
// 0.5206621004566210045662100456621 - portion of year passed
// 39,830,650.684931506849315068493151 - from start of year 2
// 129,830,650.68493150684931506849315 - total
// 0.2 - part of year 1 passed
// 18,000,000 - total tokens from start of year 1