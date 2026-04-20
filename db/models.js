import { Product } from './schema.js';

/**
 * MongoDB-based database operations using Mongoose
 * Uses Product model which contains nested Variations and Options
 */

export const models = {
  // Product operations
  async createProduct(data) {
    const normalizedVariations = Array.isArray(data.variations)
      ? data.variations.map((variation) => ({
          name: variation.name,
          type: variation.type,
          options: Array.isArray(variation.options)
            ? variation.options.map((option) => ({
                name: option.name,
                value: option.value,
                modelUrl: option.modelUrl || null,
                priceModifier: option.priceModifier || 0
              }))
            : []
        }))
      : [];

    const product = new Product({
      name: data.name,
      SKU: data.SKU,
      baseModelUrl: data.baseModelUrl || null,
      variations: normalizedVariations
    });
    return await product.save();
  },

  async getProducts() {
    return await Product.find().select('-__v');
  },

  async getProductById(id) {
    return await Product.findById(id).select('-__v');
  },

  async getProductBySKU(sku) {
    return await Product.findOne({ SKU: sku }).select('-__v');
  },

  async updateProduct(id, updateData) {
    const product = await Product.findById(id);
    if (!product) return null;

    if (updateData.name) product.name = updateData.name;
    if (updateData.baseModelUrl) product.baseModelUrl = updateData.baseModelUrl;
    product.updatedAt = new Date();

    return await product.save();
  },

  async deleteProduct(id) {
    return await Product.findByIdAndDelete(id);
  },

  // Variation operations
  async addVariation(productId, variationData) {
    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');

    const variation = {
      name: variationData.name,
      type: variationData.type,
      options: []
    };

    product.variations.push(variation);
    product.updatedAt = new Date();
    const saved = await product.save();

    // Return the newly added variation
    return saved.variations[saved.variations.length - 1];
  },

  async getVariation(productId, variationId) {
    const product = await Product.findById(productId);
    if (!product) return null;
    return product.variations.id(variationId);
  },

  // Option operations
  async addOption(productId, variationId, optionData) {
    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');

    const variation = product.variations.id(variationId);
    if (!variation) throw new Error('Variation not found');

    const option = {
      name: optionData.name,
      value: optionData.value,
      modelUrl: optionData.modelUrl || null,
      priceModifier: optionData.priceModifier || 0
    };

    variation.options.push(option);
    product.updatedAt = new Date();
    const saved = await product.save();

    // Return the newly added option
    return variation.options[variation.options.length - 1];
  },

  async getOption(productId, variationId, optionId) {
    const product = await Product.findById(productId);
    if (!product) return null;

    const variation = product.variations.id(variationId);
    if (!variation) return null;

    return variation.options.id(optionId);
  },

  // Update option model URL
  async updateOptionModelUrl(productId, variationId, optionId, modelUrl) {
    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');

    const variation = product.variations.id(variationId);
    if (!variation) throw new Error('Variation not found');

    const option = variation.options.id(optionId);
    if (!option) throw new Error('Option not found');

    option.modelUrl = modelUrl;
    option.updatedAt = new Date();
    product.updatedAt = new Date();

    await product.save();
    return option;
  },

  // Delete an option from a variation
  async deleteOption(productId, variationId, optionId) {
    console.log('deleteOption called:', { productId, variationId, optionId });
    
    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');

    const variation = product.variations.id(variationId);
    if (!variation) throw new Error('Variation not found');

    const option = variation.options.id(optionId);
    if (!option) throw new Error('Option not found');

    // Remove the option from the variation
    variation.options.pull(optionId);
    product.updatedAt = new Date();
    
    await product.save();
    console.log('Option deleted successfully');
    return option;
  },

  // Seed data for demo
  async seedData() {
    // Check if products already exist
    const count = await Product.countDocuments();
    if (count > 0) {
      console.log('Database already seeded');
      return;
    }

    const product = await this.createProduct({
      name: 'Premium T-Shirt',
      SKU: 'TSHIRT-001',
      baseModelUrl: 'https://example.com/models/tshirt-base.glb'
    });

    const fitVar = await this.addVariation(product._id, {
      name: 'Fit',
      type: 'fit'
    });

    await this.addOption(product._id, fitVar._id, {
      name: 'Regular',
      value: 'regular'
    });

    await this.addOption(product._id, fitVar._id, {
      name: 'Oversized',
      value: 'oversized'
    });

    const fabricVar = await this.addVariation(product._id, {
      name: 'Fabric',
      type: 'fabric'
    });

    await this.addOption(product._id, fabricVar._id, {
      name: 'Cotton',
      value: 'cotton'
    });

    await this.addOption(product._id, fabricVar._id, {
      name: 'Polyester',
      value: 'polyester'
    });

    console.log('Database seeded successfully');
    return product;
  }
};

export default models;

