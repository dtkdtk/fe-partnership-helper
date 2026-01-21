import { Storage } from "@eds-fw/framework";
import TypedEventEmitter, { EventMap } from "./TypedEmitter.js";
export declare class CoolTimer<T extends CoolTimer.TimerBase> extends TypedEventEmitter<CoolTimer.Events> {
    db: Storage<T>;
    timers: Record<string, NodeJS.Timeout>;
    constructor(db: Storage<T>);
    create(key: string, timer: T): void;
    break(key: string): void;
    lateEnd(key: string): void;
}
export declare namespace CoolTimer {
    interface Events extends EventMap {
        timerEnd: <T extends TimerBase>(key: string, timer: T) => any;
        timerEndLate: <T extends TimerBase>(key: string, timer: T) => any;
        timerBreak: <T extends TimerBase>(key: string, timer: T) => any;
    }
    interface TimerBase {
        start: number;
        duration: number;
    }
}
