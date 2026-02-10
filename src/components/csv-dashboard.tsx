"use client";
import type { ParseError } from "papaparse";
import * as React from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import {
  type CsvRow,
  categorizeColumns,
  chunkArray,
  coerceNumber,
  detectTimeKey,
  getNumericColumns,
  parseDateValue,
  parseTimeOnly,
} from "@/lib/csv";
import { cn } from "@/lib/utils";

const SERIES_PER_CHART = 3;

const palette = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type ParsedCsvState = {
  fileName: string;
  headers: string[];
  rows: CsvRow[];
  dateKey: string | null;
  timeKey: string | null;
  timeMode: "date-time" | "single" | "index";
  lastTimestamp: string | number | null;
  lastTimestampLabel: string | null;
  timeParsed: boolean;
  durationLabel: string | null;
  numericColumns: string[];
  warnings: string[];
};

type SeriesKey = {
  key: string;
  label: string;
};

function buildSeriesConfig(series: SeriesKey[]): ChartConfig {
  return series.reduce<ChartConfig>((acc, item, index) => {
    acc[item.key] = {
      label: item.label,
      color: palette[index % palette.length],
    };
    return acc;
  }, {});
}

function buildChartData(
  rows: CsvRow[],
  series: SeriesKey[],
  timeKey: string | null,
  dateKey: string | null,
  timeMode: "date-time" | "single" | "index",
  timeParsed: boolean,
) {
  return rows.map((row, index) => {
    const datum: Record<string, string | number | null> = {
      index: index + 1,
    };

    let rawTimestamp: string | null = null;

    if (timeMode === "date-time" && dateKey && timeKey) {
      const combined = `${row[dateKey] ?? ""} ${row[timeKey] ?? ""}`.trim();
      rawTimestamp = combined;
      const parsedTime = parseDateValue(combined);
      datum.time = timeParsed && parsedTime ? parsedTime : index + 1;
    } else if (timeMode === "single" && timeKey) {
      rawTimestamp = String(row[timeKey] ?? "");
      const parsedTime = parseDateValue(row[timeKey]);
      datum.time = timeParsed && parsedTime ? parsedTime : index + 1;
    }

    datum.rawTimestamp = rawTimestamp;

    series.forEach((item) => {
      datum[item.key] = coerceNumber(row[item.label]);
    });

    return datum;
  });
}

