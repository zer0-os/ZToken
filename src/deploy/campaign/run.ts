import { getLogger } from "@zero-tech/zdc";
import { runZTokenCampaign } from "./campaign";


const logger = getLogger();

runZTokenCampaign().catch(error => {
  logger.error(error.stack);
  process.exit(1);
}).finally(() => {
  process.exit(0);
});
