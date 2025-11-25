"use client";

import { useEffect } from "react";
import { collection, query, orderBy, onSnapshot, limit } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Log } from "@/lib/types";
import { format } from "date-fns";

interface LiveLogTerminalProps {
    logs: Log[];
    setLogs: (logs: Log[]) => void;
}

export function LiveLogTerminal({ logs, setLogs }: LiveLogTerminalProps) {
  const firestore = useFirestore();

  useEffect(() => {
    // The live-log functionality is disabled to prevent quota issues.
    // This component will no longer fetch data.
  }, [firestore, setLogs]);

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle className="font-headline">Live System Logs (Disabled)</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full">
            <div className="bg-gray-900 dark:bg-black text-white font-code p-4 text-sm rounded-b-lg h-full">
              <div className="text-gray-500">Real-time logging has been disabled to prevent exceeding Firestore write quotas.</div>
            </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
