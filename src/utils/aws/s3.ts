import {
  PutObjectCommand,
  S3Client,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const globalConfig = {
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET,
  },
} as any;

const client = new S3Client(globalConfig);

export const AppBucketName = "chartlamp";

async function uploadToS3(
  documentId: string,
  tempDocId: string,
  subPdfBytes: Uint8Array // Accepts PDF bytes as an argument
): Promise<string> {
  try {
    const key: string = `pdfs/${documentId}/${tempDocId}.pdf`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME || "chartlamp",
      Key: key,
      Body: subPdfBytes, // Use pdfBytes as the file content
      ContentType: "application/pdf", // Set the correct MIME type
    });

    await client.send(command);
    console.log(`Successfully uploaded to S3 with key: ${key}`);
    return key; // Return the key after successful upload
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw error;
  }
}

async function deleteFromS3(key: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME || "chartlamp",
      Key: key,
    });

    await client.send(command);
    console.log(`Successfully deleted from S3: ${key}`);
  } catch (error) {
    console.error("Error deleting from S3:", error);
    throw error;
  }
}


export { uploadToS3, deleteFromS3 };