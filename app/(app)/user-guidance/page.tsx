import type { Metadata } from "next";

import { UserGuidanceView } from "@/components/user-guidance/UserGuidanceView";

export const metadata: Metadata = {
  title: "User Guide",
  description:
    "How to allow location and camera access, and install the Jwork HRMS app on iPhone, Android, or desktop.",
};

export default function UserGuidancePage() {
  return <UserGuidanceView />;
}
