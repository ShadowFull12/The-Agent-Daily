
"use client";

import * as React from "react";
import { Rss, FileCheck, PenSquare, CopyCheck, Newspaper, UploadCloud } from 'lucide-react';
import type { AgentStatus as AgentStatusType } from "@/lib/types";

export type AgentName = 'scout' | 'deduplicator' | 'journalist' | 'validator' | 'editor' | 'publisher';

export type AgentStatus = AgentStatusType;

interface AgentConfig {
    name: string;
    icon: React.ComponentType<{ className?: string }>;
}

const AGENT_CONFIG: Record<AgentName, AgentConfig> = {
    scout: { name: 'Scout', icon: Rss },
    deduplicator: { name: 'Deduplicator', icon: CopyCheck },
    journalist: { name: 'Journalist', icon: PenSquare },
    validator: { name: 'Validator', icon: FileCheck },
    editor: { name: 'Editor', icon: Newspaper },
    publisher: { name: 'Publisher', icon: UploadCloud },
};

const STATUS_COLORS: Record<AgentStatus, { base: string; pulse: string; text: string }> = {
    idle: { base: 'fill-gray-300 dark:fill-gray-700', pulse: 'stroke-gray-400', text: 'text-gray-500 dark:text-gray-400' },
    working: { base: 'fill-blue-500', pulse: 'stroke-blue-400', text: 'text-blue-600 dark:text-blue-400' },
    cooldown: { base: 'fill-yellow-400', pulse: 'stroke-yellow-300', text: 'text-yellow-600 dark:text-yellow-400' },
    success: { base: 'fill-green-500', pulse: 'stroke-green-400', text: 'text-green-600 dark:text-green-400' },
    error: { base: 'fill-red-500', pulse: 'stroke-red-400', text: 'text-red-600 dark:text-red-400' },
    disabled: { base: 'fill-gray-200 dark:fill-gray-800', pulse: 'stroke-gray-300', text: 'text-gray-400 dark:text-gray-500' },
};

const AgentNode = ({ id, status }: { id: AgentName; status: AgentStatus }) => {
    const config = AGENT_CONFIG[id];
    const colors = STATUS_COLORS[status];
    const Icon = config.icon;

    return (
        <div className="flex flex-col items-center gap-2 w-24 text-center">
            <div className="relative">
                {status === 'working' && (
                    <svg className="absolute -top-2 -left-2 h-16 w-16" viewBox="0 0 100 100">
                        <circle
                            className={`animate-pulse stroke-current ${colors.pulse}`}
                            cx="50"
                            cy="50"
                            r="45"
                            strokeWidth="4"
                            fill="none"
                            opacity="0.5"
                        />
                    </svg>
                )}
                 <div className={`relative h-12 w-12 rounded-full flex items-center justify-center transition-colors duration-300 ${colors.base} bg-opacity-20 dark:bg-opacity-30 border-2 ${colors.base.replace('fill', 'border')}`}>
                    <Icon className={`h-6 w-6 transition-colors duration-300 ${colors.base.replace('fill', 'text')}`} />
                </div>
            </div>
            <span className={`text-sm font-semibold transition-colors duration-300 ${colors.text}`}>
                {config.name}
            </span>
        </div>
    );
};

const Arrow = () => (
    <svg className="h-8 w-8 text-gray-300 dark:text-gray-600 self-center -mt-6 hidden md:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
    </svg>
);

const DownArrow = () => (
     <svg className="h-8 w-8 text-gray-300 dark:text-gray-600 self-center md:hidden"  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14"/>
        <path d="m19 12-7 7-7-7"/>
     </svg>
)


export function WorkflowDiagram({ agentStatuses }: { agentStatuses: Record<AgentName, AgentStatus> }) {
    const agents: AgentName[] = ['scout', 'deduplicator', 'journalist', 'validator', 'editor', 'publisher'];
    return (
        <div className="flex flex-col md:flex-row flex-wrap items-center justify-center gap-y-4">
            {agents.map((agent, index) => (
                <React.Fragment key={agent}>
                    <AgentNode id={agent} status={agentStatuses[agent]} />
                    {index < agents.length - 1 && (
                        <>
                            <Arrow />
                            <DownArrow />
                        </>
                    )}
                </React.Fragment>
            ))}
        </div>
    );
}
