import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generateShippingLabel = async (order: any, settings?: any) => {
  const labelElement = document.createElement('div');
  labelElement.style.width = '380px';
  labelElement.style.padding = '24px';
  labelElement.style.background = 'white';
  labelElement.style.color = '#1A2C54';
  labelElement.style.fontFamily = 'Inter, ui-sans-serif, system-ui, sans-serif';
  labelElement.style.border = '1px solid #E5E7EB';
  labelElement.style.borderRadius = '16px';
  labelElement.style.position = 'absolute';
  labelElement.style.left = '-9999px';
  labelElement.style.boxSizing = 'border-box';
  labelElement.style.overflow = 'hidden';
  
  const isCOD = order.paymentMethod === 'Cash on Delivery' || order.paymentMethod === 'COD';
  const trackingNumber = order.trackingNumber || '';
  
  labelElement.innerHTML = `
    <div style="position: relative; padding: 24px; box-sizing: border-box; background: white; height: 100%;">
      <!-- FROM Section -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
        <div style="flex: 1;">
          <p style="font-size: 10px; color: #6B7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 6px 0;">FROM</p>
          <p style="font-size: 16px; font-weight: 800; color: #1A2C54; margin: 0;">${settings?.storeName || 'THE RUBY'}</p>
          <p style="font-size: 11px; color: #4B5563; margin: 4px 0 0 0; line-height: 1.4;">
            ${settings?.footerContact?.address || 'Mumbai, MH 400001'}
          </p>
        </div>
        <div style="width: 50px; height: 50px; background-color: #FFF7ED; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
           <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EA580C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
        </div>
      </div>

      <!-- Divider -->
      <div style="border-top: 1.5px dashed #D1D5DB; margin-bottom: 24px;"></div>

      <!-- TO Section -->
      <div style="margin-bottom: 32px;">
        <p style="font-size: 10px; color: #6B7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px 0;">TO (DELIVERY TO)</p>
        <p style="font-size: 20px; font-weight: 900; color: #1A2C54; text-transform: uppercase; margin: 0 0 8px 0;">${order.address?.name || order.customerName || 'CUSTOMER'}</p>
        <div style="font-size: 13px; color: #4B5563; line-height: 1.6; font-weight: 500;">
          ${order.address?.address || order.shippingAddress?.line1}<br/>
          ${order.address?.landmark ? order.address?.landmark + '<br/>' : ''}
          ${order.address?.city || order.shippingAddress?.city}, ${order.address?.state || order.shippingAddress?.state} – ${order.address?.pincode || '400058'}
        </div>
        <p style="font-size: 14px; font-weight: 800; color: #1A2C54; margin: 12px 0 0 0; display: flex; align-items: center;">
          <span style="font-size: 10px; color: #6B7280; margin-right: 6px;">TEL:</span>
          ${order.address?.phone || order.address?.number || '+91 98765 43210'}
        </p>
      </div>

      <!-- Barcode / Tracking Section -->
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 32px;">
        ${trackingNumber ? `
          <div style="background: white; padding: 10px; border: 1px solid #F3F4F6; border-radius: 8px; margin-bottom: 12px; width: 100%; display: flex; flex-direction: column; align-items: center;">
            <!-- Stylized Barcode Stripes -->
            <div style="width: 280px; height: 75px; background: repeating-linear-gradient(90deg, #1A2C54, #1A2C54 3px, transparent 3px, transparent 5px, #1A2C54 5px, #1A2C54 6px, transparent 6px, transparent 8px); box-sizing: border-box;"></div>
            <p style="font-size: 12px; font-family: 'Courier New', Courier, monospace; font-weight: bold; color: #1A2C54; letter-spacing: 0.5em; text-transform: uppercase; margin: 12px 0 0 0;">${trackingNumber}</p>
          </div>
        ` : `
          <div style="padding: 30px; text-align: center; font-size: 13px; color: #9CA3AF; background-color: #F9FAFB; border: 2px dashed #E5E7EB; border-radius: 16px; width: 100%;">
            <p style="margin: 0; font-weight: 600;">TRACKING DETAILS PENDING</p>
            <p style="margin: 4px 0 0 0; font-size: 11px;">Assign carrier & AWB in dashboard</p>
          </div>
        `}
      </div>

      <!-- Footer Info -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; border-top: 1px solid #F3F4F6; padding-top: 20px;">
        <div>
           <p style="font-size: 11px; color: #6B7280; font-weight: 700; margin: 0;">Order: ${order.orderId || order.id || 'NEW'}</p>
           <p style="font-size: 11px; color: #6B7280; font-weight: 700; margin: 4px 0 0 0;">Date: ${new Date().toLocaleDateString('en-IN')}</p>
        </div>
        <div style="padding: 6px 14px; background-color: ${isCOD ? '#FEF2F2' : '#F0FDF4'}; border-radius: 8px; border: 1px solid ${isCOD ? '#FEE2E2' : '#DCFCE7'}; text-align: right;">
           <p style="font-size: 10px; color: ${isCOD ? '#EF4444' : '#16A34A'}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 2px 0;">Payment</p>
           <p style="font-size: 14px; font-weight: 900; color: ${isCOD ? '#EF4444' : '#16A34A'}; margin: 0;">${isCOD ? 'COD: ₹' + order.total?.toLocaleString() : 'PREPAID'}</p>
        </div>
      </div>

      <!-- Watermark -->
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-15deg); font-size: 48px; font-weight: 900; color: rgba(26, 44, 84, 0.04); white-space: nowrap; pointer-events: none; z-index: 0; text-transform: uppercase;">
        ${settings?.storeName || 'THE RUBY'}
      </div>
    </div>
  `;

  document.body.appendChild(labelElement);
  
  // Workaround for html2canvas failing on modern CSS features like oklch (Tailwind 4)
  const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
  const disabledStyles: (HTMLStyleElement | HTMLLinkElement)[] = [];
  
  try {
    // Temporarily disable style/link tags that might use modern CSS to prevent html2canvas parser from crashing
    styleTags.forEach(tag => {
      let shouldDisable = false;
      if (tag instanceof HTMLStyleElement) {
        if (tag.innerHTML.includes('oklch') || tag.innerHTML.includes('@theme')) {
          shouldDisable = true;
        }
      } else if (tag instanceof HTMLLinkElement) {
        // We can't easily read external CSS, so we disable stylesheets that look like they're from our app
        // or just disable all external sheets to be safe during the capture
        if (tag.href.includes(window.location.origin) || !tag.href.startsWith('http')) {
          shouldDisable = true;
        }
      }

      if (shouldDisable) {
        (tag as HTMLStyleElement | HTMLLinkElement).disabled = true;
        disabledStyles.push(tag as any);
      }
    });

    const canvas = await html2canvas(labelElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [canvas.width / 2, canvas.height / 2]
    });
    
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
    pdf.save(`Shipping_Label_${order.orderId}.pdf`);
  } catch (error) {
    console.error('Error generating shipping label:', error);
  } finally {
    // Re-enable styles
    disabledStyles.forEach(tag => tag.disabled = false);
    document.body.removeChild(labelElement);
  }
};
