import { supabaseAdmin } from "@/lib/supabase";
import { beltColor } from "@/lib/belts";

export const dynamic = "force-dynamic";

async function getMessages() {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("private_messages")
    .select("*")
    .order("created_at", { ascending: false });
  return data || [];
}

export default async function AdminMessagesPage() {
  const messages = await getMessages();

  return (
    <div>
      <h1 className="font-display text-lg font-semibold mb-2">Messages</h1>
      <p className="text-xs opacity-60 mb-6">
        Submitted via "questions/comments or host your clips" on the homepage. Only you can see these.
      </p>
      <div className="space-y-2">
        {messages.map((m) => (
          <div key={m.id} className="border border-line rounded-md px-3 py-2 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-3 h-3 rounded-full border border-line shrink-0"
                style={{ background: beltColor(m.belt) }}
                title={m.belt || undefined}
              />
              <span className="font-mono text-xs opacity-70">{m.name}</span>
              <span className="font-mono text-[10px] opacity-40 ml-auto">
                {new Date(m.created_at).toLocaleString()}
              </span>
            </div>
            <p>{m.message}</p>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="font-mono text-xs opacity-40">No messages yet.</p>
        )}
      </div>
    </div>
  );
}
