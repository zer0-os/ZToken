import * as hre from "hardhat";
import { expect } from "chai";
import { MeowToken } from "../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";


const YEAR_IN_SECONDS = 31536000n;
let initialTotalSupply : bigint;


describe("MeowToken Test", () => {
  let meowToken : MeowToken;
  let admin : SignerWithAddress;
  let beneficiary : SignerWithAddress;
  let randomAcc : SignerWithAddress;

  before(async () => {
    [admin, beneficiary, randomAcc] = await hre.ethers.getSigners();

    const MeowTokenFactory = await hre.ethers.getContractFactory("MeowToken");
    meowToken = await MeowTokenFactory.deploy(
      admin.address,
      admin.address,
      beneficiary.address,
    );
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
        console.log(
          "Years Passed:", yearsPassed.toString(), ", ",
          "Inflation Rate (out of 10,000%):", inflationRate[Number(yearsPassed)] || 150n, ", ",
          "Mintable Tokens Per Year:", mintableTokens.toString(), ", ",
          "Total Supply:", totalSupply.toString()
        );
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

  describe.only("Minting Scenarios", () => {
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

  describe.only("Burn on Transfer to Token Address", () => {
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

  describe.only("#setMintBeneficiary()", () => {
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
