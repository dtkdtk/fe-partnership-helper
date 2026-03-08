import { resources } from "#corelib";
import { Canvas } from "canvas";

const BG_COLOR = "#25272A";
const MAIN_COLOR = "#" + resources.colors.delegation.toString(16);
const TEXT_COLOR = "#ffffff";
const AXIS_COLOR = "#444444";

//ПРЕДУПРЕЖДЕНИЕ: Данный код сгенерирован ИИ.
//Однако это лучше, чем копаться целый день с ним вручную :)

/** data - это массив из 7 чисел (по дням) */
export function build7datesChart(values: number[], dates: string[]): Canvas {
  // Убираем год из дат
  dates = dates.map((_) => _.split("-").slice(0, -1).join("."));

  const width = 512;
  const height = 512;
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.quality = "fast";

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  // Находим максимальное значение
  const maxData = Math.max(...values);
  
  // Расчет размеров
  const font_size = Math.round((Math.sqrt(width * height) / 100) * 3);
  const date_height = font_size * 2.5; // Отступ снизу для дат
  const padding = 40; // Боковые отступы
  const availableWidth = width - 2 * padding;
  
  // Определяем верхнюю точку для максимального столбца с учетом высоты текста
  const topTextMargin = font_size * 1.2; // Отступ сверху для текста над столбцом
  const maxColumnTop = topTextMargin; // Верх максимального столбца (с учетом текста)
  const bottomY = height - date_height; // Нижняя граница столбцов
  const maxBarHeight = bottomY - maxColumnTop; // Максимальная высота столбца
  
  const column_width = availableWidth / values.length;
  const bar_width = column_width * 0.7;
  const bar_offset = (column_width - bar_width) / 2;

  // Настройка шрифта
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = `${font_size}px abibas`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Отрисовка дат внизу
  dates.forEach((date, i) => {
    const x = padding + i * column_width + column_width / 2;
    const y = height - date_height / 2;
    ctx.fillText(date, x, y);
  });

  // Отрисовка оси Y (слева)
  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, bottomY);
  ctx.lineTo(padding, maxColumnTop);
  ctx.stroke();

  // Отрисовка меток оси Y
  const yAxisLabels = 5;
  for (let i = 0; i <= yAxisLabels; i++) {
    const value = (maxData * i) / yAxisLabels;
    const y = bottomY - (value / maxData) * maxBarHeight;
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(
      Math.round(value).toString(),
      padding - font_size * 0.8,
      y
    );
    
    // Горизонтальные линии сетки
    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  // Отрисовка столбцов и значений
  values.forEach((count, i) => {
    const bar_height = (count / maxData) * maxBarHeight;
    const x = padding + i * column_width + bar_offset;
    const y = bottomY - bar_height;

    // Столбец
    ctx.fillStyle = MAIN_COLOR;
    ctx.fillRect(x, y, bar_width, bar_height);

    // Значение НАД столбцом
    const valueFontSize = Math.min(font_size, bar_width * 0.8);
    ctx.font = `${valueFontSize}px abibas`;
    ctx.fillStyle = TEXT_COLOR;
    
    // Подпись прямо над столбцом
    const textY = y - valueFontSize * 0.3;
    
    ctx.fillText(
      count.toString(),
      x + bar_width / 2,
      textY
    );
  });

  return canvas;
}
