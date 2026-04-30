import ExcelJS from 'exceljs';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const excelPath = args.find(arg => !arg.startsWith('--'));
const isDryRun = args.includes('--dry-run');

const loadEnvLocal = () => {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
};

loadEnvLocal();

if (!excelPath) {
  console.error('Usage: node scripts/cleanup_r2_unused.mjs <path-to-excel> [--dry-run]');
  process.exit(1);
}

const requiredEnv = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
const missing = requiredEnv.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const BUCKET = process.env.R2_BUCKET || 'seismic-photos';
const PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

const extractKeyFromUrl = (urlString) => {
  try {
    const url = new URL(urlString);
    let key = url.pathname || '';
    if (key.startsWith('/')) key = key.slice(1);
    return key || null;
  } catch {
    return null;
  }
};

const extractUsedKeysFromExcel = async (filePath) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const usedKeys = new Set();

  workbook.eachSheet((worksheet) => {
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        const value = cell.value;
        const hyperlink = typeof value === 'object' && value && 'hyperlink' in value
          ? value.hyperlink
          : cell.hyperlink;

        if (typeof hyperlink === 'string' && hyperlink.length > 0) {
          const key = extractKeyFromUrl(hyperlink);
          if (key) usedKeys.add(key);
        }
      });
    });
  });

  return usedKeys;
};

const listAllKeys = async () => {
  const keys = [];
  let ContinuationToken;

  do {
    const response = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      ContinuationToken
    }));

    (response.Contents || []).forEach(item => {
      if (item.Key) keys.push(item.Key);
    });

    ContinuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (ContinuationToken);

  return keys;
};

const deleteKeys = async (keys) => {
  const batchSize = 1000;
  let deleted = 0;

  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    if (batch.length === 0) continue;

    await s3.send(new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: batch.map(Key => ({ Key })) }
    }));

    deleted += batch.length;
    console.log(`Deleted ${deleted}/${keys.length}...`);
  }
};

const main = async () => {
  console.log(`Reading Excel: ${excelPath}`);
  const usedKeys = await extractUsedKeysFromExcel(excelPath);
  console.log(`Found ${usedKeys.size} used image links in Excel.`);

  if (PUBLIC_URL) {
    const withPrefix = new Set();
    usedKeys.forEach(key => {
      if (key.startsWith(PUBLIC_URL.replace(/https?:\/\//, ''))) {
        const trimmed = key.replace(/^.*?\//, '');
        if (trimmed) withPrefix.add(trimmed);
      } else {
        withPrefix.add(key);
      }
    });
    usedKeys.clear();
    withPrefix.forEach(key => usedKeys.add(key));
  }

  console.log(`Listing objects in bucket: ${BUCKET}`);
  const allKeys = await listAllKeys();
  console.log(`Bucket has ${allKeys.length} objects.`);

  const unusedKeys = allKeys.filter(key => !usedKeys.has(key));
  console.log(`Unused objects: ${unusedKeys.length}`);

  if (unusedKeys.length === 0) {
    console.log('No unused objects to delete.');
    return;
  }

  if (isDryRun) {
    console.log('Dry run enabled. No deletions performed.');
    return;
  }

  console.log('Deleting unused objects...');
  await deleteKeys(unusedKeys);
  console.log('Cleanup complete.');
};

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
