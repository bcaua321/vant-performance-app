import { analysisRepository } from "@/repositories/analysis.repository";
import { catalogRepository } from "@/repositories/catalog.repository";
import { projectService } from "@/services/project.service";
import { getAnalysesQueue } from "@/lib/queue";
import type { CreateAnalysisInput } from "@/schemas/analysis.schema";

class HttpError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * Regras de negocio das analises (RF011-RF015): criacao com enfileiramento
 * BullMQ, acompanhamento de status e comparacao com isolamento por usuario.
 */
export const analysisService = {
  async create(userId: string, input: CreateAnalysisInput) {
    const project = await projectService.getOwned(input.projectId, userId);
    if (!project.config) {
      throw new HttpError("Configure a aeronave do projeto antes de criar uma análise", 422);
    }
    const [propeller, motor] = await Promise.all([
      catalogRepository.findPropeller(input.propellerId),
      catalogRepository.findMotor(input.motorId),
    ]);
    if (!propeller) throw new HttpError("Hélice não encontrada", 404);
    if (!motor) throw new HttpError("Motor não encontrado", 404);

    const analysis = await analysisRepository.create({
      projectId: project.id,
      aircraftConfigId: project.config.id,
      propellerId: propeller.id,
      motorId: motor.id,
      altitude: input.altitude,
      comparisonAltitudes: input.comparisonAltitudes,
    });

    await getAnalysesQueue().add("runAnalysis", { analysisId: analysis.id });
    return analysis;
  },

  async getOwned(analysisId: string, userId: string) {
    const analysis = await analysisRepository.findById(analysisId);
    if (!analysis) throw new HttpError("Análise não encontrada", 404);
    if (analysis.project.userId !== userId) throw new HttpError("Acesso negado", 403);
    return analysis;
  },

  async getStatus(analysisId: string, userId: string) {
    const analysis = await this.getOwned(analysisId, userId);
    return {
      id: analysis.id,
      status: analysis.status,
      errorMessage: analysis.errorMessage,
      completedAt: analysis.completedAt,
    };
  },

  async compare(ids: string[], userId: string) {
    if (ids.length < 2 || ids.length > 4) {
      throw new HttpError("Compare entre 2 e 4 análises", 400);
    }
    const analyses = await analysisRepository.findManyByIds(ids);
    if (analyses.length !== ids.length) throw new HttpError("Análise não encontrada", 404);
    for (const a of analyses) {
      if (a.project.userId !== userId) throw new HttpError("Acesso negado", 403);
      if (a.status !== "DONE") throw new HttpError(`Análise ${a.id} ainda não concluída`, 422);
    }
    return analyses;
  },

  async delete(analysisId: string, userId: string) {
    await this.getOwned(analysisId, userId);
    return analysisRepository.delete(analysisId);
  },
};
