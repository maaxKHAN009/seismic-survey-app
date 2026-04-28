import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '@/lib/s3';

const requiredEnvVars = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_URL'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.error('Missing required R2 environment variables:', missingVars);
}

const BUCKET_NAME = 'seismic-photos';

const sanitizeFileName = (name: string) => {
  return name.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80);
};

export async function POST(request: NextRequest) {
  try {
    if (missingVars.length > 0) {
      return NextResponse.json(
        { error: 'Server configuration error', details: `Missing: ${missingVars.join(', ')}` },
        { status: 500 }
      );
    }

    const body = await request.json();
    const contentType = String(body?.contentType || 'application/octet-stream');
    const rawFileName = String(body?.fileName || `offline-${Date.now()}.jpg`);
    const fileName = sanitizeFileName(rawFileName) || `offline-${Date.now()}.jpg`;

    const key = `${Date.now()}-${fileName}`;
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 15 * 60 });
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

    return NextResponse.json({ uploadUrl, publicUrl, key });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Presigned URL failed', details: errorMessage },
      { status: 500 }
    );
  }
}
