import type { Metadata } from "next";
import AtmosphericBackground from "@/apps/terra/components/AtmosphericBackground";
import BottomNav from "@/apps/terra/components/BottomNav";

export const metadata: Metadata = {
  title: "ÉDEN Terra",
  description: "Observe o céu, registre a terra, acompanhe a vida.",
};

export default function TerraLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AtmosphericBackground>
      <div className="h-full overflow-y-auto relative no-scrollbar">
        <main className="min-h-screen pb-32 md:pb-40 w-full">
          <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6 md:pt-10">
            {children}
          </div>
        </main>
        <BottomNav />
      </div>
    </AtmosphericBackground>
  );
}
