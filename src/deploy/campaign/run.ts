import { getLogger } from "@zero-tech/zdc";
import { runZTokenCampaign } from "./campaign";


runZTokenCampaign().catch(error => {
  const logger = getLogger();

  logger.error(error.stack);
  process.exit(1);
}).finally(() => {
  process.exit(0);
});
