import "server-only";

// Server-Sent Events over a ReadableStream: named events, JSON data, heartbeat comments, abort-aware.

export interface SseWriter {
  send(event: string, data: unknown): void;
  close(): void;
  readonly closed: boolean;
}

export function sseResponse(run: (w: SseWriter, signal: AbortSignal) => Promise<void>, signal: AbortSignal, heartbeatMs = 15_000): Response {
  const encoder = new TextEncoder();
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const writer: SseWriter = {
        send(event, data) {
          if (closed) return;
          const payload = JSON.stringify(data ?? null);
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${payload}\n\n`));
        },
        close() {
          if (closed) return;
          closed = true;
          if (heartbeat) clearInterval(heartbeat);
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        },
        get closed() {
          return closed;
        },
      };
      heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(`: ping\n\n`));
      }, heartbeatMs);
      signal.addEventListener("abort", () => writer.close(), { once: true });
      run(writer, signal)
        .catch((err: unknown) => {
          writer.send("error", { code: "INTERNAL", message: err instanceof Error ? err.message : "Stream failed" });
        })
        .finally(() => writer.close());
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
