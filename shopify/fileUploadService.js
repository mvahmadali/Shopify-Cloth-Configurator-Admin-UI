import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { createStagedUpload, createFile } from './graphqlClient.js';

/**
 * Upload a file (GLB or PNG) to Shopify
 * 1. Create staged upload
 * 2. Upload file to signed URL
 * 3. Create file resource in Shopify
 * 4. Return CDN URL
 */
export async function uploadGLBToShopify(filePath, originalName = null) {
  try {
    // Read file
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = originalName || filePath.split(/[/\\]/).pop();
    const fileSize = fileBuffer.length;
    
    // Determine MIME type based on file extension
    let mimeType = 'model/gltf-binary';
    if (fileName.endsWith('.png')) {
      mimeType = 'image/png';
    } else if (fileName.endsWith('.glb')) {
      mimeType = 'model/gltf-binary';
    }

    console.log(`Uploading ${fileName} (${fileSize} bytes) to Shopify... [${mimeType}]`);

    // Step 1: Create staged upload
    const stagedTarget = await createStagedUpload(fileName, fileSize, mimeType);
    console.log('Staged upload created:', { 
      url: stagedTarget.url.substring(0, 100) + '...',
      resourceUrl: stagedTarget.resourceUrl.substring(0, 100) + '...',
      hasParameters: !!stagedTarget.parameters
    });

    // Step 3: Upload file to signed URL using PUT request (simpler, avoids signature issues)
    console.log('Uploading file to Shopify via PUT request...');
    const uploadResponse = await axios.put(stagedTarget.url, fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': fileSize
      }
    });
    console.log('File uploaded to S3 successfully');

    // Step 4: Create file resource (get CDN URL)
    console.log('Creating file resource in Shopify...');
    const cdnUrl = await createFile(stagedTarget.resourceUrl);
    console.log(`File available at: ${cdnUrl}`);

    // Clean up local file
    fs.unlinkSync(filePath);

    return cdnUrl;
  } catch (error) {
    console.error('Upload error details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data ? error.response.data.substring(0, 200) : 'N/A',
      code: error.code
    });
    throw new Error(`Failed to upload file to Shopify: ${error.message}`);
  }
}

export default uploadGLBToShopify;
