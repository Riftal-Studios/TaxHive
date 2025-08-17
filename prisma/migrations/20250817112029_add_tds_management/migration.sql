-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN     "netPayableAmount" DECIMAL(65,30),
ADD COLUMN     "tdsAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "tdsApplicable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tdsRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "tdsSection" TEXT;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "lowerTDSCertificateNo" TEXT,
ADD COLUMN     "lowerTDSRate" DECIMAL(65,30),
ADD COLUMN     "lowerTDSValidTill" TIMESTAMP(3),
ADD COLUMN     "tdsApplicable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "vendorType" TEXT NOT NULL DEFAULT 'COMPANY';

-- CreateTable
CREATE TABLE "TDSConfiguration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tanNumber" TEXT NOT NULL,
    "deductorName" TEXT NOT NULL,
    "deductorPAN" TEXT NOT NULL,
    "deductorType" TEXT NOT NULL,
    "responsiblePerson" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoDeduct" BOOLEAN NOT NULL DEFAULT true,
    "emailCertificates" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TDSConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TDSSection" (
    "id" TEXT NOT NULL,
    "sectionCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "individualRate" DECIMAL(65,30) NOT NULL,
    "companyRate" DECIMAL(65,30) NOT NULL,
    "hufRate" DECIMAL(65,30),
    "thresholdLimit" DECIMAL(65,30) NOT NULL,
    "singleLimit" DECIMAL(65,30),
    "applicableFor" TEXT[],
    "natureOfPayment" TEXT[],
    "surchargeRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "eduCessRate" DECIMAL(65,30) NOT NULL DEFAULT 4,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TDSSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TDSDeduction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT,
    "paymentId" TEXT,
    "vendorId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "taxableAmount" DECIMAL(65,30) NOT NULL,
    "tdsRate" DECIMAL(65,30) NOT NULL,
    "tdsAmount" DECIMAL(65,30) NOT NULL,
    "surcharge" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "eduCess" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalTDS" DECIMAL(65,30) NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorPAN" TEXT NOT NULL,
    "vendorType" TEXT NOT NULL,
    "deductionDate" TIMESTAMP(3) NOT NULL,
    "financialYear" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "depositStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "depositDueDate" TIMESTAMP(3) NOT NULL,
    "certificateId" TEXT,
    "certificateIssued" BOOLEAN NOT NULL DEFAULT false,
    "tdsPaymentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TDSDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TDSPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challanNumber" TEXT NOT NULL,
    "challanDate" TIMESTAMP(3) NOT NULL,
    "bsrCode" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "assessmentYear" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "tdsAmount" DECIMAL(65,30) NOT NULL,
    "surcharge" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "eduCess" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "interest" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "penalty" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "deductionIds" TEXT[],
    "deductionCount" INTEGER NOT NULL,
    "paymentMode" TEXT NOT NULL,
    "paymentReference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "acknowledgmentNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TDSPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TDSCertificate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "form" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorPAN" TEXT NOT NULL,
    "vendorAddress" TEXT NOT NULL,
    "totalTDS" DECIMAL(65,30) NOT NULL,
    "totalPaid" DECIMAL(65,30) NOT NULL,
    "deductionDetails" JSONB NOT NULL,
    "generatedDate" TIMESTAMP(3) NOT NULL,
    "issuedDate" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "pdfGeneratedAt" TIMESTAMP(3),
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "emailTo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "revisedFrom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TDSCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TDSReturn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "returnType" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "formType" TEXT NOT NULL,
    "tanNumber" TEXT NOT NULL,
    "assessmentYear" TEXT NOT NULL,
    "totalDeductions" INTEGER NOT NULL,
    "totalTDS" DECIMAL(65,30) NOT NULL,
    "totalDeposited" DECIMAL(65,30) NOT NULL,
    "totalCertificates" INTEGER NOT NULL,
    "sectionWiseSummary" JSONB NOT NULL,
    "challanCount" INTEGER NOT NULL,
    "challanDetails" JSONB NOT NULL,
    "filingStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "filingDate" TIMESTAMP(3),
    "acknowledgmentNo" TEXT,
    "tokenNumber" TEXT,
    "validationErrors" JSONB,
    "validationStatus" TEXT,
    "returnFileUrl" TEXT,
    "formFileUrl" TEXT,
    "preparedBy" TEXT,
    "preparedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TDSReturn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TDSConfiguration_userId_key" ON "TDSConfiguration"("userId");

