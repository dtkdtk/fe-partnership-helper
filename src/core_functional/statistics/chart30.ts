import { resources } from "#corelib";
import { Canvas } from "canvas";

const BG_COLOR = "#25272A";
const MAIN_COLOR = "#" + resources.colors.delegation.toString(16);
const TEXT_COLOR = "#ffffff";
const AXIS_COLOR = "#444444";

//ПРЕДУПРЕЖДЕНИЕ: Данный код сгенерирован ИИ.
//Однако это лучше, чем копаться целый день с ним вручную :)

/** data - это массив из 30 чисел (по дням) */
export function build30datesChart(values: number[], dates: string[]): Canvas {
  // Убираем год из дат (оставляем только месяц.день)
  dates = dates.map((_) => _.split("-").slice(0, -1).join("."));

  const width = 512 + 256;
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

  // Используем всю ширину для 30 столбцов
  const column_width = availableWidth / (values.length - 1); // Используем всю ширину: первый столбец у левого края, последний у правого
  const bar_width = Math.max(column_width * 0.6, 6); // Минимальная ширина 6px
  const bar_offset = (column_width - bar_width) / 2;

  // Настройка шрифта
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = `${font_size}px abibas`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Отрисовка дат внизу (с оптимизацией для 30 значений)
  dates.forEach((date, i) => {
    // Используем полную ширину: первый столбец у левого края, последний у правого
    // Центрируем дату под соответствующим столбцом с небольшим сдвигом вправо
    const x = padding + i * column_width + bar_width / 2 + bar_offset; // Добавляем bar_offset для сдвига вправо
    const y = height - date_height / 2;

    // Для 30 дат показываем только каждую 3-ю (10 меток вместо 30)
    if (i % 3 === 0 || i === dates.length - 1) {
      ctx.fillText(date, x, y);
    } else {
      // Рисуем короткую метку без текста
      ctx.strokeStyle = AXIS_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, height - date_height + 5);
      ctx.lineTo(x, height - date_height - 2);
      ctx.stroke();
    }
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
    ctx.fillText(Math.round(value).toString(), padding - font_size * 0.8, y);
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
    // Используем полную ширину: первый столбец у левого края, последний у правого
    const x = padding + i * column_width;
    const bar_height = (count / maxData) * maxBarHeight;
    const y = bottomY - bar_height;

    // Столбец
    ctx.fillStyle = MAIN_COLOR;
    ctx.fillRect(x + bar_offset, y, bar_width, bar_height);

    // Значение НАД столбцом (для всех столбцов)
    const valueFontSize = Math.min(font_size * 0.8, bar_width * 0.8) + 4; // Увеличено на 4 пикселя
    ctx.font = `${valueFontSize}px abibas`;
    ctx.fillStyle = TEXT_COLOR;

    // Подпись прямо над столбцом
    const textY = y - valueFontSize * 0.3;

    // Показываем числовое значение для ВСЕХ столбцов
    ctx.fillText(count.toString(), x + bar_width / 2 + bar_offset, textY);
  });

  return canvas;
}
