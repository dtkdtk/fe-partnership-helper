// PATCHED
import { resources } from "../dist/corelib.js";
export var tReply;
(function (tReply) {
    function error(ctx, name, description, components) {
        ctx.quickReply(ctx.contextType != "text", name ?? undefined, description ?? undefined, "error", components, {
            thumbnail: { url: resources.images.no },
        });
    }
    tReply.error = error;
    function errUnexp(ctx, description) {
        ctx.quickReply(ctx.contextType != "text", "Ошибка", description, "error", undefined, {
            thumbnail: { url: resources.images.warning },
        });
    }
    tReply.errUnexp = errUnexp;
    function errCooldown(ctx, title, description) {
        ctx.quickReply(ctx.contextType != "text", title ?? undefined, description, "error", undefined, { thumbnail: { url: resources.images.time } });
    }
    tReply.errCooldown = errCooldown;
    function success(ctx, name, description, components) {
        ctx.quickReply(ctx.contextType != "text", name ?? undefined, description ?? undefined, "default", components, {
            thumbnail: { url: resources.images.yes },
        });
    }
    tReply.success = success;
})(tReply || (tReply = {}));
