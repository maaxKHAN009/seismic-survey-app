import { NextRequest, NextResponse } from 'next/server';
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';

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
    const { keys } = await request.json(); // Array of filenames
    if (!keys || keys.length === 0) return NextResponse.json({ success: true });

    await s3Client.send(new DeleteObjectsCommand({
      Bucket: 'seismic-photos',
      Delete: { Objects: keys.map((k: string) => ({ Key: k })) }
    }));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Purge failed" }, { status: 500 });
  }
}