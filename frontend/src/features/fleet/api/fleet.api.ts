import { http } from '@/core/api/http-client';
import type { ListParams } from '@/core/api/types';
import type { AddDocumentDto, BackupDto, CheckInDto, CloseWorkOrderDto, CreateEmployeeDto, CreateForecastDto, CreateShiftDto, CreateWorkOrderDto, DeclareDisruptionDto, DivertDto, FuelCardDto, FuelTxnDto, LeaveDto, PartDto, PingDto, RcaDto, TrainingDto, VehicleDocDto, ViolationDto } from '@/core/api/generated/dtos';

/* Keeping the fleet and its crew roadworthy: maintenance, fuel, compliance, HR, disruption. */

export const maintenanceWorkApi = {
  listWorkOrders: (params?: ListParams) => http.get<Array<Record<string, unknown>>>('/operator/fleet/work-orders', { params }),
  createWorkOrder: (body: CreateWorkOrderDto) => http.post<unknown>('/operator/fleet/work-orders', body),
  start: (id: string) => http.patch<unknown>(`/operator/fleet/work-orders/${id}/start`),
  close: (id: string, body?: CloseWorkOrderDto) => http.patch<unknown>(`/operator/fleet/work-orders/${id}/close`, body),
  cancel: (id: string) => http.patch<unknown>(`/operator/fleet/work-orders/${id}/cancel`),
  addVehicleDocument: (body: VehicleDocDto) => http.post<unknown>('/operator/fleet/vehicle-documents', body),
  expiringDocuments: () => http.get<Array<Record<string, unknown>>>('/operator/fleet/vehicle-documents/expiring'),
  listParts: () => http.get<Array<Record<string, unknown>>>('/operator/fleet/parts'),
  addPart: (body: PartDto) => http.post<unknown>('/operator/fleet/parts', body),
};

export const fuelApi = {
  listTransactions: (params?: ListParams) => http.get<Array<Record<string, unknown>>>('/operator/fuel/transactions', { params }),
  createTransaction: (body: FuelTxnDto) => http.post<unknown>('/operator/fuel/transactions', body),
  approveTransaction: (id: string) => http.patch<unknown>(`/operator/fuel/transactions/${id}/approve`),
  efficiency: (busId: string) => http.get<Record<string, unknown>>(`/operator/fuel/buses/${busId}/efficiency`),
  listCards: () => http.get<Array<Record<string, unknown>>>('/operator/fuel/cards'),
  createCard: (body: FuelCardDto) => http.post<unknown>('/operator/fuel/cards', body),
  suspendCard: (id: string) => http.patch<unknown>(`/operator/fuel/cards/${id}/suspend`),
};

export const driverComplianceApi = {
  addDocument: (body: AddDocumentDto) => http.post<unknown>('/operator/driver-compliance/documents', body),
  documents: (driverId: string) => http.get<Array<Record<string, unknown>>>(`/operator/driver-compliance/drivers/${driverId}/documents`),
  expiring: () => http.get<Array<Record<string, unknown>>>('/operator/driver-compliance/expiring'),
  status: (driverId: string) => http.get<Record<string, unknown>>(`/operator/driver-compliance/drivers/${driverId}/status`),
  recordViolation: (body: ViolationDto) => http.post<unknown>('/operator/driver-compliance/violations', body),
  violations: (driverId: string) => http.get<Array<Record<string, unknown>>>(`/operator/driver-compliance/drivers/${driverId}/violations`),
  recordTraining: (body: TrainingDto) => http.post<unknown>('/operator/driver-compliance/training', body),
  training: (driverId: string) => http.get<Array<Record<string, unknown>>>(`/operator/driver-compliance/drivers/${driverId}/training`),
};

export const crewApi = {
  listEmployees: (params?: ListParams) => http.get<Array<Record<string, unknown>>>('/operator/crew/employees', { params }),
  createEmployee: (body: CreateEmployeeDto) => http.post<unknown>('/operator/crew/employees', body),
  listShifts: () => http.get<Array<Record<string, unknown>>>('/operator/crew/shifts'),
  createShift: (body: CreateShiftDto) => http.post<unknown>('/operator/crew/shifts', body),
  listAttendance: (params?: ListParams) => http.get<Array<Record<string, unknown>>>('/operator/crew/attendance', { params }),
  recordAttendance: (body: CheckInDto) => http.post<unknown>('/operator/crew/attendance', body),
  listLeave: () => http.get<Array<Record<string, unknown>>>('/operator/crew/leave'),
  requestLeave: (body: LeaveDto) => http.post<unknown>('/operator/crew/leave', body),
  approveLeave: (id: string) => http.patch<unknown>(`/operator/crew/leave/${id}/approve`),
  rejectLeave: (id: string) => http.patch<unknown>(`/operator/crew/leave/${id}/reject`),
};

export const disruptionApi = {
  list: (params?: ListParams) => http.get<Array<Record<string, unknown>>>('/operator/disruption', { params }),
  create: (body: DeclareDisruptionDto) => http.post<unknown>('/operator/disruption', body),
  divert: (id: string, body: DivertDto) => http.patch<unknown>(`/operator/disruption/${id}/divert`, body),
  deployBackup: (id: string, body: BackupDto) => http.patch<unknown>(`/operator/disruption/${id}/backup`, body),
  resolve: (id: string, body?: Record<string, unknown>) => http.patch<unknown>(`/operator/disruption/${id}/resolve`, body),
  close: (id: string) => http.patch<unknown>(`/operator/disruption/${id}/close`),
  recordRca: (id: string, body: RcaDto) => http.patch<unknown>(`/operator/disruption/${id}/rca`, body),
};

export const forecastingApi = {
  list: (params?: ListParams) => http.get<Array<Record<string, unknown>>>('/operator/forecasting', { params }),
  generate: (body: CreateForecastDto) => http.post<unknown>('/operator/forecasting', body),
};

export const trackingApi = {
  ping: (body: PingDto) => http.post<unknown>('/tracking/ping', body),
  live: (tripId: string) => http.get<Record<string, unknown>>(`/tracking/${tripId}/live`),
};
