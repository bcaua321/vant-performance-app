/**
 * Seed do banco: helices com dados experimentais de tracao estatica
 * (ensaios de bancada do autor) e motores BLDC de referencia.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Densidade media do ar nos ensaios de bancada (Ponta Grossa, ~900 m): 1,12 kg/m^3
const TEST_DENSITY = 1.12;

const propellers = [
  // Com dados experimentais de bancada (tracao estatica medida pelo autor)
  { name: "APC 20x10E", diameter: 20, pitch: 10, manufacturer: "APC", dataFilePath: "20x10E.csv" },
  { name: "APC 22x10E", diameter: 22, pitch: 10, manufacturer: "APC", dataFilePath: "22x10E.csv" },
  { name: "APC 22x12E", diameter: 22, pitch: 12, manufacturer: "APC", dataFilePath: "22x12E.csv" },
  { name: "APC 22x10E (400 W)", diameter: 22, pitch: 10, manufacturer: "APC", dataFilePath: "22x10E_400W.csv" },
  { name: "APC 22x10E (600 W)", diameter: 22, pitch: 10, manufacturer: "APC", dataFilePath: "22x10E_600W.csv" },
  { name: "APC 22x12E (600 W)", diameter: 22, pitch: 12, manufacturer: "APC", dataFilePath: "22x12E_600W.csv" },
  { name: "APC 24x12 (580 W)", diameter: 24, pitch: 12, manufacturer: "APC", dataFilePath: "24x12_580W.csv" },
  // Demais helices do catalogo APC (geometria QPROP de `reference/codigo-2026/Helices`);
  // sem ensaio proprio, a tracao vem do modelo analitico de reserva
  { name: "APC 13x10E", diameter: 13, pitch: 10, manufacturer: "APC", dataFilePath: null },
  { name: "APC 13x4E", diameter: 13, pitch: 4, manufacturer: "APC", dataFilePath: null },
  { name: "APC 13x5.5E", diameter: 13, pitch: 5.5, manufacturer: "APC", dataFilePath: null },
  { name: "APC 13x6.5E", diameter: 13, pitch: 6.5, manufacturer: "APC", dataFilePath: null },
  { name: "APC 13x6.5E(F2B)", diameter: 13, pitch: 6.5, manufacturer: "APC", dataFilePath: null },
  { name: "APC 13x8E", diameter: 13, pitch: 8, manufacturer: "APC", dataFilePath: null },
  { name: "APC 14x10E", diameter: 14, pitch: 10, manufacturer: "APC", dataFilePath: null },
  { name: "APC 14x12E", diameter: 14, pitch: 12, manufacturer: "APC", dataFilePath: null },
  { name: "APC 14x14E", diameter: 14, pitch: 14, manufacturer: "APC", dataFilePath: null },
  { name: "APC 14x6E", diameter: 14, pitch: 6, manufacturer: "APC", dataFilePath: null },
  { name: "APC 14x7E", diameter: 14, pitch: 7, manufacturer: "APC", dataFilePath: null },
  { name: "APC 14x8.5E", diameter: 14, pitch: 8.5, manufacturer: "APC", dataFilePath: null },
  { name: "APC 15x10E", diameter: 15, pitch: 10, manufacturer: "APC", dataFilePath: null },
  { name: "APC 15x12E", diameter: 15, pitch: 12, manufacturer: "APC", dataFilePath: null },
  { name: "APC 15x4E", diameter: 15, pitch: 4, manufacturer: "APC", dataFilePath: null },
  { name: "APC 15x6E", diameter: 15, pitch: 6, manufacturer: "APC", dataFilePath: null },
  { name: "APC 15x7E", diameter: 15, pitch: 7, manufacturer: "APC", dataFilePath: null },
  { name: "APC 15x8E", diameter: 15, pitch: 8, manufacturer: "APC", dataFilePath: null },
  { name: "APC 16x10E", diameter: 16, pitch: 10, manufacturer: "APC", dataFilePath: null },
  { name: "APC 16x12E", diameter: 16, pitch: 12, manufacturer: "APC", dataFilePath: null },
  { name: "APC 16x4E", diameter: 16, pitch: 4, manufacturer: "APC", dataFilePath: null },
  { name: "APC 16x6E", diameter: 16, pitch: 6, manufacturer: "APC", dataFilePath: null },
  { name: "APC 16x7E(3D)", diameter: 16, pitch: 7, manufacturer: "APC", dataFilePath: null },
  { name: "APC 16x8E", diameter: 16, pitch: 8, manufacturer: "APC", dataFilePath: null },
  { name: "APC 17x10E", diameter: 17, pitch: 10, manufacturer: "APC", dataFilePath: null },
  { name: "APC 17x10WE", diameter: 17, pitch: 10, manufacturer: "APC", dataFilePath: null },
  { name: "APC 17x12E", diameter: 17, pitch: 12, manufacturer: "APC", dataFilePath: null },
  { name: "APC 17x6E", diameter: 17, pitch: 6, manufacturer: "APC", dataFilePath: null },
  { name: "APC 17x7E", diameter: 17, pitch: 7, manufacturer: "APC", dataFilePath: null },
  { name: "APC 17x8E", diameter: 17, pitch: 8, manufacturer: "APC", dataFilePath: null },
  { name: "APC 18x10E", diameter: 18, pitch: 10, manufacturer: "APC", dataFilePath: null },
  { name: "APC 18x12E", diameter: 18, pitch: 12, manufacturer: "APC", dataFilePath: null },
  { name: "APC 18x12WE", diameter: 18, pitch: 12, manufacturer: "APC", dataFilePath: null },
  { name: "APC 18x8E", diameter: 18, pitch: 8, manufacturer: "APC", dataFilePath: null },
  { name: "APC 19x10E", diameter: 19, pitch: 10, manufacturer: "APC", dataFilePath: null },
  { name: "APC 19x12E", diameter: 19, pitch: 12, manufacturer: "APC", dataFilePath: null },
  { name: "APC 19x12WE", diameter: 19, pitch: 12, manufacturer: "APC", dataFilePath: null },
  { name: "APC 19x8E", diameter: 19, pitch: 8, manufacturer: "APC", dataFilePath: null },
  { name: "APC 20x11E", diameter: 20, pitch: 11, manufacturer: "APC", dataFilePath: null },
  { name: "APC 20x12WE", diameter: 20, pitch: 12, manufacturer: "APC", dataFilePath: null },
  { name: "APC 20x13E", diameter: 20, pitch: 13, manufacturer: "APC", dataFilePath: null },
  { name: "APC 20x15E", diameter: 20, pitch: 15, manufacturer: "APC", dataFilePath: null },
  { name: "APC 20x8E", diameter: 20, pitch: 8, manufacturer: "APC", dataFilePath: null },
  { name: "APC 21x12WE", diameter: 21, pitch: 12, manufacturer: "APC", dataFilePath: null },
  { name: "APC 21x13E", diameter: 21, pitch: 13, manufacturer: "APC", dataFilePath: null },
  { name: "APC 21x13WE", diameter: 21, pitch: 13, manufacturer: "APC", dataFilePath: null },
  { name: "APC 22x12WE", diameter: 22, pitch: 12, manufacturer: "APC", dataFilePath: null },
  { name: "APC 22x13EPN", diameter: 22, pitch: 13, manufacturer: "APC", dataFilePath: null },
  { name: "APC 24x12E", diameter: 24, pitch: 12, manufacturer: "APC", dataFilePath: null },
  { name: "APC 25x12.5E", diameter: 25, pitch: 12.5, manufacturer: "APC", dataFilePath: null },
  { name: "APC 26x13E", diameter: 26, pitch: 13, manufacturer: "APC", dataFilePath: null },
  { name: "APC 26x15E", diameter: 26, pitch: 15, manufacturer: "APC", dataFilePath: null },
  { name: "APC 27x13E", diameter: 27, pitch: 13, manufacturer: "APC", dataFilePath: null },
];

const motors = [
  // Kv e resistencia interna MEDIDOS, extraidos dos arquivos QPROP em
  // `reference/codigo-2026/Motores`. Potencia maxima, corrente maxima e peso nao
  // constam desses arquivos: sao nominais por familia (mesma carcaca), a
  // confirmar contra a folha de dados do fabricante.
  { name: "T-MOTOR AT4130 230KV", brand: "T-MOTOR", kvRating: 230, maxPower: 800, maxCurrent: 35, weight: 290, internalResistance: 0.06 },
  { name: "T-MOTOR AT4130 300KV", brand: "T-MOTOR", kvRating: 300, maxPower: 800, maxCurrent: 38, weight: 290, internalResistance: 0.032 },
  { name: "T-MOTOR AT4130 450KV", brand: "T-MOTOR", kvRating: 450, maxPower: 800, maxCurrent: 42, weight: 290, internalResistance: 0.0168 },
  { name: "Dualsky ECO4120C 350KV", brand: "Dualsky", kvRating: 350, maxPower: 1200, maxCurrent: 55, weight: 318, internalResistance: 0.045 },
  { name: "Dualsky ECO4130C 375KV", brand: "Dualsky", kvRating: 375, maxPower: 1500, maxCurrent: 65, weight: 388, internalResistance: 0.0388 },
  { name: "Scorpion A-4220 540KV", brand: "Scorpion", kvRating: 540, maxPower: 1000, maxCurrent: 48, weight: 268, internalResistance: 0.0182 },
  { name: "Scorpion A-4225 500KV", brand: "Scorpion", kvRating: 500, maxPower: 1200, maxCurrent: 55, weight: 320, internalResistance: 0.014 },
  { name: "Scorpion A-5025 215KV", brand: "Scorpion", kvRating: 215, maxPower: 1400, maxCurrent: 60, weight: 445, internalResistance: 0.0175 },
  { name: "Scorpion A-4225 250KV", brand: "Scorpion", kvRating: 250, maxPower: 1200, maxCurrent: 55, weight: 320, internalResistance: 0.014 },
  { name: "Scorpion A-5025 310KV", brand: "Scorpion", kvRating: 310, maxPower: 1400, maxCurrent: 60, weight: 445, internalResistance: 0.00865 },
  { name: "Scorpion A-5025 415KV", brand: "Scorpion", kvRating: 415, maxPower: 1400, maxCurrent: 60, weight: 445, internalResistance: 0.00545 },
];

async function main() {
  for (const p of propellers) {
    await prisma.propeller.upsert({
      where: { name: p.name },
      create: { ...p, testDensity: p.dataFilePath ? TEST_DENSITY : 1.225 },
      update: { ...p, testDensity: p.dataFilePath ? TEST_DENSITY : 1.225 },
    });
  }
  for (const m of motors) {
    await prisma.motor.upsert({ where: { name: m.name }, create: m, update: m });
  }
  await prisma.user.upsert({
    where: { email: "admin@vant.local" },
    create: {
      name: "Administrador",
      email: "admin@vant.local",
      passwordHash: await bcrypt.hash("admin12345", 12),
      role: "ADMIN",
    },
    update: {},
  });
  console.log(`Seed concluído: ${propellers.length} hélices, ${motors.length} motores, 1 admin.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