-- CreateIndex
CREATE INDEX "TDSConfiguration_tanNumber_idx" ON "TDSConfiguration"("tanNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TDSSection_sectionCode_key" ON "TDSSection"("sectionCode");

-- CreateIndex
CREATE INDEX "TDSSection_sectionCode_idx" ON "TDSSection"("sectionCode");

-- CreateIndex
CREATE INDEX "TDSSection_isActive_idx" ON "TDSSection"("isActive");

-- CreateIndex
CREATE INDEX "TDSDeduction_userId_idx" ON "TDSDeduction"("userId");

-- CreateIndex
CREATE INDEX "TDSDeduction_vendorId_idx" ON "TDSDeduction"("vendorId");

-- CreateIndex
CREATE INDEX "TDSDeduction_purchaseInvoiceId_idx" ON "TDSDeduction"("purchaseInvoiceId");

-- CreateIndex
CREATE INDEX "TDSDeduction_financialYear_quarter_idx" ON "TDSDeduction"("financialYear", "quarter");

-- CreateIndex
CREATE INDEX "TDSDeduction_depositStatus_idx" ON "TDSDeduction"("depositStatus");

-- CreateIndex
CREATE INDEX "TDSDeduction_deductionDate_idx" ON "TDSDeduction"("deductionDate");

-- CreateIndex
CREATE UNIQUE INDEX "TDSPayment_challanNumber_key" ON "TDSPayment"("challanNumber");

-- CreateIndex
CREATE INDEX "TDSPayment_userId_idx" ON "TDSPayment"("userId");

-- CreateIndex
CREATE INDEX "TDSPayment_financialYear_quarter_idx" ON "TDSPayment"("financialYear", "quarter");

-- CreateIndex
CREATE INDEX "TDSPayment_challanNumber_idx" ON "TDSPayment"("challanNumber");

-- CreateIndex
CREATE INDEX "TDSPayment_challanDate_idx" ON "TDSPayment"("challanDate");

-- CreateIndex
CREATE UNIQUE INDEX "TDSCertificate_certificateNumber_key" ON "TDSCertificate"("certificateNumber");

-- CreateIndex
CREATE INDEX "TDSCertificate_userId_idx" ON "TDSCertificate"("userId");

-- CreateIndex
CREATE INDEX "TDSCertificate_vendorId_idx" ON "TDSCertificate"("vendorId");

-- CreateIndex
CREATE INDEX "TDSCertificate_financialYear_quarter_idx" ON "TDSCertificate"("financialYear", "quarter");

-- CreateIndex
CREATE INDEX "TDSCertificate_certificateNumber_idx" ON "TDSCertificate"("certificateNumber");

-- CreateIndex
CREATE INDEX "TDSReturn_userId_idx" ON "TDSReturn"("userId");

-- CreateIndex
CREATE INDEX "TDSReturn_returnType_idx" ON "TDSReturn"("returnType");

-- CreateIndex
CREATE INDEX "TDSReturn_financialYear_quarter_idx" ON "TDSReturn"("financialYear", "quarter");

-- CreateIndex
CREATE INDEX "TDSReturn_filingStatus_idx" ON "TDSReturn"("filingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "TDSReturn_userId_returnType_financialYear_quarter_key" ON "TDSReturn"("userId", "returnType", "financialYear", "quarter");

-- CreateIndex
CREATE INDEX "Vendor_pan_idx" ON "Vendor"("pan");

-- AddForeignKey
ALTER TABLE "TDSConfiguration" ADD CONSTRAINT "TDSConfiguration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TDSDeduction" ADD CONSTRAINT "TDSDeduction_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "TDSSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TDSDeduction" ADD CONSTRAINT "TDSDeduction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TDSDeduction" ADD CONSTRAINT "TDSDeduction_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TDSDeduction" ADD CONSTRAINT "TDSDeduction_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TDSDeduction" ADD CONSTRAINT "TDSDeduction_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "TDSCertificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TDSDeduction" ADD CONSTRAINT "TDSDeduction_tdsPaymentId_fkey" FOREIGN KEY ("tdsPaymentId") REFERENCES "TDSPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TDSPayment" ADD CONSTRAINT "TDSPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TDSCertificate" ADD CONSTRAINT "TDSCertificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TDSCertificate" ADD CONSTRAINT "TDSCertificate_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TDSReturn" ADD CONSTRAINT "TDSReturn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
