#  Integración de items de Zauru hacia productos de WooCommerce

Este proyecto publica los items de Zauru en WooCommerce, con los siguientes campos:
1. name
2. regular_price (price en Zauru)
3. description
4. images[0] (photo.image.square_600.url en Zauru)
5. sku (code en Zauru)
6. stock_quantity (stock en Zauru)
7. weight
8. categories (category, vendor y tags en Zauru)

La información la obtiene del módulo de e-commerce de Zauru por medio del [API](https://docs.zauru.com/e-commerce/solicitar-los-items-disponibles)

Utilizamos el [REST API v3 de woo commerce] (https://woocommerce.github.io/woocommerce-rest-api-docs/?javascript#create-a-product)

## Deploy con Serverless Framework
1. npm install
2. configurar .env (ejemplo en el siguiente punto)
3. serverless deploy (para dev) o serverless deploy --stage production (para prod)

> Gracias al Serverless Framework, en donde los permisos IAM se definen en el código, no hay que configurar nada para poder subir el código. Solo tenemos que asegurarnos que el .env esté correcto (siguiente punto)

### Variables de entorno a configurar en el archivo .env
```
WOOCOMMERCE_URL=https://misitio.com/
WOOCOMMERCE_KEY=ck_2439ujd9239fdsjklwe09ew
WOOCOMMERCE_SECRET=cs_0128438nfi230238328k
ZAURU_EMAIL=prueba@zauru.com
ZAURU_TOKEN=45ERGDSFSLIU2332
CATEGORY_PARENT_CATEGORY=29
VENDOR_PARENT_CATEGORY=31
TAG_PARENT_CATEGORY=30
```

Si hay necesidad, estas variables se pueden editar desde la funcion lambda en la consola AWS.

### Pruebas desde el Serverless Framework

```
serverless invoke local --function syncWooCommerceWithZauru
```

> Hay que refactorizar el código para separar la integración con los servicios AWS y que podamos pegar cualquier servicio ficticio para que podamos probarlo localmente... ver https://serverless.com/framework/docs/providers/aws/guide/testing