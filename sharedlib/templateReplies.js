// PATCHED
import { resources } from "../dist/corelib.js";
export var tReply;
(function (tReply) {
    function error(ctx, name, description, components) {
        ctx.quickReply(ctx.contextType != "text", name ?? undefined, description ?? undefined, "error", components, {
            thumbnail: { url: sharedRes.embed_icons.no },
        });
    }
    tReply.error = error;
    function errUnexp(ctx, description) {
        ctx.quickReply(ctx.contextType != "text", "Ошибка", description, "error", undefined, {
            thumbnail: { url: sharedRes.embed_icons.warning },
        });
    }
    tReply.errUnexp = errUnexp;
    function errCooldown(ctx, title, description) {
        ctx.quickReply(ctx.contextType != "text", title ?? undefined, description, "error", undefined, { thumbnail: { url: sharedRes.embed_icons.clock } });
    }
    tReply.errCooldown = errCooldown;
    function success(ctx, name, description, components) {
        ctx.quickReply(ctx.contextType != "text", name ?? undefined, description ?? undefined, "default", components, {
            thumbnail: { url: sharedRes.embed_icons.yes },
        });
    }
    tReply.success = success;
})(tReply || (tReply = {}));
