CREATE TABLE species (
  id SERIAL PRIMARY KEY,
  name TEXT,
  scientific_name TEXT
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT,
  password TEXT
);

CREATE TABLE notes (
  id SERIAL PRIMARY KEY,
  habitat TEXT,
  date TEXT,
  appearance TEXT,
  vocalisations TEXT,
  flock_size INTEGER,
  species_id INTEGER
);

CREATE TABLE behaviours (
  id SERIAL PRIMARY KEY,
  behaviour TEXT
);

CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  content TEXT,
  user_id INTEGER,
  note_id INTEGER
);

CREATE TABLE notes_behaviour (
  id SERIAL PRIMARY KEY,
  notes_id INTEGER,
  behaviour_id INTEGER
);