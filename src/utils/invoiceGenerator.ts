import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateInvoice = (order: any, settings?: any) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Background Accent
  doc.setFillColor(253, 253, 253);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  // Header Section with Ruby Background
  doc.setFillColor(225, 29, 72); // Ruby color
  doc.rect(0, 0, pageWidth, 60, 'F');

  // Logo & Store Name
  if (settings?.storeLogo) {
    try {
      // Note: This assumes storeLogo is a base64 string or a valid URL that jsPDF can handle.
      // For simplicity, we'll just use text if it fails or if it's not a base64.
      doc.addImage(settings.storeLogo, 'PNG', 20, 15, 30, 30);
    } catch (e) {
      doc.setFontSize(28);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(settings.storeName?.toUpperCase() || 'THE RUBY', 20, 35);
    }
  } else {
    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(settings?.storeName?.toUpperCase() || 'THE RUBY', 20, 35);
  }
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(settings?.siteTitle?.toUpperCase() || 'PREMIUM FASHION STORE', 20, 42);
  
  // Invoice Label
  doc.setFontSize(40);
  doc.setTextColor(255, 255, 255, 0.1); // Very light white for background text
  doc.text('INVOICE', pageWidth - 20, 45, { align: 'right' });

  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', pageWidth - 20, 35, { align: 'right' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const displayOrderId = order.orderId?.startsWith('#') ? order.orderId : `#${order.orderId}`;
  doc.text(displayOrderId, pageWidth - 20, 42, { align: 'right' });

  // Content Container
  const startY = 75;
  
  // Bill To & Order Info
  doc.setTextColor(26, 44, 84); // #1A2C54
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', 20, startY);
  doc.text('ORDER DETAILS', pageWidth / 2, startY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(order.address?.name || 'Guest Customer', 20, startY + 7);
  doc.text(`${order.address?.address}`, 20, startY + 13, { maxWidth: 70 });
  doc.text(`${order.address?.city}, ${order.address?.state} - ${order.address?.pincode}`, 20, startY + 23);

  doc.text(`Date: ${new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageWidth / 2, startY + 7);
  doc.text(`Payment: ${order.paymentMethod || 'Online'}`, pageWidth / 2, startY + 13);
  doc.text(`Status: Confirmed`, pageWidth / 2, startY + 19);

  // Items Table
  const tableData = order.items.map((item: any) => [
    {
      content: item.name + (item.selectedSize ? ` (Size: ${item.selectedSize})` : ''),
      styles: { fontStyle: 'bold' }
    },
    item.sku || '-',
    item.barcode || '-',
    `Rs. ${item.price.toLocaleString()}`,
    item.quantity,
    `Rs. ${(item.price * item.quantity).toLocaleString()}`
  ]);

  autoTable(doc, {
    startY: startY + 35,
    head: [['ITEM', 'SKU', 'BARCODE', 'PRICE', 'QTY', 'TOTAL']],
    body: tableData,
    headStyles: { 
      fillColor: [26, 44, 84], 
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      cellPadding: 5
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 5,
      textColor: [50, 50, 50]
    },
    alternateRowStyles: { 
      fillColor: [250, 250, 250] 
    },
    margin: { left: 20, right: 20 },
    theme: 'striped'
  });

  const finalY = ((doc as any).lastAutoTable?.finalY || (startY + 100)) + 15;

  // Totals Section
  const totalX = pageWidth - 20;
  doc.setFontSize(10);
  doc.setTextColor(100);
  
  doc.text('Subtotal:', totalX - 40, finalY);
  doc.text(`Rs. ${order.subtotal?.toLocaleString() || order.total?.toLocaleString()}`, totalX, finalY, { align: 'right' });
  
  if (order.discount > 0) {
    doc.setTextColor(225, 29, 72);
    doc.text('Discount:', totalX - 40, finalY + 8);
    doc.text(`-Rs. ${order.discount.toLocaleString()}`, totalX, finalY + 8, { align: 'right' });
  }
  
  doc.setTextColor(100);
  doc.text('Shipping:', totalX - 40, finalY + 16);
  doc.text(order.shippingCost === 0 ? 'FREE' : `Rs. ${order.shippingCost}`, totalX, finalY + 16, { align: 'right' });
  
  // Final Total Box
  doc.setFillColor(225, 29, 72);
  doc.rect(totalX - 60, finalY + 22, 60, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL PAID', totalX - 55, finalY + 30);
  doc.text(`Rs. ${order.total.toLocaleString()}`, totalX - 5, finalY + 30, { align: 'right' });

  // Footer / Thank You Note
  const footerY = pageHeight - 40;
  
  doc.setDrawColor(240);
  doc.line(20, footerY, pageWidth - 20, footerY);
  
  doc.setFontSize(14);
  doc.setTextColor(225, 29, 72);
  doc.setFont('helvetica', 'bold');
  doc.text('Thank You for your purchase!', pageWidth / 2, footerY + 15, { align: 'center' });
  
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.setFont('helvetica', 'normal');
  doc.text('This is a computer generated invoice. No signature required.', pageWidth / 2, footerY + 25, { align: 'center' });
  doc.text('www.theruby.com | support@theruby.com', pageWidth / 2, footerY + 30, { align: 'center' });

  // Save
  doc.save(`Invoice_${order.orderId}.pdf`);
};
