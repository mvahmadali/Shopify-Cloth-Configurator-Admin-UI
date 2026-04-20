import express from 'express';
import { models } from '../db/models.js';

const router = express.Router();

/**
 * GET /api/admin/products
 * Returns all products with their variations and options
 */
router.get('/', async (req, res, next) => {
  try {
    const products = await models.getProducts();
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/products/:id
 * Returns a specific product with all its structure
 */
router.get('/:id', async (req, res, next) => {
  try {
    const product = await models.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/products
 * Create a new product with variations and options
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, SKU, baseModelUrl, variations } = req.body;
    
    if (!name || !SKU) {
      return res.status(400).json({
        success: false,
        error: 'Name and SKU are required'
      });
    }

    // Check if SKU already exists
    const existing = await models.getProductBySKU(SKU);
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Product with this SKU already exists'
      });
    }

    const safeVariations = Array.isArray(variations) ? variations : [];

    for (const variation of safeVariations) {
      if (!variation?.name || !variation?.type) {
        return res.status(400).json({
          success: false,
          error: 'Each variation requires name and type'
        });
      }

      const safeOptions = Array.isArray(variation.options) ? variation.options : [];
      for (const option of safeOptions) {
        if (!option?.name || !option?.value) {
          return res.status(400).json({
            success: false,
            error: 'Each option requires name and value'
          });
        }
      }
    }

    const product = await models.createProduct({
      name,
      SKU,
      baseModelUrl,
      variations: safeVariations
    });

    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/products/:productId/variations
 * Add a variation to a product
 */
router.post('/:productId/variations', async (req, res, next) => {
  try {
    const { name, type } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({
        success: false,
        error: 'Name and type are required'
      });
    }

    const variation = await models.addVariation(req.params.productId, {
      name,
      type
    });

    res.status(201).json({
      success: true,
      data: variation
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/products/:productId/variations/:variationId/options
 * Add an option to a variation
 */
router.post('/:productId/variations/:variationId/options', async (req, res, next) => {
  try {
    const { name, value, priceModifier } = req.body;
    
    if (!name || !value) {
      return res.status(400).json({
        success: false,
        error: 'Name and value are required'
      });
    }

    const option = await models.addOption(
      req.params.productId,
      req.params.variationId,
      {
        name,
        value,
        priceModifier
      }
    );

    res.status(201).json({
      success: true,
      data: option
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/products/:id
 * Update a product's basic information
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const { name, baseModelUrl } = req.body;
    
    const product = await models.updateProduct(req.params.id, {
      name,
      baseModelUrl
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/products/:id
 * Delete a product and all its variations and options
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const product = await models.deleteProduct(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      message: 'Product deleted successfully',
      data: product
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/products/:productId/variations/:variationId/options/:optionId
 * Delete a single option from a variation
 */
router.delete('/:productId/variations/:variationId/options/:optionId', async (req, res, next) => {
  try {
    const { productId, variationId, optionId } = req.params;
    
    console.log('Delete option request:', { productId, variationId, optionId });
    
    const option = await models.deleteOption(productId, variationId, optionId);

    res.json({
      success: true,
      message: 'Option deleted successfully',
      data: option
    });
  } catch (error) {
    next(error);
  }
});

export default router;
