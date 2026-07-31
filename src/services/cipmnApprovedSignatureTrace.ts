import type { jsPDF } from 'jspdf';

const APPROVED_SIGNATURE_OUTLINE: ReadonlyArray<readonly [number, number]> = [
  [0.3097, 0.0947], [0.3009, 0.1895], [0.4867, 0.3053], [0.5398, 0.2842],
  [0.3363, 0.1368], [0.4867, 0.0632], [0.6106, 0.1053], [0.5664, 0.4947],
  [0.4336, 0.6105], [0.0708, 0.6947], [0, 0.8316], [0.1062, 0.9895],
  [0.2301, 0.9368], [0.3451, 0.9895], [0.4425, 0.8947], [0.469, 0.9263],
  [0.3894, 0.9895], [0.5398, 0.9895], [0.5575, 0.8842], [0.5575, 0.9895],
  [0.6726, 0.9158], [0.708, 0.9895], [0.8142, 0.8842], [0.7788, 0.9895],
  [0.9381, 0.9895], [0.8053, 0.9579], [0.9292, 0.8], [0.9912, 0.8316],
  [0.9823, 0.7263], [0.823, 0.8], [0.8938, 0.4737], [0.8407, 0.4947],
  [0.7611, 0.3368], [0.646, 0.2947], [0.646, 0.0947], [0.4956, 0.0211],
];

export function drawApprovedSignatureTrace(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  doc.setDrawColor(8, 82, 61);
  doc.setLineWidth(0.32);
  for (let index = 1; index < APPROVED_SIGNATURE_OUTLINE.length; index += 1) {
    const previous = APPROVED_SIGNATURE_OUTLINE[index - 1];
    const current = APPROVED_SIGNATURE_OUTLINE[index];
    doc.line(
      x + previous[0] * width,
      y + previous[1] * height,
      x + current[0] * width,
      y + current[1] * height,
    );
  }
  const first = APPROVED_SIGNATURE_OUTLINE[0];
  const last = APPROVED_SIGNATURE_OUTLINE[APPROVED_SIGNATURE_OUTLINE.length - 1];
  doc.line(
    x + last[0] * width,
    y + last[1] * height,
    x + first[0] * width,
    y + first[1] * height,
  );
}
