// Deletes files from a storage bucket. Supabase reports success even when row-level security
// lets it delete nothing (deleting needs a select policy as well as a delete one), so this
// counts what was actually removed. Cleanup is best effort: a file left behind is only
// unused storage, so callers carry on and the shortfall is logged.
export async function removeStoredFiles(supabase, bucket, paths) {
  const wanted = paths.filter(Boolean);
  if (!wanted.length) return true;
  const { data, error } = await supabase.storage.from(bucket).remove(wanted);
  const removed = data?.length ?? 0;
  if (error || removed < wanted.length) {
    console.warn(`Removed ${removed} of ${wanted.length} file(s) from the ${bucket} bucket.`, error?.message || "");
    return false;
  }
  return true;
}
