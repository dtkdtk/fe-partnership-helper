export declare class ProgressBar {
    static readonly BR_START = "[";
    static readonly BR_END = "]";
    static readonly DEFAULT_SYM_EMPTY = "<:ProgressBarEmpty:1241857500735606794>";
    static readonly DEFAULT_SYM_FILLED = "<:ProgressBarFilled:1242137475908898836>";
    private sym_empty;
    private sym_filled;
    private length;
    private filled;
    get filled_count(): number;
    constructor(length: number, sym_empty?: string, sym_filled?: string);
    get isDone(): boolean;
    increase(count?: number): this;
    get bar(): string;
    toString(): string;
    [Symbol.toStringTag](): string;
}
