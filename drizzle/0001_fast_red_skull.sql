ALTER TABLE "bills" ADD COLUMN "introduced_on" date;--> statement-breakpoint
CREATE INDEX "bills_introduced_on_idx" ON "bills" USING btree ("introduced_on");