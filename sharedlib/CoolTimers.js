import TypedEventEmitter from "./TypedEmitter.js";
import { MSK } from "./timeutil.js";
export class CoolTimer extends TypedEventEmitter {
    db;
    timers = {};
    constructor(db) {
        super();
        this.db = db;
        const previous_map = new Map(db);
        previous_map.forEach((value, key) => {
            if (value.start + value.duration > +MSK())
                return this.lateEnd(key);
            this.create(key, value);
        });
    }
    create(key, timer) {
        this.db.set(key, timer);
        this.db.save();
        this.timers[key] = setTimeout(() => {
            this.db.delete(key);
            this.emit("timerEnd", key, timer);
            this.db.save();
        }, timer.start + timer.duration - +MSK());
    }
    break(key) {
        const timer = this.db.get(key);
        this.db.delete(key);
        clearTimeout(this.timers[key]);
        this.emit("timerBreak", key, timer);
        this.db.save();
    }
    lateEnd(key) {
        const timer = this.db.get(key);
        this.db.delete(key);
        this.emit("timerEndLate", key, timer);
        this.db.save();
    }
}
