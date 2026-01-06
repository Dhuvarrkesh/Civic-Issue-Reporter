import { model, Schema } from "mongoose";

const AdminSchema = new Schema(
  {
    fullName: { type: String, required: true },
    password: {
      type: String,
      required: [true],
      min: [8],
    },
    email: { type: String, required: true, lowercase: true },
    phonenumber: {
      type: String,
      required: [true],
    },
    department: { type: String, required: true },
    adminAccessCode: { type: Number, required: true, unique: true },
    // Admin level: 1 - local/admin, 2 - higher-level/admin
    accessLevel: { type: Number, required: true, default: 1 },
  },
  { timestamps: true }
);

export const AdminModel = model("Admin", AdminSchema);
