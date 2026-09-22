export interface LogSink {
  log(line: string): void;
  error(line: string): void;
}

export interface Logger {
  info(event: "bot_started" | "webhook_runtime_ready"): void;
  processingFailure(updateId: number | undefined, error: unknown): void;
  webhookRejected(reason: WebhookRejectionReason, status: number): void;
  webhookFailure(error: unknown): void;
}

export type WebhookRejectionReason =
  | "content_length_invalid"
  | "content_type_invalid"
  | "request_body_invalid"
  | "request_body_too_large"
  | "secret_token_invalid";

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
    webhookRejected(reason, status): void {
      sink.log(
        JSON.stringify({
          level: "info",
          event: "webhook_request_rejected",
          reason,
          status,
        }),
      );
    },
    webhookFailure(error): void {
      sink.error(
        JSON.stringify({
          level: "error",
          event: "webhook_request_failed",
          errorType: classifyError(error),
        }),
      );
    },
  };
}

function classifyError(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}
