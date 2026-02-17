import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Validate environment variables at startup
const requiredEnvVars = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_URL'];
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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    // Sanitize filename to prevent URL issues
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;

    const endpoint = process.env.R2_ENDPOINT!;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
    const publicUrl = process.env.R2_PUBLIC_URL!;

    console.log(`[R2 Upload] File: ${fileName} (${buffer.length} bytes)`);
    console.log(`[R2 Upload] Endpoint: ${endpoint}`);
    console.log(`[R2 Upload] Access Key ID starts with: ${accessKeyId.substring(0, 5)}...`);
    console.log(`[R2 Upload] Public URL: ${publicUrl}`);
    console.log(`[R2 Upload] Content-Type: ${file.type}`);

    const command = new PutObjectCommand({
      Bucket: 'seismic-photos',
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
      // ACL: 'public-read' // Uncomment if your bucket isn't public by default
    });

    console.log(`[R2 Upload] Executing PutObjectCommand...`);
    await s3Client.send(command);

    // Construct the public URL
    const finalUrl = `${publicUrl}/${fileName}`;
    console.log(`[R2 Upload] SUCCESS! Public URL: ${finalUrl}`);

    return NextResponse.json({ url: finalUrl });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as any)?.$metadata?.httpStatusCode || 'Unknown';
    
    console.error(`[R2 Upload] FAILED with status ${errorCode}`);
    console.error(`[R2 Upload] Error message: ${errorMessage}`);
    console.error(`[R2 Upload] Full error:`, error);
    
    // Give more specific error messages
    let details = errorMessage;
    if (errorMessage.includes('InvalidAccessKeyId')) {
      details = 'Invalid R2 Access Key - check your R2_ACCESS_KEY_ID in Vercel environment variables';
    } else if (errorMessage.includes('SignatureDoesNotMatch')) {
      details = 'Invalid R2 Secret Key - check your R2_SECRET_ACCESS_KEY in Vercel environment variables';
    } else if (errorMessage.includes('NoSuchBucket')) {
      details = 'Bucket "seismic-photos" not found - create it or check the name';
    } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
      details = 'Cannot reach R2 endpoint - check R2_ENDPOINT URL is correct';
    }
    
    return NextResponse.json(
      { 
        error: "Upload failed", 
        details,
        statusCode: errorCode,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}