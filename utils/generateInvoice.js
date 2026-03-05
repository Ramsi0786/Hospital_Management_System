import PDFDocument from 'pdfkit';
import Invoice from '../models/invoice.model.js';

export const saveInvoiceRecord = async (appointment, type = 'booking') => {
  try {
    const invoiceNumber = await Invoice.generateInvoiceNumber(type);
    const invoice = await Invoice.create({
      appointment: appointment._id,
      patient:     appointment.patient,
      invoiceNumber,
      type,
      amount:      appointment.consultationFee,
      pdfGeneratedAt: new Date()
    });
    return invoice;
  } catch (err) {
    console.error('Save invoice record error:', err.message);
    return null;
  }
};


export const generateInvoicePDF = (data) => {
  return new Promise((resolve, reject) => {
    const { appointment, doctor, patient } = data;

    const doc    = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data',  chunk => chunks.push(chunk));
    doc.on('end',   ()    => resolve(Buffer.concat(chunks)));
    doc.on('error', err   => reject(err));

    const W         = doc.page.width;
    const MARGIN    = 50;
    const COL_RIGHT = W - MARGIN;

    // ── Colours ──────────────────────────────────────────────────────────────
    const NAVY   = '#203f6a';
    const TEAL   = '#1a7f8e';
    const GREY   = '#64748b';
    const LIGHT  = '#f1f5f9';
    const BLACK  = '#1a202c';
    const GREEN  = '#059669';
    const WHITE  = '#ffffff';

    // ── Helper: horizontal rule ───────────────────────────────────────────────
    const hr = (y, color = '#e2e8f0') => {
      doc.moveTo(MARGIN, y).lineTo(COL_RIGHT, y).strokeColor(color).lineWidth(1).stroke();
    };

    // ════════════════════════  HEADER — gradient-like banner ════════════════════════
    
    doc.rect(0, 0, W, 100).fill(NAVY);
    doc.rect(W * 0.65, 0, W * 0.35, 100).fill(TEAL);

    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(28)
      .text('HEALORA', MARGIN, 30);
    doc.fillColor('rgba(255,255,255,0.7)').font('Helvetica').fontSize(11)
      .text('Hospital Management System', MARGIN, 62);

    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(22)
      .text('INVOICE', 0, 30, { align: 'right', width: W - MARGIN });
    doc.fillColor('rgba(255,255,255,0.8)').font('Helvetica').fontSize(10)
      .text(`#${appointment._id.toString().slice(-8).toUpperCase()}`, 0, 58, { align: 'right', width: W - MARGIN });

    // ════════════════════════ META ROW : Date, Status, Payment ════════════════════════
    doc.rect(0, 100, W, 38).fill(LIGHT);

    const invoiceDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
    const apptDate = new Date(appointment.date + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
    });

    doc.fillColor(GREY).font('Helvetica').fontSize(9);
    doc.text(`Invoice Date: ${invoiceDate}`,       MARGIN,        112);
    doc.text(`Appointment: ${apptDate} · ${appointment.timeSlot}`, 210, 112);
    doc.text(`Payment: ${appointment.paymentMethod.toUpperCase()}`, 430, 112);

    // ════════════════════════ BILLED TO / DOCTOR SECTION ════════════════════════
    
    let y = 160;

    doc.fillColor(GREY).font('Helvetica').fontSize(9).text('BILLED TO', MARGIN, y);
    doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(13).text(patient.name, MARGIN, y + 14);
    doc.fillColor(GREY).font('Helvetica').fontSize(10)
      .text(patient.email,        MARGIN, y + 30)
      .text(patient.phone || '—', MARGIN, y + 44);

    doc.fillColor(GREY).font('Helvetica').fontSize(9).text('DOCTOR', 340, y);
    doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(13)
      .text(`Dr. ${doctor.name}`, 340, y + 14);
    doc.fillColor(GREY).font('Helvetica').fontSize(10)
      .text(doctor.specialization,               340, y + 30)
      .text(`${doctor.department} Department`,   340, y + 44);

    //────── DIVIDER ──────────────────────────────────────────
    
    y += 80;
    hr(y);

    // ════════════════════════ SERVICE TABLE HEADER ════════════════════════
    
    y += 16;
    doc.rect(MARGIN, y, W - MARGIN * 2, 28).fill(NAVY);

    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(10);
    doc.text('DESCRIPTION',  MARGIN + 10,  y + 9);
    doc.text('DATE',         280,          y + 9);
    doc.text('TIME',         370,          y + 9);
    doc.text('AMOUNT',       0,            y + 9, { align: 'right', width: W - MARGIN - 10 });

    // ════════════════════════ SERVICE ROW ════════════════════════
    
    y += 36;
    doc.rect(MARGIN, y - 6, W - MARGIN * 2, 34).fill('#f8fafc');

    doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(11)
      .text('Medical Consultation', MARGIN + 10, y);
    doc.fillColor(GREY).font('Helvetica').fontSize(9)
      .text(`${doctor.specialization} · ${doctor.department}`, MARGIN + 10, y + 14);

    doc.fillColor(BLACK).font('Helvetica').fontSize(10)
      .text(apptDate,                 280, y + 4)
      .text(appointment.timeSlot,     370, y + 4);

    doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(12)
      .text(`Rs. ${appointment.consultationFee}`, 0, y + 4,
            { align: 'right', width: W - MARGIN - 10 });

    // ════════════════════════ REASON (if provided) ════════════════════════
    
    y += 50;
    if (appointment.reason) {
      doc.fillColor(GREY).font('Helvetica').fontSize(9)
        .text('REASON FOR VISIT', MARGIN, y);
      doc.fillColor(BLACK).font('Helvetica').fontSize(10)
        .text(appointment.reason, MARGIN, y + 12, { width: 300 });
      y += 40;
    }

    // ════════════════════════ TOTALS BOX ════════════════════════  
    
    y += 10;
    hr(y);

    const totalsX = 360;
    y += 14;

    doc.fillColor(GREY).font('Helvetica').fontSize(10).text('Subtotal', totalsX, y);
    doc.fillColor(BLACK).font('Helvetica').fontSize(10)
      .text(`Rs. ${appointment.consultationFee}`, 0, y,
            { align: 'right', width: W - MARGIN - 10 });

    y += 18;
    doc.fillColor(GREY).font('Helvetica').fontSize(10).text('Platform Fee', totalsX, y);
    doc.fillColor(GREEN).font('Helvetica').fontSize(10)
      .text('FREE', 0, y, { align: 'right', width: W - MARGIN - 10 });

    y += 18;
    doc.fillColor(GREY).font('Helvetica').fontSize(10).text('Tax', totalsX, y);
    doc.fillColor(GREEN).font('Helvetica').fontSize(10)
      .text('Included', 0, y, { align: 'right', width: W - MARGIN - 10 });

    y += 8;
    hr(y, NAVY);
    y += 10;

    doc.rect(totalsX - 10, y - 4, W - totalsX - MARGIN + 20, 30).fill(NAVY);
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(13)
      .text('TOTAL', totalsX, y + 6);
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(14)
      .text(`Rs. ${appointment.consultationFee}`, 0, y + 6,
            { align: 'right', width: W - MARGIN - 10 });

    // ════════════════════════ PAYMENT STATUS BADGE ════════════════════════
   
    y += 50;
    const statusColor = appointment.paymentStatus === 'paid' ? GREEN :
                        appointment.paymentStatus === 'pending' ? '#d97706' : '#dc2626';
    const statusText  = appointment.paymentStatus === 'paid'    ? 'PAID' :
                        appointment.paymentStatus === 'pending' ? 'PAYMENT PENDING' : 'UNPAID';

    doc.roundedRect(MARGIN, y, 150, 28, 5).fill(statusColor);
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(11)
      .text(statusText, MARGIN, y + 8, { width: 150, align: 'center' });

    if (appointment.paymentMethod === 'cash') {
      doc.fillColor(GREY).font('Helvetica').fontSize(9)
        .text('Please pay at the clinic on the day of your appointment.', MARGIN + 160, y + 9);
    } else if (appointment.razorpayPaymentId) {
      doc.fillColor(GREY).font('Helvetica').fontSize(9)
        .text(`Transaction ID: ${appointment.razorpayPaymentId}`, MARGIN + 160, y + 9);
    }

    // ════════════════════════ FOOTER ════════════════════════
    
    const footerY = doc.page.height - 70;
    doc.rect(0, footerY, W, 70).fill(LIGHT);
    hr(footerY, '#e2e8f0');

    doc.fillColor(GREY).font('Helvetica').fontSize(9)
      .text('Thank you for choosing Healora. We wish you good health.',
            MARGIN, footerY + 14, { align: 'center', width: W - MARGIN * 2 })
      .text('For support: support@healora.com  |  www.healora.com',
            MARGIN, footerY + 30, { align: 'center', width: W - MARGIN * 2 })
      .text(`© ${new Date().getFullYear()} Healora Hospital Management System. All rights reserved.`,
            MARGIN, footerY + 46, { align: 'center', width: W - MARGIN * 2 });

    doc.end();
  });
};