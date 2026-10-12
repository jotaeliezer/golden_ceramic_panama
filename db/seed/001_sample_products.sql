-- Sample molds for the Panama workshop. Safe to run more than once.
-- Products are inserted only when the products table is empty.
-- English copy is filled for the ten sample molds on every run.
-- This file does not create an admin user. Set one with npm run admin:set-password.
-- Apply after db/migrations/002_product_english.sql. The server does not run this file.
-- name_en and description_en must already exist. This file does not add columns.

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
      '/pieces/columna.webp',
      'Columnas',
      '8'
    ),
    (
      'mold-pedestal',
      'Molde de pedestal barroco',
      'Pedestal con volutas y base escalonada, para jardín o interior. Aguanta vaciados repetidos en yeso de fundición.',
      '215',
      '/pieces/pedestal.webp',
      'Pedestales',
      '4'
    ),
    (
      'mold-maceta',
      'Molde de maceta art déco',
      'Maceta de cuerpo geométrico con franjas escalonadas. Sirve para cerámica de colada o yeso, y el fondo trae marcado el orificio de drenaje.',
      '96',
      '/pieces/maceta.webp',
      'Macetas',
      '14'
    ),
    (
      'mold-angel',
      'Molde de ángel de jardín',
      'Figura de jardín en dos piezas, con las alas en relieve. Se vierte yeso o pasta cerámica de colada y se une por la costura central.',
      '168',
      '/pieces/angel.webp',
      'Jardín',
      '6'
    ),
    (
      'mold-fuente',
      'Molde de fuente de pared',
      'Placa con concha y mascarón para una fuente de pared. El molde deja marcada la salida del caño.',
      '240',
      '/pieces/fuente.webp',
      'Fuentes',
      '3'
    ),
    (
      'mold-marco',
      'Molde de marco ornamental',
      'Marco rectangular con hoja de acanto en las esquinas, para vaciar un marco de yeso que después se puede dorar o pintar.',
      '74',
      '/pieces/marco.webp',
      'Ornamento',
      '18'
    ),
    (
      'mold-baldosa',
      'Molde de baldosa hidráulica',
      'Baldosa cuadrada con estrella de ocho puntas, al estilo de los pisos antiguos de la ciudad. El molde es de una sola cara.',
      '52',
      '/pieces/baldosa.webp',
      'Baldosas',
      '30'
    ),
    (
      'mold-jarron',
      'Molde de jarrón clásico',
      'Jarrón de cuello estrecho y panza ovalada, en dos mitades, para colada de cerámica. La boca queda abierta para el vaciado.',
      '110',
      '/pieces/jarron.webp',
      'Jarrones',
      '11'
    ),
    (
      'mold-cornisa',
      'Molde de cornisa corrida',
      'Perfil de cornisa con dentículos, para tirar un tramo de yeso y cortarlo a la medida de la pared.',
      '88',
      '/pieces/cornisa.webp',
      'Coronas',
      '16'
    ),
    (
      'mold-roseton',
      'Molde de rosetón de techo',
      'Rosetón circular con pétalos para el centro de un techo. El anillo interior deja el paso de la lámpara.',
      '142',
      '/pieces/roseton.webp',
      'Techos',
      '7'
    )
) AS v(id, name, description, price, image_url, category, stock)
WHERE NOT EXISTS (SELECT 1 FROM products);

UPDATE products AS p
SET
  name_en = v.name_en,
  description_en = v.description_en
FROM (
  VALUES
    (
      'mold-angel',
      'Garden angel mold',
      'A two-piece garden figure with the wings in relief. Pour plaster or ceramic slip and join the halves along the center seam.'
    ),
    (
      'mold-baldosa',
      'Encaustic tile mold',
      'A square tile with an eight-pointed star, in the manner of the old city floors. The mold is single-faced.'
    ),
    (
      'mold-columna',
      'Fluted column mold',
      'A rigid two-part mold for casting a column with vertical flutes, in plaster or ceramic. The shaft comes out ready to sand and paint in the workshop.'
    ),
    (
      'mold-cornisa',
      'Running cornice mold',
      'A cornice profile with dentils, for running a length of plaster and cutting it to fit the wall.'
    ),
    (
      'mold-fuente',
      'Wall fountain mold',
      'A plaque with a shell and mascaron for a wall fountain. The mold marks where the spout comes out.'
    ),
    (
      'mold-jarron',
      'Classic vase mold',
      'A narrow-necked vase with an oval body, in two halves, for ceramic slip casting. The mouth stays open for the pour.'
    ),
    (
      'mold-maceta',
      'Art Deco planter mold',
      'A planter with a geometric body and stepped bands. It works for slip-cast ceramic or plaster, and the base is marked for the drainage hole.'
    ),
    (
      'mold-marco',
      'Ornamental frame mold',
      'A rectangular frame with acanthus leaves in the corners, for casting a plaster frame that can later be gilded or painted.'
    ),
    (
      'mold-pedestal',
      'Baroque pedestal mold',
      'A pedestal with scrolls and a stepped base, for the garden or indoors. It stands up to repeated casts in casting plaster.'
    ),
    (
      'mold-roseton',
      'Ceiling rosette mold',
      'A circular rosette with petals for the center of a ceiling. The inner ring leaves room for the light fixture.'
    )
) AS v(id, name_en, description_en)
WHERE p.id = v.id;
