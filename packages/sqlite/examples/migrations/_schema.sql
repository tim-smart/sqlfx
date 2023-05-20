CREATE TABLE IF NOT EXISTS "sqlfx_migrations" (
        migration_id integer PRIMARY KEY NOT NULL,
        created_at datetime NOT NULL DEFAULT current_timestamp,
        name VARCHAR(255) NOT NULL
      );
CREATE TABLE people (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at datetime NOT NULL DEFAULT current_timestamp
      );

INSERT INTO sqlfx_migrations VALUES(1,'2023-05-20 10:02:32','create people');