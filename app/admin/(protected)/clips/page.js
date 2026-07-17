import { supabaseAdmin } from "@/lib/supabase";
import ClipsManager from "@/components/ClipsManager";

export const dynamic = "force-dynamic";

async function getClips() {
  const supabase = supabaseAdmin();
  const { data } = await supabase.from("clips").select("*").order("added_at", { ascending: false });
  return data || [];
}

export default async function AdminClipsPage() {
  const clips = await getClips();
  return (
    <div>
      <h1 className="font-display text-lg font-semibold mb-6">Clips</h1>
      <ClipsManager initialClips={clips} />
    </div>
  );
}
