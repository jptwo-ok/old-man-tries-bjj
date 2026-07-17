import { supabaseAdmin } from "@/lib/supabase";
import ThemeEditor from "@/components/ThemeEditor";

export const dynamic = "force-dynamic";

async function getSettings() {
  const supabase = supabaseAdmin();
  const [{ data: theme }, { data: copy }] = await Promise.all([
    supabase.from("site_settings").select("value").eq("key", "theme").single(),
    supabase.from("site_settings").select("value").eq("key", "site_copy").single(),
  ]);
  return { theme: theme?.value, copy: copy?.value };
}

export default async function ThemePage() {
  const { theme, copy } = await getSettings();
  return (
    <div>
      <h1 className="font-display text-lg font-semibold mb-6">Theme & site copy</h1>
      <p className="text-xs opacity-60 mb-6">
        Changes here apply to the live site within about a minute — no redeploy needed.
      </p>
      <ThemeEditor initialTheme={theme} initialCopy={copy} />
    </div>
  );
}
