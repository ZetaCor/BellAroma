const path = require('path');
const express = require('express');
const app = require('./app');

// La tienda (public/) la sirve este mismo servidor, tanto en local como en Vercel.
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// En local arranca el servidor; en Vercel solo se exporta la app.
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log('Bell Aroma en http://localhost:' + port));
}

module.exports = app;
