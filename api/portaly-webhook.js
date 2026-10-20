// FAIL-CLOSED: Portaly's signed event schema and payment-state verification
// are not confirmed yet. Never grant course access from untrusted webhook JSON.
// Next phase: verify provider signature, event ID (idempotency), paid product IDs,
// and refund / chargeback revocation. Meanwhile issue codes only after manually
// checking the order in Portaly through the protected admin API.
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).end();
  return res.status(503).json({error:'Automatic payment provisioning is not enabled. Verify payment manually.'});
}
