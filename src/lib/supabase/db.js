import { getSupabaseBrowserClient } from "@/lib/supabase/supabaseClient";

/**
 * Inserts one record into a Supabase table.
 * Pass table name and an object containing column values.
 */
export async function addRecord(table, values) {
  const supabase = getSupabaseBrowserClient();
  return supabase.from(table).insert(values).select();
}

/**
 * Reads all rows from a Supabase table.
 * Keeps the query simple and returns everything.
 */
export async function getAllRecords(table) {
  const supabase = getSupabaseBrowserClient();
  return supabase.from(table).select("*");
}

/**
 * Updates one row in a table by id.
 * idColumn defaults to "id" for common table structures.
 */
export async function updateRecord(table, id, values, idColumn = "id") {
  const supabase = getSupabaseBrowserClient();
  return supabase.from(table).update(values).eq(idColumn, id).select();
}

/**
 * Deletes one row in a table by id.
 * idColumn defaults to "id" to keep usage simple.
 */
export async function deleteRecord(table, id, idColumn = "id") {
  const supabase = getSupabaseBrowserClient();
  return supabase.from(table).delete().eq(idColumn, id);
}
