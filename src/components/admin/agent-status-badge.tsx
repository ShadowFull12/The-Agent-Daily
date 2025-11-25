
"use client"
import { Badge } from "@/components/ui/badge";
import type { AgentStatus } from "@/lib/types";
import { CheckCircle, Clock, Cpu, AlertTriangle, XCircle, Zap } from 'lucide-react';

const statusConfig: Record<AgentStatus, { label: string; icon: React.ReactNode; className: string }> = {
    idle: {
        label: "Idle",
        icon: <Clock className="h-3 w-3" />,
        className: "bg-gray-100 text-gray-800 border-gray-200",
    },
    working: {
        label: "Working",
        icon: <Zap className="h-3 w-3 animate-pulse" />,
        className: "bg-blue-100 text-blue-800 border-blue-200",
    },
    cooldown: {
        label: "Cooldown",
        icon: <Clock className="h-3 w-3" />,
        className: "bg-yellow-100 text-yellow-800 border-yellow-200",
    },
    success: {
        label: "Success",
        icon: <CheckCircle className="h-3 w-3" />,
        className: "bg-green-100 text-green-800 border-green-200",
    },
    error: {
        label: "Error",
        icon: <AlertTriangle className="h-3 w-3" />,
        className: "bg-red-100 text-red-800 border-red-200",
    },
    disabled: {
        label: "Disabled",
        icon: <XCircle className="h-3 w-3" />,
        className: "bg-gray-50 text-gray-500 border-gray-200",
    }
};


export function AgentStatusBadge({ status }: { status: AgentStatus }) {
    const config = statusConfig[status] || statusConfig.idle;
    
    return (
        <Badge variant="outline" className={`gap-1.5 pl-2 pr-2.5 ${config.className}`}>
            {config.icon}
            <span className="font-medium">{config.label}</span>
        </Badge>
    );
}
