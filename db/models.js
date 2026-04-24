import { Product, Variation, Option } from './schema.js';

/**
 * MongoDB-based database operations using Mongoose
 * Uses referenced Product -> Variation -> Option collections
 */

const toPlainProduct = (productDoc) => {
  if (!productDoc) return null;

  const product = productDoc.toObject ? productDoc.toObject() : productDoc;
  const variations = Array.isArray(product.variations) ? product.variations : [];

  return {
    ...product,
    variations: variations.map((variation) => ({
      ...variation,
      options: Array.isArray(variation.options) ? variation.options : []
    }))
  };
};

const hydrateProductById = async (id) => {
  const product = await Product.findById(id)
    .select('-__v')
    .populate({
      path: 'variations',
      select: '-__v',
      populate: {
        path: 'options',
        select: '-__v'
      }
    });

  return toPlainProduct(product);
};

const hydrateProducts = async (query = {}) => {
  const products = await Product.find(query)
    .select('-__v')
    .populate({
      path: 'variations',
      select: '-__v',
      populate: {
        path: 'options',
        select: '-__v'
      }
    });

  return products.map(toPlainProduct);
};

export const models = {
  // Product operations
  async createProduct(data) {
    const product = new Product({
      name: data.name,
      SKU: data.SKU,
      baseModelUrl: data.baseModelUrl || null,
      variations: []
    });

    await product.save();

    const safeVariations = Array.isArray(data.variations) ? data.variations : [];
    for (const variationData of safeVariations) {
      const variation = new Variation({
        productId: product._id,
        name: variationData.name,
        type: variationData.type,
        options: []
      });
      await variation.save();

      const safeOptions = Array.isArray(variationData.options) ? variationData.options : [];
      for (const optionData of safeOptions) {
        const option = new Option({
          productId: product._id,
          variationId: variation._id,
          name: optionData.name,
          value: optionData.value,
          modelUrl: optionData.modelUrl || null,
          priceModifier: optionData.priceModifier || 0
        });
        await option.save();
        variation.options.push(option._id);
      }

      variation.updatedAt = new Date();
      await variation.save();
      product.variations.push(variation._id);
    }

    product.updatedAt = new Date();
    await product.save();

    return await hydrateProductById(product._id);
  },

  async getProducts() {
    return await hydrateProducts();
  },

  async getProductById(id) {
    return await hydrateProductById(id);
  },

  async getProductBySKU(sku) {
    const products = await hydrateProducts({ SKU: sku });
    return products[0] || null;
  },

  async updateProduct(id, updateData) {
    const product = await Product.findById(id);
    if (!product) return null;

    if (updateData.name) product.name = updateData.name;
    if (updateData.baseModelUrl !== undefined) product.baseModelUrl = updateData.baseModelUrl;
    product.updatedAt = new Date();

    await product.save();
    return await hydrateProductById(id);
  },

  async deleteProduct(id) {
    const product = await Product.findById(id);
    if (!product) return null;

    const variationIds = product.variations.map((variationId) => variationId.toString());
    await Option.deleteMany({ productId: id });
    await Variation.deleteMany({ productId: id });
    const deletedProduct = await Product.findByIdAndDelete(id).select('-__v');

    return {
      ...(deletedProduct?.toObject ? deletedProduct.toObject() : deletedProduct),
      variations: variationIds
    };
  },

  // Variation operations
  async addVariation(productId, variationData) {
    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');

    const variation = new Variation({
      productId,
      name: variationData.name,
      type: variationData.type,
      options: []
    });

    await variation.save();

    product.variations.push(variation._id);
    product.updatedAt = new Date();
    await product.save();

    return variation.toObject();
  },

  async getVariation(productId, variationId) {
    const product = await Product.findById(productId).select('_id');
    if (!product) return null;

    return await Variation.findOne({ _id: variationId, productId }).select('-__v');
  },

  // Option operations
  async addOption(productId, variationId, optionData) {
    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');

    const variationDoc = await Variation.findOne({ _id: variationId, productId });
    if (!variationDoc) throw new Error('Variation not found');

    const option = new Option({
      productId,
      variationId,
      name: optionData.name,
      value: optionData.value,
      modelUrl: optionData.modelUrl || null,
      priceModifier: optionData.priceModifier || 0
    });

    await option.save();

    variationDoc.options.push(option._id);
    variationDoc.updatedAt = new Date();
    await variationDoc.save();

    product.updatedAt = new Date();
    await product.save();

    return option.toObject();
  },

  async getOption(productId, variationId, optionId) {
    const product = await Product.findById(productId).select('_id');
    if (!product) return null;

    const variation = await Variation.findOne({ _id: variationId, productId }).select('_id');
    if (!variation) return null;

    return await Option.findOne({ _id: optionId, variationId, productId }).select('-__v');
  },

  // Update option model URL
  async updateOptionModelUrl(productId, variationId, optionId, modelUrl) {
    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');

    const variation = await Variation.findOne({ _id: variationId, productId });
    if (!variation) throw new Error('Variation not found');

    const option = await Option.findOne({ _id: optionId, variationId, productId });
    if (!option) throw new Error('Option not found');

    option.modelUrl = modelUrl;
    option.updatedAt = new Date();
    variation.updatedAt = new Date();
    product.updatedAt = new Date();

    await option.save();
    await variation.save();
    await product.save();
    return option;
  },

  // Delete an option from a variation
  async deleteOption(productId, variationId, optionId) {
    console.log('deleteOption called:', { productId, variationId, optionId });
    
    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');

    const variation = await Variation.findOne({ _id: variationId, productId });
    if (!variation) throw new Error('Variation not found');

    const option = await Option.findOne({ _id: optionId, variationId, productId });
    if (!option) throw new Error('Option not found');

    variation.options.pull(optionId);
    variation.updatedAt = new Date();
    product.updatedAt = new Date();
    
    await variation.save();
    await Option.deleteOne({ _id: optionId, variationId, productId });
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

