import fetch from 'node-fetch';

async function main() {
  const emailHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1C1917; line-height: 1.5;">
              <!-- Header -->
              <div style="display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 1px solid #E5E7EB; padding-bottom: 15px;">
                <span style="font-size: 16px; font-weight: 600; color: #1A2C54;">Order #TRF0030</span>
                <span style="font-size: 16px; font-weight: 600; color: #E11D48; text-transform: lowercase;">confirmed</span>
              </div>

              <!-- Main Message -->
              <div style="margin-bottom: 35px;">
                <h1 style="font-size: 22px; font-weight: 700; color: #1A2C54; margin: 0 0 12px 0;">Thank you for your purchase!</h1>
                <p style="font-size: 15px; color: #4B5563; margin: 0;">We're getting your order ready to be shipped. We will notify you when it has been sent.</p>
              </div>

              <!-- Action Buttons -->
              <div style="margin-bottom: 45px; text-align: center;">
                <a href="https://example.com/track/TRF0030" 
                   style="display: inline-block; background-color: #E11D48; color: #FFFFFF; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-size: 15px; font-weight: 600; text-align: center; margin-bottom: 12px; transition: background-color 0.2s;">
                  Track Your Order
                </a>
              </div>

              <!-- Order Summary Table (Safe across all clients including Gmail & Outlook) -->
              <div style="border-top: 1px solid #E5E7EB; padding-top: 30px;">
                <h2 style="font-size: 16px; font-weight: 700; color: #1A2C54; margin: 0 0 20px 0; text-transform: uppercase; letter-spacing: 0.5px;">Order summary</h2>
                
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 25px;">
                  <tr style="border-bottom: 1px solid #F3F4F6;">
                    <td style="padding: 10px 0; width: 65px; vertical-align: top;">
                      <div style="width: 55px; height: 55px; background-color: #F3F4F6; overflow: hidden; border-radius: 6px; border: 1px solid #E5E7EB;">
                        <img src="https://images.unsplash.com/photo-1614732414444-096e5f1122d5" alt="Product" style="width: 100%; height: 100%; object-fit: cover;">
                      </div>
                    </td>
                    <td style="padding: 10px 10px; vertical-align: top; text-align: left;">
                      <p style="font-size: 14px; font-weight: 600; color: #1C1917; margin: 0;">Sample Ruby Dress &times; 1</p>
                      <p style="font-size: 12px; color: #6B7280; margin: 4px 0 0 0;">Size: M | Color: Red</p>
                    </td>
                    <td style="padding: 10px 0; vertical-align: top; text-align: right; width: 85px;">
                      <p style="font-size: 14px; font-weight: 600; color: #1C1917; margin: 0;">₹499</p>
                    </td>
                  </tr>
                </table>

                <!-- Totals -->
                <div style="border-top: 1px solid #E5E7EB; padding-top: 20px;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="font-size: 14px; color: #4B5563; padding: 5px 0;">Subtotal</td>
                      <td style="font-size: 14px; font-weight: 600; color: #1C1917; text-align: right; padding: 5px 0;">₹499</td>
                    </tr>
                    <tr>
                      <td style="font-size: 16px; font-weight: 700; color: #1A2C54; padding: 15px 0 0 0; border-top: 1px solid #E5E7EB; margin-top: 15px;">Total</td>
                      <td style="font-size: 20px; font-weight: 700; color: #E11D48; text-align: right; padding: 15px 0 0 0; border-top: 1px solid #E5E7EB; margin-top: 15px;">₹529</td>
                    </tr>
                  </table>
                </div>
              </div>
            </div>`;

  const payload = {
    to: "mdsagaransari65670@gmail.com",
    subject: "Test Order Confirmed - TRF0030",
    html: emailHtml,
    fromName: "The Ruby Fashion Test"
  };

  try {
    console.log("Calling local /api/send-email with complex order HTML...");
    const res = await fetch("http://localhost:3000/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    console.log(`Status: ${res.status}`);
    const data = await res.text();
    console.log("Response body:");
    console.log(data);
  } catch (err) {
    console.error("Failed to connect to local server:", err.message);
  }
}

main();
