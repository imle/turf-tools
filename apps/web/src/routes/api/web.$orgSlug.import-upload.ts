// Stage a voter-file upload on the data service for a later import. Raw body
// (not multipart) with the filename in the query string, matching the custom-
// field append pattern: the browser only talks to this edge, and the data
// service returns a local path the import job can read.

import { createFileRoute } from "@tanstack/react-router";
import { db } from "@turf-tools/db";
import { dataFetch } from "~/lib/server/data-proxy";
import { buildPermittedContext } from "~/rpc/context";

// Matches the data service's ceiling (statewide extracts).
const MAX_BODY_BYTES = 2 * 1024 * 1024 * 1024;

export const Route = createFileRoute("/api/web/$orgSlug/import-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const orgSlug = url.pathname.match(/^\/api\/web\/([^/]+)\/import-upload$/)?.[1];
        if (!orgSlug) return new Response("Not Found", { status: 404 });

        try {
          await buildPermittedContext(db, request.headers, orgSlug, "datasets.manage");
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        const filename = url.searchParams.get("filename")?.trim();
        if (!filename) return new Response("Missing filename.", { status: 400 });

        const contentLength = request.headers.get("content-length");
        if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
          return new Response("File is too large to upload.", { status: 413 });
        }

        const body = await request.arrayBuffer();
        if (body.byteLength === 0) return new Response("Empty upload.", { status: 400 });
        if (body.byteLength > MAX_BODY_BYTES) {
          return new Response("File is too large to upload.", { status: 413 });
        }

        const params = new URLSearchParams({ filename });
        const upstream = await dataFetch(`/import-uploads?${params.toString()}`, {
          method: "POST",
          body,
          headers: { "Content-Type": "application/octet-stream" },
        });
        const text = await upstream.text();
        if (!upstream.ok) {
          try {
            const parsed = JSON.parse(text) as { detail?: string };
            return new Response(parsed.detail ?? text, { status: upstream.status });
          } catch {
            return new Response(text, { status: upstream.status });
          }
        }
        return new Response(text, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
