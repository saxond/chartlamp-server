import { PutObjectCommand, S3 } from "@aws-sdk/client-s3";

const globalConfig = {
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET,
  },
} as any;

const s3Client = new S3(globalConfig);

async function uploadSvgToS3(fileId: string, svgContent: string) {
  try {
    const key = `svgs/${fileId}`;
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: svgContent,
      ContentType: "image/svg+xml",
      ACL: "public-read",
    });

    const result = await s3Client.send(command);
    console.log("Uploaded SVG to S3:", result);
    // Construct the public URL
    const url = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    console.log("SVG URL:", url);

    return url;
  } catch (error) {
    console.error("Error uploading SVG to S3:", error);
    throw error;
  }
}


export {
    uploadSvgToS3,
}