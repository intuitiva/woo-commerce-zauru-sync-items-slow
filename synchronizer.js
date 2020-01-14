require('dotenv').config();
const axios = require('axios');
const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;

const api = new WooCommerceRestApi({
  url: process.env.WOOCOMMERCE_URL,
  consumerKey: process.env.WOOCOMMERCE_KEY,
  consumerSecret: process.env.WOOCOMMERCE_SECRET,
  version: 'wc/v3'
});

// this will get the GIAN JSON with all the info to process
const fetchZauruData = async () => {
  console.log('STARTING');
  const response = await axios.get(
    'https://app.zauru.com/ecommerce/ecommerce_requests/get_items_for_ecommerce.json',
    {
      headers: {
        'X-User-Email': process.env.ZAURU_EMAIL,
        'X-User-Token': process.env.ZAURU_TOKEN
      }
    }
  );
  console.log('zauru data retrieved');
  return response.data;
};

// function that will add or update category in woocommerce
// it will force the parent category from the param into the woocommerce category
const addOrUpdateCategory = async (category, parent) => {
  console.log('Zauru category: ', category);
  if (category) {
    const wcCategories = (await api.get(`products/categories?name=${category}`))
      .data;
    if (!wcCategories.length) {
      console.log(`category ${category} not found in woocommerce. Creating...`);
      try {
        const createResponse = await api.post('products/categories', {
          name: category,
          parent
        });
        console.log('Created');
        return createResponse.data.id;
      } catch (ex) {
        console.log(
          `Failed in creating category ${category}: `,
          ex.response.data
        );
      }
    } else if (wcCategories[0].parent !== parent) {
      try {
        const updateResponse = await api.put(
          `products/categories/${wcCategories[0].id}`,
          {
            parent
          }
        );
        console.log('Updated');
        return updateResponse.data.id;
      } catch (ex) {
        console.log(
          `Failed in updating category ${category}: `,
          ex.response.data
        );
      }
    }
  }
};

// function that will see if Zauru category is in WooCommerce category from a parent
const updateProductCategories = async zauru => {
  for (const category of Object.keys(zauru)) {
    await addOrUpdateCategory(category, 29);
  }
};

// comparison from Zauru vs. WooCommerce skipping the categories
const isProductUpdated = (wooProduct, product) => {
  const productStock = product.stock === 'infinite' ? 1000000 : product.stock;
  const description = '<p>' + product.description + '</p>';
  return (
    product.name !== wooProduct.name ||
    (product.price && product.price !== wooProduct.regular_price) ||
    description.trim() !== wooProduct.description.trim() ||
    product.code !== wooProduct.sku ||
    productStock !== wooProduct.stock_quantity ||
    (product.weight && product.weight !== wooProduct.weight)
  );
};

// format that woocommerce recognizes
const getProductObj = (product, category, vendor, tags) => {
  const productStock = product.stock === 'infinite' ? 1000000 : product.stock;
  const description = '<p>' + product.description + '</p>';
  return {
    name: product.name,
    regular_price: product.price,
    description,
    sku: product.code,
    stock_quantity: productStock,
    weight: product.weight,
    categories: [category].concat([vendor].concat(tags))
  };
};

// this will update the products and the vendors and tags as categories
const updateProducts = async zauru => {
  for (let category in zauru) {
    for (const productKey in zauru[category]) {
      const product = zauru[category][productKey];
      const existingProduct = (await api.get(`products?sku=${product.code}`))
        .data;
      console.log(`Product: ${product.name}, found: ${existingProduct.length}`);
      // force Zauru vendor as WC category forcing parent category
      const vendorId = await addOrUpdateCategory(product.vendor, 31);
      let tags = [];
      for (const tag of product.tags) {
        // force Zauru tag as WC category forcing parent category
        tags.push(await addOrUpdateCategory(tag, 30));
      }
      try {
        if (existingProduct.length) {
          if (isProductUpdated(existingProduct[0], product)) {
            console.log('Product is updated. Updating on woocommerce');
            const updateResponse = await api.put(
              `products/${existingProduct[0].id}`,
              getProductObj(product, category, vendor, tags)
            );
            console.log('Updated');
          }
        } else {
          await api.post(
            'products',
            getProductObj(product, category, vendorId, tags)
          );
        }
      } catch (ex) {
        console.log('Failed in creating/updating product: ', ex);
      }
    }
  }
};

exports.syncWooCommerceWithZauru = async () => {
  try {
    const zauru = await fetchZauruData();
    await updateProductCategories(zauru);
    await updateProducts(zauru);
  } catch (ex) {
    console.log(`Failed in wooCommerce API: `, ex);
  }
};

// syncWooCommerceWithZauru();
