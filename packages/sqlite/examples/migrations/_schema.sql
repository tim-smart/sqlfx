CREATE TABLE IF NOT EXISTS "sqlfx_migrations" (
        migration_id integer PRIMARY KEY NOT NULL,
        created_at datetime NOT NULL DEFAULT current_timestamp,
        name VARCHAR(255) NOT NULL
      );
CREATE TABLE people (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at datetime NOT NULL DEFAULT current_timestamp
      , age INTEGER);

INSERT INTO sqlfx_migrations VALUES(1,'2023-09-23 07:38:05','create people');
INSERT INTO sqlfx_migrations VALUES(2,'2023-09-23 07:39:58','add age');