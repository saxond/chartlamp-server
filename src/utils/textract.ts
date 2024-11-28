

import { TextractClient } from '@aws-sdk/client-textract';

export const textractClient = new TextractClient({
    region: process.env.AWS_REGION as string,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.AWS_SECRET as string,
    },
  });
  
