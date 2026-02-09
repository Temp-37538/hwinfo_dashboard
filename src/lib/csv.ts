export type CsvRow = Record<string, string | number | null | undefined>;

export type CsvCategoryMap = {
  cpu: string[];
  gpu: string[];
  ram: string[];
  other: string[];
};

const TIME_KEY_REGEX = /(time|date|timestamp|recorded|log)/i;
const TIME_ONLY_REGEX = /^(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d+))?$/;
const EURO_DATE_REGEX =
  /^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d+))?$/;
const CPU_REGEX = /(cpu|core|package|tdp|vrm|socket)/i;
const GPU_REGEX = /(gpu|graphics|vram|rtx|gtx|radeon|nvidia|amd)/i;
const RAM_REGEX = /(ram|memory|mem|dimm|dram)/i;

export function detectTimeKey(headers: string[]) {
  const match = headers.find((header) => TIME_KEY_REGEX.test(header));

  return match || null;
}

export function coerceNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(",", ".");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function parseTimeOnly(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const match = trimmed.match(TIME_ONLY_REGEX);
    if (match) {
      const [, hours, minutes, seconds, ms] = match;
      const totalMs =
        parseInt(hours, 10) * 3600000 +
        parseInt(minutes, 10) * 60000 +
        parseInt(seconds, 10) * 1000 +
        (ms ? parseInt(ms.padEnd(3, "0").slice(0, 3), 10) : 0);
      return totalMs;
    }
  }

  return null;
}

export function parseDateValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getTime();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 1_000_000_000_000) {
      return value;
    }

    if (value > 1_000_000_000) {
      return value * 1000;
    }

    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const euroMatch = trimmed.match(EURO_DATE_REGEX);
    if (euroMatch) {
      const [, day, month, year, hours, minutes, seconds, ms] = euroMatch;
      const date = new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        parseInt(hours, 10),
        parseInt(minutes, 10),
        parseInt(seconds, 10),
        ms ? parseInt(ms.padEnd(3, "0").slice(0, 3), 10) : 0,
      );
      if (!Number.isNaN(date.getTime())) {
        return date.getTime();
      }
    }

    const normalized = trimmed.replace(/\//g, "-");
    const parsed = Date.parse(normalized);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

export function getNumericColumns(headers: string[], rows: CsvRow[]) {
  return headers.filter((header) => {
    let sampleCount = 0;
    let numericCount = 0;

    for (const row of rows) {
      const value = row[header];
      if (value === null || value === undefined || value === "") {
        continue;
      }
      sampleCount += 1;
      if (coerceNumber(value) !== null) {
        numericCount += 1;
      }
    }

    return sampleCount > 0 && numericCount / sampleCount >= 0.6;
  });
}

export function categorizeColumns(headers: string[]): CsvCategoryMap {
  const cpu: string[] = [];
  const gpu: string[] = [];
  const ram: string[] = [];
  const other: string[] = [];

  for (const header of headers) {
    if (CPU_REGEX.test(header)) {
      cpu.push(header);
    } else if (GPU_REGEX.test(header)) {
      gpu.push(header);
    } else if (RAM_REGEX.test(header)) {
      ram.push(header);
    } else {
      other.push(header);
    }
  }

  return { cpu, gpu, ram, other };
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}
