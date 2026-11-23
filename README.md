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
3. El cliente elige una de las diez provincias, escribe la localidad y la dirección, y puede pegar un pin de Google Maps. El mensaje lleva el enlace para la entrega. El chat desde el que se envía el pedido sirve como contacto. Para Yappy, el comprador envía el comprobante por ese chat después de confirmar el total.
4. Confirma disponibilidad, envío y total con el cliente. Después de verificar el abono de Yappy o el cobro contra entrega, pega el código en **Finalizar pedido**. Revisa todas las cantidades. Al confirmar, se descuenta el pedido completo una sola vez.

En producción, conserva `SESSION_SECRET` estable para que los códigos de pedidos abiertos sigan siendo válidos. Los datos de entrega se incluyen en el mensaje de WhatsApp y el catálogo guarda únicamente los identificadores de pedidos finalizados para evitar descuentos duplicados.
