import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt";

async function seedAdmin() {
  try {
    // Check if admin already exists
    const existing = await prisma.user.findUnique({
      where: { email: "admin@example.com" },
    });

    if (existing) {
      console.log("✅ Admin user already exists");
      return;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash("admin123", 10);
    const admin = await prisma.user.create({
      data: {
        name: "Admin User",
        email: "admin@example.com",
        phone: "+919999999999",
        passwordHash: hashedPassword,
        role: "ADMIN",
        isActive: true,
        emailVerified: true,
        phoneVerified: true,
      },
    });

    console.log("✅ Admin user created successfully!");
    console.log("Email: admin@example.com");
    console.log("Password: admin123");
    console.log("Role: ADMIN");
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmin();
