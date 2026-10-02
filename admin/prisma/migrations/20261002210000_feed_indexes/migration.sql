-- CreateIndex
CREATE INDEX "documents_vehicleId_addedAt_idx" ON "documents"("vehicleId", "addedAt" DESC);

-- CreateIndex
CREATE INDEX "documents_expiryDate_idx" ON "documents"("expiryDate");

-- CreateIndex
CREATE INDEX "expense_records_vehicleId_date_idx" ON "expense_records"("vehicleId", "date" DESC);

-- CreateIndex
CREATE INDEX "fuel_records_vehicleId_date_idx" ON "fuel_records"("vehicleId", "date" DESC);

-- CreateIndex
CREATE INDEX "odometer_readings_vehicleId_date_idx" ON "odometer_readings"("vehicleId", "date" DESC);

-- CreateIndex
CREATE INDEX "repair_records_vehicleId_date_idx" ON "repair_records"("vehicleId", "date" DESC);

-- CreateIndex
CREATE INDEX "service_records_vehicleId_date_idx" ON "service_records"("vehicleId", "date" DESC);

