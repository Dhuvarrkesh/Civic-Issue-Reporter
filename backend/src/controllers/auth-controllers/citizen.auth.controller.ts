import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { CitizenModel } from "../../models/citizen.model";
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
    .length(10, { message: "Phone number must be exactly 10 digits" }),
});

export const citizenSignup = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const parsedData = signupSchema.parse(req.body);
    const { fullName, password, email, phonenumber } = parsedData;

    const emailLower = email.toLowerCase();

    const existingCitizen = await CitizenModel.findOne({ email: emailLower });
    if (existingCitizen) {
      res.status(400).json({ message: "Citizen already exists" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newCitizen = await CitizenModel.create({
      fullName,
      password: hashedPassword,
      email: emailLower,
      phonenumber,
    });

    // Generate token and return user data (without password)
    const token = jwt.sign(
      {
        id: newCitizen._id,
        role: "citizen",
      },
      process.env.JWT_PASSWORD!,
      { expiresIn: "1d" }
    );

    console.log("Citizen created!");
    res.status(201).json({
      token,
      user: {
        id: newCitizen._id,
        fullName: newCitizen.fullName,
        email: newCitizen.email,
        phonenumber: newCitizen.phonenumber,
        role: "citizen",
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

    console.error("Error creating CitizenModel:", err);
    // Duplicate key error (unique email)
    if (err && err.code === 11000) {
      res.status(409).json({ message: "Citizen already exists" });
      return;
    }

    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const citizenSignin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body;
    const emailLower = (email || "").toLowerCase();
    const existingCitizen = await CitizenModel.findOne({ email: emailLower });

    if (!existingCitizen) {
      res.status(400).json({ message: "Invalid email or password" });
      return;
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      existingCitizen.password as string
    );
    if (!isPasswordValid) {
      res.status(400).json({ message: "Invalid email or password" });
      return;
    }

    const token = jwt.sign(
      {
        id: existingCitizen._id,
        role: "citizen",
      },
      process.env.JWT_PASSWORD!,
      { expiresIn: "1d" }
    );
    res.json({
      token,
      user: {
        id: existingCitizen._id,
        fullName: existingCitizen.fullName,
        email: existingCitizen.email,
        phonenumber: existingCitizen.phonenumber,
        role: "citizen",
      },
    });
    console.log("Citizen signed in!");
  } catch (error) {
    console.error("Error during citizen signin:", error);
    res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
