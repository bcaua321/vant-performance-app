-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aircraft_configs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "wingspan" DOUBLE PRECISION NOT NULL,
    "chord" DOUBLE PRECISION NOT NULL,
    "area" DOUBLE PRECISION NOT NULL,
    "clMax" DOUBLE PRECISION NOT NULL,
    "cd0" DOUBLE PRECISION NOT NULL,
    "oswald" DOUBLE PRECISION NOT NULL,
    "emptyWeight" DOUBLE PRECISION NOT NULL,
    "payload" DOUBLE PRECISION NOT NULL,
    "batteryCapacity" INTEGER NOT NULL,
    "batteryVoltage" DOUBLE PRECISION NOT NULL,
    "batteryCells" INTEGER NOT NULL,
    "etaEsc" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "etaMotor" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "etaProp" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aircraft_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propellers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "diameter" DOUBLE PRECISION NOT NULL,
    "pitch" DOUBLE PRECISION NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "dataFilePath" TEXT,
    "testDensity" DOUBLE PRECISION NOT NULL DEFAULT 1.225,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "propellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "kvRating" INTEGER NOT NULL,
    "maxPower" DOUBLE PRECISION NOT NULL,
    "maxCurrent" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "internalResistance" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "motors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analyses" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "aircraftConfigId" TEXT NOT NULL,
    "propellerId" TEXT NOT NULL,
    "motorId" TEXT NOT NULL,
    "altitude" DOUBLE PRECISION NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "results" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_graphs" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,

    CONSTRAINT "analysis_graphs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "projects_userId_idx" ON "projects"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "aircraft_configs_projectId_key" ON "aircraft_configs"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "propellers_name_key" ON "propellers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "motors_name_key" ON "motors"("name");

-- CreateIndex
CREATE INDEX "analyses_projectId_status_idx" ON "analyses"("projectId", "status");

-- CreateIndex
CREATE INDEX "analyses_projectId_createdAt_idx" ON "analyses"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aircraft_configs" ADD CONSTRAINT "aircraft_configs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_aircraftConfigId_fkey" FOREIGN KEY ("aircraftConfigId") REFERENCES "aircraft_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_propellerId_fkey" FOREIGN KEY ("propellerId") REFERENCES "propellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_motorId_fkey" FOREIGN KEY ("motorId") REFERENCES "motors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_graphs" ADD CONSTRAINT "analysis_graphs_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
