/*
  Warnings:

  - Made the column `custom_domain` on table `Project` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Project" ALTER COLUMN "custom_domain" SET NOT NULL;
