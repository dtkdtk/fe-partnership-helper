import { ButtonInteraction, ButtonStyle, type ActionRowData, type BaseMessageOptions, type MessageActionRowComponentBuilder, type MessageActionRowComponentData } from "discord.js";
import { InteractionContext } from "@eds-fw/framework";
export declare class PaginationSource<ContentType = string> {
    authorId: string;
    index: number;
    pages: ContentType[];
    contentTransformer: <ContentType_1>(data: PaginationSource<ContentType_1>) => string;
    pageDisplayer: PaginationSource.MsgBuilderFn<ContentType>;
    buildMessage(builder?: PaginationSource.MsgBuilderFn<ContentType>): BaseMessageOptions;
    constructor(authorId: string, pages: ContentType[], index?: number);
}
export declare namespace PaginationSource {
    type ButtonsType = ActionRowData<MessageActionRowComponentData | MessageActionRowComponentBuilder>[];
    type MsgBuilderFn<ContentType> = (data: PaginationSource<ContentType>, buttons: ButtonsType) => BaseMessageOptions;
    const NEXT_BTN_EMOJI: string;
    const NEXT_BTN_STYLE: Exclude<ButtonStyle, ButtonStyle.Link>;
    const PREVIOUS_BTN_EMOJI: string;
    const PREVIOUS_BTN_STYLE: Exclude<ButtonStyle, ButtonStyle.Link>;
    const PAGE_INDEX_BTN_STYLE: Exclude<ButtonStyle, ButtonStyle.Link>;
    const replies: {
        notYours(ctx: InteractionContext<ButtonInteraction>): any;
        oldInteraction(ctx: InteractionContext<ButtonInteraction>): any;
    };
    const cache: Map<string, PaginationSource<string>>;
    function fromJson(/** @clean */ json: string): PaginationSource;
    function init(): void;
    const defaultContentTransformer: <ContentType>(data: PaginationSource<ContentType>) => string;
    const defaultPageDisplayer: <ContentType>(data: PaginationSource<ContentType>, buttons: PaginationSource.ButtonsType) => BaseMessageOptions;
}
