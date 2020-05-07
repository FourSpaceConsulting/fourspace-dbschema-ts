import { readFileSync } from "fs";

export interface WriteConfig {
    schemaLocation: string;
    sqlOutputLocation: string;
    codeOutputLocation: string;
}

export function readConfig(path: string): WriteConfig {
    const writeConfig: WriteConfig = JSON.parse(readFileSync(path, 'utf-8'));
    return writeConfig;
}
