import { NextRequest, NextResponse } from 'next/server';
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';

// Validate environment variables at startup
const requiredEnvVars = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.error('Missing required R2 environment variables:', missingVars);
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: NextRequest) {
  try {
    // Validate env vars before processing
    if (missingVars.length > 0) {
      console.error('Cannot proceed - missing env vars:', missingVars);
      return NextResponse.json(
        { error: "Server configuration error", details: `Missing: ${missingVars.join(', ')}` },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { keys } = body;
    
    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      console.log('No files to delete');
      return NextResponse.json({ success: true, deleted: 0 });
    }

    // Validate all keys are strings
    if (!keys.every((k: any) => typeof k === 'string')) {
      return NextResponse.json({ error: "All keys must be strings" }, { status: 400 });
    }

    console.log(`Deleting ${keys.length} files from R2:`, keys);

    const result = await s3Client.send(new DeleteObjectsCommand({
      Bucket: 'seismic-photos',
      Delete: {
        Objects: keys.map((k: string) => ({ Key: k })),
      },
    }));

    const deletedCount = result.Deleted?.length || 0;
    const failedCount = result.Errors?.length || 0;

    console.log(`R2 delete result: ${deletedCount} deleted, ${failedCount} failed`);

    if (result.Errors && result.Errors.length > 0) {
      console.warn('Some files failed to delete:', result.Errors);
    }

    return NextResponse.json({ 
      success: true, 
      deleted: deletedCount,
      failed: failedCount,
      errors: result.Errors
    });
  } catch (error) {
    console.error("R2 Delete Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Delete failed", details: errorMessage },
      { status: 500 }
    );
  }
}