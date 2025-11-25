
"use client";

import { MissionControl } from "@/components/admin/mission-control";
import { AdvancedOptions } from "@/components/admin/advanced-options";
import { EditionReview } from "@/components/admin/edition-review";

export default function AdminDashboard() {

  return (
    <div className="container mx-auto grid gap-8 pb-12">
        <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold font-headline tracking-tight">Mission Control</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
                Oversee the automated, multi-agent workflow that brings The Daily Agent to life.
                The system runs daily, but you can initiate a manual run at any time.
            </p>
        </div>
        <MissionControl />
        <EditionReview />
        <AdvancedOptions />
    </div>
  );
}
