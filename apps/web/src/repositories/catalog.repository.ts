import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/** Acesso ao catalogo global de helices e motores (RF009/RF010/RF016/RF017). */
export const catalogRepository = {
  listPropellers(filters?: { manufacturer?: string; minDiameter?: number; maxDiameter?: number }) {
    const where: Prisma.PropellerWhereInput = {};
    if (filters?.manufacturer) where.manufacturer = { contains: filters.manufacturer, mode: "insensitive" };
    if (filters?.minDiameter || filters?.maxDiameter) {
      where.diameter = {
        ...(filters.minDiameter ? { gte: filters.minDiameter } : {}),
        ...(filters.maxDiameter ? { lte: filters.maxDiameter } : {}),
      };
    }
    return prisma.propeller.findMany({ where, orderBy: [{ diameter: "asc" }, { pitch: "asc" }] });
  },

  listMotors(filters?: { brand?: string; minPower?: number }) {
    const where: Prisma.MotorWhereInput = {};
    if (filters?.brand) where.brand = { contains: filters.brand, mode: "insensitive" };
    if (filters?.minPower) where.maxPower = { gte: filters.minPower };
    return prisma.motor.findMany({ where, orderBy: [{ brand: "asc" }, { kvRating: "asc" }] });
  },

  findPropeller(id: string) {
    return prisma.propeller.findUnique({ where: { id } });
  },

  findMotor(id: string) {
    return prisma.motor.findUnique({ where: { id } });
  },

  createPropeller(data: Prisma.PropellerUncheckedCreateInput) {
    return prisma.propeller.create({ data });
  },

  createMotor(data: Prisma.MotorUncheckedCreateInput) {
    return prisma.motor.create({ data });
  },
};
