import { ButtonStyle, ComponentType, } from "discord.js";
import { createButton } from "@eds-fw/framework";
import { emoji } from "./utils.js";
let isHandlersCreated = false;
export class PaginationSource {
    authorId;
    index = 0;
    pages;
    contentTransformer = PaginationSource.defaultContentTransformer;
    pageDisplayer = PaginationSource.defaultPageDisplayer;
    buildMessage(builder = this.pageDisplayer) {
        const buttons = [
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        customId: "pagination.previous",
                        style: PaginationSource.PREVIOUS_BTN_STYLE,
                        emoji: emoji(PaginationSource.PREVIOUS_BTN_EMOJI),
                        disabled: this.index == 0,
                    },
                    {
                        type: ComponentType.Button,
                        customId: "pagination.pageIndex",
                        style: PaginationSource.PAGE_INDEX_BTN_STYLE,
                        label: `Страница ${this.index + 1}/${this.pages.length}`,
                    },
                    {
                        type: ComponentType.Button,
                        customId: "pagination.next",
                        style: PaginationSource.NEXT_BTN_STYLE,
                        emoji: emoji(PaginationSource.NEXT_BTN_EMOJI),
                        disabled: this.index + 1 == this.pages.length,
                    },
                ],
            },
        ];
        const built = builder(this, buttons);
        return built;
    }
    constructor(authorId, pages, index = 0) {
        if (!isHandlersCreated)
            PaginationSource.init();
        this.authorId = authorId;
        this.pages = pages;
        this.index = index;
    }
}
(function (PaginationSource) {
    PaginationSource.NEXT_BTN_EMOJI = "➡";
    PaginationSource.NEXT_BTN_STYLE = ButtonStyle.Secondary;
    PaginationSource.PREVIOUS_BTN_EMOJI = "⬅";
    PaginationSource.PREVIOUS_BTN_STYLE = ButtonStyle.Secondary;
    PaginationSource.PAGE_INDEX_BTN_STYLE = ButtonStyle.Primary;
    PaginationSource.replies = {
        notYours(ctx) { },
        oldInteraction(ctx) { },
    };
    PaginationSource.cache = new Map();
    function fromJson(/** @clean */ json) {
        const deserialized = JSON.parse(json);
        const instance = new PaginationSource(deserialized.authorId, deserialized.pages, deserialized.index);
        return instance;
    }
    PaginationSource.fromJson = fromJson;
    function init() {
        isHandlersCreated = true;
        createButton({
            custom_id: "pagination.previous",
        }, handleButton_previous);
        createButton({
            custom_id: "pagination.pageIndex",
        }, handleButton_pageIndex);
        createButton({
            custom_id: "pagination.next",
        }, handleButton_next);
    }
    PaginationSource.init = init;
    PaginationSource.defaultContentTransformer = (data) => {
        const page = data.pages[data.index];
        if (typeof page == "string")
            return page;
        else
            return String(page);
    };
    PaginationSource.defaultPageDisplayer = (data, buttons) => {
        return {
            embeds: [
                {
                    title: `Страница ${data.index + 1}/${data.pages.length}`,
                    description: data.contentTransformer(data),
                },
            ],
            components: buttons,
        };
    };
})(PaginationSource || (PaginationSource = {}));
async function handleButton_previous(ctx) {
    const data = PaginationSource.cache.get(ctx.message.id);
    if (!data)
        return PaginationSource.replies.oldInteraction(ctx);
    if (data.authorId != ctx.user.id)
        return PaginationSource.replies.notYours(ctx);
    data.index--;
    ctx.update(data.buildMessage(data.pageDisplayer)).catch(console.error);
}
async function handleButton_next(ctx) {
    const data = PaginationSource.cache.get(ctx.message.id);
    if (!data)
        return PaginationSource.replies.oldInteraction(ctx);
    if (data.authorId != ctx.user.id)
        return PaginationSource.replies.notYours(ctx);
    data.index++;
    ctx.update(data.buildMessage(data.pageDisplayer)).catch(console.error);
}
async function handleButton_pageIndex(ctx) {
    const data = PaginationSource.cache.get(ctx.message.id);
    if (!data)
        return PaginationSource.replies.oldInteraction(ctx);
    if (data.authorId != ctx.user.id)
        return PaginationSource.replies.notYours(ctx);
    if (data.index == 0)
        data.index = data.pages.length - 1;
    else if (data.index > 0)
        data.index = 0;
    ctx.update(data.buildMessage(data.pageDisplayer)).catch(console.error);
}
