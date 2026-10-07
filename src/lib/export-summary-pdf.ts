// This module is loaded only when a student asks to download a summary.
export async function exportSummaryPdf(subject: string, topic: string, summary: string, kind = "resumo") {
  const [{ PDFDocument, rgb }, fontkit] = await Promise.all([
    import("pdf-lib"),
    import("@pdf-lib/fontkit"),
  ]);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit.default);
  const [regularData, boldData] = await Promise.all([
    fetch(new URL("../assets/DejaVuSans.ttf", import.meta.url)).then((response) => response.arrayBuffer()),
    fetch(new URL("../assets/DejaVuSans-Bold.ttf", import.meta.url)).then((response) => response.arrayBuffer()),
  ]);
  const regular = await pdf.embedFont(regularData);
  const bold = await pdf.embedFont(boldData);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 52;
  const ink = rgb(0.11, 0.17, 0.21);
  const muted = rgb(0.37, 0.44, 0.48);
  const accent = rgb(0.08, 0.45, 0.55);
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const nextPage = (needed: number) => {
    if (y - needed < margin + 25) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  const wrap = (text: string, font: typeof regular, size: number, width: number) => {
    const lines: string[] = [];
    let current = "";
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  const draw = (text: string, size: number, weight: typeof regular, color = ink, indent = 0, leading = size * 1.55) => {
    for (const line of wrap(text, weight, size, pageWidth - margin * 2 - indent)) {
      nextPage(leading);
      page.drawText(line, { x: margin + indent, y, size, font: weight, color });
      y -= leading;
    }
  };

  draw(`MEUCBFPM  /  ${kind.toLocaleUpperCase("pt-BR")}`, 10, bold, accent);
  y -= 22;
  draw(subject.toLocaleUpperCase("pt-BR"), 10, bold, muted);
  y -= 5;
  draw(topic, 21, bold, ink, 0, 28);
  y -= 16;
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: accent });
  y -= 25;

  for (const rawLine of summary.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) { y -= 8; continue; }
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading?.[1]) {
      nextPage(46);
      y -= 9;
      draw(heading[1].replace(/\*\*/g, ""), 14, bold, accent, 0, 21);
      y -= 3;
      continue;
    }
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
    if (bullet?.[1]) {
      nextPage(20);
      page.drawCircle({ x: margin + 4, y: y + 3, size: 2, color: accent });
      draw(bullet[1].replace(/\*\*/g, ""), 10.5, regular, ink, 15, 16);
      y -= 4;
    } else {
      draw(line.replace(/\*\*/g, ""), 10.5, regular, ink, 0, 16);
    }
  }

  pdf.getPages().forEach((sheet, index) => {
    sheet.drawLine({ start: { x: margin, y: 38 }, end: { x: pageWidth - margin, y: 38 }, thickness: 0.5, color: muted });
    sheet.drawText(`MEUCBFPM  ·  ${index + 1} / ${pdf.getPageCount()}`, { x: margin, y: 22, size: 8, font: regular, color: muted });
  });

  const bytes = await pdf.save();
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `MEUCBFPM-${kind}-${subject}-${topic}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9-]+/g, "-").slice(0, 100) + ".pdf";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}