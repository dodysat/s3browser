import { S3Client, ListBucketsCommand, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import { useAuthStore } from "@/stores/auth"

const authStore = useAuthStore()

let s3Client;

const setCredentials = () => {
  s3Client = new S3Client({
    region: authStore.region,
    endpoint: authStore.endpoint,
    credentials: {
      accessKeyId: authStore.accessKeyId,
      secretAccessKey: authStore.secretAccessKey,
    },
  });
}

const listBuckets = async () => {
  setCredentials()
  try {
    const data = await s3Client.send(new ListBucketsCommand({}));
    return data.Buckets;
  } catch (err) {
    throw new Error(err);
  }
}

const listObjects = async ({
  Bucket,
  Prefix,
  MaxKeys,
  ContinuationToken
}) => {
  setCredentials()
  try {
    const data = await s3Client.send(new ListObjectsV2Command({
      Bucket,
      Prefix,
      MaxKeys,
      ContinuationToken,
      Delimiter: "/",
    }));

    return {
      Contents: data.Contents,
      CommonPrefixes: data.CommonPrefixes,
      NextContinuationToken: data.NextContinuationToken,
    }
  } catch (err) {
    throw new Error(err);
  }
}

const checkConnection = async () => {
  setCredentials()
  if (!authStore.bucket) {
    try {
      await listBuckets();
    } catch (error) {
      throw new Error(error);
    }
  } else {
    try {
      const params = {
        Bucket: authStore.bucket,
        Key: 'key',
      };
      await s3Client.send(new HeadObjectCommand(params));
      return true;
    } catch (err) {
      if (err.name === "NotFound") {
        return true
      } else if (err.name === "Forbidden") {
        throw new Error("Access denied.");
      } else {
        throw new Error(err);
      }
    }
  }
}


export { listBuckets, listObjects, checkConnection }