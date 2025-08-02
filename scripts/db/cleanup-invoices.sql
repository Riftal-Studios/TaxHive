DELETE FROM "Payment" WHERE "invoiceId" IN (
  SELECT id FROM "Invoice" WHERE "invoiceNumber" IN ('FY24-25/001', 'FY24-25/002', 'FY24-25/003', 'FY24-25/004')
);
DELETE FROM "InvoiceItem" WHERE "invoiceId" IN (
  SELECT id FROM "Invoice" WHERE "invoiceNumber" IN ('FY24-25/001', 'FY24-25/002', 'FY24-25/003', 'FY24-25/004')
);
DELETE FROM "Invoice" WHERE "invoiceNumber" IN ('FY24-25/001', 'FY24-25/002', 'FY24-25/003', 'FY24-25/004');