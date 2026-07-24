import { supabaseAdmin } from "@/lib/supabase";
import ClipsManager from "@/components/ClipsManager";

export const dynamic = "force-dynamic";

async function getClips() {
  const supabase = supabaseAdmin();
  const { data } = await supabase.from("clips").select("*").order("added_at", { ascending: false });
  return data || [];
}

async function getCopySettings() {
  const supabase = supabaseAdmin();
  const { data } = await supabase.from("site_settings").select("value").eq("key", "site_copy").single();
  return data?.value || {};
}

export default async function AdminClipsPage() {
  const [clips, copy] = await Promise.all([getClips(), getCopySettings()]);
  return (
    <div>
      <h1 className="font-display text-lg font-semibold mb-6">Clips</h1>
      <ClipsManager initialClips={clips} initialCopy={copy} />
    </div>
  );
}
