import Link from "next/link";
import ContactForm from "@/components/ContactForm";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  return (
    <main className="max-w-4xl mx-auto px-3 pt-8 pb-16">
      <Link href="/" className="font-mono text-[11px] underline opacity-60 hover:opacity-100">
        ← back
      </Link>

      <div className="border-t border-line pt-8">
        <ContactForm />
      </div>
    </main>
  );
}