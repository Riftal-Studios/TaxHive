-- AlterTable
ALTER TABLE "RecurringInvoice" ADD COLUMN     "holidayCalendar" JSONB,
ADD COLUMN     "scheduleTime" TEXT,
ADD COLUMN     "skipHolidays" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "skipWeekends" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';
