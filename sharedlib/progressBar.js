export class ProgressBar {
    static BR_START = "[";
    static BR_END = "]";
    static DEFAULT_SYM_EMPTY = "<:ProgressBarEmpty:1241857500735606794>";
    static DEFAULT_SYM_FILLED = "<:ProgressBarFilled:1242137475908898836>";
    sym_empty = ProgressBar.DEFAULT_SYM_EMPTY;
    sym_filled = ProgressBar.DEFAULT_SYM_FILLED;
    length = 1;
    filled = 0;
    get filled_count() {
        return this.filled;
    }
    constructor(length, sym_empty, sym_filled) {
        this.length = length;
        if (sym_empty)
            this.sym_empty = sym_empty;
        if (sym_filled)
            this.sym_filled = sym_filled;
    }
    get isDone() {
        return this.filled >= this.length;
    }
    increase(count) {
        this.filled += count ?? 1;
        return this;
    }
    get bar() {
        return (ProgressBar.BR_START +
            this.sym_filled.repeat(this.filled) +
            this.sym_empty.repeat(this.length - this.filled) +
            ProgressBar.BR_END);
    }
    toString() {
        return this.bar;
    }
    [Symbol.toStringTag]() {
        return this.bar;
    }
}
