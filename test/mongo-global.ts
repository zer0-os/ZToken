import { getZTokenMongoAdapter } from "../src/deploy/mongo";


export const mochaGlobalSetup = async () => {
  await getZTokenMongoAdapter();
};

export const mochaGlobalTeardown = async () => {
  const mongoAdapter = await getZTokenMongoAdapter();
  // the next line can be commented out to leave the DB after test to manually test
  // await mongoAdapter.dropDB();
  await mongoAdapter.close();
};
