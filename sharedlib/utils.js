import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import libPath from "path";
export function asDisabled(originalComponents) {
    const components = structuredClone(originalComponents);
    for (const row of components)
        if ("components" in row)
            for (const btn of row.components)
                btn.disabled = true;
    return components;
}
export function disableComponents(msg) {
    msg
        .edit({
        content: msg.content,
        embeds: msg.embeds,
        files: Array.from(msg.attachments.values()),
        components: asDisabled(msg.components),
    })
        .catch(console.error);
}
export function unwrapJsonEncodable(value) {
    if ("toJSON" in value)
        return value.toJSON();
    return value;
}
export function clampString(text, targetLength) {
    if (text.length > targetLength)
        text = text.slice(0, targetLength - 1) + "…";
    return text;
}
export function createResourceFile(path, text = "") {
    if (!existsSync(path)) {
        const directories = path
            .split(/[\/\\]/g)
            .slice(0, -1)
            .join(libPath.sep);
        if (directories)
            mkdirSync(directories, { recursive: true });
        writeFileSync(path, text);
        return true;
    }
    else
        return false;
}
export function getResourceFile(path, defaultValue = "") {
    const created = createResourceFile(path, defaultValue);
    if (created)
        return defaultValue;
    else
        return readFileSync(path, "utf-8") || defaultValue;
}
export function emoji(E) {
    E = E.slice(2, -1);
    const parts = E.split(":");
    return {
        name: parts[0],
        id: parts[1],
    };
}
