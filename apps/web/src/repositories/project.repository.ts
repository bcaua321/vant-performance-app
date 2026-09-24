import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const projectRepository = {
  listByUser(userId: string) {
    return prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        config: true,
        _count: { select: { analyses: true } },
      },
    });
  },

  findById(id: string) {
    return prisma.project.findUnique({
      where: { id },
      include: {
        config: true,
        analyses: {
          orderBy: { createdAt: "desc" },
          include: { propeller: true, motor: true },
        },
      },
    });
  },

  create(userId: string, data: { name: string; description?: string | null }) {
    return prisma.project.create({ data: { ...data, userId } });
  },

  update(id: string, data: Prisma.ProjectUpdateInput) {
    return prisma.project.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.project.delete({ where: { id } });
  },

  upsertConfig(projectId: string, data: Omit<Prisma.AircraftConfigUncheckedCreateInput, "id" | "projectId">) {
    return prisma.aircraftConfig.upsert({
      where: { projectId },
      create: { ...data, projectId },
      update: data,
    });
  },
};
