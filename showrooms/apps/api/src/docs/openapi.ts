import { z } from "zod";

type Method = "get" | "post" | "patch" | "put" | "delete";

interface RouteDoc {
  method: Method;
  /** Express-style path relative to /api/v1, e.g. /vehicles/:id */
  path: string;
  summary: string;
  tag: string;
  auth?: boolean;
  body?: z.ZodType;
  query?: z.ZodType;
  responses?: Record<number, string>;
}

const routes: RouteDoc[] = [];

/** Route modules describe themselves here; the spec is generated from the same Zod schemas used for validation. */
export function describeRoute(doc: RouteDoc): void {
  routes.push(doc);
}

const toSchema = (schema: z.ZodType) => z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });

export function buildOpenApiSpec() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of routes) {
    const path = r.path.replace(/:(\w+)/g, "{$1}");
    const params = [...r.path.matchAll(/:(\w+)/g)].map((m) => ({ name: m[1], in: "path", required: true, schema: { type: "string" } }));
    const querySchema = r.query ? (toSchema(r.query) as { properties?: Record<string, unknown>; required?: string[] }) : undefined;
    const queryParams = Object.entries(querySchema?.properties ?? {}).map(([name, schema]) => ({
      name,
      in: "query",
      required: querySchema?.required?.includes(name) ?? false,
      schema,
    }));

    paths[path] ??= {};
    paths[path][r.method] = {
      tags: [r.tag],
      summary: r.summary,
      security: r.auth ? [{ bearerAuth: [] }] : [],
      parameters: [...params, ...queryParams],
      requestBody: r.body ? { required: true, content: { "application/json": { schema: toSchema(r.body) } } } : undefined,
      responses: Object.fromEntries(
        Object.entries(r.responses ?? { 200: "OK" }).map(([code, description]) => [
          code,
          { description, content: Number(code) >= 400 ? { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } : undefined },
        ]),
      ),
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Showrooms Vehicle Marketplace API",
      version: "1.0.0",
      description:
        "REST API shared by the Showrooms web and mobile apps. Successful responses are `{ data, meta? }`; errors are `{ error: { code, message, details?, requestId? } }`.\n\nBrowsers receive the refresh token as an HttpOnly cookie and must send `X-Requested-With: showrooms` on /auth/refresh and /auth/logout. Native apps send `X-Client-Type: mobile` and receive the refresh token in the response body.",
    },
    servers: [{ url: "/api/v1" }],
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: { code: { type: "string" }, message: { type: "string" }, details: {}, requestId: { type: "string" } },
              required: ["code", "message"],
            },
          },
        },
      },
    },
    paths,
  };
}
