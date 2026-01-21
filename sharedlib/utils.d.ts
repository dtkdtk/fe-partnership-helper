import { JSONEncodable, Message, TopLevelComponentData } from "discord.js";
export declare function asDisabled<T extends TopLevelComponentData>(originalComponents: Readonly<T[]>): T[];
export declare function disableComponents(msg: Message): void;
export declare function unwrapJsonEncodable<Result extends object>(value: JSONEncodable<Result> | Result): Result;
export declare function clampString(text: string, targetLength: number): string;
export declare function createResourceFile(path: string, text?: string): boolean;
export declare function getResourceFile(path: string, defaultValue?: string): string;
export declare function emoji(E: string): {
    name: string;
    id: string;
};
