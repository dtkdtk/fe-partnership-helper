import { Canvas } from "canvas";
import { resources } from "../../corelib.js";

const BG_COLOR = "#25272A";
const MAIN_COLOR = "#" + resources.colors.delegation.toString(16);
const TEXT_COLOR = "#ffffff";
const AXIS_COLOR = "#444444";

//ПРЕДУПРЕЖДЕНИЕ: Данный код сгенерирован ИИ.
//Однако это лучше, чем копаться целый день с ним вручную :)

/**
 * - data - массив из 365 значений
 * - dates - массив из 365 дат (формат "DD-MM-YYYY")
 * - bins - количество бинов для сглаживания
 */
export function build365datesSmoothChart(
  data: number[],
  dates: string[],
  bins: number = 24
): Canvas {
  const width = 1024;
  const height = 512;
  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.quality = "fast";

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  const fontSize = Math.round((Math.sqrt(width * height) / 100) * 2.5);
  const padding = 60;
  const topPadding = 40;
  const bottomPadding = 60;
  const availableWidth = width - 2 * padding;
  const availableHeight = height - topPadding - bottomPadding;

  // Применяем бининг с вычислением центров для корректного масштабирования по оси X
  const binningResult = applyBinningWithCenters(data, bins);
  const binnedData = binningResult.values;
  const binCenters = binningResult.centers; // индексы центров бинов (0..364)

  // Максимальное значение среди сглаженных данных (для оси Y)
  const maxValue = Math.max(...data);
  const maxBinValue = Math.max(...binnedData);

  // Нормализуем данные для отрисовки высоты
  const normalized = binnedData.map(v => (v / maxBinValue) * availableHeight);

  // Настройка шрифта
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = `${fontSize}px abibas`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Ось Y (левая)
  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, topPadding);
  ctx.lineTo(padding, height - bottomPadding);
  ctx.stroke();

  // Метки оси Y и сетка
  const yAxisLabels = 6;
  for (let i = 0; i <= yAxisLabels; i++) {
    const value = Math.round((maxValue * i) / yAxisLabels);
    const y = height - bottomPadding - (i * availableHeight) / yAxisLabels;

    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(value.toString(), padding - fontSize * 0.8, y);

    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  // Подготовка координат для графика (X по центрам бинов)
  const xScale = availableWidth / (data.length - 1); // масштаб от индекса даты к пикселям
  const points: { x: number; y: number }[] = [];

  for (let i = 0; i < binCenters.length; i++) {
    const idx = binCenters[i];
    const x = padding + idx * xScale;
    const y = height - bottomPadding - normalized[i];
    points.push({ x, y });
  }

  // Рисуем заполненную область
  ctx.beginPath();
  ctx.moveTo(padding, height - bottomPadding); // левый нижний

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i === 0) ctx.lineTo(p.x, p.y);
    else {
      const prev = points[i - 1];
      // Кубическая интерполяция для сглаживания
      const cp1x = prev.x + (p.x - prev.x) * 0.5;
      const cp1y = prev.y;
      const cp2x = p.x - (p.x - prev.x) * 0.5;
      const cp2y = p.y;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p.x, p.y);
    }
  }

  ctx.lineTo(width - padding, height - bottomPadding); // правый нижний
  ctx.closePath();

  ctx.fillStyle = MAIN_COLOR + "80"; // прозрачность
  ctx.fill();

  // Рисуем линию графика
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i === 0) ctx.moveTo(p.x, p.y);
    else {
      const prev = points[i - 1];
      const cp1x = prev.x + (p.x - prev.x) * 0.5;
      const cp1y = prev.y;
      const cp2x = p.x - (p.x - prev.x) * 0.5;
      const cp2y = p.y;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p.x, p.y);
    }
  }

  ctx.strokeStyle = MAIN_COLOR;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Подписи месяцев (по первому числу)
  const monthNames = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
  const monthPositions: { month: string; x: number }[] = [];

  for (let i = 0; i < dates.length; i++) {
    const parts = dates[i].split("-");
    if (parts.length >= 2) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      if (day === 1) {
        // первое число месяца
        const x = padding + (i / (dates.length - 1)) * availableWidth;
        monthPositions.push({ month: monthNames[month], x });
      }
    }
  }

  ctx.font = `${fontSize * 0.8}px abibas`;
  ctx.fillStyle = TEXT_COLOR;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  for (const mp of monthPositions) {
    ctx.fillText(mp.month, mp.x, height - bottomPadding + 10);
  }

  return canvas;
}

/**
 * Выполняет бининг и возвращает массив средних значений, а также индексы центров бинов.
 * @param data - исходные данные (длина 365)
 * @param bins - желаемое количество бинов
 */
function applyBinningWithCenters(data: number[], bins: number): { values: number[]; centers: number[] } {
  const len = data.length;
  const binSize = Math.floor(len / bins); // размер каждого бина (кроме последнего)
  const result: number[] = [];
  const centers: number[] = [];

  for (let i = 0; i < bins; i++) {
    const start = i * binSize;
    const end = i === bins - 1 ? len : (i + 1) * binSize;
    let sum = 0;
    for (let j = start; j < end; j++) sum += data[j];
    const avg = sum / (end - start);
    result.push(avg);
    // центр бина – среднее арифметическое индексов (приблизительно)
    centers.push((start + end - 1) / 2);
  }

  return { values: result, centers };
}