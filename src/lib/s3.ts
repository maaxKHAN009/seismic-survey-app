import { S3Client } from "@aws-sdk/client-s3";

export const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT || "https://b754259008623445494d39b205c6a71a.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});