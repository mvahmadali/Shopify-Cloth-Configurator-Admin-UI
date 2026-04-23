const ORDER_DETAIL_FIELDS = [
  { name: 'Type', source: 'configuration.type', fallback: 'Three piece' },
  { name: 'Fit', source: 'configuration.fit', fallback: 'Slim' },
  { name: 'Style', source: 'configuration.style', fallback: 'Single breast' },
  { name: 'Shoulderpad', source: 'configuration.shoulderPad', fallback: 'Italian' },
  { name: 'Fabric Brand', source: 'fabric.brand', fallback: 'Outfitters' },
  { name: 'Fabric Color', source: 'fabric.color', fallback: 'Blue' },
  { name: 'Fabric Composition', source: 'fabric.composition', fallback: 'Wool' },
  { name: 'Fabric Occasion', source: 'fabric.occasion', fallback: 'Business' },
  { name: 'Fabric Pattern', source: 'fabric.pattern', fallback: 'Solid' },
  { name: 'Fabric Season', source: 'fabric.season', fallback: 'Spring' },
  {
    name: 'Fabric Price',
    value: ({ safeFabricPrice }) => safeFabricPrice.toFixed(2)
  },
  {
    name: 'Overall Price',
    value: ({ finalPrice }) => finalPrice.toFixed(2)
  },
  { name: 'Lapel Style', source: 'configuration.lapelStyle', fallback: 'Notch' },
  { name: 'Lapel Button Hole', source: 'configuration.lapelButtonHole', fallback: 'Yes' },
  { name: 'Button Style', source: 'configuration.buttonStyle', fallback: 'Brown' },
  { name: 'Sleeve Buttons', source: 'configuration.sleeveButtons', fallback: 'Three buttons' },
  { name: 'Jacket Pockets', source: 'configuration.jacketPockets', fallback: 'Flap pockets' },
  { name: 'Jacket Vents', source: 'configuration.jacketVents', fallback: 'Side vents' },
  { name: 'Add Pickstitch', source: 'configuration.addPickStitch', fallback: 'Yes' },
  { name: 'Pickstitch Color', source: 'configuration.pickStitchColor', fallback: 'White' },
  { name: 'Monogram Color', source: 'monogram.color', fallback: 'White' },
  { name: 'Monogram Text', source: 'monogram.text', fallback: '' },
  { name: 'Configuration ID', source: 'configuration.id', fallback: 'n/a' },
  {
    name: 'Has Arms',
    value: ({ configuration }) => String(configuration.hasArms ?? true)
  },
  {
    name: 'Has Shirt',
    value: ({ configuration }) => String(configuration.hasShirt ?? false)
  },
  {
    name: 'Has Tie',
    value: ({ configuration }) => String(configuration.hasTie ?? false)
  },
  {
    name: 'Has Double Arms',
    value: ({ configuration }) => String(configuration.hasDoubleArms ?? false)
  }
];

const getValueByPath = (context, path) => {
  return path.split('.').reduce((current, segment) => {
    if (current == null) {
      return undefined;
    }

    return current[segment];
  }, context);
};

export const buildOrderProperties = (context) => {
  return ORDER_DETAIL_FIELDS.map(field => {
    const resolvedValue = field.value
      ? field.value(context)
      : getValueByPath(context, field.source) ?? field.fallback;

    return {
      name: field.name,
      value: String(resolvedValue)
    };
  });
};
