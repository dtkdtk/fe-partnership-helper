export declare class PersistentLogger {
    private dirpath;
    private time_offset;
    private _path;
    private _date;
    msgCount: number;
    constructor(dirpath?: string, time_offset?: number);
    template: (message: string) => string;
    log(message: string): void;
    private _format;
    private _today;
    private _time;
    private _createFile;
    private _counterReport;
}
