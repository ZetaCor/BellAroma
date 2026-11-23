var $ = function (id) { return document.getElementById(id); };
var token = localStorage.getItem("ba-token") || "";
var data = { settings: { whatsapp: "" }, products: [] };
let original = null, draftId, photoTask, uploadedImage;
const fieldIds = { name: 'name', brand: 'brand', family: 'family', size: 'size', price: 'price', description: 'desc', stock: 'stock' };
const fieldLabels = { name:'nombre', brand:'marca', family:'familia', size:'tamaño', price:'precio', description:'descripción', stock:'unidades', image:'foto', cutout:'foto', available:'disponibilidad' };
function selectView(id) {
  document.querySelectorAll('[data-view]').forEach((button) => {
    const active = button.dataset.view === id;
    button.setAttribute('aria-pressed', String(active));
    $(button.dataset.view).hidden = !active;
  });
}
document.querySelectorAll('[data-view]').forEach((button) => button.onclick = () => selectView(button.dataset.view));

function say(t, err) { $("msg").textContent = t || ""; $("msg").className = err ? "err" : ""; }
function api(method, url, body) {
  return fetch(url, {
    method: method,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: body ? JSON.stringify(body) : undefined
  }).then(function (r) {
    if (r.status === 401 && token) { logout(); throw new Error("Sesión vencida"); }
    return r.json().then(function (j) { if (!r.ok) throw Object.assign(new Error(j.error || "Error"), { details:j }); return j; });
  });
}
function logout() { token = ""; localStorage.removeItem("ba-token"); show(); }
function show() { $("login").hidden = !!token; $("app").hidden = !token; if (token) load(); }

$("go").onclick = function () {
  api("POST", "/api/login", { password: $("pw").value }).then(function (r) {
    token = r.token; localStorage.setItem("ba-token", token); $("pw").value = ""; $("lmsg").textContent = ""; show();
  }).catch(function (e) { $("lmsg").textContent = e.message; });
};
$("pw").onkeydown = function (e) { if (e.key === "Enter") $("go").click(); };
$("out").onclick = logout;

