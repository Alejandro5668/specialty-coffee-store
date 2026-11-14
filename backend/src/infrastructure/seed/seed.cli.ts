import { createDocumentClient, loadDynamoConfig } from '../dynamodb/config';
import { loadSeed } from './load-seed';

const config = loadDynamoConfig(process.env);

loadSeed(createDocumentClient(config), config)
  .then(({ written, skipped }) => {
    console.log(`Seed done in ${config.region}: ${written} written, ${skipped} already there.`);
  })
  .catch((error: unknown) => {
    console.error('Seed failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
