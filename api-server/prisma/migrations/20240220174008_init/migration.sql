/*
  Warnings:

  - A unique constraint covering the columns `[sub_domain]` on the table `Project` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Project_sub_domain_key" ON "Project"("sub_domain");
