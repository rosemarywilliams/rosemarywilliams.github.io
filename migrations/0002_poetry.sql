CREATE TABLE IF NOT EXISTS poems (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  published_on TEXT NOT NULL,
  is_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS poems_public_order_idx
  ON poems (is_hidden, published_on DESC, created_at DESC);

INSERT OR IGNORE INTO poems (id, title, published_on, body)
VALUES
  (
    'legacy-poem-01',
    'Notes from the Garden',
    '2026-01-01',
    'The day leaves gold along the fence,
then folds itself into the trees.
What stays is not the light alone,
but how the evening learns to breathe.'
  ),
  (
    'legacy-poem-02',
    'After Rain',
    '2025-12-12',
    'Every stone keeps a darker name
after the rain has gone.
The path remembers weather
longer than the sky does.'
  ),
  (
    'legacy-poem-03',
    'Small Window',
    '2025-11-03',
    'A small window can hold
an impossible amount of blue.
I stand beside it quietly,
letting the room become sky.'
  );