function load() {
  $("import-catalog").disabled = true;
  $("saveWa").disabled = true;
  api("GET", "/api/store").then(function (d) {
    data = d;
    $("wa").value = d.settings?.whatsapp || "";
    $("store-address").value = d.settings?.address || "";
    $("store-map").value = d.settings?.mapPin || "";
    $("store-hours").value = d.settings?.hours || "";
    $("yappy").value = d.settings?.yappyAlias || "";
    $("cash").checked = d.settings?.cashOnDelivery === true;
    $("card").checked = d.settings?.cardOnDelivery === true;
    $("saveWa").disabled = false;
    render();
    $("import-catalog").disabled = false;
  }).catch(function (e) { $("payment-status").textContent = e.message; say(e.message, true); });
}
$("import-catalog").onclick = async function () {
  const button = $("import-catalog");
  const status = $("import-status");
  button.disabled = true;
  status.textContent = "Agregando perfumes…";
  try {
    const response = await fetch("/products/catalog.json");
    if (!response.ok) throw new Error("No se pudieron cargar los perfumes incluidos.");
    const included = await response.json();
    const nameKey = (name) => name.trim().toLocaleLowerCase("es");
    const existingIds = new Set(data.products.map((product) => product.id));
    const existingNames = new Set(data.products.map((product) => nameKey(product.name)));
    const additions = included.filter((product) =>
      !existingIds.has(product.id) && !existingNames.has(nameKey(product.name))
    );
    if (!additions.length) {
      status.textContent = "Los perfumes incluidos ya están en el catálogo.";
      return;
    }
    if (data.products.length + additions.length > 500) {
      throw new Error("El catálogo admite hasta 500 productos.");
    }
    await persist({ ...data, products: data.products.concat(additions) });
    status.textContent = "Perfumes agregados. Completa sus datos desde el panel.";
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
};
async function persist(next) {
  data = await api("PUT", "/api/store", next);
  render();
}
$("settings-form").onsubmit = async function (event) {
  event.preventDefault();
  const button = $("saveWa");
  const status = $("payment-status");
  button.disabled = true;
  try {
    const number = $("wa").value.replace(/[\s()+-]/g, "");
    if (number && !/^\d{8,15}$/.test(number)) throw new Error("Revisa el número de WhatsApp e incluye el código de país.");
    data = await api("PUT", "/api/store/settings", { version: data.version, settings: {
      whatsapp: number,
      address: $("store-address").value,
      mapPin: $("store-map").value.trim(),
      hours: $("store-hours").value,
      yappyAlias: $("yappy").value,
      cashOnDelivery: $("cash").checked,
      cardOnDelivery: $("card").checked,
    } });
    render();
    status.textContent = "Configuración guardada.";
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
};

$("complete-order").onsubmit = async function (event) {
  event.preventDefault();
  const button = $("complete-button");
  const status = $("order-status");
  const code = $("order-code").value.trim();
  button.disabled = true;
  status.textContent = "";
  try {
    const review = await api("POST", "/api/orders/complete", { code });
    if (review.alreadyCompleted) {
      data = review;
      render();
      status.textContent = "Este pedido ya se finalizó.";
      return;
    }
    const details = review.items.map((item) => item.quantity + " × " + item.name).join("\n");
    if (!confirm("¿Finalizar la compra y descontar estas unidades?\n\n" + details)) return;
    const result = await api("POST", "/api/orders/complete", { code, confirm: true });
    data = result;
    render();
    $("order-code").value = "";
    status.textContent = result.alreadyCompleted ? "Este pedido ya se finalizó." :
      "Compra finalizada. Inventario actualizado.";
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
};

function resize(file) {
  return new Promise(function (ok, no) {
    var img = new Image();
    img.onload = function () {
      var s = Math.min(1, 1000 / Math.max(img.width, img.height));
      var c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      var ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      var cut = false;
      try { cut = ctx.getImageData(0, 0, 1, 1).data[3] < 250 && ctx.getImageData(c.width - 1, c.height - 1, 1, 1).data[3] < 250; } catch (e) {}
      ok({ data: cut ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.85), cut: cut });
    };
    img.onerror = function () { no(new Error("No se pudo leer la imagen")); };
    img.src = URL.createObjectURL(file);
  });
}
function preview(url) {
  $("prev").hidden = !url;
  if (url) $("prev").src = url;
  else $("prev").removeAttribute("src");
}
$("file").onchange = function () {
  const file = this.files[0];
  if (!file) return;
  const task = resize(file);
  photoTask = task;
  uploadedImage = null;
  task.then((result) => { if (photoTask === task) preview(result.data); })
    .catch((error) => { if (photoTask === task) say(error.message, true); });
};

function fillFields(p) {
  for (const [field, id] of Object.entries(fieldIds)) $(id).value = p[field] ?? "";
  $("avail").checked = p.available !== false;
  preview(p.image);
}
function edit(product) {
  original = product ? { brand:"", family:"", size:"", price:"", description:"", stock:null, image:"", cutout:false, available:true, ...product } : null;
  draftId = original?.id || crypto.randomUUID();
  photoTask = uploadedImage = null;
  $("file").value = "";
  fillFields(original || {});
  $("ftitle").textContent = original ? "Editar perfume" : "Nuevo perfume";
  $("product-form").hidden = false;
  say("");
  $("name").focus();
}
$("new-product").onclick = () => edit(null);
$("cancel").onclick = () => {
  photoTask = uploadedImage = original = null;
  $("product-form").hidden = true;
  say("");
  $("new-product").focus();
};

$("product-form").onsubmit = async function (event) {
  event.preventDefault();
  if (!this.reportValidity()) return;
  const product = {
    id:draftId, image: original?.image || "", cutout:original?.cutout === true,
    available:$("avail").checked,
  };
  for (const [field, id] of Object.entries(fieldIds)) product[field] = $(id).value.trim();
  product.stock = $("stock").valueAsNumber;
  if (!product.name) { say("Escribe el nombre del perfume.", true); return; }
  const base = original;
  const pendingPhoto = photoTask;
  $("catalog").inert = true;
  $("new-product").disabled = true;
  say("Guardando…");
  try {
    if (pendingPhoto) {
      const photo = await pendingPhoto;
      if (!uploadedImage) uploadedImage = (await api("POST", "/api/upload", { image: photo.data })).url;
      product.image = uploadedImage;
      product.cutout = photo.cut;
    }
    data = await api("PUT", "/api/products/" + encodeURIComponent(product.id), { original:base, product });
    render();
    this.hidden = true;
    photoTask = uploadedImage = original = null;
    say("Perfume guardado.");
  } catch (error) {
    const latest = error.details?.currentProduct;
    if (!latest || !base) { say(error.message, true); return; }
    const conflicts = error.details.conflicts;
    const merged = { ...latest };
    for (const key of Object.keys(product)) {
      if (!conflicts.includes(key) && product[key] !== base[key]) merged[key] = product[key];
    }
    original = latest;
    data.products = data.products.map((item) => item.id === latest.id ? latest : item);
    render();
    if (conflicts.includes("image") || conflicts.includes("cutout")) {
      photoTask = uploadedImage = null;
      $("file").value = "";
    }
    fillFields(merged);
    const names = [...new Set(conflicts.map((key) => fieldLabels[key]))].join(", ");
    say("Revisa los valores actualizados de " + names + " y vuelve a guardar. Conservamos los demás cambios que escribiste.", true);
  } finally {
    $("catalog").inert = false;
    $("new-product").disabled = false;
    if (this.hidden && !$("catalog").hidden) $("new-product").focus();
  }
};
function btn(label, cls, fn) { var b = document.createElement("button"); b.type = "button"; b.className = "btn " + cls; b.textContent = label; b.onclick = fn; return b; }

function render() {
  $("count").textContent = data.products.length;
  var l = $("list"); l.textContent = "";
  if (!data.products.length) { l.textContent = "Aún no hay productos. Agrega el primero arriba."; return; }
  data.products.forEach(function (p) {
    var row = document.createElement("div"); row.className = "item";
    var im = document.createElement("img"); im.className = "thumb"; im.alt = ""; if (p.image) im.src = p.image;
    var g = document.createElement("div"); g.className = "grow";
    var b = document.createElement("b"); b.textContent = p.name;
    var s = document.createElement("span");
    const stock = p.stock == null ? "Inventario pendiente" : `${p.stock} en inventario`;
    s.textContent = [p.brand, p.size, p.price, stock, (!p.available || p.stock === 0) ? "Agotado" : ""].filter(Boolean).join(" · ");
    g.appendChild(b); g.appendChild(s);
    var a = document.createElement("div"); a.className = "acts";
    a.appendChild(btn(p.available ? "Marcar agotado" : "Marcar disponible", "", async function () {
      try {
        data = await api("PUT", "/api/products/" + encodeURIComponent(p.id), { original:p, product:{ ...p, available:p.available === false } });
        render();
        say("Disponibilidad actualizada.");
      } catch (error) { say(error.message, true); }
    }));
    a.appendChild(btn("Editar", "", function () { edit(p); }));
    a.appendChild(btn("Eliminar", "del", async function () {
      if (!confirm("¿Eliminar “" + p.name + "”?")) return;
      try {
        await persist({ ...data, products: data.products.filter((item) => item.id !== p.id) });
        say("Producto eliminado.");
      } catch (error) { say(error.message, true); }
    }));
    row.appendChild(im); row.appendChild(g); row.appendChild(a); l.appendChild(row);
  });
}
show();

