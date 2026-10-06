-- Sample molds for the Panama workshop. Safe to run more than once.
-- Products are inserted only when the products table is empty.
-- The admin row is the same demo login the admin page already shows.
-- Apply after db/migrations/001_init.sql. The server does not run this file.

INSERT INTO products (id, name, description, price, "imageUrl", category, stock)
SELECT
  v.id,
  v.name,
  v.description,
  v.price::double precision,
  v.image_url,
  v.category,
  v.stock::integer
FROM (
  VALUES
    (
      'mold-columna',
      'Molde de columna estriada',
      'Molde rígido en dos mitades para vaciar una columna con estrías verticales, en yeso o cerámica. El fuste sale listo para lijar y pintar en el taller.',
      '128',
      '/molds/columna.svg',
      'Columnas',
      '8'
    ),
    (
      'mold-pedestal',
      'Molde de pedestal barroco',
      'Pedestal con volutas y base escalonada, para jardín o interior. Aguanta vaciados repetidos en yeso de fundición.',
      '215',
      '/molds/pedestal.svg',
      'Pedestales',
      '4'
    ),
    (
      'mold-maceta',
      'Molde de maceta art déco',
      'Maceta de cuerpo geométrico con franjas escalonadas. Sirve para cerámica de colada o yeso, y el fondo trae marcado el orificio de drenaje.',
      '96',
      '/molds/maceta.svg',
      'Macetas',
      '14'
    ),
    (
      'mold-angel',
      'Molde de ángel de jardín',
      'Figura de jardín en dos piezas, con las alas en relieve. Se vierte yeso o pasta cerámica de colada y se une por la costura central.',
      '168',
      '/molds/angel.svg',
      'Jardín',
      '6'
    ),
    (
      'mold-fuente',
      'Molde de fuente de pared',
      'Placa con concha y mascarón para una fuente de pared. El molde deja marcada la salida del caño.',
      '240',
      '/molds/fuente.svg',
      'Fuentes',
      '3'
    ),
    (
      'mold-marco',
      'Molde de marco ornamental',
      'Marco rectangular con hoja de acanto en las esquinas, para vaciar un marco de yeso que después se puede dorar o pintar.',
      '74',
      '/molds/marco.svg',
      'Ornamento',
      '18'
    ),
    (
      'mold-baldosa',
      'Molde de baldosa hidráulica',
      'Baldosa cuadrada con estrella de ocho puntas, al estilo de los pisos antiguos de la ciudad. El molde es de una sola cara.',
      '52',
      '/molds/baldosa.svg',
      'Baldosas',
      '30'
    ),
    (
      'mold-jarron',
      'Molde de jarrón clásico',
      'Jarrón de cuello estrecho y panza ovalada, en dos mitades, para colada de cerámica. La boca queda abierta para el vaciado.',
      '110',
      '/molds/jarron.svg',
      'Jarrones',
      '11'
    ),
    (
      'mold-cornisa',
      'Molde de cornisa corrida',
      'Perfil de cornisa con dentículos, para tirar un tramo de yeso y cortarlo a la medida de la pared.',
      '88',
      '/molds/cornisa.svg',
      'Coronas',
      '16'
    ),
    (
      'mold-roseton',
      'Molde de rosetón de techo',
      'Rosetón circular con pétalos para el centro de un techo. El anillo interior deja el paso de la lámpara.',
      '142',
      '/molds/roseton.svg',
      'Techos',
      '7'
    )
) AS v(id, name, description, price, image_url, category, stock)
WHERE NOT EXISTS (SELECT 1 FROM products);

INSERT INTO admin_users (id, email, password)
SELECT 'admin-1', 'admin@goldenceramic.com', 'admin123'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_users WHERE email = 'admin@goldenceramic.com'
);
