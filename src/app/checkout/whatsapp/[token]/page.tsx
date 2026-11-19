"use client";

import Script from "next/script";
import { copyText } from "@/lib/utils/browser";
import { use, useEffect, useState } from "react";
import styles from "./page.module.scss";

interface CheckoutData {
  business_name?: string;
  provider?: "upi" | "razorpay";
  upi_link?: string | null;
  upi_qr?: string | null;
  upi_id?: string | null;
  payee_name?: string | null;
  upi_reference?: string | null;
  order_id: string;
  provider_order_id?: string | null;
  key_id?: string | null;
  amount: number;
  currency: string;
  status: string;
  expires_at?: string;
  items: { name: string; quantity: number; line_total_minor: number }[];
}
interface RazorpayResult { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }
interface RazorpayOptions { key: string; amount: number; currency: string; order_id: string; name: string; description: string; handler: (result: RazorpayResult) => void; theme: { color: string } }
declare global { interface Window { Razorpay?: new (options: RazorpayOptions) => { open: () => void; on: (event: string, callback: () => void) => void } } }

const rupees = (minor: number) => `₹${(minor / 100).toFixed(2)}`;

export default function PublicWhatsAppCheckout({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<CheckoutData | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [done, setDone] = useState<"paid" | "claimed" | null>(null);
  const [reference, setReference] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void fetch(`/api/public/checkout/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.detail || "Checkout unavailable");
        setData(body);
        if (body.status === "paid" || body.status === "payment_verified") setDone("paid");
        else if (body.status === "payment_claimed") setDone("claimed");
      })
      .catch((reason) => setError(reason.message));
  }, [token]);

  function payWithRazorpay() {
    if (!data || !window.Razorpay || !data.key_id || !data.provider_order_id) {
      setError("Secure checkout is still loading. Please try again.");
      return;
    }
    setWorking(true);
    const checkout = new window.Razorpay({
      key: data.key_id, amount: data.amount, currency: data.currency, order_id: data.provider_order_id,
      name: data.business_name || "Your order", description: `Order ${data.order_id.slice(-8).toUpperCase()}`, theme: { color: "#10b981" },
      handler: async (result) => {
        const response = await fetch(`/api/public/checkout/${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result) });
        if (response.ok) { setDone("paid"); setError(""); } else { setError("Payment could not be verified. Nothing has been dispatched."); }
        setWorking(false);
      },
    });
    checkout.on("payment.failed", () => { setWorking(false); setError("Payment was not completed. You can safely try again."); });
    checkout.open();
  }

  async function sendReference() {
    setWorking(true);
    setError("");
    try {
      const response = await fetch(`/api/public/checkout/${encodeURIComponent(token)}/upi`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Couldn't send your reference. Please try again.");
      setDone("claimed");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't send your reference.");
    } finally {
      setWorking(false);
    }
  }

  async function copyUpiId() {
    if (!data?.upi_id) return;
    try {
      await copyText(data.upi_id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the ID is on screen to copy by hand.
    }
  }

  const name = data?.business_name || "Your order";
  const isUpi = data?.provider === "upi";

  return (
    <main className={styles.page}>
      {!isUpi && <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />}
      <div className={styles.brand}>
        <span>{name.slice(0, 1).toUpperCase()}</span>
        <strong>{name}</strong>
      </div>
      <section>
        {error && !data ? (
          <div className={styles.error}>{error}</div>
        ) : !data ? (
          <p>Loading your order…</p>
        ) : done === "paid" ? (
          <div className={styles.success}>
            <span>✓</span>
            <h1>Payment received</h1>
            <p>Thank you! Your order is confirmed. You can go back to WhatsApp.</p>
          </div>
        ) : done === "claimed" ? (
          <div className={styles.success}>
            <span>✓</span>
            <h1>Thanks, we&apos;re checking it</h1>
            <p>{name} will confirm your payment shortly and you&apos;ll get the receipt on WhatsApp.</p>
          </div>
        ) : (
          <>
            <div className={styles.heading}>
              <div>
                <span>Order {data.order_id.slice(-8).toUpperCase()}</span>
                <h1>Complete your payment</h1>
              </div>
              <strong>{rupees(data.amount)}</strong>
            </div>
            <div className={styles.items}>
              {data.items.map((item, index) => (
                <div key={index}>
                  <span>
                    {item.quantity} × {item.name}
                  </span>
                  <strong>{rupees(item.line_total_minor)}</strong>
                </div>
              ))}
            </div>
            <div className={styles.total}>
              <span>Total</span>
              <strong>{rupees(data.amount)}</strong>
            </div>

            {isUpi ? (
              <>
                {data.upi_link && (
                  <a className={styles.payButton} href={data.upi_link}>
                    Pay {rupees(data.amount)} with any UPI app
                  </a>
                )}
                <small>Opens GPay, PhonePe, Paytm or your bank&apos;s app with the amount filled in.</small>
                {data.upi_qr && (
                  <div className={styles.qr}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={data.upi_qr} alt="UPI QR code" width={180} height={180} />
                    <span>On a computer? Scan this with your phone&apos;s UPI app.</span>
                  </div>
                )}
                {data.upi_id && (
                  <div className={styles.upiId}>
                    <span>
                      Pay to <strong>{data.upi_id}</strong>
                      {data.payee_name ? ` (${data.payee_name})` : ""}
                    </span>
                    <button type="button" className={styles.copy} onClick={() => void copyUpiId()}>
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                )}
                <div className={styles.claim}>
                  <label htmlFor="upi-ref">Paid? Enter your UPI reference so {name} can confirm it faster</label>
                  <input
                    id="upi-ref"
                    inputMode="text"
                    autoComplete="off"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder="12-digit UPI reference / UTR"
                  />
                  <button type="button" onClick={() => void sendReference()} disabled={working || reference.replace(/\s/g, "").length < 6}>
                    {working ? "Sending…" : "I've paid"}
                  </button>
                </div>
                {error && <div className={styles.error}>{error}</div>}
              </>
            ) : (
              <>
                <button type="button" onClick={payWithRazorpay} disabled={working}>
                  {working ? "Opening secure payment…" : "Pay securely"}
                </button>
                {error && <div className={styles.error}>{error}</div>}
              </>
            )}
            {data.expires_at && <small>Your items are held until {new Date(data.expires_at).toLocaleString()}.</small>}
          </>
        )}
      </section>
    </main>
  );
}
