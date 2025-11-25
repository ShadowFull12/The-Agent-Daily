"use client"
import { Badge } from "@/components/ui/badge";

export function AgentStatusBadge({ status }: { status: string }) {
    const variant = status === 'Idle' ? 'secondary' : (status === 'Reviewing' ? 'default' : 'default');
    const colorClass = status === 'Idle' ? '' : 'bg-primary text-primary-foreground';
    
    return <Badge variant={variant} className={colorClass}>{status}</Badge>;
}
