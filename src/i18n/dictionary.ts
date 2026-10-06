export type Locale = "es" | "en";

export const LOCALE_STORAGE_KEY = "gcp-locale";

const es = {
  "meta.title": "Golden Ceramic Panamá",

  "language.label": "Idioma",
  "language.spanish": "Español",
  "language.english": "Inglés",

  "nav.est": "Est. 2024 • Ciudad de Panamá",
  "nav.collection": "La Colección",
  "nav.process": "Nuestro Proceso",
  "nav.cart": "Carrito",
  "nav.openMenu": "Abrir menú",
  "nav.closeMenu": "Cerrar menú",
  "nav.mobile": "Menú móvil",

  "footer.est": "Est. 2024",
  "footer.blurb":
    "Moldes de cerámica arquitectónica hechos a mano. Diseñados en Panamá, uniendo precisión técnica y lujo clásico.",
  "footer.index": "Índice",
  "footer.yourCart": "Su carrito",
  "footer.admin": "Acceso de administración",
  "footer.inquiry": "Consultas",

  "home.limited": "Edición limitada",
  "home.heroLead": "El arte del",
  "home.heroEmphasis": "molde",
  "home.heroBody":
    "Descubra nuestra colección de moldes de cerámica arquitectónica hechos a mano. Diseñados en Panamá para el artesano global, uniendo precisión técnica y lujo clásico.",
  "home.viewCatalog": "Ver catálogo",
  "home.heroAlt": "Molde de cerámica artesanal",
  "home.material": "Detalle del material",
  "home.materialQuote":
    "“Compuesto de resina de ingeniería, con alta resistencia térmica, para un desmolde impecable.”",
  "home.selection": "Selección",
  "home.curated": "Series curadas",
  "home.inquiry": "Consultas",

  "about.kicker": "Tras el taller",
  "about.title": "Los artesanos",
  "about.body":
    "Golden Ceramic Panama nació de la convicción de que un vaciado perfecto exige un molde perfecto. Inspirados en la arquitectura clásica y el diseño minimalista contemporáneo, creamos moldes que perduran tanto en resistencia como en estética. Cada pieza se diseña y fabrica en nuestro taller de Panamá, de la mano de maestros artesanos.",
  "about.imageAlt": "Taller del estudio",
  "about.location": "Ubicación",
  "about.locationQuote":
    "“Nuestro taller y laboratorio principal, en el corazón de la Ciudad de Panamá.”",

  "shop.loading": "Preparando la selección...",
  "shop.kicker": "Catálogo completo",
  "shop.title": "La Colección",
  "shop.body":
    "Recorra toda nuestra selección de moldes de cerámica y yeso. Cada pieza está pensada para un vaciado preciso y una estética atemporal.",
  "shop.empty": "La colección está vacía por ahora.",

  "product.decrease": "Disminuir cantidad",
  "product.increase": "Aumentar cantidad",
  "product.quantity": "Cantidad",
  "product.added": "Añadido al carrito",
  "product.add": "Añadir al carrito",
  "product.status": "Estado:",
  "product.units": "{count} unidades disponibles",
  "product.outOfStock": "Agotado",
  "product.fulfillment": "Entrega:",
  "product.fulfillmentValue": "Se calcula al finalizar la compra.",

  "cart.emptyTitle": "Su carrito está vacío",
  "cart.return": "Volver a la colección",
  "cart.kicker": "Pedido",
  "cart.title": "Carrito de compras",
  "cart.each": "USD cada uno",
  "cart.decrease": "Disminuir la cantidad de {name}",
  "cart.increase": "Aumentar la cantidad de {name}",
  "cart.remove": "Quitar {name}",
  "cart.summary": "Resumen del pedido",
  "cart.subtotal": "Subtotal",
  "cart.logistics": "Envío",
  "cart.calculatedNext": "Se calcula a continuación",
  "cart.total": "Total USD",
  "cart.proceed": "Continuar",

  "checkout.kicker": "Finalizar",
  "checkout.title": "Pago seguro",
  "checkout.simTitle": "Información de pago de demostración",
  "checkout.simBody":
    "Si configura STRIPE_SECRET_KEY en el entorno, será redirigido a un portal seguro de Stripe. De lo contrario, al pulsar Realizar pedido se simulará un pedido exitoso para la demostración.",
  "checkout.contact": "Datos de contacto",
  "checkout.email": "Correo electrónico",
  "checkout.shipping": "Datos de envío",
  "checkout.fullName": "Nombre completo",
  "checkout.address": "Dirección",
  "checkout.city": "Ciudad",
  "checkout.country": "País",
  "checkout.total": "Total: ${amount} USD",
  "checkout.processing": "Procesando...",
  "checkout.placeOrder": "Realizar pedido",
  "checkout.orderCreated":
    "¡Pedido creado! (Se omitió el pago con Stripe porque falta STRIPE_SECRET_KEY). ID del pedido: {orderId}",
  "checkout.failed": "No se pudo completar el pago",
  "checkout.error": "Error al procesar el pedido.",
} as const;

