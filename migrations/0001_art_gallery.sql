PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS media_objects (
  object_key TEXT PRIMARY KEY,
  artwork_id TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('display', 'thumbnail')),
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS media_objects_artwork_id_idx
  ON media_objects (artwork_id);

CREATE TABLE IF NOT EXISTS artworks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  medium TEXT NOT NULL DEFAULT '',
  year TEXT NOT NULL DEFAULT '',
  dimensions TEXT NOT NULL DEFAULT '',
  frame TEXT NOT NULL DEFAULT 'frame-1'
    CHECK (frame IN ('frame-1', 'frame-2', 'frame-3', 'frame-4')),
  y_offset TEXT NOT NULL DEFAULT 'translate-y-0',
  image_key TEXT REFERENCES media_objects(object_key) ON DELETE SET NULL,
  thumbnail_key TEXT REFERENCES media_objects(object_key) ON DELETE SET NULL,
  legacy_image_url TEXT NOT NULL DEFAULT '',
  is_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS artworks_public_order_idx
  ON artworks (is_hidden, sort_order, created_at);

INSERT OR IGNORE INTO artworks
  (id, title, alt_text, frame, y_offset, legacy_image_url, sort_order)
VALUES
  ('legacy-01', 'The First Morning', 'The First Morning, an artwork by Rosemary Williams', 'frame-1', '-translate-y-12', 'images/art/img17.png', 10),
  ('legacy-02', 'Study in Blue', 'Study in Blue, an artwork by Rosemary Williams', 'frame-2', 'translate-y-20', 'images/art/img12.png', 20),
  ('legacy-03', 'Valley Silence', 'Valley Silence, an artwork by Rosemary Williams', 'frame-3', '-translate-y-8', 'images/art/img3.png', 30),
  ('legacy-04', 'Gold Study', 'Gold Study, an artwork by Rosemary Williams', 'frame-4', 'translate-y-32', 'images/art/img18.png', 40),
  ('legacy-05', 'Tall Shadows', 'Tall Shadows, an artwork by Rosemary Williams', 'frame-1', '-translate-y-24', 'images/art/img9.png', 50),
  ('legacy-06', 'Winter Light', 'Winter Light, an artwork by Rosemary Williams', 'frame-1', 'translate-y-12', 'images/art/img14.png', 60),
  ('legacy-07', 'Small Joy', 'Small Joy, an artwork by Rosemary Williams', 'frame-3', 'translate-y-40', 'images/art/img1.png', 70),
  ('legacy-08', 'Abstract Study V', 'Abstract Study V, an artwork by Rosemary Williams', 'frame-4', '-translate-y-20', 'images/art/img19.png', 80),
  ('legacy-09', 'Horizon Line', 'Horizon Line, an artwork by Rosemary Williams', 'frame-1', 'translate-y-8', 'images/art/img7.png', 90),
  ('legacy-10', 'Fragment', 'Fragment, an artwork by Rosemary Williams', 'frame-2', '-translate-y-32', 'images/art/img2.png', 100),
  ('legacy-11', 'Evening Portrait', 'Evening Portrait, an artwork by Rosemary Williams', 'frame-3', 'translate-y-24', 'images/art/img16.png', 110),
  ('legacy-12', 'Solitude', 'Solitude, an artwork by Rosemary Williams', 'frame-4', '-translate-y-20', 'images/art/img20.png', 120),
  ('legacy-13', 'Coastal Dreams', 'Coastal Dreams, an artwork by Rosemary Williams', 'frame-1', 'translate-y-16', 'images/art/img8.png', 130),
  ('legacy-14', 'Golden Hour', 'Golden Hour, an artwork by Rosemary Williams', 'frame-2', '-translate-y-12', 'images/art/img11.png', 140),
  ('legacy-15', 'Ascent', 'Ascent, an artwork by Rosemary Williams', 'frame-3', 'translate-y-36', 'images/art/img4.png', 150),
  ('legacy-16', 'Quiet Field', 'Quiet Field, an artwork by Rosemary Williams', 'frame-4', '-translate-y-28', 'images/art/img15.png', 160),
  ('legacy-17', 'Memory', 'Memory, an artwork by Rosemary Williams', 'frame-1', 'translate-y-14', 'images/art/img6.png', 170),
  ('legacy-18', 'The Matriarch', 'The Matriarch, an artwork by Rosemary Williams', 'frame-2', '-translate-y-8', 'images/art/img13.png', 180),
  ('legacy-19', 'Wide Open', 'Wide Open, an artwork by Rosemary Williams', 'frame-3', 'translate-y-32', 'images/art/img10.png', 190),
  ('legacy-20', 'The Final Chapter', 'The Final Chapter, an artwork by Rosemary Williams', 'frame-4', 'translate-y-0', 'images/art/img5.png', 200);
