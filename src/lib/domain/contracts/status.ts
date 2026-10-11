import type { AccountInfo, BlankReason, Mode } from "../types";
export interface EnvKeyStatusWire {
    key: string;
    group: string;
    set: boolean;
    required: boolean;
    secret: boolean;
    masked: string | null;
    description: string;
}
export interface StatusResponse {
    mode: Mode;
    reason: BlankReason | null;
    reasonText: string;
    account: AccountInfo;
    accounts: AccountInfo[];
    manager: {
        id: string;
        name: string;
    } | null;
    today: string;
    dataThrough: string;
    googleAds: {
        apiVersion: string;
        envFile: boolean;
        missingKeys: string[];
        health: {
            ok: boolean;
            checkedAt: string | null;
            latencyMs?: number;
            errorCode?: string;
        } | null;
    };
    store: {
        driver: "file" | "memory";
        writable: boolean;
        fallbackReason?: string;
    };
    scheduler: {
        enabled: boolean;
        intervalMinutes: number;
        lastRunAt: string | null;
    };
    security: {
        basicAuth: boolean;
        encryption: boolean;
        readOnly: true;
    };
    display: {
        currency: string;
        fxRates: Record<string, number>;
    };
    env: EnvKeyStatusWire[];
    generatedAt: string;
}
