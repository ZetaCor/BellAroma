# Bell Aroma · tienda con panel admin

## Local
    npm install
    ADMIN_PASSWORD=tu-clave npm start
Tienda: http://localhost:3000 · Panel: http://localhost:3000/admin
(En local guarda en `data/` y `public/uploads/`.)

## GitHub + Vercel
1. Sube el proyecto a GitHub e impórtalo en Vercel.
2. En Vercel, conecta el almacén Blob al proyecto y habilita **Production**. Bell Aroma utiliza un almacén privado con `BLOB_ACCESS=private` y la conexión OIDC de Vercel con `BLOB_STORE_ID`. Las fotos se sirven mediante la tienda. También se admite un almacén público con `BLOB_ACCESS=public` y conexiones mediante `BLOB_READ_WRITE_TOKEN`.
3. En Settings → Environment Variables agrega `ADMIN_PASSWORD` y `SESSION_SECRET`.
4. Vuelve a desplegar Production para aplicar la conexión. Entra a `/admin`, guarda el WhatsApp y recarga la página para verificarlo. Si falta la conexión, la tienda puede mostrar los perfumes iniciales y el panel indicará que hace falta almacenamiento para guardar.

## Inventario y pedidos

1. En `/admin`, registra las unidades de cada perfume y marca su disponibilidad. Un perfume con cero unidades se mostrará agotado. Los perfumes anteriores sin inventario registrado se pueden pedir sujetos a confirmación. Registra sus existencias antes de finalizar la venta.
2. En **Pedidos y métodos de pago**, guarda el WhatsApp con código de país. Configura el alias de Yappy Comercial y activa efectivo o tarjeta contra entrega según los medios que pueda recibir el repartidor.
3. El cliente elige provincia y distrito, y escribe la dirección o la selecciona entre las sugerencias de Google Maps. El pedido por WhatsApp incluye la dirección y el enlace al lugar. Para Yappy, el comprador envía el comprobante por ese mismo chat después de confirmar el total.
4. Confirma disponibilidad, envío y total con el cliente. Después de verificar el abono de Yappy o el cobro contra entrega, pega el código en **Finalizar pedido**. Revisa todas las cantidades. Al confirmar, se descuenta el pedido completo una sola vez.

En producción, conserva `SESSION_SECRET` estable para que los códigos de pedidos abiertos sigan siendo válidos. Los datos de entrega se incluyen en el mensaje de WhatsApp y el catálogo guarda únicamente los identificadores de pedidos finalizados para evitar descuentos duplicados.

## Sugerencias de dirección en el carrito

1. En un proyecto de Google Cloud con facturación activa, habilita **Maps JavaScript API** y **Places API (New)**. [Guía de Google Maps](https://developers.google.com/maps/documentation/javascript/place-autocomplete-new)
2. Crea una clave de navegador con la restricción **Sitios web**. Autoriza `https://bellaromapty.vercel.app/*` y limita la clave a las dos APIs anteriores. [Configuración de claves](https://developers.google.com/maps/documentation/javascript/get-api-key)
3. En Vercel → Settings → Environment Variables, guarda la clave como `GOOGLE_MAPS_BROWSER_KEY` para Production y vuelve a desplegar. Para probar en local, autoriza también el origen local en una clave de desarrollo y asígnala a la misma variable de entorno antes de iniciar Node.

El carrito carga Google Places al entrar en el paso de entrega. Las sugerencias se limitan a Panamá. Si Google no está disponible, el cliente puede completar su dirección a mano.
