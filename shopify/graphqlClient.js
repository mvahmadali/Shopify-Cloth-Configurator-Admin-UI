import { GraphQLClient } from 'graphql-request';
import dotenv from 'dotenv';

dotenv.config();

const client = new GraphQLClient(
  `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/graphql.json`,
  {
    headers: {
      'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
      'Content-Type': 'application/json'
    }
  }
);

/**
 * Create a staged upload for file upload to Shopify
 * Returns upload parameters and URL
 */
export async function createStagedUpload(filename, fileSize, mimeType) {
  const query = `
    mutation CreateStagedUpload($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters {
            name
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: [{
      filename,
      fileSize: fileSize.toString(), // Convert to string as required by Shopify API
      mimeType,
      resource: "FILE" // Use FILE resource type for generic file uploads
    }]
  };

  console.log('Creating staged upload with variables:', JSON.stringify(variables, null, 2));

  const response = await client.request(query, variables);

  if (response.stagedUploadsCreate.userErrors.length > 0) {
    throw new Error(
      `Shopify error: ${response.stagedUploadsCreate.userErrors[0].message}`
    );
  }

  return response.stagedUploadsCreate.stagedTargets[0];
}

/**
 * Sleep helper
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get file status and URL by ID
 */
export async function getFileStatus(fileId) {
  const query = `
    query GetFile($id: ID!) {
      node(id: $id) {
        ... on GenericFile {
          url
          fileStatus
        }
        ... on MediaImage {
          image {
            url
          }
          fileStatus
        }
        ... on Model3d {
          fileStatus
          sources {
            url
            format
            mimeType
          }
        }
      }
    }
  `;

  const response = await client.request(query, { id: fileId });
  const file = response.node;

  if (!file) return null;

  let url = null;
  if (file.url) url = file.url;
  else if (file.image?.url) url = file.image.url;
  else if (file.sources && file.sources.length > 0) {
    const glbSource = file.sources.find(s => s.format === 'glb' || s.mimeType === 'model/gltf-binary');
    url = glbSource ? glbSource.url : file.sources[0].url;
  }

  return {
    status: file.fileStatus,
    url
  };
}

/**
 * Create a file in Shopify after upload
 * Returns the CDN URL (polls until READY)
 */
export async function createFile(stagedTargetUrl) {
  const query = `
    mutation CreateFile($input: FileCreateInput!) {
      fileCreate(files: [$input]) {
        files {
          id
          fileStatus
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: {
      originalSource: stagedTargetUrl
    }
  };

  const response = await client.request(query, variables);

  if (response.fileCreate.userErrors.length > 0) {
    throw new Error(
      `Shopify error: ${response.fileCreate.userErrors[0].message}`
    );
  }

  const fileId = response.fileCreate.files[0].id;
  console.log(`File created with ID: ${fileId}. Checking status...`);

  // Polling logic: check every 2 seconds, max 15 attempts (30 seconds)
  let attempts = 0;
  const maxAttempts = 15;

  while (attempts < maxAttempts) {
    const fileInfo = await getFileStatus(fileId);
    
    if (fileInfo) {
      console.log(`Attempt ${attempts + 1}: Status is ${fileInfo.status}`);
      
      if (fileInfo.status === 'READY' && fileInfo.url) {
        return fileInfo.url;
      }
      
      if (fileInfo.status === 'FAILED') {
        throw new Error('Shopify file processing failed');
      }
    }

    attempts++;
    await sleep(2000);
  }

  throw new Error('Timeout waiting for Shopify file processing');
}

export default client;

