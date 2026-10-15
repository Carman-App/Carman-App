import type { SchemaOptions } from "mongoose";

/** Shared toJSON: expose `id`, hide `_id`/`__v` and any field listed in `hidden`. */
export function jsonOptions(hidden: string[] = []): SchemaOptions["toJSON"] {
  return {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      for (const key of hidden) delete ret[key];
      return ret;
    },
  };
}
