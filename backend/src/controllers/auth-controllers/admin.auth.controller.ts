import { Request, Response } from "express";
import { AdminModel } from "../../models/admin.model";
import jwt from "jsonwebtoken";
import { z } from "zod";
import bcrypt from "bcryptjs";

const signupSchema = z.object({
  fullName: z.string().min(1, { message: "Full name is required" }).trim(),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/, 
      {
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      }
    )
    .trim(),
  email: z.string().email({ message: "Invalid email format" }).trim(),
  phonenumber: z
    .string()
    .length(10, { message: "Phone number must be exactly 10 digits" })
    .trim(),
  department: z.string().trim(),
  adminAccessCode: z
    .number()
    .int()
    .min(1000, { message: "Admin access code must be at least 4 digits" }),
  accessLevel: z.number().int().min(1).max(2).optional(),
  inviteCode: z.string().optional(),
});

export const adminSignup = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const parsedData = signupSchema.parse(req.body);
    const {
      fullName,
      password,
      email,
      phonenumber,
      department,
      adminAccessCode,
      accessLevel,
      inviteCode,
    } = parsedData;

    // Determine final access level securely. Level-2 requires a valid invite code set in env ADMIN_INVITE_CODE
    let finalAccessLevel = 1;
    if (accessLevel === 2) {
      if (!inviteCode) {
        res.status(403).json({ message: "Invite code is required to create a level-2 admin" });
        return;
      }
      const envCode = process.env.ADMIN_INVITE_CODE;
      if (!envCode || inviteCode !== envCode) {
        res.status(403).json({ message: "Invalid invite code" });
        return;
      }
      finalAccessLevel = 2;
    } else if (inviteCode) {
      // If inviteCode provided without accessLevel explicitly set to 2, validate and promote to level 2 if valid
      const envCode = process.env.ADMIN_INVITE_CODE;
      if (!envCode || inviteCode !== envCode) {
        res.status(403).json({ message: "Invalid invite code" });
        return;
      }
      finalAccessLevel = 2;
    }

    const emailLower = email.toLowerCase();
  
    //Check if the admin already exists
    const existingUser = await AdminModel.findOne({ email: emailLower });
    if (existingUser) {
      res.status(400).json({ message: "User already exists" });
      return;
    }

    //Hash password and create new admin
    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = await AdminModel.create({
      fullName,
      password: hashedPassword,
      email: emailLower,
      phonenumber,
      department,
      adminAccessCode,
      accessLevel: finalAccessLevel,
    });

    console.log("Admin created!");

    // Generate token and return user
    const token = jwt.sign(
      {
        id: newAdmin._id,
        role: "admin",
      },
      process.env.JWT_PASSWORD!,
      { expiresIn: "1d" }
    );

    res.status(201).json({
      token,
      user: {
        id: newAdmin._id,
        fullName: newAdmin.fullName,
        email: newAdmin.email,
        adminAccessCode: newAdmin.adminAccessCode,
        department: newAdmin.department,
        phonenumber: newAdmin.phonenumber,        accessLevel: newAdmin.accessLevel,        role: "admin",
      },
    });
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json({
        message: "Validation failed",
        errors: err.errors,
      });
      return;
    }

    console.error("Error creating admin:", err);
    // Duplicate key error (unique fields)
    if (err && err.code === 11000) {
      res.status(409).json({ message: "Admin already exists" });
      return;
    }

    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const adminSignin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body;
    let { adminAccessCode } = req.body;

    // Ensure adminAccessCode is a number (it may come as a string from the client)
    if (typeof adminAccessCode === "string") {
      adminAccessCode = parseInt(adminAccessCode, 10);
    }

    if (adminAccessCode === undefined || adminAccessCode === null || Number.isNaN(adminAccessCode)) {
      res.status(400).json({ message: "Admin access code is required and must be a number" });
      return;
    }

    const emailLower = (email || "").toLowerCase();

    // Find admin by email and access code
    const existingUser = await AdminModel.findOne({
      email: emailLower,
      adminAccessCode,
    });
    if (!existingUser) {
      res.status(404).json({ message: "Admin not found!" });
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      password,
      existingUser.password as string
    );
    if (!isPasswordValid) {
      res.status(401).json({ message: "Invalid password" });
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: existingUser._id,
        role: "admin",
      },
      process.env.JWT_PASSWORD!,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: existingUser._id,
        fullName: existingUser.fullName,
        email: existingUser.email,
        adminAccessCode: existingUser.adminAccessCode,
        department: existingUser.department,
        phonenumber: existingUser.phonenumber,
        accessLevel: existingUser.accessLevel,
        role: "admin",
      },
    });
  } catch (error) {
    console.error("Error during admin signin:", error);
    res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
