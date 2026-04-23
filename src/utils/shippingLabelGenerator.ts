import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

export const generateShippingLabel = async (order: any, settings?: any) => {
  const doc = new jsPDF({
    unit: 'mm',
    format: [101.6, 152.4] // 4x6 inches
  });

  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 5;

  // Draw Main Border
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(2, 2, width - 4, height - 4, 'S');

  // Header Section
  // Logo & Store Name
  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.text('Thr Ruby', margin + 2, margin + 8);
  doc.setFont('times', 'normal');
  doc.setFontSize(7);
  doc.text('Timeless Elegance, Crafted for You', margin + 2, margin + 12);

  // E-Kart Logistics Info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('E-Kart Logistics', width - margin - 2, margin + 6, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }), width - margin - 2, margin + 11, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PREPAID', width - margin - 2, margin + 17, { align: 'right' });

  // Divider
  doc.line(2, 25, width - 2, 25);
  doc.line(width / 2 + 5, 2, width / 2 + 5, 25); // Vertical split in header

  // QR Code Generation
  const qrData = JSON.stringify({
    orderId: order.orderId,
    customer: order.address?.name,
    email: order.address?.email || order.email || order.customerEmail,
    address: `${order.address?.address}, ${order.address?.city}, ${order.address?.state} - ${order.address?.pincode}`,
    courier: 'E-Kart Logistics',
    tracking: order.trackingNumber || 'FMPC170203456789'
  });

  const qrUrl = await QRCode.toDataURL(qrData);
  doc.addImage(qrUrl, 'PNG', width - 40, 28, 35, 35);

  // Shipping Address Section
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Shipping/Customer Address:', margin + 2, 32);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(order.address?.name || 'Customer Name', margin + 2, 38);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const addressLines = doc.splitTextToSize(`${order.address?.address || 'N/A'}, ${order.address?.city || ''}, ${order.address?.state || ''} - ${order.address?.pincode || ''}\nIndia`, 50);
  doc.text(addressLines, margin + 2, 44);
  
  doc.setFont('helvetica', 'bold');
  doc.text(`Phone: +91 ${order.address?.phone || order.address?.number || 'N/A'}`, margin + 2, 60);

  // Barcode Section Border
  doc.line(2, 65, width - 2, 65);
  doc.text('Seller Name:', margin + 2, 69);
  doc.setFont('helvetica', 'bold');
  doc.text('Thr Ruby', margin + 2, 73);
  doc.line(2, 75, width - 2, 75);

  // Tracking Barcode #1 (Middle)
  const trackingNumber = order.trackingNumber || 'FMPC170203456789';
  const barcodeCanvas1 = document.createElement('canvas');
  try {
    JsBarcode(barcodeCanvas1, trackingNumber, {
      format: "CODE128",
      displayValue: false,
      margin: 0,
      height: 40
    });
    const barcode1Url = barcodeCanvas1.toDataURL('image/png');
    doc.addImage(barcode1Url, 'PNG', margin + 2, 78, 55, 18);
    doc.setFontSize(8);
    doc.text(trackingNumber, margin + 25, 99, { align: 'center' });
  } catch (e) {
    console.error('Barcode generation error', e);
  }

  // Tracking ID / Order ID text
  doc.line(65, 75, 65, 103); // Vertical sep for barcode
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Tracking ID:', 67, 80);
  doc.setFont('helvetica', 'bold');
  doc.text(trackingNumber, 67, 84);
  
  doc.setFont('helvetica', 'normal');
  doc.text('Order ID:', 67, 91);
  doc.setFont('helvetica', 'bold');
  doc.text(order.orderId || 'ORD42851', 67, 95);

  // Handover Section
  doc.line(2, 103, width - 2, 103);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Handover to E-Kart Logistics', margin + 2, 109);
  doc.rect(width - 25, 105, 20, 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('REG', width - 15, 111, { align: 'center' });

  // Bottom Section
  doc.line(2, 115, width - 2, 115);
  doc.line(width / 2 + 5, 115, width / 2 + 5, 138); // Vertical sep

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('E-Kart Logistics - Surface', margin + 2, 121);
  doc.setFont('helvetica', 'normal');
  doc.text(`Delivery By: ${new Date(Date.now() + 7*24*60*60*1000).toLocaleDateString('en-GB')}`, margin + 2, 127);

  doc.setFont('helvetica', 'bold');
  doc.text('Pickup From:', width / 2 + 7, 120);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  const pickupAddr = [
    'Thr Ruby',
    'D-12, First Floor, Sector-7',
    'Noida, Gautam Buddha Nagar',
    'Uttar Pradesh - 201301',
    'India',
    'Phone: +91 98765 43210'
  ];
  pickupAddr.forEach((line, i) => {
    doc.text(line, width / 2 + 7, 123 + (i * 2.5));
  });

  // Sorting Barcode #2 (Bottom)
  doc.line(2, 138, width - 2, 138);
  const sortingCode = `SORT-${order.address?.pincode || '123456'}`;
  const barcodeCanvas2 = document.createElement('canvas');
  try {
    JsBarcode(barcodeCanvas2, sortingCode, {
      format: "CODE128",
      displayValue: false,
      margin: 0,
      height: 30
    });
    const barcode2Url = barcodeCanvas2.toDataURL('image/png');
    doc.addImage(barcode2Url, 'PNG', margin + 2, 140, 70, 10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('(N) DEL/DEL', width - margin - 2, 146, { align: 'right' });
  } catch (e) {
    console.error('Barcode 2 generation error', e);
  }

  // Save
  doc.save(`Shipping_Label_${order.orderId}.pdf`);
};
