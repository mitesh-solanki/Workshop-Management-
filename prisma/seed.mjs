/**
 * Demo seed for local content review across implemented modules.
 *
 * Targets your real garage by default (name "prime", or SEED_GARAGE_ID).
 * Re-runnable: deletes prior rows whose ids start with "seed_" then recreates them.
 *
 * Usage: npm run db:seed
 *
 * Not in schema yet (skipped): inventory, vendors, purchases, billing, payments,
 * reminders, appointments, AMC.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CHECKLIST = [
  { key: "brakes", label: "Brakes" },
  { key: "tyres", label: "Tyres" },
  { key: "battery", label: "Battery" },
  { key: "lights", label: "Lights" },
  { key: "fluids", label: "Fluids" },
  { key: "suspension", label: "Suspension" },
  { key: "ac", label: "AC" },
];

const LABOUR_SAC = "998714";
const PART_HSN = "87089900";

function daysFromNow(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

async function resolveGarage() {
  if (process.env.SEED_GARAGE_ID) {
    const byId = await prisma.garage.findUnique({
      where: { id: process.env.SEED_GARAGE_ID },
    });
    if (!byId) {
      throw new Error(`SEED_GARAGE_ID not found: ${process.env.SEED_GARAGE_ID}`);
    }
    return byId;
  }

  const prime = await prisma.garage.findFirst({
    where: { name: { equals: "prime", mode: "insensitive" } },
  });
  if (prime) return prime;

  const withOwner = await prisma.user.findFirst({
    where: {
      role: "OWNER",
      NOT: { email: { contains: "example.com" } },
    },
    include: { garage: true },
    orderBy: { createdAt: "asc" },
  });
  if (withOwner) return withOwner.garage;

  return prisma.garage.create({
    data: {
      id: "seed_garage",
      name: "Prime Motors",
      address: "12 Ring Road, Surat, Gujarat 395007",
      gstin: "24ABCDE1234F1Z5",
    },
  });
}

async function clearPreviousSeed(garageId) {
  // Children first — estimates / inspections cascade from orders, but fixed ids need order.
  await prisma.estimateApproval.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  await prisma.estimateLine.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  await prisma.estimate.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  await prisma.suggestedRepair.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  await prisma.media.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  await prisma.inspectionItem.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  await prisma.inspection.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  await prisma.serviceOrderLine.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  await prisma.serviceOrder.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  await prisma.vehicle.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  await prisma.customer.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  await prisma.auditLog.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  await prisma.invite.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
  // Seed team users (email unique globally) — only our seed_* ids
  await prisma.user.deleteMany({
    where: { garageId, id: { startsWith: "seed_" } },
  });
}

async function ensureTeam(garageId, ownerId) {
  const tech1 = await prisma.user.upsert({
    where: { email: "seed.tech1@yopmail.com" },
    update: { garageId, role: "TECHNICIAN", name: "Ravi Patel" },
    create: {
      id: "seed_user_tech1",
      email: "seed.tech1@yopmail.com",
      name: "Ravi Patel",
      role: "TECHNICIAN",
      garageId,
      emailVerified: new Date(),
    },
  });

  const tech2 = await prisma.user.upsert({
    where: { email: "seed.tech2@yopmail.com" },
    update: { garageId, role: "TECHNICIAN", name: "Amit Shah" },
    create: {
      id: "seed_user_tech2",
      email: "seed.tech2@yopmail.com",
      name: "Amit Shah",
      role: "TECHNICIAN",
      garageId,
      emailVerified: new Date(),
    },
  });

  const accountant = await prisma.user.upsert({
    where: { email: "seed.accounts@yopmail.com" },
    update: { garageId, role: "ACCOUNTANT", name: "Neha Desai" },
    create: {
      id: "seed_user_accountant",
      email: "seed.accounts@yopmail.com",
      name: "Neha Desai",
      role: "ACCOUNTANT",
      garageId,
      emailVerified: new Date(),
    },
  });

  await prisma.invite.upsert({
    where: { id: "seed_invite_pending" },
    update: {},
    create: {
      id: "seed_invite_pending",
      garageId,
      email: "seed.invitee@yopmail.com",
      role: "TECHNICIAN",
      tokenHash: "seed_invite_token_hash_not_for_login",
      invitedBy: ownerId,
      locale: "en",
      expiresAt: daysFromNow(7),
      lastEmailStatus: "sent",
      lastEmailAt: new Date(),
    },
  });

  return { tech1, tech2, accountant };
}

async function seedCustomersAndVehicles(garageId) {
  const customers = [
    {
      id: "seed_cust_01",
      name: "Kiran Mehta",
      phone: "9876501001",
      address: "Adajan, Surat",
      notes: "Prefers WhatsApp updates. Regular for oil service.",
      vehicles: [
        {
          id: "seed_veh_01",
          registrationNumber: "GJ05AB1234",
          make: "Maruti Suzuki",
          model: "Swift VXI",
          year: 2019,
          odometer: 48200,
          insuranceExpiry: daysFromNow(40),
          pucExpiry: daysFromNow(-5),
          fitnessExpiry: daysFromNow(200),
        },
        {
          id: "seed_veh_02",
          registrationNumber: "GJ05CD5678",
          make: "Hyundai",
          model: "i20 Sportz",
          year: 2021,
          odometer: 22150,
          insuranceExpiry: daysFromNow(120),
          pucExpiry: daysFromNow(60),
        },
      ],
    },
    {
      id: "seed_cust_02",
      name: "Fatima Khan",
      phone: "9876501002",
      address: "Vesu, Surat",
      notes: "Company car — send GST invoice to accounts.",
      vehicles: [
        {
          id: "seed_veh_03",
          registrationNumber: "GJ05EF9012",
          make: "Honda",
          model: "City ZX",
          year: 2020,
          odometer: 61500,
          insuranceExpiry: daysFromNow(15),
          pucExpiry: daysFromNow(30),
          fitnessExpiry: daysFromNow(90),
        },
      ],
    },
    {
      id: "seed_cust_03",
      name: "Jayesh Solanki",
      phone: "9876501003",
      address: "Katargam, Surat",
      notes: null,
      vehicles: [
        {
          id: "seed_veh_04",
          registrationNumber: "GJ05GH3456",
          make: "Tata",
          model: "Nexon EV",
          year: 2023,
          odometer: 9800,
          insuranceExpiry: daysFromNow(300),
          pucExpiry: daysFromNow(180),
        },
      ],
    },
    {
      id: "seed_cust_04",
      name: "Priya Sharma",
      phone: "9876501004",
      address: "Athwa, Surat",
      notes: "Sensitive to brake noise — follow up after delivery.",
      vehicles: [
        {
          id: "seed_veh_05",
          registrationNumber: "GJ05IJ7890",
          make: "Mahindra",
          model: "XUV700 AX7",
          year: 2022,
          odometer: 35400,
          insuranceExpiry: daysFromNow(8),
          pucExpiry: daysFromNow(45),
          fitnessExpiry: daysFromNow(400),
        },
      ],
    },
    {
      id: "seed_cust_05",
      name: "Ramesh Gohil",
      phone: "9876501005",
      address: "Varachha, Surat",
      notes: "Walk-in lead converted last month.",
      vehicles: [
        {
          id: "seed_veh_06",
          registrationNumber: "GJ05KL1122",
          make: "Toyota",
          model: "Innova Crysta",
          year: 2018,
          odometer: 89200,
          insuranceExpiry: daysFromNow(-20),
          pucExpiry: daysFromNow(10),
          fitnessExpiry: daysFromNow(60),
        },
      ],
    },
  ];

  for (const c of customers) {
    const { vehicles, ...cust } = c;
    await prisma.customer.create({
      data: { ...cust, garageId },
    });
    for (const v of vehicles) {
      await prisma.vehicle.create({
        data: { ...v, garageId, customerId: cust.id },
      });
    }
  }

  return customers;
}

async function createChecklist(inspectionId, garageId, results) {
  for (let i = 0; i < CHECKLIST.length; i++) {
    const item = CHECKLIST[i];
    const result = results[item.key] ?? null;
    await prisma.inspectionItem.create({
      data: {
        id: `seed_ii_${inspectionId.slice(-6)}_${item.key}`,
        garageId,
        inspectionId,
        key: item.key,
        label: item.label,
        result: result?.result ?? null,
        notes: result?.notes ?? null,
        sortOrder: i,
        isCustom: false,
      },
    });
  }
}

async function seedOrders({ garageId, ownerId, tech1, tech2 }) {
  /** @type {Array<Record<string, unknown>>} */
  const specs = [
    {
      id: "seed_so_waiting",
      customerId: "seed_cust_01",
      vehicleId: "seed_veh_01",
      status: "WAITING",
      priority: "NORMAL",
      complaint: "Periodic service due — oil change and general check.",
      requestedServices: "Engine oil, filter, cabin filter",
      odometerIn: 48200,
      expectedCompletion: hoursFromNow(6),
      technicianId: null,
      bay: null,
      lines: [
        {
          id: "seed_sol_w1",
          type: "LABOUR",
          description: "Periodic service labour",
          quantity: 1,
          unitPricePaise: 120000,
        },
        {
          id: "seed_sol_w2",
          type: "PART",
          description: "Engine oil 4L (synthetic)",
          quantity: 1,
          unitPricePaise: 280000,
        },
      ],
    },
    {
      id: "seed_so_inspection",
      customerId: "seed_cust_02",
      vehicleId: "seed_veh_03",
      status: "INSPECTION",
      priority: "HIGH",
      complaint: "Brake pedal soft; squeal on low speed. Check pads and discs.",
      requestedServices: "Brake inspection",
      odometerIn: 61500,
      expectedCompletion: hoursFromNow(4),
      technicianId: tech1.id,
      bay: "Bay 1",
      lines: [
        {
          id: "seed_sol_i1",
          type: "LABOUR",
          description: "Brake inspection labour",
          quantity: 1,
          unitPricePaise: 80000,
        },
      ],
      inspection: {
        id: "seed_insp_01",
        notes: "Front pads thin; rear OK. Disc scoring on left front.",
        results: {
          brakes: {
            result: "URGENT",
            notes: "Front pads ~2mm; replace both sides.",
          },
          tyres: { result: "OK", notes: null },
          battery: { result: "OK", notes: null },
          lights: { result: "NEEDS_ATTENTION", notes: "LH headlamp misted." },
          fluids: { result: "OK", notes: null },
          suspension: { result: "OK", notes: null },
          ac: { result: "OK", notes: null },
        },
        repairs: [
          {
            id: "seed_sr_01",
            type: "LABOUR",
            description: "Replace front brake pads",
            quantity: 1,
            unitPricePaise: 150000,
          },
          {
            id: "seed_sr_02",
            type: "PART",
            description: "Front brake pad set (City)",
            quantity: 1,
            unitPricePaise: 320000,
          },
          {
            id: "seed_sr_03",
            type: "LABOUR",
            description: "Resurface / replace LH disc if needed",
            quantity: 1,
            unitPricePaise: 200000,
          },
        ],
      },
      estimate: {
        revision1: {
          id: "seed_est_01_r1",
          notes: "Initial quote — pads only",
          superseded: true,
          lines: [
            {
              id: "seed_el_01_r1_a",
              type: "LABOUR",
              description: "Replace front brake pads",
              quantity: 1,
              unitPricePaise: 150000,
              gstRatePercent: 18,
              hsnOrSac: LABOUR_SAC,
              approvalState: "APPROVED",
            },
            {
              id: "seed_el_01_r1_b",
              type: "PART",
              description: "Front brake pad set",
              quantity: 1,
              unitPricePaise: 320000,
              gstRatePercent: 18,
              hsnOrSac: PART_HSN,
              approvalState: "APPROVED",
            },
          ],
        },
        revision2: {
          id: "seed_est_01_r2",
          notes: "Revised after disc check — customer approved pads + disc",
          superseded: false,
          lines: [
            {
              id: "seed_el_01_r2_a",
              type: "LABOUR",
              description: "Replace front brake pads",
              quantity: 1,
              unitPricePaise: 150000,
              gstRatePercent: 18,
              hsnOrSac: LABOUR_SAC,
              approvalState: "APPROVED",
            },
            {
              id: "seed_el_01_r2_b",
              type: "PART",
              description: "Front brake pad set (City)",
              quantity: 1,
              unitPricePaise: 320000,
              gstRatePercent: 18,
              hsnOrSac: PART_HSN,
              approvalState: "APPROVED",
            },
            {
              id: "seed_el_01_r2_c",
              type: "LABOUR",
              description: "Replace LH front disc",
              quantity: 1,
              unitPricePaise: 220000,
              gstRatePercent: 18,
              hsnOrSac: LABOUR_SAC,
              approvalState: "APPROVED",
            },
            {
              id: "seed_el_01_r2_d",
              type: "PART",
              description: "Brake disc LH front",
              quantity: 1,
              unitPricePaise: 450000,
              gstRatePercent: 28,
              hsnOrSac: PART_HSN,
              approvalState: "PENDING",
            },
          ],
        },
      },
    },
    {
      id: "seed_so_progress",
      customerId: "seed_cust_04",
      vehicleId: "seed_veh_05",
      status: "IN_PROGRESS",
      priority: "URGENT",
      complaint: "AC not cooling; unusual noise from compressor area.",
      requestedServices: "AC diagnosis and repair",
      odometerIn: 35400,
      expectedCompletion: hoursFromNow(-2),
      technicianId: tech2.id,
      bay: "Bay 2",
      lines: [
        {
          id: "seed_sol_p1",
          type: "LABOUR",
          description: "AC diagnosis",
          quantity: 1,
          unitPricePaise: 100000,
        },
        {
          id: "seed_sol_p2",
          type: "PART",
          description: "AC gas R134a top-up",
          quantity: 1,
          unitPricePaise: 180000,
        },
      ],
      inspection: {
        id: "seed_insp_02",
        notes: "Low gas; condenser fins clogged with dust.",
        results: {
          brakes: { result: "OK", notes: null },
          tyres: { result: "NEEDS_ATTENTION", notes: "Rear right low pressure." },
          battery: { result: "OK", notes: null },
          lights: { result: "OK", notes: null },
          fluids: { result: "OK", notes: null },
          suspension: { result: "OK", notes: null },
          ac: {
            result: "URGENT",
            notes: "Compressor clutch intermittently engaging.",
          },
        },
        repairs: [
          {
            id: "seed_sr_04",
            type: "LABOUR",
            description: "AC leak check + gas recharge",
            quantity: 1,
            unitPricePaise: 250000,
          },
          {
            id: "seed_sr_05",
            type: "PART",
            description: "AC compressor (XUV700)",
            quantity: 1,
            unitPricePaise: 1850000,
          },
        ],
      },
      estimate: {
        revision1: {
          id: "seed_est_02_r1",
          notes: "Customer asked to approve labour first; compressor pending",
          superseded: false,
          lines: [
            {
              id: "seed_el_02_a",
              type: "LABOUR",
              description: "AC leak check + gas recharge",
              quantity: 1,
              unitPricePaise: 250000,
              gstRatePercent: 18,
              hsnOrSac: LABOUR_SAC,
              approvalState: "APPROVED",
            },
            {
              id: "seed_el_02_b",
              type: "PART",
              description: "AC compressor (XUV700)",
              quantity: 1,
              unitPricePaise: 1850000,
              gstRatePercent: 18,
              hsnOrSac: PART_HSN,
              approvalState: "REJECTED",
            },
            {
              id: "seed_el_02_c",
              type: "PART",
              description: "AC gas R134a",
              quantity: 1,
              unitPricePaise: 180000,
              gstRatePercent: 18,
              hsnOrSac: PART_HSN,
              approvalState: "APPROVED",
            },
          ],
        },
      },
    },
    {
      id: "seed_so_parts",
      customerId: "seed_cust_03",
      vehicleId: "seed_veh_04",
      status: "WAITING_FOR_PARTS",
      priority: "NORMAL",
      complaint: "Charging slow; 12V battery warning on dash.",
      requestedServices: "EV 12V battery check",
      odometerIn: 9800,
      expectedCompletion: daysFromNow(1),
      technicianId: tech1.id,
      bay: "Bay 3",
      lines: [
        {
          id: "seed_sol_wp1",
          type: "LABOUR",
          description: "Battery diagnosis",
          quantity: 1,
          unitPricePaise: 90000,
        },
        {
          id: "seed_sol_wp2",
          type: "PART",
          description: "12V auxiliary battery (Nexon EV)",
          quantity: 1,
          unitPricePaise: 750000,
        },
      ],
      inspection: {
        id: "seed_insp_03",
        notes: "12V battery failing load test. Ordered OEM unit.",
        results: {
          brakes: { result: "OK", notes: null },
          tyres: { result: "OK", notes: null },
          battery: {
            result: "URGENT",
            notes: "Load test failed at 10.8V.",
          },
          lights: { result: "OK", notes: null },
          fluids: { result: "OK", notes: null },
          suspension: { result: "OK", notes: null },
          ac: { result: "OK", notes: null },
        },
        repairs: [
          {
            id: "seed_sr_06",
            type: "PART",
            description: "12V auxiliary battery",
            quantity: 1,
            unitPricePaise: 750000,
          },
        ],
      },
      estimate: {
        revision1: {
          id: "seed_est_03_r1",
          notes: "Awaiting part arrival from vendor",
          superseded: false,
          lines: [
            {
              id: "seed_el_03_a",
              type: "LABOUR",
              description: "Battery diagnosis & fitment",
              quantity: 1,
              unitPricePaise: 120000,
              gstRatePercent: 18,
              hsnOrSac: LABOUR_SAC,
              approvalState: "APPROVED",
            },
            {
              id: "seed_el_03_b",
              type: "PART",
              description: "12V auxiliary battery (Nexon EV)",
              quantity: 1,
              unitPricePaise: 750000,
              gstRatePercent: 18,
              hsnOrSac: PART_HSN,
              approvalState: "APPROVED",
            },
          ],
        },
      },
    },
    {
      id: "seed_so_ready",
      customerId: "seed_cust_01",
      vehicleId: "seed_veh_02",
      status: "READY",
      priority: "LOW",
      complaint: "Wheel alignment and tyre rotation.",
      requestedServices: "Alignment + balance",
      odometerIn: 22150,
      expectedCompletion: hoursFromNow(1),
      technicianId: tech2.id,
      bay: "Bay 1",
      lines: [
        {
          id: "seed_sol_r1",
          type: "LABOUR",
          description: "Four-wheel alignment",
          quantity: 1,
          unitPricePaise: 150000,
        },
        {
          id: "seed_sol_r2",
          type: "LABOUR",
          description: "Tyre rotation and balance",
          quantity: 1,
          unitPricePaise: 80000,
        },
      ],
      inspection: {
        id: "seed_insp_04",
        notes: "All checks OK after alignment.",
        results: {
          brakes: { result: "OK", notes: null },
          tyres: { result: "OK", notes: "Rotated FL→RL pattern." },
          battery: { result: "OK", notes: null },
          lights: { result: "OK", notes: null },
          fluids: { result: "OK", notes: null },
          suspension: { result: "OK", notes: null },
          ac: { result: "OK", notes: null },
        },
        repairs: [],
      },
      estimate: {
        revision1: {
          id: "seed_est_04_r1",
          notes: "Ready for delivery — full approval",
          superseded: false,
          lines: [
            {
              id: "seed_el_04_a",
              type: "LABOUR",
              description: "Four-wheel alignment",
              quantity: 1,
              unitPricePaise: 150000,
              gstRatePercent: 18,
              hsnOrSac: LABOUR_SAC,
              approvalState: "APPROVED",
            },
            {
              id: "seed_el_04_b",
              type: "LABOUR",
              description: "Tyre rotation and balance",
              quantity: 1,
              unitPricePaise: 80000,
              gstRatePercent: 18,
              hsnOrSac: LABOUR_SAC,
              approvalState: "APPROVED",
            },
          ],
        },
      },
    },
    {
      id: "seed_so_done",
      customerId: "seed_cust_05",
      vehicleId: "seed_veh_06",
      status: "COMPLETED",
      priority: "NORMAL",
      complaint: "Clutch slipping on highway; hard to engage 3rd gear.",
      requestedServices: "Clutch overhaul",
      odometerIn: 89150,
      expectedCompletion: daysFromNow(-2),
      technicianId: tech1.id,
      bay: "Bay 2",
      lines: [
        {
          id: "seed_sol_d1",
          type: "LABOUR",
          description: "Clutch kit replacement labour",
          quantity: 1,
          unitPricePaise: 450000,
        },
        {
          id: "seed_sol_d2",
          type: "PART",
          description: "Clutch kit (Innova Crysta)",
          quantity: 1,
          unitPricePaise: 1250000,
        },
      ],
      inspection: {
        id: "seed_insp_05",
        notes: "Clutch worn; flywheel resurfaced. Delivered.",
        results: {
          brakes: { result: "NEEDS_ATTENTION", notes: "Pads at 40% — advise next visit." },
          tyres: { result: "OK", notes: null },
          battery: { result: "OK", notes: null },
          lights: { result: "OK", notes: null },
          fluids: { result: "OK", notes: null },
          suspension: { result: "OK", notes: null },
          ac: { result: "OK", notes: null },
        },
        repairs: [
          {
            id: "seed_sr_07",
            type: "LABOUR",
            description: "Clutch kit replacement",
            quantity: 1,
            unitPricePaise: 450000,
          },
          {
            id: "seed_sr_08",
            type: "PART",
            description: "Clutch kit (Innova Crysta)",
            quantity: 1,
            unitPricePaise: 1250000,
          },
        ],
      },
      estimate: {
        revision1: {
          id: "seed_est_05_r1",
          notes: "Completed job — paid in full (billing module later)",
          superseded: false,
          lines: [
            {
              id: "seed_el_05_a",
              type: "LABOUR",
              description: "Clutch kit replacement labour",
              quantity: 1,
              unitPricePaise: 450000,
              gstRatePercent: 18,
              hsnOrSac: LABOUR_SAC,
              approvalState: "APPROVED",
            },
            {
              id: "seed_el_05_b",
              type: "PART",
              description: "Clutch kit (Innova Crysta)",
              quantity: 1,
              unitPricePaise: 1250000,
              gstRatePercent: 18,
              hsnOrSac: PART_HSN,
              approvalState: "APPROVED",
            },
          ],
        },
      },
    },
  ];

  for (const spec of specs) {
    const {
      lines,
      inspection,
      estimate,
      ...order
    } = spec;

    await prisma.serviceOrder.create({
      data: { ...order, garageId },
    });

    let sort = 0;
    for (const line of lines) {
      await prisma.serviceOrderLine.create({
        data: {
          ...line,
          garageId,
          serviceOrderId: order.id,
          sortOrder: sort++,
        },
      });
    }

    if (inspection) {
      await prisma.inspection.create({
        data: {
          id: inspection.id,
          garageId,
          serviceOrderId: order.id,
          notes: inspection.notes,
        },
      });
      await createChecklist(inspection.id, garageId, inspection.results);
      let rSort = 0;
      for (const repair of inspection.repairs) {
        await prisma.suggestedRepair.create({
          data: {
            ...repair,
            garageId,
            inspectionId: inspection.id,
            sortOrder: rSort++,
          },
        });
      }
    }

    if (estimate) {
      const revisions = [estimate.revision1, estimate.revision2].filter(Boolean);
      let revNo = 1;
      for (const rev of revisions) {
        await prisma.estimate.create({
          data: {
            id: rev.id,
            garageId,
            serviceOrderId: order.id,
            revisionNumber: revNo,
            notes: rev.notes,
            supersededAt: rev.superseded ? daysFromNow(-1) : null,
            createdById: ownerId,
          },
        });
        let lSort = 0;
        for (const line of rev.lines) {
          await prisma.estimateLine.create({
            data: {
              ...line,
              garageId,
              estimateId: rev.id,
              sortOrder: lSort++,
            },
          });

          if (line.approvalState !== "PENDING") {
            await prisma.estimateApproval.create({
              data: {
                id: `seed_ea_${line.id}`,
                garageId,
                estimateId: rev.id,
                estimateLineId: line.id,
                fromState: "PENDING",
                toState: line.approvalState,
                method: line.approvalState === "REJECTED" ? "PHONE" : "MANUAL",
                recordedById: ownerId,
                note:
                  line.approvalState === "REJECTED"
                    ? "Customer wants second opinion on compressor price"
                    : "Approved on floor",
              },
            });
          }
        }
        revNo += 1;
      }
    }
  }

  return specs.length;
}

