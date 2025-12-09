// lib/certificateService.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { supabase } from "./supabaseClient";

export type CertificateRow = {
  id: string;
  certificate_url: string | null;
  certificate_number: string | null;
  issued_at: string;
  completed_at: string | null;
};

type GenerateCertificateArgs = {
  userId: string;
  courseId: string;
  nameText: string;        // "Lauren Burrell"
  completionLine: string;  // "for completing Fastener Selection for Commercial Rooftop Equipment"
  completionDate: string;  // "December 9, 2025"
};

const BUCKET_NAME = "certificates";
const TEMPLATE_PATH = "templates/anchor-certificate-template.pdf";

// Wrap text based on actual rendered width
function wrapByWidth(
  text: string,
  maxWidth: number,
  font: any,
  fontSize: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? current + " " + word : word;
    const width = font.widthOfTextAtSize(test, fontSize);

    if (width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function generateCertificate({
  userId,
  courseId,
  nameText,
  completionLine,
  completionDate,
}: GenerateCertificateArgs): Promise<CertificateRow> {
  // 1) Get template from Supabase
  const { data: templateUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(TEMPLATE_PATH);

  const templateUrl = templateUrlData?.publicUrl;
  if (!templateUrl) {
    throw new Error("Could not resolve certificate template URL.");
  }

  const templateBytes = await fetch(templateUrl).then((res) =>
    res.arrayBuffer()
  );
  const pdfDoc = await PDFDocument.load(templateBytes);
  const [page] = pdfDoc.getPages();

  // 2) Draw text manually (ignore any form fields)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();

  // Layout constants – tweak if needed
  const nameSize = 28;
  const courseSize = 16;
  const dateSize = 12;

  // approximate bar widths (80% of page)
  const barWidth = pageWidth * 0.78;

  // ---- NAME (big line under "of Completion") ----
  const nameWidth = boldFont.widthOfTextAtSize(nameText, nameSize);
  const nameX = (pageWidth - nameWidth) / 2;
  const nameY = pageHeight * 0.46; // adjust up/down as needed

  page.drawText(nameText, {
    x: nameX,
    y: nameY,
    size: nameSize,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

    // ---- COURSE LINE (blue bar in the middle section) ----
  // Move the course text down so it sits fully inside the second blue bar
  const courseBarCenterY = pageHeight * 0.24; // lower than before

  const courseLineHeight = courseSize + 3;

  const wrappedLines = wrapByWidth(
    completionLine,
    barWidth,
    font,
    courseSize
  );

  // center the whole block around courseBarCenterY
  const totalBlockHeight =
    courseLineHeight * (wrappedLines.length - 1 || 1);
  let lineY = courseBarCenterY + totalBlockHeight / 2;


  for (const line of wrappedLines) {
    const w = font.widthOfTextAtSize(line, courseSize);
    const x = (pageWidth - w) / 2;

    page.drawText(line, {
      x,
      y: lineY,
      size: courseSize,
      font,
      color: rgb(0, 0, 0),
    });

    lineY -= courseLineHeight;
  }

  // ---- DATE (small box at bottom left) ----
  const dateWidth = font.widthOfTextAtSize(completionDate, dateSize);
  const dateX = pageWidth * 0.14; // left-ish, over that blue date box
  const dateY = pageHeight * 0.12;

  page.drawText(completionDate, {
    x: dateX,
    y: dateY,
    size: dateSize,
    font,
    color: rgb(0, 0, 0),
  });

  // 3) Save & upload to Supabase
  const pdfBytes = await pdfDoc.save();
  const now = new Date();
  const fileName = `cert_${courseId}_${userId}_${now.getTime()}.pdf`;
  const filePath = `${userId}/${fileName}`;

  const file = new File([pdfBytes], fileName, { type: "application/pdf" });

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) {
    console.error("Supabase upload error:", uploadError);
    throw new Error(uploadError.message || "Failed to upload certificate PDF.");
  }

  // 4) Public URL
  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  const publicUrl = publicUrlData?.publicUrl;
  if (!publicUrl) {
    throw new Error("Could not generate public URL for certificate.");
  }

  // 5) Insert DB row
  const issuedAt = now.toISOString();
  const certificateNumber = Math.random().toString().slice(2, 10);

  const { data: insertData, error: insertError } = await supabase
    .from("certificates")
    .insert({
      user_id: userId,
      course_id: courseId,
      certificate_url: publicUrl,
      certificate_number: certificateNumber,
      issued_at: issuedAt,
      completed_at: issuedAt,
    })
    .select(
      `
      id,
      certificate_url,
      certificate_number,
      issued_at,
      completed_at
    `
    )
    .single();

  if (insertError) {
    console.error("Insert error:", insertError);
    throw new Error("Failed to save certificate record.");
  }

  return insertData as CertificateRow;
}
