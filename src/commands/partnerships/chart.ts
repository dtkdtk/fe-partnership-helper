import { Canvas } from "canvas";
import { resources } from "../../corelib.js";


const BG_COLOR = "#25272A";
const MAIN_COLOR = "#" + resources.colors.delegation.toString(16);
const TEXT_COLOR = "#ffffff";

/** data - это массив из 14 чисел (по дням) */
export function createChart(data: number[], dates: string[]): Canvas {
  //убираем год
  dates = dates.map((_) => _.split(".").slice(0, -1).join("."));

  const width = 512 + 256;
  const height = 512;
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.quality = "fast";

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  const font_size = Math.round((Math.sqrt(width * height) / 100) * 3);
  const date_width = font_size * 2.5;
  const column_height = height / data.length;
  const display_column_height = column_height * 0.8;
  const column_offset = (column_height - display_column_height) / 2;
  const one_point_width =
    (width - date_width - column_height) / (Math.max(...data) || 1);

  ctx.fillStyle = TEXT_COLOR;
  ctx.font = `${font_size}px abibas`;
  dates.forEach((date, i) => {
    i++;
    //<...> - font_size / 2  --- это центровка
    //<...> - font_size / 10 --- это визуальная поправка центра (сдвиг вверх)
    ctx.fillText(date, 0, i * column_height - font_size / 2 - font_size / 10);
  });

  ctx.font = `${display_column_height}px abibas`;
  data.forEach((count, i) => {
    ctx.fillStyle = MAIN_COLOR;
    const x = date_width;
    const y = i * column_height + column_offset;
    const w = count * one_point_width;
    const h = display_column_height;
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(
      count.toString(),
      x + w + column_offset,
      y + display_column_height - column_offset - column_offset / 10
    );
    i++;
  });

  return canvas;
}
