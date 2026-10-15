import { Schema, model } from "mongoose";
import { BODY_TYPES, CATEGORY_KINDS } from "@showrooms/shared";
import { jsonOptions } from "../../utils/mongoose";

/** Admin-managed vehicle makes (with their models) and body-type categories. */
const categorySchema = new Schema(
  {
    kind: { type: String, enum: CATEGORY_KINDS, required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true },
    models: { type: [String], default: [] },
    bodyType: { type: String, enum: BODY_TYPES },
    isActive: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: jsonOptions() },
);
categorySchema.index({ kind: 1, slug: 1 }, { unique: true });
categorySchema.index({ kind: 1, isActive: 1, sortOrder: 1, name: 1 });
export const Category = model("Category", categorySchema);
