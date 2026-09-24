import { projectRepository } from "@/repositories/project.repository";
import type { AircraftConfigInput } from "@/schemas/aircraft.schema";
import type { ProjectInput } from "@/schemas/project.schema";

class HttpError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Regras de negocio de projetos: propriedade obrigatoria (RNF013). */
export const projectService = {
  listByUser(userId: string) {
    return projectRepository.listByUser(userId);
  },

  async getOwned(projectId: string, userId: string) {
    const project = await projectRepository.findById(projectId);
    if (!project) throw new HttpError("Projeto não encontrado", 404);
    if (project.userId !== userId) throw new HttpError("Acesso negado", 403);
    return project;
  },

  create(userId: string, input: ProjectInput) {
    return projectRepository.create(userId, {
      name: input.name,
      description: input.description || null,
    });
  },

  async update(projectId: string, userId: string, input: ProjectInput) {
    await this.getOwned(projectId, userId);
    return projectRepository.update(projectId, {
      name: input.name,
      description: input.description || null,
    });
  },

  async delete(projectId: string, userId: string) {
    await this.getOwned(projectId, userId);
    return projectRepository.delete(projectId);
  },

  async saveConfig(projectId: string, userId: string, input: AircraftConfigInput) {
    await this.getOwned(projectId, userId);
    return projectRepository.upsertConfig(projectId, input);
  },
};
