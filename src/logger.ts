export interface LogSink {
  log(line: string): void;
  error(line: string): void;
}

export interface Logger {
  info(event: "bot_started"): void;
  processingFailure(updateId: number | undefined, error: unknown): void;
}

export function createLogger(sink: LogSink = console): Logger {
  return {
    info(event): void {
      sink.log(JSON.stringify({ level: "info", event }));
    },
    processingFailure(updateId, error): void {
      sink.error(
        JSON.stringify({
          level: "error",
          event: "update_processing_failed",
          updateId,
          errorType: classifyError(error),
        }),
      );
    },
  };
}

function classifyError(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}
