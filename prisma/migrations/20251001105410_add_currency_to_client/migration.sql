-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD';

-- Populate currency based on country for existing clients
-- United States
UPDATE "Client" SET "currency" = 'USD' WHERE "country" ILIKE '%united states%' OR "country" ILIKE '%usa%' OR "country" = 'US';

-- Australia
UPDATE "Client" SET "currency" = 'AUD' WHERE "country" ILIKE '%australia%' OR "country" = 'AU';

-- United Kingdom
UPDATE "Client" SET "currency" = 'GBP' WHERE "country" ILIKE '%united kingdom%' OR "country" ILIKE '%uk%' OR "country" = 'GB';

-- European Union countries (using EUR)
UPDATE "Client" SET "currency" = 'EUR' WHERE
  "country" IN ('AT', 'BE', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES')
  OR "country" ILIKE '%austria%' OR "country" ILIKE '%belgium%' OR "country" ILIKE '%cyprus%'
  OR "country" ILIKE '%estonia%' OR "country" ILIKE '%finland%' OR "country" ILIKE '%france%'
  OR "country" ILIKE '%germany%' OR "country" ILIKE '%greece%' OR "country" ILIKE '%ireland%'
  OR "country" ILIKE '%italy%' OR "country" ILIKE '%latvia%' OR "country" ILIKE '%lithuania%'
  OR "country" ILIKE '%luxembourg%' OR "country" ILIKE '%malta%' OR "country" ILIKE '%netherlands%'
  OR "country" ILIKE '%portugal%' OR "country" ILIKE '%slovakia%' OR "country" ILIKE '%slovenia%'
  OR "country" ILIKE '%spain%';

-- Canada
UPDATE "Client" SET "currency" = 'CAD' WHERE "country" ILIKE '%canada%' OR "country" = 'CA';

-- Singapore
UPDATE "Client" SET "currency" = 'SGD' WHERE "country" ILIKE '%singapore%' OR "country" = 'SG';

-- UAE
UPDATE "Client" SET "currency" = 'AED' WHERE "country" ILIKE '%uae%' OR "country" ILIKE '%emirates%' OR "country" = 'AE';

-- Japan
UPDATE "Client" SET "currency" = 'JPY' WHERE "country" ILIKE '%japan%' OR "country" = 'JP';

-- Switzerland
UPDATE "Client" SET "currency" = 'CHF' WHERE "country" ILIKE '%switzerland%' OR "country" = 'CH';

-- New Zealand
UPDATE "Client" SET "currency" = 'NZD' WHERE "country" ILIKE '%new zealand%' OR "country" = 'NZ';
