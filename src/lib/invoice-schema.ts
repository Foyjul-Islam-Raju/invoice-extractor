import { z } from "zod";

export const invoiceSchema = z.object({
  invoice_number: z.string().nullable().describe("Invoice number exactly as printed, or null when missing or unreadable."),
  invoice_date: z.string().nullable().describe("Invoice date exactly as printed, or null when missing or unreadable."),
  supplier_name: z.string().nullable().describe("Supplier or seller name, or null when missing or unreadable."),
  customer_name: z.string().nullable().describe("Customer or bill-to name, or null when missing or unreadable."),
  subtotal: z.number().nullable().describe("Subtotal before tax as a number, or null when missing or unreadable."),
  tax: z.number().nullable().describe("Tax amount as a number, or null when missing or unreadable."),
  total: z.number().nullable().describe("Final invoice total as a number, or null when missing or unreadable."),
  currency: z.string().nullable().describe("Currency code only when explicitly shown; otherwise preserve an ambiguous printed symbol or use null."),
  line_items: z.array(
    z.object({
      description: z.string().nullable().describe("Line item description, or null when unreadable."),
      quantity: z.number().nullable().describe("Quantity printed on the invoice, or null when absent or unreadable."),
      unit_price: z.number().nullable().describe("Per-unit price printed on the invoice, or null when absent or unreadable."),
      amount: z.number().nullable().describe("Line amount printed on the invoice, or null when absent or unreadable."),
    }),
  ).describe("Invoice line items in the order they appear. Return an empty array only when there are no visible line items."),
  uncertain_fields: z.array(z.string()).describe("Names or paths of fields that appear ambiguous or only partly legible, for example invoice_date or line_items[0].amount."),
});

export type InvoiceExtraction = z.infer<typeof invoiceSchema>;

