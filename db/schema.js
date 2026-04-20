import mongoose from 'mongoose';

const { Schema } = mongoose;

// Option Schema (nested in Variation)
const optionSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  value: {
    type: String,
    required: true
  },
  modelUrl: {
    type: String,
    default: null
  },
  priceModifier: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Variation Schema (nested in Product)
const variationSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  options: [optionSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Product Schema
const productSchema = new Schema({
  name: {
    type: String,
    required: true,
    index: true
  },
  SKU: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  baseModelUrl: {
    type: String,
    default: null
  },
  variations: [variationSchema],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create models
export const Product = mongoose.model('Product', productSchema);
export const Variation = mongoose.model('Variation', variationSchema);
export const Option = mongoose.model('Option', optionSchema);

export { productSchema, variationSchema, optionSchema };
