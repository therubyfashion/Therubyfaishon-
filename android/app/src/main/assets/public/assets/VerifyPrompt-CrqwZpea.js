import{b as M,A as W,r as d,f as O,t as i,j as e,m as _,I as q,g as N,c as v,d as f,i as C,h as D,D as R}from"./index-Cqii6WX9.js";import{A as G}from"./arrow-left-C-Nqq5pb.js";import{C as J}from"./circle-alert-CKvIQLcq.js";import{M as K}from"./mail-CgBDJkME.js";import{R as F}from"./refresh-cw-B7kzvrnb.js";import{C as Q}from"./circle-check-D-5X0Yfb.js";function re(){const x=M(),k=W(),[A,y]=d.useState(!1),[P,b]=d.useState(!1),[h,$]=d.useState(null),[w,E]=d.useState(""),[m,B]=d.useState(""),[g,S]=d.useState(["","","","","",""]),[T,V]=d.useState(null);d.useEffect(()=>{const s=new URLSearchParams(k.search),o=s.get("email"),t=s.get("uid"),n=s.get("message");o&&E(o),t&&B(t),n&&V(n),(async()=>{try{const l=await N(v(f,"settings"));l.empty||$(l.docs[0].data())}catch(l){l.code==="resource-exhausted"?console.warn("VerifyPrompt: Firestore quota exceeded."):console.error("Error fetching settings:",l)}})();const r=O.onAuthStateChanged(l=>{!l&&t&&(i.error("Please sign in to verify your email."),x("/login"))});return()=>r()},[k,x]);const U=(s,o)=>{if(o.length>1&&(o=o.slice(-1)),!/^\d*$/.test(o))return;const t=[...g];if(t[s]=o,S(t),o&&s<5){const n=document.getElementById(`otp-${s+1}`);n==null||n.focus()}},I=(s,o)=>{if(o.key==="Backspace"&&!g[s]&&s>0){const t=document.getElementById(`otp-${s-1}`);t==null||t.focus()}},L=async()=>{var o;const s=g.join("");if(s.length!==6){i.error("Please enter the full 6-digit code.");return}b(!0);try{const t=h?Promise.resolve(h):N(v(f,"settings")).then(p=>p.empty?null:p.docs[0].data()),n=C(f,"users",m),a=D(n),[r,l]=await Promise.all([t,a]);if(!l.exists()){i.error("User not found."),b(!1);return}const c=l.data();if(c.emailOtp===s){await R(n,{isVerified:!0,emailOtp:null});const p=`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to ${(r==null?void 0:r.storeName)||"The Ruby"}</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap" rel="stylesheet">
          </head>
          <body style="margin: 0; padding: 0; background-color: #FAFAFA; font-family: 'Inter', sans-serif;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
              <tr>
                <td align="center" style="padding: 60px 0;">
                  <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 32px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.05); border: 1px solid #F1F5F9;">
                    <!-- Brand Header -->
                    <tr>
                      <td align="center" style="padding: 50px 40px 30px 40px; background: linear-gradient(to bottom, #FFF1F2 0%, #ffffff 100%);">
                        ${r!=null&&r.storeLogo?`<img src="${r.storeLogo}" alt="${r.storeName}" style="max-height: 60px; display: block;">`:'<h1 style="margin: 0; color: #1A2C54; font-size: 32px; font-weight: 800; letter-spacing: -1.5px; text-transform: uppercase;">THE <span style="color: #E11D48; font-style: italic;">RUBY</span></h1>'}
                      </td>
                    </tr>
                    
                    <!-- Hero Section -->
                    <tr>
                      <td style="padding: 20px 60px 40px 60px; text-align: center;">
                        <div style="font-size: 50px; margin-bottom: 20px;">🎉</div>
                        <h2 style="margin: 0 0 16px 0; color: #1A2C54; font-size: 28px; font-weight: 700; line-height: 1.2;">You're In, ${c.firstName||"Gorgeous"}!</h2>
                        <p style="margin: 0; color: #64748B; font-size: 16px; line-height: 1.6;">Your account is now verified. Get ready to explore the most curated fashion collections designed just for you.</p>
                      </td>
                    </tr>

                    <!-- Action Button -->
                    <tr>
                      <td align="center" style="padding: 0 60px 50px 60px;">
                        <a href="${window.location.origin}" style="display: inline-block; background-color: #1A2C54; color: #ffffff; padding: 20px 45px; border-radius: 18px; text-decoration: none; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; box-shadow: 0 10px 25px rgba(26,44,84,0.2);">Start Shopping Now</a>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="padding: 50px 60px; background-color: #1A2C54; text-align: center;">
                        <p style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 600;">Welcome to the Family!</p>
                        <p style="margin: 10px 0 0 0; color: #FB7185; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Team ${(r==null?void 0:r.storeName)||"The Ruby Fashion"}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;await fetch("/api/send-email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:c.email,fromName:(r==null?void 0:r.storeName)||"The Ruby",subject:`Welcome to the Family, ${c.firstName||""}! ✨`,html:p})}),i.success("successfully account created 🎉",{position:"bottom-center",duration:5e3}),setTimeout(()=>{try{fetch("/api/send-user-push",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:m,title:"Welcome to the Family! ✨",body:`Hi ${c.firstName||"Gorgeous"}, we're so glad you're here!`,url:"/"})})}catch(u){console.error("Welcome push error:",u)}},3e3),x("/")}else i.error("Invalid verification code. Please try again.")}catch(t){console.error("Verification error:",t),t.code==="not-found"||(o=t.message)!=null&&o.includes("5 NOT_FOUND")?i.error("Bhai, Database abhi ready ho raha hai. 2-3 minute baad dobara try karein! 💎",{duration:6e3}):i.error("Failed to verify code.")}finally{b(!1)}},H=async()=>{var s,o;if(!w||!m){i.error("Missing user information. Please try signing up again.");return}y(!0);try{const t=h?Promise.resolve(h):N(v(f,"settings")).then(z=>z.empty?null:z.docs[0].data()),n=D(C(f,"users",m)),[a,r]=await Promise.all([t,n]);if(!r.exists()){i.error("User not found."),y(!1);return}const l=r.data(),c=Math.floor(1e5+Math.random()*9e5).toString();await R(C(f,"users",m),{emailOtp:c});const p=`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your Verification Code</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.05);">
                  <!-- Header -->
                  <tr>
                    <td align="center" style="padding: 40px 40px 20px 40px;">
                      ${a!=null&&a.storeLogo?`<img src="${a.storeLogo}" alt="${a.storeName}" style="max-height: 50px; display: block;">`:`<h1 style="margin: 0; color: #E11D48; font-size: 28px; font-weight: 800; letter-spacing: -1px; text-transform: uppercase;">${(a==null?void 0:a.storeName)||"THE RUBY"}</h1>`}
                    </td>
                  </tr>
                  
                  <!-- Hero Icon -->
                  <tr>
                    <td align="center" style="padding: 20px 40px;">
                      <div style="width: 80px; height: 80px; background-color: #FFF1F2; border-radius: 24px; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                        <span style="font-size: 40px; line-height: 80px;">🔐</span>
                      </div>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 20px 60px 40px 60px; text-align: center;">
                      <h2 style="margin: 0 0 16px 0; color: #1A2C54; font-size: 24px; font-weight: 700; line-height: 1.2;">New Verification Code</h2>
                      <p style="margin: 0; color: #64748B; font-size: 16px; line-height: 1.6;">You requested a new code. Use the code below to verify your email address.</p>
                    </td>
                  </tr>

                  <!-- OTP Box -->
                  <tr>
                    <td align="center" style="padding: 0 60px 40px 60px;">
                      <div style="background-color: #F8FAFC; border-radius: 16px; padding: 30px; border: 2px solid #F1F5F9; display: inline-block;">
                        <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #1A2C54; font-family: 'Courier New', Courier, monospace;">${c}</span>
                      </div>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 40px 60px; background-color: #1A2C54; text-align: center;">
                      <p style="margin: 0 0 8px 0; color: #ffffff; font-size: 14px; font-weight: 600;">This code will expire in 10 minutes.</p>
                      <p style="margin: 0; color: #FB7185; font-size: 12px; font-weight: 700;">Team ${(a==null?void 0:a.storeName)||"The Ruby"}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,u=await fetch("/api/send-email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:w,fromName:(a==null?void 0:a.storeName)||"The Ruby",subject:`${c} is your new verification code ✨`,html:p})}),j=await u.json();if(!u.ok)throw(s=j.error)!=null&&s.includes("Bhai")?new Error(j.error):new Error(j.error||"Failed to resend code");i.success("New verification code sent!")}catch(t){console.error("Resend error:",t),t.code==="not-found"||(o=t.message)!=null&&o.includes("5 NOT_FOUND")?i.error("Bhai, Database abhi ready ho raha hai. Thodi der mein dobara try karein! 💎",{duration:6e3}):i.error(t.message||"Failed to resend code.")}finally{y(!1)}},Y=async()=>{try{await O.signOut(),x("/login")}catch(s){console.error("Logout error:",s)}};return e.jsxs("div",{className:"min-h-screen flex items-center justify-center px-4 bg-[#FAFAFA] py-12 relative overflow-hidden",children:[e.jsxs("div",{className:"absolute top-0 left-0 w-full h-full pointer-events-none",children:[e.jsx("div",{className:"absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-ruby/5 rounded-full blur-[120px]"}),e.jsx("div",{className:"absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-ruby/5 rounded-full blur-[120px]"})]}),e.jsxs(_.div,{initial:{opacity:0,y:30},animate:{opacity:1,y:0},className:"max-w-md w-full bg-white p-8 md:p-12 rounded-[2.5rem] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.08)] border border-gray-50 relative z-10 text-center flex flex-col items-center",children:[e.jsx("button",{onClick:Y,className:"absolute top-6 left-6 p-2 rounded-xl text-gray-400 hover:text-ruby hover:bg-ruby/5 transition-all outline-none",title:"Go back and change email",children:e.jsx(G,{size:20})}),T&&e.jsxs("div",{className:"w-full mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex flex-col items-start gap-2 text-left",children:[e.jsxs("div",{className:"flex items-center gap-2 text-red-600",children:[e.jsx(J,{size:18}),e.jsx("span",{className:"text-xs font-black uppercase tracking-wider",children:"Configuration Required"})]}),e.jsxs("p",{className:"text-[11px] font-bold text-red-500 leading-relaxed",children:[T,e.jsx("br",{}),e.jsx("span",{className:"text-[#1A2C54] mt-1 block opacity-80",children:"Check Admin Panel → Settings → Resend API Key."})]})]}),e.jsx("div",{className:"mb-8",children:e.jsx("div",{className:"w-20 h-20 bg-ruby/10 text-ruby rounded-3xl flex items-center justify-center mx-auto",children:e.jsx(K,{size:40})})}),e.jsxs("div",{className:"space-y-4 mb-10",children:[e.jsxs("h1",{className:"text-3xl font-serif font-bold tracking-tight text-[#1A2C54]",children:["Verify Your ",e.jsx("span",{className:"text-ruby italic",children:"Email"})]}),e.jsxs("p",{className:"text-sm text-gray-400 font-medium leading-relaxed",children:["We've sent a 6-digit code to ",e.jsx("span",{className:"text-[#1A2C54] font-bold",children:w}),". Enter it below to activate your account."]})]}),e.jsx("div",{className:"flex justify-center gap-2 mb-10",children:g.map((s,o)=>e.jsx("input",{id:`otp-${o}`,type:"text",maxLength:1,value:s,onChange:t=>U(o,t.target.value),onKeyDown:t=>I(o,t),className:"w-12 h-14 text-center text-xl font-bold bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-ruby/20 focus:border-ruby transition-all"},o))}),e.jsxs("div",{className:"space-y-4",children:[e.jsx("button",{onClick:L,disabled:P,className:"w-full bg-[#1A2C54] text-white py-5 rounded-2xl text-sm font-bold uppercase tracking-[0.2em] hover:bg-ruby transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-[#1A2C54]/10 flex items-center justify-center gap-3 disabled:opacity-50",children:P?e.jsx(F,{size:18,className:"animate-spin"}):e.jsxs(e.Fragment,{children:["Verify Code",e.jsx(Q,{size:18})]})}),e.jsx("button",{onClick:H,disabled:A,className:"w-full bg-white border border-gray-100 text-[#1A2C54] py-5 rounded-2xl text-sm font-bold uppercase tracking-[0.2em] hover:bg-gray-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50",children:A?e.jsx(F,{size:18,className:"animate-spin"}):e.jsxs(e.Fragment,{children:["Resend Code",e.jsx(F,{size:18})]})})]}),e.jsx("div",{className:"pt-8",children:e.jsxs("p",{className:"text-[10px] text-gray-300 uppercase tracking-[0.3em] font-bold flex items-center justify-center gap-2",children:[e.jsx(q,{size:12,className:"text-ruby"}),"The Ruby Premium Experience"]})})]})]})}export{re as default};
