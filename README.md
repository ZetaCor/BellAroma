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
