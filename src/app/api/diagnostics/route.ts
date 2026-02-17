import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const envVars = {
    R2_ENDPOINT: process.env.R2_ENDPOINT ? '✓ Set' : '✗ Missing',
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ? '✓ Set' : '✗ Missing',
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ? '✓ Set' : '✗ Missing',
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL ? '✓ Set' : '✗ Missing',
  };

  const endpointValue = process.env.R2_ENDPOINT || 'Not set';
  const publicUrlValue = process.env.R2_PUBLIC_URL || 'Not set';

  return NextResponse.json({
    environment: process.env.NODE_ENV,
    envVars,
    endpoint: {
      value: endpointValue,
      preview: endpointValue.substring(0, 10) + '...' + endpointValue.substring(endpointValue.length - 10)
    },
    publicUrl: {
      value: publicUrlValue,
      preview: publicUrlValue.substring(0, 15) + '...'
    },
    timestamp: new Date().toISOString(),
    note: 'If all are "✓ Set", environment variables are configured correctly'
  });
}
