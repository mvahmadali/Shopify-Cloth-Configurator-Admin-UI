import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { models } from '../db/models.js';
import uploadGLBToShopify from '../shopify/fileUploadService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Setup multer for file uploads
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'model-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Accept GLB and PNG files
    const isGLB = file.mimetype === 'model/gltf-binary' || file.originalname.endsWith('.glb');
    const isPNG = file.mimetype === 'image/png' || file.originalname.endsWith('.png');
    
    if (isGLB || isPNG) {
      cb(null, true);
    } else {
      cb(new Error('Only GLB and PNG files are allowed'));
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

/**
 * POST /api/admin/upload-model
 * Upload GLB model for a specific option
 * 
 * Required fields:
 * - productId
 * - variationId
 * - optionId
 * - file (binary GLB)
 */
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    const { productId, variationId, optionId } = req.body;

    // Validate inputs
    if (!productId || !variationId || !optionId) {
      return res.status(400).json({
        success: false,
        error: 'productId, variationId, and optionId are required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'GLB file is required'
      });
    }

    // Verify option exists
    const option = await models.getOption(productId, variationId, optionId);
    if (!option) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        error: 'Option not found'
      });
    }

    console.log(`Uploading model for option ${optionId}...`);

    // Upload to Shopify
    const modelUrl = await uploadGLBToShopify(req.file.path, req.file.originalname);

    // Update option with model URL
    const updatedOption = await models.updateOptionModelUrl(
      productId,
      variationId,
      optionId,
      modelUrl
    );

    res.status(200).json({
      success: true,
      data: {
        option: updatedOption,
        modelUrl: modelUrl
      },
      message: 'Model uploaded successfully'
    });
  } catch (error) {
    // Clean up file if it still exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
});

/**
 * POST /api/admin/upload-model/base-model
 * Upload base model (GLB or PNG) for a product
 * 
 * Required fields:
 * - productId (can be 'temp' for new products)
 * - file (binary GLB or PNG)
 */
router.post('/base-model', upload.single('file'), async (req, res, next) => {
  try {
    const { productId } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'File is required'
      });
    }

    console.log(`Uploading base model for product ${productId}...`);
    console.log(`File info:`, { name: req.file.originalname, size: req.file.size, path: req.file.path });

    // Upload to Shopify
    const modelUrl = await uploadGLBToShopify(req.file.path, req.file.originalname);
    console.log(`Successfully uploaded to Shopify: ${modelUrl}`);

    // If not a temp product, update the product with the model URL
    if (productId && productId !== 'temp') {
      await models.updateProduct(productId, { baseModelUrl: modelUrl });
    }

    res.status(200).json({
      success: true,
      data: {
        modelUrl: modelUrl,
        cdnUrl: modelUrl
      },
      message: 'Base model uploaded successfully'
    });
  } catch (error) {
    console.error('Base model upload error:', error);
    // Clean up file if it still exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
});

export default router;
