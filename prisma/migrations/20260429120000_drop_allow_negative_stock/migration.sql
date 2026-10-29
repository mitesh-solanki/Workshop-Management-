-- Stock may never go below zero; remove the garage overselling toggle.
ALTER TABLE "Garage" DROP COLUMN IF EXISTS "allowNegativeStock";
