import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { GuestUpgradePrompt } from "@/components/auth/GuestUpgradePrompt";
import { ResponsivePage } from "@/components/responsive/ResponsivePage";
import { breakpoints } from "@/lib/responsive";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <>
      <style>{`
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .rs-dash-header h1 {
            font-size: 1.5rem !important;
          }
          .rs-dash-header p {
            font-size: 0.875rem !important;
          }
        }
      `}</style>
      <ResponsivePage>
        <GuestUpgradePrompt />

        <div
          style={{
            padding: "16px 20px",
            marginBottom: "24px",
            backgroundColor: "#FCF5DF",
            border: "1px solid #ECBA2B",
            borderRadius: "12px",
            fontSize: "14px",
            color: "#111827",
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: "#ECBA2B" }}>Note:</strong> This is a planning tool and is not
          affiliated with or endorsed by the school district. Course offerings, graduation requirements,
          and all other information may not reflect the most current data. Always consult your school
          counselor or the official course catalog for authoritative information.
        </div>

        <div className="rs-dash-header">
          <DashboardHeader />
        </div>

        <DashboardOverview />
      </ResponsivePage>
    </>
  );
}
