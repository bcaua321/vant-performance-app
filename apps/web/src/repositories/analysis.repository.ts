import { prisma } from "@/lib/db";
import type { AnalysisStatus, Prisma } from "@prisma/client";

export const analysisRepository = {
  findById(id: string) {
    return prisma.analysis.findUnique({
      where: { id },
      include: {
        project: true,
        aircraftConfig: true,
        propeller: true,
        motor: true,
        graphs: true,
      },
    });
  },

  findManyByIds(ids: string[]) {
    return prisma.analysis.findMany({
      where: { id: { in: ids } },
      include: { project: true, propeller: true, motor: true, graphs: true },
    });
  },

  create(data: {
    projectId: string;
    aircraftConfigId: string;
    propellerId: string;
    motorId: string;
    altitude: number;
    comparisonAltitudes: number[];
  }) {
    return prisma.analysis.create({ data });
  },

  setStatus(id: string, status: AnalysisStatus) {
    return prisma.analysis.update({ where: { id }, data: { status } });
  },

  complete(id: string, results: Prisma.InputJsonValue, graphs: Record<string, string>) {
    return prisma.analysis.update({
      where: { id },
      data: {
        status: "DONE",
        results,
        completedAt: new Date(),
        graphs: {
          create: Object.entries(graphs).map(([type, filePath]) => ({ type, filePath })),
        },
      },
    });
  },

  fail(id: string, errorMessage: string) {
    return prisma.analysis.update({
      where: { id },
      data: { status: "FAILED", errorMessage, completedAt: new Date() },
    });
  },

  delete(id: string) {
    return prisma.analysis.delete({ where: { id } });
  },
};
