import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: 'seismic-photos',
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
    }));

    // Replace the URL below with your R2 Public Custom Domain or worker URL
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${fileName}`;

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error("R2 Upload Error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}