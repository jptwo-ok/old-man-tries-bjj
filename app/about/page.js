import Link from "next/link";
import { supabasePublic } from "@/lib/supabase";
import ContactForm from "@/components/ContactForm";

export const dynamic = "force-dynamic";

async function getAboutText() {
  const supabase = supabasePublic();
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "site_copy")
    .single();
  return data?.value?.aboutText || "Write your About Me content here.";
}

export default async function AboutPage() {
  const aboutText = await getAboutText();

  return (
    <main className="max-w-4xl mx-auto px-3 pt-8 pb-16">
      <Link href="/" className="font-mono text-[11px] underline opacity-60 hover:opacity-100">
        ← back
      </Link>

      <header className="mt-6 mb-8">
        <h1 className="font-display text-2xl font-semibold tracking-wide">About</h1>
      </header>

      <div className="max-w-lg text-sm leading-relaxed opacity-90 mb-12 whitespace-pre-wrap">
        {aboutText}
      </div>

      <div className="border-t border-line pt-8">
        <h2 className="font-mono text-xs uppercase tracking-wide opacity-60 mb-4">
          Questions / Comments
        </h2>
        <ContactForm />
      </div>
    </main>
  );
}