import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

@Injectable()
export class PdfService {
  // Builds the ticket PDF (QR code, PNR, route, and GST breakup) and returns a Buffer.
  async ticket(data: {
    pnr: string; operatorName: string; from: string; to: string; date: string; time: string;
    seats: { seatNumber: string; passengerName: string }[];
    baseFare: number; fareGst: number; payable: number;
  }): Promise<Buffer> {
    const qrPng = await QRCode.toBuffer(`TICKET:${data.pnr}`, { width: 140 });
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).fillColor('#1f6feb').text('Yoo Bus Mobility Pvt Ltd', { align: 'left' });
      doc.moveDown(0.3).fontSize(12).fillColor('#000').text(`Operator: ${data.operatorName}`);
      doc.moveDown(0.5).fontSize(16).text(`PNR: ${data.pnr}`);
      doc.image(qrPng, 420, 40, { width: 120 });
      doc.moveDown(1).fontSize(12)
        .text(`From: ${data.from}`).text(`To: ${data.to}`)
        .text(`Date/Time: ${data.date} ${data.time}`);
      doc.moveDown(0.5).text('Passengers / Seats:');
      data.seats.forEach((s) => doc.text(`  • Seat ${s.seatNumber} — ${s.passengerName}`));
      doc.moveDown(0.5).text('Fare breakup:');
      doc.text(`  Base fare: Rs ${data.baseFare}`).text(`  GST: Rs ${data.fareGst}`)
        .font('Helvetica-Bold').text(`  Total paid: Rs ${data.payable}`).font('Helvetica');
      doc.moveDown(1).fontSize(9).fillColor('#888')
        .text('GST rates as configured; tax invoice subject to operator GSTIN. This is a system-generated ticket.');
      doc.end();
    });
  }
}
