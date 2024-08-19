import { exec } from "child_process";
import { getLogger, getMongoAdapter, TLogger } from "@zero-tech/zdc";
import { promisify } from "util";


const execAsync = promisify(exec);


export const getZTokenMongoAdapter = async ({
  contractsVersion,
  logger,
} : {
  contractsVersion ?: string;
  logger ?: TLogger;
} = {}) => {
  if (!contractsVersion) {
    contractsVersion = "1.0.0";
  }

  return getMongoAdapter({
    logger,
    contractsVersion,
  });
};

export const startMongo = async () => {
  const logger = getLogger();

  try {
    exec("npm run mongo:start");
    logger.info("MongoDB started");
  } catch (e) {
    logger.error({
      message: "Failed to start MongoDB Docker",
      error: e,
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    throw new Error(e.message);
  }
};

export const stopMongo = async () => {
  const logger = getLogger();

  try {
    await execAsync("npm run mongo:stop");
    logger.info("MongoDB stopped");
  } catch (e) {
    logger.error({
      message: "Failed to stop MongoDB Docker",
      error: e,
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    throw new Error(e.message);
  }
};
