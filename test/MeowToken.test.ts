/* eslint-disable prefer-arrow/prefer-arrow-functions */
import * as hre from "hardhat";
import { expect } from "chai";
import { MeowToken } from "../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { percents } from "./helpers/percents";
import { AUTH_ERROR } from "./helpers/errors";
import { TRANSFER } from "./helpers/events";
import { years } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration";


const YEAR_IN_SECONDS = 31536000n;
let initialTotalSupply : bigint;

// TODO how are these values calculated?
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

// TODO how are these values calculated?
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

// Inflation rate for each year
const inflationRates = [
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

describe("MeowToken Test", () => {
  let meowToken : MeowToken;
  let admin : SignerWithAddress;
  let beneficiary : SignerWithAddress;
  let randomAcc : SignerWithAddress;
  let deployTime : bigint;

  before(async () => {
    [admin, beneficiary, randomAcc] = await hre.ethers.getSigners();

    const MeowTokenFactory = await hre.ethers.getContractFactory("MeowToken");
    meowToken = await MeowTokenFactory.deploy(admin.address, admin.address);
    initialTotalSupply = await meowToken.totalSupply();

    deployTime = await meowToken.deployTime();
  });

  describe.only("Deployment", () => {
    describe("Access control", () => {
      it("Should set the given address as the admin and minter of the contract", async () => {
        expect(await meowToken.hasRole(await meowToken.MINTER_ROLE(), admin.address)).to.be.true;
        expect(await meowToken.hasRole(await meowToken.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;

      });

      it("Does not set other addresses with rikes on deployment", async () => {
        expect(await meowToken.hasRole(await meowToken.MINTER_ROLE(), beneficiary.address)).to.be.false;
        expect(await meowToken.hasRole(await meowToken.DEFAULT_ADMIN_ROLE(), beneficiary.address)).to.be.false;

        expect(await meowToken.hasRole(await meowToken.MINTER_ROLE(), randomAcc.address)).to.be.false;
        expect(await meowToken.hasRole(await meowToken.DEFAULT_ADMIN_ROLE(), randomAcc.address)).to.be.false;
      });
  
      it("Succeeds when an authorized address calls to mint", async () => {
        const beneficiaryBalBefore = await meowToken.balanceOf(beneficiary.address);
  
        expect(await meowToken.connect(admin).mint(beneficiary.address)).to.emit(meowToken, TRANSFER);
  
        const beneficiaryBalAfter = await meowToken.balanceOf(beneficiary.address);
  
        // Because the `time` helper from HH increments the `block.timestamp` by 1s BEFORE executing the transaction
        // we always calculate the expected amount the same way
        const mintableTokens = await meowToken.calculateMintableTokens(await time.latest() + 1);
  
        const balDiff = beneficiaryBalAfter - beneficiaryBalBefore;
        expect(balDiff).to.eq(mintableTokens);
      });
  
      it("Fails when an address that does not have the MINTER_ROLE tries to mint", async () => {
        await expect(meowToken.connect(beneficiary).mint(beneficiary.address)).to.be.revertedWithCustomError(meowToken, AUTH_ERROR);
      });
    });

    describe("Other Calcs", () => {
      it("Breaks yearSinceDeploy? ormint?", async () => {
        const deployTime = await meowToken.deployTime();

        // TODO underflows this function, just a view though so do we care?
        // const val = await meowToken.connect(admin).yearSinceDeploy(deployTime - 1000n);
      });

      it("Gets current inflation rate and returns 150 when we default", async () => {
        // We ignore 0 as it is a dummy value to make the array 1-indexed for calcs
        for(let i = 1; i < 11; i++) {
          expect(await meowToken.currentInflationRate(i)).to.eq(inflationRates[i - 1]);
        };
        // Any value higher will always return 150
        expect(await meowToken.currentInflationRate(12)).to.eq(inflationRates[inflationRates.length - 1]);
        expect(await meowToken.currentInflationRate(20)).to.eq(inflationRates[inflationRates.length - 1]);
      });
    })
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

    it("Reference formula", async () => {
      for (let k = 0; k < 20; k++) {
        const getTotalSupplyForYear = (year : bigint) => {
          const yearIdx = Number(year);
          let totalSupply = 1000000000n * 10n ** 18n;
          let tokensPerYear = 0n;
          for (let i = 0; i <= yearIdx; i++) {
            const rate = inflationRates[i] || 150n;
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


    // it("Should revert when passed time earlier than deploytime", async () => {

    // });
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

    it("Should mint proper amount at the end of the year based on `lastMintLeftoverTokens`", async () => {
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

  describe("Burn on Transfer to Token Address", () => {
    it("should burn token upon transfer to token address", async () => {
      const adminBalanceBefore = await meowToken.balanceOf(admin.address);
      const tokenSupplyBefore = await meowToken.totalSupply();
      const transferAmt = 13546846845n;

      await meowToken.connect(admin).transfer(meowToken.target, transferAmt);

      const adminBalanceAfter = await meowToken.balanceOf(admin.address);
      const tokenSupplyAfter = await meowToken.totalSupply();

      expect(adminBalanceBefore - adminBalanceAfter).to.eq(transferAmt);
      expect(tokenSupplyBefore - tokenSupplyAfter).to.eq(transferAmt);

      // make sure we can't transfer to 0x0 address
      await expect(
        meowToken.connect(admin).transfer(hre.ethers.ZeroAddress, transferAmt)
      ).to.be.revertedWithCustomError(
        meowToken,
        "ERC20InvalidReceiver"
      ).withArgs(hre.ethers.ZeroAddress);
    });

    it("should NOT burn tokens if transferred to any regular address", async () => {
      const adminBalanceBefore = await meowToken.balanceOf(admin.address);
      const tokenSupplyBefore = await meowToken.totalSupply();
      const transferAmt = 13546846845n;

      await meowToken.connect(admin).transfer(randomAcc.address, transferAmt);

      const adminBalanceAfter = await meowToken.balanceOf(admin.address);
      const tokenSupplyAfter = await meowToken.totalSupply();

      expect(adminBalanceBefore - adminBalanceAfter).to.eq(transferAmt);
      expect(tokenSupplyBefore - tokenSupplyAfter).to.eq(0n);
    });
  });
});