async function seedAudit(garageId, ownerId) {
  const rows = [
    {
      id: "seed_audit_01",
      action: "estimate.line_approved",
      entity: "EstimateLine",
      entityId: "seed_el_01_r2_a",
      meta: { method: "MANUAL", demo: true },
    },
    {
      id: "seed_audit_02",
      action: "estimate.line_rejected",
      entity: "EstimateLine",
      entityId: "seed_el_02_b",
      meta: { method: "PHONE", demo: true },
    },
    {
      id: "seed_audit_03",
      action: "service_order.status_changed",
      entity: "ServiceOrder",
      entityId: "seed_so_ready",
      meta: { from: "IN_PROGRESS", to: "READY", demo: true },
    },
  ];

  for (const row of rows) {
    await prisma.auditLog.create({
      data: {
        ...row,
        garageId,
        actorId: ownerId,
      },
    });
  }
}

async function main() {
  const garage = await resolveGarage();
  console.log(`Seeding garage: ${garage.name} (${garage.id})`);

  await prisma.garage.update({
    where: { id: garage.id },
    data: {
      name: garage.name === "prime" ? "Prime Motors" : garage.name,
      address: garage.address ?? "12 Ring Road, Surat, Gujarat 395007",
      gstin: garage.gstin ?? "24ABCDE1234F1Z5",
    },
  });

  const owner = await prisma.user.findFirst({
    where: { garageId: garage.id, role: "OWNER" },
    orderBy: { createdAt: "asc" },
  });

  if (!owner) {
    throw new Error(
      "No OWNER user on this garage. Sign up first, then re-run npm run db:seed.",
    );
  }

  await clearPreviousSeed(garage.id);
  const team = await ensureTeam(garage.id, owner.id);
  await seedCustomersAndVehicles(garage.id);
  const orderCount = await seedOrders({
    garageId: garage.id,
    ownerId: owner.id,
    tech1: team.tech1,
    tech2: team.tech2,
  });
  await seedAudit(garage.id, owner.id);

  console.log(`Done.
  Customers: 5 (+ vehicles)
  Service orders: ${orderCount} (all statuses)
  Team seed users: seed.tech1@yopmail.com, seed.tech2@yopmail.com, seed.accounts@yopmail.com
  Pending invite: seed.invitee@yopmail.com
  Log in as: ${owner.email}
  Skipped (no tables yet): inventory, vendors, billing, payments, reminders, appointments`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