function useCsvParser() {
  const [state, setState] = React.useState<ParsedCsvState | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const parseFile = React.useCallback(async (file: File) => {
    setError(null);

    const Papa = (await import("papaparse")).default;

    let text = await file.text();
    if (!text.trim()) {
      setState(null);
      setError("The file is empty.");
      return;
    }

    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }

    const lines = text.split(/\r?\n/);
    if (lines[0]?.startsWith('"') && lines[0]?.includes(",")) {
      const cleanedHeader = lines[0]
        .replace(/^"/, "")
        .replace(/"$/, "")
        .replace(/"""/g, '"')
        .replace(/""/g, "");
      lines[0] = cleanedHeader;
      text = lines.join("\n");
    }

    const parsed = Papa.parse<CsvRow>(text, {
      header: true,
      skipEmptyLines: "greedy",
      dynamicTyping: true,
      transformHeader: (header: string) => header.trim(),
    });

    let headers = parsed.meta.fields?.filter(Boolean) ?? [];
    let rows = parsed.data.filter((row: CsvRow) =>
      Object.values(row).some(
        (value) => value !== null && value !== undefined && value !== "",
      ),
    );

    if (!headers.length) {
      const fallback = Papa.parse<string[]>(text, {
        header: false,
        skipEmptyLines: "greedy",
      });

      const fallbackRows = fallback.data.filter(
        (row: string[]) => row.length > 0,
      );
      if (!fallbackRows.length) {
        setState(null);
        setError("No data detected in the CSV.");
        return;
      }

      headers = fallbackRows[0].map(
        (_: string, index: number) => `Colonne ${index + 1}`,
      );
      rows = fallbackRows.map((row: string[]) =>
        headers.reduce<CsvRow>((acc: CsvRow, header: string, index: number) => {
          acc[header] = row[index] ?? null;
          return acc;
        }, {}),
      );
    }

    if (!rows.length) {
      setState(null);
      setError("No valid rows after parsing.");
      return;
    }

    const dateKey = headers.find((header) => /\bdate\b/i.test(header)) ?? null;
    const timeColumnKey =
      headers.find((header) => /\btime\b/i.test(header)) ?? null;
    const detectedTimeKey = detectTimeKey(headers);

    if (dateKey || timeColumnKey) {
      rows = rows.filter((row) => {
        const dateValue = dateKey ? row[dateKey] : null;
        const timeValue = timeColumnKey ? row[timeColumnKey] : null;

        if (
          typeof dateValue === "string" &&
          dateValue.toLowerCase() === "date"
        ) {
          return false;
        }
        if (
          typeof timeValue === "string" &&
          timeValue.toLowerCase() === "time"
        ) {
          return false;
        }

        if (
          dateKey &&
          (dateValue === null || dateValue === undefined || dateValue === "")
        ) {
          return false;
        }
        if (
          timeColumnKey &&
          (timeValue === null || timeValue === undefined || timeValue === "")
        ) {
          return false;
        }

        return true;
      });
    }

    if (!rows.length) {
      setState(null);
      setError("No valid data rows after filtering.");
      return;
    }

    const lastRow = rows[rows.length - 1];
    const firstRow = rows[0];

    let timeMode: "date-time" | "single" | "index" = "index";
    let timeKey: string | null = null;

    if (dateKey && timeColumnKey) {
      timeMode = "date-time";
      timeKey = timeColumnKey;
    } else if (detectedTimeKey) {
      timeMode = "single";
      timeKey = detectedTimeKey;
    }

    const rawEndTimestamp =
      timeMode === "date-time" && dateKey && timeKey
        ? `${lastRow[dateKey] ?? ""} ${lastRow[timeKey] ?? ""}`.trim()
        : timeMode === "single" && timeKey
          ? ((lastRow[timeKey] as string | number | null) ?? null)
          : null;

    const rawStartTimestamp =
      timeMode === "date-time" && dateKey && timeKey
        ? `${firstRow[dateKey] ?? ""} ${firstRow[timeKey] ?? ""}`.trim()
        : timeMode === "single" && timeKey
          ? ((firstRow[timeKey] as string | number | null) ?? null)
          : null;

    const endTimestampMs = rawEndTimestamp
      ? parseDateValue(rawEndTimestamp)
      : null;
    const startTimestampMs = rawStartTimestamp
      ? parseDateValue(rawStartTimestamp)
      : null;

    const timeParsed = Boolean(endTimestampMs && startTimestampMs);
    const lastTimestamp = endTimestampMs ?? rawEndTimestamp ?? rows.length;

    const formatDuration = (durationMs: number) => {
      if (!Number.isFinite(durationMs) || durationMs < 0) {
        return null;
      }
      const totalSeconds = Math.floor(durationMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const pad = (value: number) => String(value).padStart(2, "0");
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    };

    const firstTimeValue = timeKey ? firstRow[timeKey] : null;
    const lastTimeValue = timeKey ? lastRow[timeKey] : null;

    const firstTimeMs = parseTimeOnly(firstTimeValue);
    const lastTimeMs = parseTimeOnly(lastTimeValue);

    const durationMs =
      firstTimeMs !== null && lastTimeMs !== null
        ? lastTimeMs - firstTimeMs
        : null;

    const numericColumns = getNumericColumns(headers, rows).filter(
      (column) => column !== timeKey,
    );

    const warningsSet = new Set(
      parsed.errors
        .filter(
          (errorItem: ParseError) =>
            !errorItem.message.includes("Too few fields") &&
            !errorItem.message.includes("Too many fields"),
        )
        .map((errorItem: ParseError) => errorItem.message),
    );
    const warnings = Array.from(warningsSet);

    setState({
      fileName: file.name,
      headers,
      rows,
      dateKey,
      timeKey,
      timeMode,
      lastTimestamp,
      lastTimestampLabel:
        endTimestampMs !== null
          ? new Intl.DateTimeFormat("en-US", {
              dateStyle: "medium",
              timeStyle: "medium",
            }).format(new Date(endTimestampMs))
          : rawEndTimestamp
            ? String(rawEndTimestamp)
            : null,
      timeParsed,
      durationLabel: durationMs !== null ? formatDuration(durationMs) : null,
      numericColumns,
      warnings,
    });
  }, []);

  return {
    state,
    error,
    isDragging,
    setIsDragging,
    parseFile,
  };
}

function ChartCard({
  title,
  rows,
  timeKey,
  dateKey,
  timeMode,
  timeParsed,
  columns,
}: {
  title: string;
  rows: CsvRow[];
  timeKey: string | null;
  dateKey: string | null;
  timeMode: "date-time" | "single" | "index";
  timeParsed: boolean;
  columns: string[];
}) {
  const series = React.useMemo<SeriesKey[]>(
    () => columns.map((label, index) => ({ key: `series_${index}`, label })),
    [columns],
  );
  const config = React.useMemo(() => buildSeriesConfig(series), [series]);
  const data = React.useMemo(
    () => buildChartData(rows, series, timeKey, dateKey, timeMode, timeParsed),
    [rows, series, timeKey, dateKey, timeMode, timeParsed],
  );

  const formatDate = React.useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "medium",
      }),
    [],
  );

  const formatDateDetailed = React.useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3,
      }),
    [],
  );

  return (
    <Card className="h-full  ">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          {columns.length} metric{columns.length > 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <ChartContainer config={config} className="  w-[95%] h-70">
          <LineChart data={data} margin={{ left: 12, right: 12, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={timeKey ? "time" : "index"}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              type={timeParsed ? "number" : "category"}
              domain={timeParsed ? ["dataMin", "dataMax"] : undefined}
              tickFormatter={(value) =>
                timeParsed && typeof value === "number"
                  ? formatDate.format(new Date(value))
                  : String(value)
              }
            />
            <YAxis tickLine={false} axisLine={false} width={48} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
              labelFormatter={(label, payload) => {
                const rawTimestamp = payload?.[0]?.payload?.rawTimestamp;
                if (rawTimestamp) {
                  return String(rawTimestamp);
                }
                if (timeParsed && typeof label === "number") {
                  return formatDateDetailed.format(new Date(label));
                }
                return String(label);
              }}
            />
            <ChartLegend content={<ChartLegendContent />} />
            {series.map((item) => (
              <Line
                key={item.key}
                dataKey={item.key}
                type="monotone"
                stroke={`var(--color-${item.key})`}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function CategorySection({
  id,
  title,
  rows,
  timeKey,
  dateKey,
  timeMode,
  timeParsed,
  columns,
}: {
  id: string;
  title: string;
  rows: CsvRow[];
  timeKey: string | null;
  dateKey: string | null;
  timeMode: "date-time" | "single" | "index";
  timeParsed: boolean;
  columns: string[];
}) {
  if (!columns.length) {
    return (
      <section id={id} className="scroll-mt-24">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
        <Card className="mt-4">
          <CardContent className="py-6 text-sm text-muted-foreground">
            No numeric fields detected for this category.
          </CardContent>
        </Card>
      </section>
    );
  }

  const chunks = chunkArray(columns, SERIES_PER_CHART);

  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {chunks.map((group) => (
          <ChartCard
            key={`${id}-${group.join("::")}`}
            title={`${title} - Group ${group.join(" / ")}`}
            rows={rows}
            timeKey={timeKey}
            dateKey={dateKey}
            timeMode={timeMode}
            timeParsed={timeParsed}
            columns={group}
          />
        ))}
      </div>
    </section>
  );
}

export function CsvDashboard() {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const { state, error, isDragging, setIsDragging, parseFile } = useCsvParser();

  const handleFile = React.useCallback(
    (file: File | null | undefined) => {
      if (!file) {
        return;
      }
      void parseFile(file);
    },
    [parseFile],
  );

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setIsDragging(false);
      handleFile(event.dataTransfer.files?.[0]);
    },
    [handleFile, setIsDragging],
  );

  const handleBrowse = React.useCallback(() => {
    inputRef.current?.click();
  }, []);

  const categories = React.useMemo(() => {
    if (!state) {
      return null;
    }

    const numericSet = new Set(state.numericColumns);
    const categorized = categorizeColumns(state.headers);

    return {
      cpu: categorized.cpu.filter((column) => numericSet.has(column)),
      gpu: categorized.gpu.filter((column) => numericSet.has(column)),
      ram: categorized.ram.filter((column) => numericSet.has(column)),
      other: categorized.other.filter((column) => numericSet.has(column)),
    };
  }, [state]);

  return (
    <div className="flex flex-col gap-8">
      <section id="overview" className="scroll-mt-24">
        <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Import CSV</CardTitle>
              <CardDescription>
                Drag and drop a file or choose one from your computer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <button
                className={cn(
                  "border-border/60 bg-muted/20 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center transition",
                  isDragging && "border-primary bg-primary/5",
                )}
                type="button"
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={handleBrowse}
              >
                <div className="text-sm font-medium">
                  {state?.fileName ?? "No file selected"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Large CSVs supported · Data stays in memory during the
                  session.
                </div>
                <span className="border-border/60 cursor-pointer bg-background inline-flex items-center rounded-md border px-3 py-2 text-xs font-medium shadow-sm">
                  Choose a CSV
                </span>
                <Input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => handleFile(event.target.files?.[0])}
                  className="hidden"
                />
              </button>
              {error ? (
                <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
              {state?.warnings.length ? (
                <div className="mt-4 rounded-md border border-amber-400/40 bg-amber-400/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                  <div className="font-medium">CSV warnings</div>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {state.warnings.slice(0, 4).map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rows</CardTitle>
                <CardDescription>Total analyzed</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">
                  {state ? state.rows.length : "—"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Columns</CardTitle>
                <CardDescription>Detected</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">
                  {state ? state.headers.length : "—"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Timestamp final</CardTitle>
                <CardDescription>
                  {state?.lastTimestampLabel ?? "—"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">
                  {state?.durationLabel ?? "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Total duration
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Numeric series</CardTitle>
                <CardDescription>Used for charts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">
                  {state ? state.numericColumns.length : "—"}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {state && categories ? (
        <div className="flex flex-col gap-12">
          <CategorySection
            id="cpu"
            title="CPU"
            rows={state.rows}
            timeKey={state.timeKey}
            dateKey={state.dateKey}
            timeMode={state.timeMode}
            timeParsed={state.timeParsed}
            columns={categories.cpu}
          />
          <CategorySection
            id="gpu"
            title="GPU"
            rows={state.rows}
            timeKey={state.timeKey}
            dateKey={state.dateKey}
            timeMode={state.timeMode}
            timeParsed={state.timeParsed}
            columns={categories.gpu}
          />
          <CategorySection
            id="ram"
            title="RAM"
            rows={state.rows}
            timeKey={state.timeKey}
            dateKey={state.dateKey}
            timeMode={state.timeMode}
            timeParsed={state.timeParsed}
            columns={categories.ram}
          />
          <CategorySection
            id="other"
            title="Other"
            rows={state.rows}
            timeKey={state.timeKey}
            dateKey={state.dateKey}
            timeMode={state.timeMode}
            timeParsed={state.timeParsed}
            columns={categories.other}
          />
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Upload a CSV file to generate charts.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
