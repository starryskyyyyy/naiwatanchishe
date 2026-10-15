CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL CHECK(length(nickname) BETWEEN 1 AND 20),
  score INTEGER NOT NULL CHECK(typeof(score) = 'integer' AND score BETWEEN 0 AND 397),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS scores_ranking ON scores(score DESC, id ASC);