export type MessageKey = keyof typeof es;

const en: { [K in MessageKey]: string } = {
  "meta.title": "My Google AI Studio App",

  "language.label": "Language",
  "language.spanish": "Spanish",
  "language.english": "English",

  "nav.est": "Est. 2024 • Panama City",
  "nav.collection": "The Collection",
  "nav.process": "Our Process",
  "nav.cart": "Cart",
  "nav.openMenu": "Open menu",
  "nav.closeMenu": "Close menu",
  "nav.mobile": "Mobile",

  "footer.est": "Est. 2024",
  "footer.blurb":
    "Handcrafted architectural ceramic molds. Designed in Panama bridging technical precision with classic luxury.",
  "footer.index": "Index",
  "footer.yourCart": "Your Cart",
  "footer.admin": "Admin Access",
  "footer.inquiry": "Inquiry",

  "home.limited": "Limited Release",
  "home.heroLead": "The Art of the",
  "home.heroEmphasis": "Mold",
  "home.heroBody":
    "Discover our handcrafted collection of architectural ceramic molds. Designed in Panama for the global artisan, bridging technical precision with classic luxury.",
  "home.viewCatalog": "View Catalog",
  "home.heroAlt": "Artisan Ceramic Mold",
  "home.material": "Material Detail",
  "home.materialQuote":
    '"Engineered resin composite with high-thermal resistance for flawless extraction."',
  "home.selection": "Selection",
  "home.curated": "Curated Series",
  "home.inquiry": "Inquiry",

  "about.kicker": "Behind the Studio",
  "about.title": "The Artisans",
  "about.body":
    "Golden Ceramic Panama was founded on the belief that perfect casts require perfect molds. Drawing inspiration from classical architecture and modern minimal design, we craft molds that stand the test of time, both in durability and aesthetics. Every piece is designed and manufactured by master craftsmen in our Panama studio.",
  "about.imageAlt": "Studio workspace",
  "about.location": "Location",
  "about.locationQuote":
    '"Our primary studio and laboratory located in the heart of Panama City."',

  "shop.loading": "Curating Selection...",
  "shop.kicker": "Full Catalog",
  "shop.title": "The Collection",
  "shop.body":
    "Browse our entire selection of premium ceramic and plaster molds. Each piece is designed for precision casting and timeless aesthetics.",
  "shop.empty": "The collection is empty for now.",

  "product.decrease": "Decrease quantity",
  "product.increase": "Increase quantity",
  "product.quantity": "Quantity",
  "product.added": "Added to Cart",
  "product.add": "Add to Cart",
  "product.status": "Status:",
  "product.units": "{count} Units Expected",
  "product.outOfStock": "Out of stock",
  "product.fulfillment": "Fulfillment:",
  "product.fulfillmentValue": "Calculated at checkout.",

  "cart.emptyTitle": "Your Registry is Empty",
  "cart.return": "Return to Collection",
  "cart.kicker": "Requisition",
  "cart.title": "Shopping Cart",
  "cart.each": "USD each",
  "cart.decrease": "Decrease quantity of {name}",
  "cart.increase": "Increase quantity of {name}",
  "cart.remove": "Remove {name}",
  "cart.summary": "Order Directory",
  "cart.subtotal": "Subtotal",
  "cart.logistics": "Logistics",
  "cart.calculatedNext": "Calculated Next",
  "cart.total": "Total USD",
  "cart.proceed": "Proceed",

  "checkout.kicker": "Finalize",
  "checkout.title": "Secure Checkout",
  "checkout.simTitle": "Simulated Checkout Info",
  "checkout.simBody":
    "If you configure STRIPE_SECRET_KEY in the environment, you will be redirected to a secure Stripe portal. Otherwise, clicking Place Order will mock success for demo purposes.",
  "checkout.contact": "Contact Details",
  "checkout.email": "Email address",
  "checkout.shipping": "Shipping Logistics",
  "checkout.fullName": "Full Name",
  "checkout.address": "Street Address",
  "checkout.city": "City",
  "checkout.country": "Country",
  "checkout.total": "Total: ${amount} USD",
  "checkout.processing": "Processing...",
  "checkout.placeOrder": "Place Order",
  "checkout.orderCreated":
    "Order created! (Stripe Checkout skipped since STRIPE_SECRET_KEY is missing). Order ID: {orderId}",
  "checkout.failed": "Checkout failed",
  "checkout.error": "Error processing order.",
};

export const messages: Record<Locale, { [K in MessageKey]: string }> = { es, en };

export function isLocale(value: string | null): value is Locale {
  return value === "es" || value === "en";
}

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const template = messages[locale][key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] === undefined ? "" : String(vars[name]),
  );
}
