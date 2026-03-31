const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { amount, currency, name, email, property, checkin, checkout, guests, addons } = JSON.parse(event.body);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency || 'cad',
      receipt_email: email,
      metadata: {
        guest_name: name,
        guest_email: email,
        property: property,
        checkin: checkin,
        checkout: checkout,
        guests: guests,
        addons: addons || 'None',
      },
    });

    // Send email notification to host
    try {
      await sendBookingEmail({ name, email, property, checkin, checkout, guests, addons, amount });
    } catch (emailErr) {
      console.error('Email send failed:', emailErr);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientSecret: paymentIntent.client_secret }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};

async function sendBookingEmail({ name, email, property, checkin, checkout, guests, addons, amount }) {
  const mat = amount * 0.06;
  const hst = amount * 0.13;
  const total = amount + mat + hst;

  const formatDate = (d) => {
    if (!d) return '-';
    const [y, m, day] = d.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[parseInt(m)-1] + ' ' + parseInt(day) + ', ' + y;
  };

  const fmt = (n) => '$' + n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const htmlBody = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px;"><div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1);"><div style="background:#1a1a1a;padding:32px 36px;"><div style="font-family:Georgia,serif;color:#c9a84c;font-size:1.3rem;margin-bottom:4px;">Windsor Executive Rentals</div><div style="color:#888;font-size:.85rem;">New Booking Notification</div></div><div style="padding:36px;"><h2 style="color:#1a1a1a;font-family:Georgia,serif;font-size:1.5rem;margin:0 0 6px;">New Booking Confirmed!</h2><p style="color:#666;margin:0 0 28px;font-size:.9rem;">A new direct booking has just been paid and confirmed.</p><table style="width:100%;border-collapse:collapse;margin-bottom:28px;"><tr style="background:#f9f7f4;"><td style="padding:12px 16px;font-size:.82rem;font-weight:700;color:#888;text-transform:uppercase;width:140px;">Guest</td><td style="padding:12px 16px;color:#1a1a1a;font-weight:600;">${name}</td></tr><tr><td style="padding:12px 16px;font-size:.82rem;font-weight:700;color:#888;text-transform:uppercase;">Email</td><td style="padding:12px 16px;color:#1a1a1a;">${email}</td></tr><tr style="background:#f9f7f4;"><td style="padding:12px 16px;font-size:.82rem;font-weight:700;color:#888;text-transform:uppercase;">Property</td><td style="padding:12px 16px;color:#1a1a1a;">${property}</td></tr><tr><td style="padding:12px 16px;font-size:.82rem;font-weight:700;color:#888;text-transform:uppercase;">Check-in</td><td style="padding:12px 16px;color:#1a1a1a;">${formatDate(checkin)}</td></tr><tr style="background:#f9f7f4;"><td style="padding:12px 16px;font-size:.82rem;font-weight:700;color:#888;text-transform:uppercase;">Check-out</td><td style="padding:12px 16px;color:#1a1a1a;">${formatDate(checkout)}</td></tr><tr><td style="padding:12px 16px;font-size:.82rem;font-weight:700;color:#888;text-transform:uppercase;">Guests</td><td style="padding:12px 16px;color:#1a1a1a;">${guests}</td></tr>${addons && addons !== 'None' ? '<tr style="background:#f9f7f4;"><td style="padding:12px 16px;font-size:.82rem;font-weight:700;color:#888;text-transform:uppercase;">Add-ons</td><td style="padding:12px 16px;color:#1a1a1a;">' + addons + '</td></tr>' : ''}</table><div style="background:#f9f7f4;border-radius:8px;padding:20px 24px;border-left:4px solid #c9a84c;"><div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="color:#666;font-size:.88rem;">Accommodation subtotal</span><span style="color:#1a1a1a;font-size:.88rem;">${fmt(amount)}</span></div><div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="color:#666;font-size:.88rem;">Windsor MAT (6%)</span><span style="color:#1a1a1a;font-size:.88rem;">${fmt(mat)}</span></div><div style="display:flex;justify-content:space-between;margin-bottom:12px;"><span style="color:#666;font-size:.88rem;">Ontario HST (13%)</span><span style="color:#1a1a1a;font-size:.88rem;">${fmt(hst)}</span></div><div style="border-top:1px solid #e0d9cc;padding-top:12px;display:flex;justify-content:space-between;"><span style="color:#1a1a1a;font-weight:700;font-size:1rem;">Total Paid</span><span style="color:#c9a84c;font-weight:700;font-size:1.1rem;">${fmt(total)}</span></div></div><p style="color:#888;font-size:.8rem;margin-top:24px;line-height:1.6;">Follow up with the guest to send check-in instructions!</p></div><div style="background:#1a1a1a;padding:20px 36px;text-align:center;"><div style="color:#666;font-size:.78rem;">Windsor Executive Rentals · jaworskibnb@gmail.com · (647) 470-7333</div></div></div></body></html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Windsor Executive Rentals <onboarding@resend.dev>',
      to: ['jaworskibnb@gmail.com'],
      subject: 'New Booking - ' + property + ' - ' + formatDate(checkin) + ' to ' + formatDate(checkout),
      html: htmlBody,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error('Resend API error: ' + err);
  }

  return res.json();
}
