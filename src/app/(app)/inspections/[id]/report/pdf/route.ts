import { NextResponse } from "next/server";
import { z } from "zod";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { createPresignedDownloadUrl } from "@/lib/storage";
import { prisma } from "@/lib/db";
import type { Paise } from "@/lib/money";
import {
  buildInspectionReportCheckedOk,
  buildInspectionReportExternalOnly,
  buildInspectionReportPricedLines,
} from "@/modules/inspections/report-lines";
import {
  formatInspectionPdfExpectedCompletion,
  generateInspectionReportPdf,
} from "@/modules/inspections/report-pdf";
import { getInspection } from "@/modules/inspections/service";

type Params = { params: Promise<{ id: string }> };

const CLOSING_NOTE =
  "These findings are based on the inspection completed so far. We will update you if further issues are identified.";

const draftLineSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.number().int().min(1).max(9999),
  unitPricePaise: z.number().int().min(0).max(100_000_000),
  lineTotalPaise: z.number().int().min(0).max(100_000_000).optional(),
});

const draftBodySchema = z.object({
  items: z.array(draftLineSchema).max(200),
  checkedOkLabels: z.array(z.string().trim().max(120)).max(100).optional(),
  externalLabels: z.array(z.string().trim().max(120)).max(100).optional(),
  expectedCompletion: z.string().max(80).nullable().optional(),
  complaint: z.string().max(2000).nullable().optional(),
  recommendedNotes: z.string().max(2000).nullable().optional(),
});

async function loadPhotoBuffers(
  media: Array<{
    kind: "PHOTO" | "VIDEO";
    storageKey: string;
    label: string;
  }>,
) {
  const photos: Array<{ label: string; buffer: Buffer }> = [];
  for (const row of media) {
    if (row.kind !== "PHOTO") continue;
    try {
      const url = await createPresignedDownloadUrl(row.storageKey);
      const response = await fetch(url);
      if (!response.ok) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      photos.push({ label: row.label, buffer });
    } catch {
      // Skip broken media; report still generates.
    }
  }
  return photos;
}

async function buildPdfResponse(args: {
  garageName: string;
  customerName: string;
  vehicleRegistration: string;
  vehicleMakeModel: string;
  expectedCompletion: string | null;
  complaint: string | null;
  recommendedNotes: string | null;
  items: Array<{
    description: string;
    quantity: number;
    unitPricePaise: Paise;
    lineTotalPaise?: Paise;
  }>;
  checkedOkLabels: string[];
  externalLabels: string[];
  photos: Array<{ label: string; buffer: Buffer }>;
}) {
  const pdf = await generateInspectionReportPdf({
    garageName: args.garageName,
    customerName: args.customerName,
    vehicleRegistration: args.vehicleRegistration,
    vehicleMakeModel: args.vehicleMakeModel,
    expectedCompletion: args.expectedCompletion,
    complaint: args.complaint,
    recommendedNotes: args.recommendedNotes,
    items: args.items,
    checkedOkLabels: args.checkedOkLabels,
    externalLabels: args.externalLabels,
    photos: args.photos,
    closingNote: CLOSING_NOTE,
    generatedAt: new Date(),
  });

  const filename = `inspection-report-${args.vehicleRegistration}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const inspection = await getInspection(session, id);
    const garage = await prisma.garage.findFirst({
      where: { id: session.garageId },
      select: { name: true },
    });

    const sourceItems = inspection.items.map((item) => ({
      id: item.id,
      label: item.label,
      notes: item.notes,
      quantity: item.quantity,
      unitPricePaise: item.unitPricePaise,
      externalCheck: item.externalCheck,
      result: item.result,
    }));
    const priced = buildInspectionReportPricedLines(sourceItems);
    const checkedOk = buildInspectionReportCheckedOk(sourceItems);
    const externalOnly = buildInspectionReportExternalOnly(sourceItems);

    const photoSources = inspection.items.flatMap((item) =>
      item.media.map((m) => ({
        kind: m.kind,
        storageKey: m.storageKey,
        label: item.label,
      })),
    );
    const photos = await loadPhotoBuffers(photoSources);

    return buildPdfResponse({
      garageName: garage?.name?.trim() || "Workshop",
      customerName: inspection.customer.name,
      vehicleRegistration: inspection.vehicle.registrationNumber,
      vehicleMakeModel:
        `${inspection.vehicle.make} ${inspection.vehicle.model}`.trim(),
      expectedCompletion: formatInspectionPdfExpectedCompletion(
        inspection.expectedCompletion,
      ),
      complaint: inspection.complaint,
      recommendedNotes: inspection.recommendedNotes,
      items: priced.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitPricePaise: line.unitPricePaise as Paise,
        lineTotalPaise: line.lineTotalPaise as Paise,
      })),
      checkedOkLabels: checkedOk.map((item) => item.label),
      externalLabels: externalOnly.map((item) => item.label),
      photos,
    });
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ForbiddenError) {
      return new NextResponse("Not found", { status: 404 });
    }
    console.error("inspection report pdf failed", error);
    return new NextResponse("Failed to generate PDF", { status: 500 });
  }
}

/** PDF from the live report draft (same lines the Report tab shows). */
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const inspection = await getInspection(session, id);
    const garage = await prisma.garage.findFirst({
      where: { id: session.garageId },
      select: { name: true },
    });

    const raw = await request.json();
    const body = draftBodySchema.parse(raw);

    const photoSources = inspection.items.flatMap((item) =>
      item.media.map((m) => ({
        kind: m.kind,
        storageKey: m.storageKey,
        label: item.label,
      })),
    );
    const photos = await loadPhotoBuffers(photoSources);

    const expectedFromDraft =
      body.expectedCompletion !== undefined
        ? formatInspectionPdfExpectedCompletion(body.expectedCompletion)
        : formatInspectionPdfExpectedCompletion(inspection.expectedCompletion);

    return buildPdfResponse({
      garageName: garage?.name?.trim() || "Workshop",
      customerName: inspection.customer.name,
      vehicleRegistration: inspection.vehicle.registrationNumber,
      vehicleMakeModel:
        `${inspection.vehicle.make} ${inspection.vehicle.model}`.trim(),
      expectedCompletion: expectedFromDraft,
      complaint:
        body.complaint !== undefined ? body.complaint : inspection.complaint,
      recommendedNotes:
        body.recommendedNotes !== undefined
          ? body.recommendedNotes
          : inspection.recommendedNotes,
      items: body.items.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitPricePaise: line.unitPricePaise as Paise,
        lineTotalPaise: (line.lineTotalPaise ??
          line.unitPricePaise * line.quantity) as Paise,
      })),
      checkedOkLabels: body.checkedOkLabels ?? [],
      externalLabels: body.externalLabels ?? [],
      photos,
    });
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ForbiddenError) {
      return new NextResponse("Not found", { status: 404 });
    }
    if (error instanceof z.ZodError) {
      return new NextResponse("Invalid report data", { status: 400 });
    }
    console.error("inspection report pdf failed", error);
    return new NextResponse("Failed to generate PDF", { status: 500 });
  }
}
