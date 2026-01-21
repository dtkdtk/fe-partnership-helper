import { accessSync, appendFileSync, mkdirSync } from "fs";
export class PersistentLogger {
    dirpath;
    time_offset;
    _path = "";
    _date;
    msgCount = 0;
    constructor(dirpath = "./logs", time_offset = 0) {
        this.dirpath = dirpath;
        this.time_offset = time_offset;
        try {
            accessSync(this.dirpath);
        }
        catch (err) {
            mkdirSync(this.dirpath);
        }
        let date = this._today();
        this._date = this._today();
        this._path = this.dirpath + `/${date}.log`;
        try {
            accessSync(this._path);
        }
        catch (err) {
            this._createFile(date);
        }
    }
    template = (message) => `\n[${this._time()}] (${this.msgCount + 1}) ${message}`;
    log(message) {
        //load displacement
        setTimeout(() => {
            if (this._today() !== this._date) {
                this._path = this.dirpath + `/${this._today()}.log`;
                this._createFile(this._today());
                this._counterReport();
                this.msgCount = 0;
            }
            try {
                appendFileSync(this._path, this.template(message));
            }
            catch (err) {
                throw new Error("in Logger.log append file sync");
            }
            this.msgCount++;
        }, this.time_offset);
    }
    _format(num) {
        return (num >= 10 ? num : "0" + num).toString();
    }
    _today() {
        const date = new Date();
        return `${date.getFullYear()}-${this._format(date.getMonth() + 1)}-${this._format(date.getDate())}`;
    }
    _time() {
        const date = new Date();
        return `${this._format(date.getHours())}:${this._format(date.getMinutes())}:${this._format(date.getSeconds())}`;
    }
    _createFile(date) {
        appendFileSync(this.dirpath + `/${date}.log`, "");
    }
    _counterReport() {
        try {
            appendFileSync(this._path, `\n\nEnd of log file. Total messages: ${this.msgCount}`);
        }
        catch (err) {
            throw new Error("in Logger.log append file sync");
        }
    }
}
