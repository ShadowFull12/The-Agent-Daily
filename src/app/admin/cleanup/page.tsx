"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash2, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CleanupPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleCleanup = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/editions/cleanup", {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        toast({
          title: "Cleanup Complete",
          description: `Removed ${data.deleted} duplicate editions`,
        });
      } else {
        throw new Error(data.error || "Cleanup failed");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-6 w-6" />
            Database Cleanup
          </CardTitle>
          <CardDescription>
            Remove duplicate editions and clean up the database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold mb-1">What this does:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Removes duplicate editions (keeps the newest of each edition number)</li>
                  <li>Cleans up orphaned data</li>
                  <li>Ensures database consistency</li>
                </ul>
              </div>
            </div>
          </div>

          <Button
            onClick={handleCleanup}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Running Cleanup...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-5 w-5" />
                Run Cleanup
              </>
            )}
          </Button>

          {result && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex gap-2">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-800">
                  <p className="font-semibold mb-2">Cleanup Results:</p>
                  <ul className="space-y-1">
                    <li>✅ Deleted: <strong>{result.deleted}</strong> duplicate editions</li>
                    <li>📊 Remaining Drafts: <strong>{result.remainingDrafts}</strong></li>
                    <li>📰 Unique Editions: <strong>{result.uniqueEditions}</strong></li>
                  </ul>
                  <p className="mt-2 text-xs">{result.message}</p>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => window.location.href = "/"}
              className="w-full"
            >
              Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
