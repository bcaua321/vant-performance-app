/**
 * Worker BullMQ de execucao de analises.
 *
 * Consome a fila `analyses`, marca a analise como RUNNING, invoca o motor
 * Python via HTTP e persiste resultados/graficos (DONE) ou a causa da
 * falha (FAILED). Executar com: npm run worker
 */
import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { runPythonAnalysis } from "../lib/python-client";
import { redisConnection } from "../lib/redis-connection";

const prisma = new PrismaClient();
const connection = redisConnection();

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 5);

const worker = new Worker(
  "analyses",
  async (job) => {
    const { analysisId } = job.data as { analysisId: string };
    console.log(`[worker] processando análise ${analysisId}`);

    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: "RUNNING" },
    });

    try {
      const analysis = await prisma.analysis.findUniqueOrThrow({
        where: { id: analysisId },
        include: { aircraftConfig: true, propeller: true, motor: true },
      });
      const cfg = analysis.aircraftConfig;

      const result = await runPythonAnalysis({
        analysisId,
        wingspan: cfg.wingspan,
        chord: cfg.chord,
        area: cfg.area,
        clMax: cfg.clMax,
        cd0: cfg.cd0,
        oswald: cfg.oswald,
        loadFactor: cfg.loadFactor,
        emptyWeight: cfg.emptyWeight,
        payload: cfg.payload,
        batteryCapacity: cfg.batteryCapacity,
        batteryVoltage: cfg.batteryVoltage,
        batteryCells: cfg.batteryCells,
        etaEsc: cfg.etaEsc,
        etaMotor: cfg.etaMotor,
        etaProp: cfg.etaProp,
        propellerName: analysis.propeller.name,
        propellerDiameter: analysis.propeller.diameter,
        propellerPitch: analysis.propeller.pitch,
        propellerDataFile: analysis.propeller.dataFilePath,
        propellerTestDensity: analysis.propeller.testDensity,
        motorName: analysis.motor.name,
        motorKv: analysis.motor.kvRating,
        motorMaxPower: analysis.motor.maxPower,
        altitude: analysis.altitude,
      comparisonAltitudes: analysis.comparisonAltitudes,
      });

      await prisma.analysis.update({
        where: { id: analysisId },
        data: {
          status: "DONE",
          results: { metrics: result.metrics, series: result.series },
          completedAt: new Date(),
          graphs: {
            create: Object.entries(result.graphs).map(([type, filePath]) => ({ type, filePath })),
          },
        },
      });
      console.log(`[worker] análise ${analysisId} concluída`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[worker] análise ${analysisId} falhou: ${message}`);
      await prisma.analysis.update({
        where: { id: analysisId },
        data: { status: "FAILED", errorMessage: message, completedAt: new Date() },
      });
    }
  },
  { connection, concurrency: CONCURRENCY },
);

worker.on("ready", () => console.log(`[worker] aguardando jobs (concorrência=${CONCURRENCY})`));
worker.on("failed", (job, err) => console.error(`[worker] job ${job?.id} falhou:`, err.message));

process.on("SIGINT", async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});
