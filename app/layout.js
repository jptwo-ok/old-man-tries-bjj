import "./globals.css";
import { supabasePublic } from "@/lib/supabase";

export const metadata = {
  title: "Old Man Tries BJJ",
  description: "Vote LEGIT, IFFY, or SKIP IT on real BJJ technique clips.",
};

export const revalidate = 60; // theme/settings changes show up within a minute, no redeploy needed

async function getTheme() {
  const supabase = supabasePublic();
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "theme")
    .single();
  return data?.value || null;
}

export default async function RootLayout({ children }) {
  const theme = await getTheme();

  const themeVars = theme
    ? `:root{
        --color-bg:${theme.colorBg};
        --color-text:${theme.colorText};
        --color-legit:${theme.colorLegit};
        --color-situational:${theme.colorSituational};
        --color-trash:${theme.colorTrash};
        --color-line:${theme.colorLine};
        --font-display:${theme.fontDisplay};
        --font-body:${theme.fontBody};
        --font-mono:${theme.fontMono};
      }`
    : "";

  return (
    <html lang="en">
      <head>
        {themeVars && <style dangerouslySetInnerHTML={{ __html: themeVars }} />}
        <link
          href="https://fonts.googleapis.com/css2?family=Quicksand:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body min-h-screen">{children}</body>
    </html>
  );
}
