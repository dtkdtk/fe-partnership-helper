/**
 * Функция для очистки визуального форматирования текста.
 * Удаляет только Markdown форматирование.
 * 
 * Сохраняет: символьное оформление, списки, цитаты, ссылки
 * (но не на картинки), Unicode-эмодзи
 */
export function cleanTextFormatting(text: string): string {
  const lines = text.split("\n");
  const cleanedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    line = line.replace(/^\s*#{1,6}\s+/g, "");

    line = line.replace(/\*\*\*(.*?)\*\*\*/g, "$1");
    line = line.replace(/\*\*(.*?)\*\*/g, "$1");
    line = line.replace(/\*(.*?)\*/g, "$1");
    line = line.replace(/__(.*?)__/g, "$1");
    line = line.replace(/~~(.*?)~~/g, "$1");
    line = line.replace(/`([^`]+)`/g, "$1");

    if (line.trim().startsWith("```") && line.trim().endsWith("```"))
      line = line.replace(/```/g, "");

    line = processLinks(line);
    line = line.replace(/<\/?[a-zA-Z][^>]*>/g, "");
    line = line.trim();
    if (line !== "" || lines[i].trim() === "")
      cleanedLines.push(line);
  }

  return cleanedLines.join("\n");
}

export function quotePartnership(text: string): string {
  const visiblePart = cleanTextFormatting(text);
  const quoted = "> " + visiblePart.replaceAll("\n", "\n> ");
  return quoted;
}

/**
 * Обрабатывает ссылки - сохраняет URL и текст, убирает Markdown форматирование
 */
function processLinks(line: string): string {
  return line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    if (
      url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i) ||
      url.includes("tenor.com") ||
      url.includes("cdn.discordapp.com/attachments") ||
      url.includes("media.discordapp.net")
    ) {
      return text;
    }
    else return `${text} ${url}`;
  });
}
