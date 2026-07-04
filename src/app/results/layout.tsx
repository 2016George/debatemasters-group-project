import { NetherSidebarShell } from "@/components/layout/NetherSidebarShell";
import { OnboardingSidebar } from "@/components/sidebars/OnboardingSidebar";

export default function ResultsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="results-nether-bg relative min-h-screen overflow-x-hidden font-app font-normal text-white antialiased">
      <div className="nether-haze-results" />
      <div className="crimson-particles" />
      <NetherSidebarShell sidebar={<OnboardingSidebar />}>
        <main className="relative z-10">
          {children}
        </main>
      </NetherSidebarShell>
    </div>
  );
}
