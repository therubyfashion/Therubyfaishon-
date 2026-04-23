import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateInvoice = (order: any, settings?: any) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Settings / Constants
  const rubyColor = [225, 29, 72]; // RGB for Ruby
  const darkNavy = [26, 44, 84]; // #1A2C54
  const margin = 15;
  
  // Header Section
  // Logo
  if (settings?.storeLogo) {
    try {
      doc.addImage(settings.storeLogo, 'PNG', margin, margin, 20, 20);
    } catch (e) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(rubyColor[0], rubyColor[1], rubyColor[2]);
      doc.text('Thr Ruby', margin, margin + 12);
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(rubyColor[0], rubyColor[1], rubyColor[2]);
    doc.text('Thr Ruby', margin, margin + 12);
  }

  // Tagline under logo
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text('Timeless Elegance, Crafted for You', margin, margin + 25);

  // Right Side: Tax Invoice
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(0);
  doc.text('Tax Invoice', pageWidth - margin, margin + 12, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('(ORIGINAL FOR RECIPIENT)', pageWidth - margin, margin + 18, { align: 'right' });

  // Divider Line
  doc.setDrawColor(240);
  doc.line(margin, margin + 35, pageWidth - margin, margin + 35);

  // Sold By & Billing Address Columns
  const colY = margin + 45;
  const colWidth = (pageWidth - (margin * 2)) / 2;

  // Sold By
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('Sold By :', margin, colY);
  
  doc.setFontSize(11);
  doc.text(settings?.storeName || 'Thr Ruby', margin, colY + 10);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80);
  const addressLines = [
    settings?.footerContact?.address || 'D-12, First Floor, Sector-7',
    'Noida, Gautam Buddha Nagar',
    'Uttar Pradesh - 201301, India',
    `Phone: ${settings?.footerContact?.phone || '+91 98765 43210'}`,
    `GSTIN: ${settings?.razorpayKeyId ? '09ABCDE1234F1Z5' : 'NOT PROVIDED'}`
  ];
  addressLines.forEach((line, i) => {
    doc.text(line, margin, colY + 18 + (i * 6));
  });

  // Vertical Separator
  doc.setDrawColor(220);
  doc.line(pageWidth / 2, colY, pageWidth / 2, colY + 50);

  // Billing Address
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('Billing Address :', pageWidth / 2 + 10, colY);
  
  doc.setFontSize(11);
  doc.text(order.address?.name || 'Customer Name', pageWidth / 2 + 10, colY + 10);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80);
  const billLines = [
    order.address?.address || 'N/A',
    `${order.address?.city || ''} ${order.address?.state || ''}`,
    `${order.address?.pincode || ''}`,
    'India',
    `Phone: ${order.address?.phone || order.address?.number || 'N/A'}`
  ];
  billLines.forEach((line, i) => {
    doc.text(line, pageWidth / 2 + 10, colY + 18 + (i * 6));
  });

  // Highlight Box for Order Stats
  const statsY = colY + 60;
  doc.setFillColor(252, 252, 252);
  doc.rect(margin, statsY, pageWidth - (margin * 2), 22, 'F');
  doc.setDrawColor(240);
  doc.rect(margin, statsY, pageWidth - (margin * 2), 22, 'S');

  const statsWidth = (pageWidth - (margin * 2)) / 4;
  const statsLabels = ['Order ID', 'Order Date', 'Invoice No.', 'Invoice Date'];
  const formattedDate = new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN');
  const orderId = order.orderId?.replace('#', '') || 'ORD42851';
  const statsValues = [orderId, formattedDate, `INV-TR-${orderId.substring(0, 6)}`, formattedDate];

  statsLabels.forEach((label, i) => {
    const x = margin + (i * statsWidth) + 12;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(150);
    doc.text(label, x, statsY + 8);
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text(statsValues[i], x, statsY + 16);
  });

  // Product Table
  const tableData = order.items.map((item: any) => [
    {
      content: item.name + (item.selectedSize ? `\nSize: ${item.selectedSize}` : '') + `\nSKU: ${item.sku || 'N/A'}`,
      styles: { fontSize: 9 }
    },
    '85183000', // HSN Dummy or if available
    item.quantity,
    `Rs. ${item.price.toLocaleString()}`,
    `Rs. ${(item.price * item.quantity).toLocaleString()}`
  ]);

  autoTable(doc, {
    startY: statsY + 35,
    head: [['Product', 'HSN / SAC', 'Qty', 'Unit Price', 'Total Price']],
    body: tableData,
    headStyles: {
      fillColor: [248, 249, 250],
      textColor: [0, 0, 0],
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 6,
      lineWidth: 0.1,
      lineColor: [230, 230, 230]
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 8,
      textColor: [40, 40, 40],
      halign: 'center',
      lineWidth: 0.1,
      lineColor: [240, 240, 240]
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 80 }
    },
    theme: 'grid'
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Totals Section
  const totalsX = pageWidth - margin;
  doc.setFontSize(10);
  doc.setTextColor(80);
  
  const drawRow = (label: string, value: string, y: number, isLast = false) => {
    doc.setFont('helvetica', isLast ? 'bold' : 'normal');
    if (isLast) {
      doc.setFillColor(252, 252, 252);
      doc.rect(totalsX - 80, y - 6, 80, 10, 'F');
      doc.setTextColor(0);
    }
    doc.text(label, totalsX - 80, y);
    doc.text(value, totalsX, y, { align: 'right' });
  };

  let currentY = finalY;
  drawRow('Subtotal', `Rs. ${order.subtotal?.toLocaleString() || order.total?.toLocaleString()}`, currentY);
  currentY += 8;
  drawRow('Shipping Charges', `Rs. ${order.shippingCost || 40}`, currentY);
  currentY += 8;
  if (order.discount > 0) {
    drawRow('Shipping Charges Discount', `-Rs. ${order.discount.toLocaleString()}`, currentY);
    currentY += 8;
  }
  
  doc.setDrawColor(240);
  doc.line(totalsX - 80, currentY, totalsX, currentY);
  currentY += 10;
  
  drawRow('Total Amount', `Rs. ${order.total.toLocaleString()}`, currentY);
  currentY += 12;
  
  doc.setFontSize(12);
  drawRow('Grand Total', `Rs. ${order.total.toLocaleString()}`, currentY, true);

  // Amount in words
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('Amount in Words:', margin, finalY + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text('One Thousand Two Hundred Ninety Nine Only', margin, finalY + 18); // This would need a converter lib if real

  // Signature
  const signY = finalY + 45;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(`For ${settings?.storeName || 'Thr Ruby'}`, margin, signY);
  
  // Dummy Signature Placeholder
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(12);
  doc.setTextColor(150);
  doc.text('Authorized Signatory', margin, signY + 15);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text('Authorized Signatory', margin, signY + 30);

  // Footer Section
  const footerY = pageHeight - 50;
  doc.setDrawColor(240);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Registered Office:', margin, footerY + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(settings?.storeName || 'Thr Ruby', margin, footerY + 16);
  doc.text('D-12, First Floor, Sector-7', margin, footerY + 21);
  doc.text('Noida, Gautam Buddha Nagar, Uttar Pradesh - 201301, India', margin, footerY + 26);
  doc.text(`GSTIN: 09ABCDE1234F1Z5`, margin, footerY + 35);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text('Contact Us:', pageWidth / 2 + 20, footerY + 10);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Phone: ${settings?.footerContact?.phone || '+91 98765 43210'}`, pageWidth / 2 + 20, footerY + 18);
  doc.text(`Email: ${settings?.footerContact?.email || 'support@theruby.com'}`, pageWidth / 2 + 20, footerY + 24);
  doc.text(`Website: www.therubyfashion.shop`, pageWidth / 2 + 20, footerY + 30);

  // Bottom Note
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('Thank You!', pageWidth / 2, pageHeight - 15, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('We hope to see you again.', pageWidth / 2, pageHeight - 10, { align: 'center' });

  // Save
  doc.save(`Invoice_${order.orderId}.pdf`);
};
