import { catalogueScope } from "./entities.ts";
import { readDb } from "./read.ts";
import type { Sqlite } from "./sqlite.ts";

/** One stored attribute: entity key, name, type tag, canonical text value. */
export type AttributeRow = { k: string; n: string; t: string; v: string };

/** Attributes of the entities in the catalogue's scope, streamed. */
export function catalogueAttributes(sinceBlock: number, db: Sqlite = readDb()): Iterable<AttributeRow> {
  return db.prepare(`SELECT a.entityKey AS k, a.name AS n, a.type AS t, a.value AS v FROM "Attribute" a JOIN "Entity" e ON e.key = a.entityKey WHERE ${catalogueScope(sinceBlock)}`)
    .iterate() as Iterable<AttributeRow>;
}

/** Text attributes among `fields` whose value equals `text`, ignoring case (at most 5,000). */
export function findTextValues(fields: readonly string[], text: string, db: Sqlite = readDb()): { entityKey: string; name: string; value: string }[] {
  return db.prepare(`SELECT entityKey, name, value FROM "Attribute" WHERE name IN (${fields.map(() => "?").join(",")}) AND type = 'str' AND value = ? COLLATE NOCASE LIMIT 5000`)
    .all(...fields, text) as { entityKey: string; name: string; value: string }[];
}

/** An entity's attributes, by name. */
export function entityAttributes(key: string, db: Sqlite = readDb()): { name: string; type: string; value: string }[] {
  return db.prepare(`SELECT name, type, value FROM "Attribute" WHERE entityKey = ? ORDER BY name`).all(key) as { name: string; type: string; value: string }[];
}
