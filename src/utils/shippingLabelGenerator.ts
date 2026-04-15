import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generateShippingLabel = async (order: any, settings?: any) => {
  const labelElement = document.createElement('div');
  labelElement.style.width = '400px';
  labelElement.style.padding = '20px';
  labelElement.style.background = 'white';
  labelElement.style.color = 'black';
  labelElement.style.fontFamily = 'Arial, sans-serif';
  labelElement.style.border = '1px solid #000';
  labelElement.style.borderRadius = '12px';
  labelElement.style.position = 'absolute';
  labelElement.style.left = '-9999px';
  
  const isCOD = order.paymentMethod === 'Cash on Delivery' || order.paymentMethod === 'COD';
  
  labelElement.innerHTML = `
    <div style="border: 2px solid #000; padding: 15px; border-radius: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 15px;">
        <div style="display: flex; align-items: center; gap: 15px;">
          <div style="width: 50px; height: 50px; border: 3px solid #000; display: flex; items-center; justify-content: center; font-size: 32px; font-weight: 900;">F</div>
          <div>
            <div style="font-weight: 900; font-size: 18px;">Swift Couriers</div>
            <div style="font-size: 12px; color: #666;">Shipping for E-commerce</div>
            <div style="font-size: 14px; font-weight: bold; margin-top: 2px;">${order.orderId?.substring(0, 8) || '82937456'}</div>
            <div style="font-size: 12px; font-weight: bold;">PIN ${order.address?.pincode || '110005'}</div>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="border: 2px solid #000; padding: 4px 8px; font-weight: 900; font-size: 12px; margin-bottom: 10px;">
            ${isCOD ? 'CASH ON DELIVERY' : 'PREPAID'}
          </div>
          <div style="width: 70px; height: 70px; border: 1px solid #000; padding: 2px;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${order.id}" style="width: 100%; height: 100%;" />
          </div>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <div style="font-size: 24px; font-weight: 900; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 5px;">Order ${order.orderId?.startsWith('#') ? order.orderId : `#${order.orderId || '1001'}`}</div>
        
        <div style="margin-bottom: 15px;">
          <div style="font-weight: 900; font-size: 16px; margin-bottom: 5px;">Ship To:</div>
          <div style="font-weight: 900; font-size: 18px;">${order.address?.name || order.customerName}</div>
          <div style="font-size: 14px; line-height: 1.4;">
            ${order.address?.address}<br/>
            ${order.address?.city}, ${order.address?.state} ${order.address?.pincode}<br/>
            India<br/>
            <span style="font-weight: bold; font-size: 16px; margin-top: 5px; display: block;">+91 ${order.address?.number || order.phone}</span>
          </div>
        </div>
      </div>

      <div style="border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 15px 0; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: bold; font-size: 16px;">Order ${order.orderId?.startsWith('#') ? order.orderId : `#${order.orderId || '1001'}`}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 900; font-size: 20px;">${isCOD ? 'COD' : 'PAID'} ₹${order.total?.toLocaleString()}</div>
          <div style="font-size: 12px; color: #666;">${isCOD ? `Collect ₹${order.total?.toLocaleString()} on delivery` : 'No collection required'}</div>
        </div>
      </div>

      <div style="margin-bottom: 20px; font-size: 12px; line-height: 1.4;">
        <div style="font-weight: bold; margin-bottom: 4px;">From:</div>
        <div style="font-weight: bold;">${settings?.storeName || 'The Ruby'}</div>
        <div>${settings?.footerContact?.address || '456 Business Lane, Mumbai, Maharashtra 400001'}</div>
        <div>+91 ${settings?.footerSocials?.whatsapp || '9876543210'}</div>
      </div>

      <div style="border-top: 1px solid #eee; padding-top: 15px; text-align: center;">
        <div style="font-weight: bold; font-size: 12px; margin-bottom: 5px;">${settings?.storeName || 'The Ruby'}</div>
        <div style="font-size: 10px; color: #666;">${settings?.footerContact?.address || '456 Business Lane, Mumbai, Maharashtra 400001'}</div>
        <div style="font-size: 10px; color: #666;">+91 ${settings?.footerSocials?.whatsapp || '9876543210'}</div>
        
        <div style="margin-top: 15px; display: flex; flex-direction: column; align-items: center;">
          <div style="width: 100%; height: 40px; background: repeating-linear-gradient(90deg, #000, #000 2px, transparent 2px, transparent 4px);"></div>
          <div style="font-size: 12px; font-weight: bold; margin-top: 5px;">*${order.orderId || '82937456'} ${order.address?.pincode || '10005'} 0309 3140*</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(labelElement);
  
  try {
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
    document.body.removeChild(labelElement);
  }
};
