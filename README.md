# Bell Aroma · tienda con panel admin

## Local
    npm install
    ADMIN_PASSWORD=tu-clave npm start
Tienda: http://localhost:3000 · Panel: http://localhost:3000/admin
(En local guarda en `data/` y `public/uploads/`.)

## GitHub + Vercel
1. Sube el proyecto a GitHub e impórtalo en Vercel.
2. En Vercel: Storage → Create → Blob, y conéctalo al proyecto (crea `BLOB_READ_WRITE_TOKEN`).
3. En Settings → Environment Variables agrega `ADMIN_PASSWORD` y `SESSION_SECRET`.
4. Redeploy. Entra a `/admin`, pon el WhatsApp de la tienda y carga los productos.

## Inventario y pedidos

1. En `/admin`, registra las unidades de cada perfume y marca su disponibilidad. Un perfume con cero unidades se mostrará agotado. Los perfumes anteriores sin inventario registrado se pueden pedir sujetos a confirmación. Registra sus existencias antes de finalizar la venta.
2. En **Pedidos y métodos de pago**, guarda el WhatsApp con código de país. Configura el alias de Yappy Comercial y activa efectivo o tarjeta contra entrega según los medios que pueda recibir el repartidor.
3. El cliente agrega perfumes al carrito, ajusta las cantidades e indica el método de pago y la dirección. Un solo mensaje de WhatsApp reúne todos los artículos, el subtotal y la entrega. Si falta un precio, el subtotal aparece por confirmar. Las consultas de cada perfume también llegan al WhatsApp comercial.
4. Confirma disponibilidad, envío y total con el cliente. Después de verificar el abono de Yappy o el cobro contra entrega, pega el código en **Finalizar pedido**. Revisa todas las cantidades. Al confirmar, se descuenta el pedido completo una sola vez.

En producción, conserva `SESSION_SECRET` estable para que los códigos de pedidos abiertos sigan siendo válidos. Los datos de entrega se incluyen en el mensaje de WhatsApp y el catálogo guarda únicamente los identificadores de pedidos finalizados para evitar descuentos duplicados.
