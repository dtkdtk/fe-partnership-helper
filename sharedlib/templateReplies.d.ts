import { eds } from "@eds-fw/framework";
import { BaseMessageOptions } from "discord.js";
export declare namespace tReply {
    function error(ctx: eds.AnyContext, name: string | null, description: string | null, components?: BaseMessageOptions["components"]): void;
    function errUnexp(ctx: eds.AnyContext, description: string): void;
    function errCooldown(ctx: eds.AnyContext, title: string | null, description: string): void;
    function success(ctx: eds.AnyContext, name: string | null, description: string | null, components?: BaseMessageOptions["components"]): void;
}
