"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { InvoiceExtraction } from "@/lib/invoice-schema";

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const fieldLabels: { key: keyof Pick<InvoiceExtraction, "invoice_number" | "invoice_date" | "supplier_name" | "customer_name" | "subtotal" | "tax" | "total" | "currency">; label: string }[] = [
  { key: "invoice_number", label: "Invoice number" },
  { key: "invoice_date", label: "Invoice date" },
  { key: "supplier_name", label: "Supplier" },
  { key: "customer_name", label: "Customer" },
  { key: "subtotal", label: "Subtotal" },
  { key: "tax", label: "Tax" },
  { key: "total", label: "Total" },
  { key: "currency", label: "Currency" },
];

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M7 8.5C7 7.12 8.12 6 9.5 6h13A2.5 2.5 0 0 1 25 8.5v15a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 7 23.5v-15Z" stroke="currentColor" strokeWidth="1.7" />
        <path d="M11 12h10M11 16h6M11 20h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="m20.3 19.8 1.3 1.3 2.7-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function FileGlyph({ type }: { type?: string }) {
  const pdf = type === "application/pdf";
  return (
    <div className={`file-glyph${pdf ? " file-glyph-pdf" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 28 32" fill="none">
        <path d="M6 2.8h10l6 6v19.4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.8a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M16 3v6h6M8.5 15h11M8.5 19h11M8.5 23h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {pdf && <span>PDF</span>}
    </div>
  );
}

function formatBytes(bytes: number) {
  return bytes < 1_000_000 ? `${Math.max(1, Math.round(bytes / 1_000))} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function displayMoney(value: number | null, currency: string | null) {
  if (value === null) return "Not found";
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
    } catch {
      // Fall through to the original currency label when it is not supported by this browser.
    }
  }
  const formatted = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return currency ? `${currency} ${formatted}` : formatted;
}

function fieldValue(key: (typeof fieldLabels)[number]["key"], data: InvoiceExtraction) {
  const value = data[key];
  if (value === null) return null;
  if (key === "subtotal" || key === "tax" || key === "total") return displayMoney(value as number, data.currency);
  return value;
}

export default function Home() {
  const fileInput = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<InvoiceExtraction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<"fields" | "json">("fields");
  const [copied, setCopied] = useState(false);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  function handleFile(candidate: File | undefined) {
    if (!candidate) return;
    const extension = candidate.name.split(".").pop()?.toLowerCase() ?? "";
    const type = TYPE_BY_EXTENSION[extension] ?? candidate.type;
    if (!Object.values(TYPE_BY_EXTENSION).includes(type)) {
      setError("Use a PDF, JPG, PNG, or WebP invoice.");
      return;
    }
    if (candidate.size > MAX_FILE_SIZE) {
      setError("Choose a file under 4 MB so it uploads smoothly.");
      return;
    }
    const normalized = candidate.type === type ? candidate : new File([candidate], candidate.name, { type });
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = type.startsWith("image/") ? URL.createObjectURL(normalized) : null;
    setPreviewUrl(previewUrlRef.current);
    setFile(normalized);
    setExtraction(null);
    setError(null);
    setActiveTab("fields");
  }

  function reset() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setFile(null);
    setExtraction(null);
    setError(null);
    setCopied(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function extractInvoice() {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch("/api/extract", { method: "POST", body: formData });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "We couldn’t extract this invoice. Please try again.");
      setExtraction(body as InvoiceExtraction);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn’t extract this invoice. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyJson() {
    if (!extraction) return;
    await navigator.clipboard.writeText(JSON.stringify(extraction, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadJson() {
    if (!extraction) return;
    const blob = new Blob([JSON.stringify(extraction, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${file?.name.replace(/\.[^.]+$/, "") || "invoice"}-extracted.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const needsReview = !!extraction && (extraction.uncertain_fields.length > 0 || fieldLabels.some(({ key }) => extraction[key] === null));
  const currentStep = extraction ? 3 : file ? 2 : 1;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="Ledgerly home">
          <BrandMark />
          <span>ledgerly<span className="brand-dot">.</span></span>
        </a>
        <div className="sidebar-caption">WORKSPACE</div>
        <div className="nav-item nav-item-active" aria-current="page">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 4.8h14a1.7 1.7 0 0 1 1.7 1.7v11A1.7 1.7 0 0 1 19 19.2H5a1.7 1.7 0 0 1-1.7-1.7v-11A1.7 1.7 0 0 1 5 4.8Z" stroke="currentColor" strokeWidth="1.7"/><path d="M7.5 9h9M7.5 12.5h6M7.5 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
          <span>Invoice extractor</span>
        </div>
        <div className="sidebar-note">
          <div className="note-icon"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.5 19 6v5.5c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6l7-2.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
          <div><strong>Private by design</strong><span>Files aren’t saved in a history.</span></div>
        </div>
        <div className="sidebar-footer">
          <span className="status-dot" />
          <span>Ready for your invoice</span>
        </div>
      </aside>

      <main className="main-area" id="top">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>Invoice extractor</strong></div>
          <div className="topbar-right"><span className="gateway-indicator"><span /> AI extraction</span><div className="avatar" aria-label="Your workspace">L</div></div>
        </header>

        <div className="page-content">
          <section className="page-intro">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> DOCUMENT INTAKE</div>
              <h1>Invoices, <em>understood.</em></h1>
              <p className="intro-copy">Drop in an invoice. Get the key details and line items ready to review in seconds.</p>
            </div>
            <div className="intro-aside"><span className="sparkle">✳</span><span>Careful extraction<br />with AI</span></div>
          </section>

          <section className="stepper" aria-label="Extraction steps">
            {["Upload invoice", "Extract details", "Review & export"].map((label, index) => {
              const step = index + 1;
              const isComplete = step < currentStep;
              const isActive = step === currentStep;
              return (
                <div className={`stepper-item${isActive ? " stepper-active" : ""}${isComplete ? " stepper-complete" : ""}`} key={label}>
                  <span className="step-number">{isComplete ? "✓" : `0${step}`}</span>
                  <span>{label}</span>
                  {step < 3 && <span className="step-connector" />}
                </div>
              );
            })}
          </section>

          <div className="workspace-grid">
            <section className="upload-card">
              <div className="card-kicker"><span className="kicker-number">01</span><span>YOUR DOCUMENT</span></div>
              {!file ? (
                <>
                  <h2>Start with an invoice</h2>
                  <p className="card-description">Upload a file and we’ll take it from there.</p>
                  <div
                    className={`dropzone${dragging ? " dropzone-dragging" : ""}`}
                    onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => { event.preventDefault(); setDragging(false); handleFile(event.dataTransfer.files[0]); }}
                  >
                    <input
                      ref={fileInput}
                      className="visually-hidden"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                      onChange={(event) => handleFile(event.target.files?.[0])}
                      aria-label="Choose an invoice file"
                    />
                    <div className="upload-illustration"><span className="upload-arrow">↑</span><span className="upload-orbit orbit-one" /><span className="upload-orbit orbit-two" /></div>
                    <strong>Drop your invoice here</strong>
                    <span className="dropzone-or">or</span>
                    <button className="choose-button" type="button" onClick={() => fileInput.current?.click()}>Browse files <span>↗</span></button>
                    <span className="file-hint">PDF, JPG, PNG or WebP <i>·</i> up to 4 MB</span>
                  </div>
                  <div className="upload-footnote"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.5 16 5v4.7c0 3.7-2.5 6.5-6 7.8-3.5-1.3-6-4.1-6-7.8V5l6-2.5Z" stroke="currentColor" strokeWidth="1.4"/><path d="m7.5 9.8 1.7 1.7 3.4-3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg><span>Your file is used for extraction and isn’t saved here.</span></div>
                </>
              ) : (
                <>
                  <div className="upload-card-heading"><div><h2>{extraction ? "Document complete" : "Invoice selected"}</h2><p className="card-description">{extraction ? "Your fields are ready to review." : "Take a quick look, then start extraction."}</p></div><button className="text-button" onClick={() => fileInput.current?.click()} disabled={busy}>Replace</button></div>
                  <input
                    ref={fileInput}
                    className="visually-hidden"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(event) => handleFile(event.target.files?.[0])}
                    aria-label="Replace invoice file"
                  />
                  <div className="selected-file">
                    {previewUrl ? <Image className="file-thumb" src={previewUrl} alt="Invoice preview" width={39} height={43} unoptimized /> : <FileGlyph type={file.type} />}
                    <div className="selected-file-copy"><strong title={file.name}>{file.name}</strong><span>{formatBytes(file.size)} <i>·</i> {file.type === "application/pdf" ? "PDF document" : "Image file"}</span></div>
                    <button className="icon-button remove-file" onClick={reset} disabled={busy} aria-label="Remove selected invoice">×</button>
                  </div>
                  {busy ? (
                    <div className="processing-card" role="status"><span className="processing-spinner" /><div><strong>Reading your invoice</strong><span>Finding totals, parties and line items…</span></div></div>
                  ) : extraction ? (
                    <div className="completed-card"><span className="completed-check">✓</span><div><strong>Extraction complete</strong><span>Check any fields marked for review.</span></div></div>
                  ) : (
                    <button className="primary-button extract-button" onClick={extractInvoice}>Extract invoice details <span>→</span></button>
                  )}
                  {error && <div className="error-message" role="alert"><span>!</span><p>{error}</p></div>}
                  <div className="upload-footnote"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.5 16 5v4.7c0 3.7-2.5 6.5-6 7.8-3.5-1.3-6-4.1-6-7.8V5l6-2.5Z" stroke="currentColor" strokeWidth="1.4"/><path d="m7.5 9.8 1.7 1.7 3.4-3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg><span>Files aren’t saved in this app.</span></div>
                </>
              )}
            </section>

            <section className={`results-card${extraction ? " results-card-filled" : ""}`} aria-live="polite">
              {extraction ? (
                <>
                  <div className="results-header">
                    <div><div className="card-kicker"><span className="kicker-number">02</span><span>EXTRACTION RESULTS</span></div><h2>Review your details</h2></div>
                    <span className={`review-badge${needsReview ? " review-badge-needed" : " review-badge-ready"}`}><span />{needsReview ? "Review recommended" : "Ready to export"}</span>
                  </div>
                  <div className="results-toolbar">
                    <div className="result-tabs" role="tablist" aria-label="Result format">
                      <button role="tab" aria-selected={activeTab === "fields"} className={activeTab === "fields" ? "tab-active" : ""} onClick={() => setActiveTab("fields")}>Fields</button>
                      <button role="tab" aria-selected={activeTab === "json"} className={activeTab === "json" ? "tab-active" : ""} onClick={() => setActiveTab("json")}>JSON</button>
                    </div>
                    <div className="toolbar-actions"><button className="quiet-button" onClick={copyJson}>{copied ? "Copied ✓" : "Copy JSON"}</button><button className="export-button" onClick={downloadJson}><span>↓</span> Export JSON</button></div>
                  </div>
                  {activeTab === "json" ? (
                    <pre className="json-output">{JSON.stringify(extraction, null, 2)}</pre>
                  ) : (
                    <>
                      <div className="summary-strip">
                        <div className="summary-total"><span>INVOICE TOTAL</span><strong>{displayMoney(extraction.total, extraction.currency)}</strong><small>{extraction.currency ?? "Currency not identified"}</small></div>
                        <div className="summary-meta"><span>INVOICE DATE</span><strong>{extraction.invoice_date ?? <span className="missing-value">Not found</span>}</strong></div>
                        <div className="summary-meta"><span>LINE ITEMS</span><strong>{extraction.line_items.length}<small> {extraction.line_items.length === 1 ? "item" : "items"}</small></strong></div>
                      </div>
                      {extraction.uncertain_fields.length > 0 && <div className="uncertain-note"><span>!</span><p>Some details may need a closer look: {extraction.uncertain_fields.join(", ")}.</p></div>}
                      <div className="fields-grid">
                        {fieldLabels.map(({ key, label }) => {
                          const value = fieldValue(key, extraction);
                          const uncertain = extraction.uncertain_fields.includes(key);
                          return <div className={`data-field${value === null ? " data-field-missing" : ""}`} key={key}><span>{label}{uncertain && <i className="field-warning-dot" title="Check this value" />}</span><strong>{value ?? "Not found"}</strong></div>;
                        })}
                      </div>
                      <div className="line-items-section">
                        <div className="section-title"><div><h3>Line items</h3><span>As shown on the invoice</span></div><span className="item-count">{extraction.line_items.length.toString().padStart(2, "0")}</span></div>
                        {extraction.line_items.length ? (
                          <div className="table-scroll"><table><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>
                            {extraction.line_items.map((item, index) => <tr key={`${item.description ?? "item"}-${index}`}><td>{item.description ?? <span className="missing-value">Not found</span>}</td><td>{item.quantity ?? <span className="missing-value">—</span>}</td><td>{item.unit_price === null ? <span className="missing-value">—</span> : displayMoney(item.unit_price, extraction.currency)}</td><td>{item.amount === null ? <span className="missing-value">—</span> : displayMoney(item.amount, extraction.currency)}</td></tr>)}
                          </tbody></table></div>
                        ) : <div className="empty-lines">No line items were visible on this invoice.</div>}
                      </div>
                      <div className="result-bottom"><span><span className="bottom-check">✓</span> Review the values before using them.</span><button className="text-button" onClick={reset}>Extract another invoice <span>↗</span></button></div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="card-kicker"><span className="kicker-number">02</span><span>WHAT YOU’LL GET</span></div>
                  <div className="preview-heading"><h2>Your results, clearly organized.</h2><p>We’ll find the details that matter and keep missing information blank.</p></div>
                  <div className="preview-paper">
                    <div className="paper-topline"><span>EXAMPLE PREVIEW</span><span className="paper-status"><span /> SAMPLE</span></div>
                    <div className="paper-overview"><div><span>INVOICE NO.</span><strong>INV-2024-001</strong></div><div><span>INVOICE DATE</span><strong>15 Mar 2024</strong></div></div>
                    <div className="paper-rule" />
                    <div className="paper-row paper-row-head"><span>DESCRIPTION</span><span>AMOUNT</span></div>
                    <div className="paper-row"><span><i className="paper-line-icon" /> Product or service</span><span>$240.00</span></div>
                    <div className="paper-row paper-row-muted"><span><i className="paper-line-icon" /> Another line item</span><span>$80.00</span></div>
                    <div className="paper-rule" />
                    <div className="paper-total"><span>INVOICE TOTAL</span><strong>$320.00</strong></div>
                    <div className="paper-blur" aria-hidden="true" />
                  </div>
                  <div className="preview-caption"><span className="preview-spark">✳</span><span>From document to structured data, with less busywork.</span></div>
                  {error && <div className="error-message results-error" role="alert"><span>!</span><p>{error}</p></div>}
                </>
              )}
            </section>
          </div>

          <footer className="page-footer"><span>MADE FOR THE DETAILS</span><span>AI extraction can be imperfect. Please review before use.</span></footer>
        </div>
      </main>
    </div>
  );
}

