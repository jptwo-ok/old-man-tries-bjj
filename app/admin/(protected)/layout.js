import { isAdmin } from "@/lib/adminAuth";
import { redirect } from "next/navigation";
import Link from "next/link";
import DisableBackForwardCache from "@/components/DisableBackForwardCache";

export default function ProtectedAdminLayout({ children }) {
  if (!isAdmin()) redirect("/admin/login");

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <DisableBackForwardCache />
      <nav className="flex gap-4 font-mono text-xs mb-8 border-b border-line pb-4">
        <Link href="/admin" className="opacity-80 hover:opacity-100">Dashboard</Link>
        <Link href="/admin/clips" className="opacity-80 hover:opacity-100">Clips</Link>
        <Link href="/admin/theme" className="opacity-80 hover:opacity-100">Theme & copy</Link>
        <Link href="/admin/announce" className="opacity-80 hover:opacity-100">Announce</Link>
        <Link href="/admin/messages" className="opacity-80 hover:opacity-100">Messages</Link>
        <Link href="/" className="opacity-50 hover:opacity-100 ml-auto">View site →</Link>
        <form action="/api/admin/logout" method="POST">
          <button className="opacity-50 hover:opacity-100">Log out</button>
        </form>
      </nav>
      {children}
    </div>
  );
}
