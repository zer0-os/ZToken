import { ethers } from "ethers";


export const INFLATION_RATES_DEFAULT = [0n, 900n, 765n, 650n, 552n, 469n, 398n, 338n, 287n, 243n, 206n, 175n];
export const FINAL_INFLATION_RATE_DEFAULT = 150n;
export const MINTABLE_YEARLY_TOKENS_REF_DEFAULT = [
  ethers.parseUnits("909090909"),
  ethers.parseUnits("772727272"),
  ethers.parseUnits("656565656"),
  ethers.parseUnits("557575757"),
  ethers.parseUnits("473737373"),
  ethers.parseUnits("402020202"),
  ethers.parseUnits("341414141"),
  ethers.parseUnits("289898989"),
  ethers.parseUnits("245454545"),
  ethers.parseUnits("208080808"),
  ethers.parseUnits("176767676"),
];
export const FINAL_MINTABLE_YEARLY_TOKENS_REF_DEFAULT = ethers.parseUnits("151515151");