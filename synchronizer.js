require('dotenv').config();
const axios = require('axios');
const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;

const wc_api = new WooCommerceRestApi({
  url: process.env.WOOCOMMERCE_URL,
  consumerKey: process.env.WOOCOMMERCE_KEY,
  consumerSecret: process.env.WOOCOMMERCE_SECRET,
  version: 'wc/v3'
});

let localCategories = {};

function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}

// this will get the GIAN JSON with all the info to process
const fetchZauruData = async () => {
  const response = await axios.get(
    'https://app.zauru.com/ecommerce/ecommerce_requests/get_items_for_ecommerce.json',
    {
      headers: {
        'X-User-Email': process.env.ZAURU_EMAIL,
        'X-User-Token': process.env.ZAURU_TOKEN
      }
    }
  );
  return response.data;
};

const getCategoryKey = (category, parent) => category + '|' + parent;

// function that will add or update category in woocommerce
// it will force the parent category from the param into the woocommerce category
const findCreateOrUpdateCategory = async (category, parent) => {
  console.log(
    '  creating/updating Zauru category: ',
    category,
    ' parent ',
    parent
  );
  if (category) {
    let categoryId = null;
    if (localCategories[getCategoryKey(category, parent)]) {
      return localCategories[getCategoryKey(category, parent)];
    }
    let wcCategories = (
      await wc_api.get(`products/categories?search=${category}`)
    ).data;
    if (!wcCategories.length) {
      try {
        const createResponse = await wc_api.post('products/categories', {
          name: category,
          parent
        });
        categoryId = createResponse.data.id;
      } catch (ex) {
        console.log(
          `   Failed in creating category ${category}: `,
          ex.response.data
        );
      }
    } else if (wcCategories[0].parent !== parent) {
      try {
        const updateResponse = await wc_api.put(
          `products/categories/${wcCategories[0].id}`,
          {
            parent
          }
        );
        console.log('   Category updated');
        categoryId = updateResponse.data.id;
      } catch (ex) {
        console.log(
          `    Failed in updating category ${category}: `,
          ex.response.data
        );
      }
    } else {
      console.log('   Category found');
      categoryId = wcCategories[0].id;
    }
    localCategories[getCategoryKey(category, parent)] = categoryId;
    return categoryId;
  }
};

// comparison from Zauru vs. WooCommerce skipping the categories
const isProductUpdated = (wooProduct, item) => {
  const productStock = item.stock === 'infinite' ? 1000000 : item.stock;
  let description = item.description.replace(/ /g, '');
  description = item.description.replace(/\s/g, '');
  let wooDescription = wooProduct.description.replace(/ /g, '');
  wooDescription = wooProduct.description.replace(/\s/g, '');
  wooDescription = wooDescription.replace(new RegExp('<p>', 'g'), '');
  wooDescription = wooDescription.replace(new RegExp('</p>', 'g'), '');
  wooDescription = wooDescription.replace(new RegExp('<br/>', 'g'), '');

  /*
  console.log(item.name !== wooProduct.name);
  console.log(item.price && item.price !== wooProduct.regular_price);
  console.log(description.trim());
  console.log(wooDescription.trim());
  console.log(description.trim() !== wooDescription.trim());
  console.log(item.code !== wooProduct.sku);
  console.log(productStock !== wooProduct.stock_quantity);
  console.log(item.weight && item.weight !== wooProduct.weight);
  */
  return (
    item.name !== wooProduct.name ||
    (item.price && item.price !== wooProduct.regular_price) ||
    description.trim() !== wooDescription.trim() ||
    item.code !== wooProduct.sku ||
    productStock !== wooProduct.stock_quantity ||
    (item.weight && item.weight !== wooProduct.weight)
  );
};

// format that woocommerce recognizes
const getProductObj = (item, category, vendor, tags) => {
  const productStock = item.stock === 'infinite' ? 1000000 : item.stock;
  const description =
    '<p>' + item.description.replace(new RegExp('\r\n', 'g'), '<br/>') + '</p>';
  let categories = [category].concat([vendor].concat(tags)).filter(onlyUnique);
  categories = categories.map(cat => {
    return { id: cat };
  });
  return {
    name: item.name,
    regular_price: item.price,
    description,
    sku: item.code,
    stock_quantity: productStock,
    weight: item.weight,
    categories,
    images: [{ src: item.photo.image.square_600.url }]
  };
};

// this will update the products and the vendors and tags as categories
const createOrUpdateProducts = async zauru => {
  for (let category in zauru) {
    for (const productKey in zauru[category]) {
      const item = zauru[category][productKey];
      const wcProduct = (await wc_api.get(`products?sku=${item.code}`)).data;
      console.log(` Item: ${item.name}, found: ${wcProduct.length}`);

      // force Zauru category to propagate to woo commerce
      const categoryId = await findCreateOrUpdateCategory(category, 29);
      // force Zauru vendor as WC category forcing parent category
      const vendor = await findCreateOrUpdateCategory(item.vendor, 31);
      let tags = [];
      for (const tag of item.tags) {
        // force Zauru tag as WC category forcing parent category
        tags.push(await findCreateOrUpdateCategory(tag, 30));
      }

      try {
        // actually update
        if (wcProduct.length) {
          if (isProductUpdated(wcProduct[0], item)) {
            console.log(
              '  Product vs Item found difference. Updating on woocommerce'
            );
            const updateResponse = await wc_api.put(
              `products/${wcProduct[0].id}`,
              getProductObj(item, categoryId, vendor, tags)
            );
            console.log('  Product Updated');
          }
          // actually create
        } else {
          await wc_api.post(
            'products',
            getProductObj(item, categoryId, vendor, tags)
          );
        }
      } catch (ex) {
        console.log(
          '   Failed in creating/updating product: ',
          ex.response.data
        );
      }
    }
  }
};

exports.syncWooCommerceWithZauru = async () => {
  try {
    const zauru = await fetchZauruData();
    //console.log('ITEM CATEGORIES');
    //await updateItemCategories(zauru);
    await createOrUpdateProducts(zauru);
  } catch (ex) {
    console.log(`Failed in wooCommerce API: `, ex);
  }
};
