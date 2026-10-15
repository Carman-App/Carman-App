import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { z } from "zod";

interface Schemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

type Infer<S> = S extends z.ZodType ? z.output<S> : undefined;

export interface HandlerContext<S extends Schemas> {
  req: Request;
  res: Response;
  body: Infer<S["body"]>;
  query: Infer<S["query"]>;
  params: Infer<S["params"]>;
}

/**
 * Wraps a controller so its body/query/params are parsed with Zod before it runs.
 * A ZodError is turned into a 422 by the error handler. Express 5 forwards
 * rejected promises to the error handler, so no try/catch is needed here.
 */
export function handler<S extends Schemas>(
  schemas: S,
  fn: (ctx: HandlerContext<S>) => Promise<unknown> | unknown,
): RequestHandler {
  return async (req: Request, res: Response, _next: NextFunction) => {
    const ctx = {
      req,
      res,
      body: schemas.body ? schemas.body.parse(req.body ?? {}) : undefined,
      query: schemas.query ? schemas.query.parse(req.query) : undefined,
      params: schemas.params ? schemas.params.parse(req.params) : undefined,
    } as HandlerContext<S>;
    await fn(ctx);
  };
}

export function ok<T>(res: Response, data: T, meta?: unknown, status = 200) {
  return res.status(status).json(meta === undefined ? { data } : { data, meta });
}

export function created<T>(res: Response, data: T) {
  return ok(res, data, undefined, 201);
}
