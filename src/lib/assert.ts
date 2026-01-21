
export type _ErrorActionFn = (E: Error, kind: "moderate" | "unexpected" | "critical") => void;
let _ErrorAction: _ErrorActionFn | undefined;

export async function hardAssert(condition: any, error: Error): Promise<void> {
  if (!condition) {
    await Promise.resolve(_ErrorAction?.(error, "critical"));
    throw error;
  }
}
export function assert(condition: any, error: Error): condition is true {
  return condition ? true : (_ErrorAction?.(error, "unexpected"), false);
}
export function softAssert(condition: any, error: Error): condition is true {
  return condition ? true : (_ErrorAction?.(error, "moderate"), false);
}

export function softError(error: Error) {
  _ErrorAction?.(error, "moderate");
}

export function _initErrorAction(fn: _ErrorActionFn) {
  _ErrorAction = fn;
}
