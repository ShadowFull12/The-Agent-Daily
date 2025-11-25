
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function AgentStatusSection() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Agent Status</CardTitle>
                <CardDescription>The agent system has been simplified. Use the manual controls to fetch leads and publish editions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-muted rounded-md">
                    <span className="text-muted-foreground">System Status</span>
                    <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                        <span className="text-sm font-medium">Idle</span>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">The old progress bar has been removed. Check the data columns below to see the results of agent runs.</p>
            </CardContent>
        </Card>
    );
}
