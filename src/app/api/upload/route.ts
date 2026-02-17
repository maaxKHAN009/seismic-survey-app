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

    console.log(`Uploading to R2: ${fileName}, Content-Type: ${file.type}`);

    await s3Client.send(new PutObjectCommand({
      Bucket: 'seismic-photos',
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
      // ACL: 'public-read' // Uncomment if your bucket isn't public by default
    }));

    // Construct the public URL
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${fileName}`;
    console.log(`Upload successful. Public URL: ${publicUrl}`);

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error("R2 Upload Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Upload failed", details: errorMessage },
      { status: 500 }
    );
  }
}