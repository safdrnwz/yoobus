/* eslint-disable */
/**
 * GENERATED from the backend DTO classes. Do not hand-edit.
 *   regenerate:  npm run api:types   (from the repo root)
 *
 * These are the exact payload shapes the server validates against. If a call site
 * stops compiling after a regenerate, the backend contract changed — that is the
 * point. Previously every write was typed `Record<string, unknown>`, so a missing or
 * misspelt key sailed through TypeScript and came back as a 400 at runtime.
 */

export interface AddDocumentDto {
  driverId: string;
  docType: string;
  documentNumber: string;
  expiresAt: string;
  fileKey?: string;
}

export interface AddEmployeeDto {
  email: string;
  fullName: string;
}

export interface AdjustSeatFaresDto {
  percent?: number;
  delta?: number;
  setMultiplier?: number;
  /** Leave empty to move every seat on the bus. */
  seats?: string[];
}

export interface ApproveDto {
  commissionRate?: number;
  setupFeePerBus?: number;
  oneTimePlatformFee?: number;
  smsCharge?: number;
  whatsappCharge?: number;
  emailCharge?: number;
}

export interface AssignBusDto {
  busId: string;
}

export interface AssignCustomRoleDto {
  userId: string;
  /** null takes them off the custom role and back to their base role. */
  roleId?: string | unknown;
}

export interface AssignDriverDto {
  driverId: string;
}

export interface AssignLayoutDto {
  templateId: string;
}

export interface AttachRouteDto {
  routeId: string;
}

export interface BackupDto {
  backupBusId: string;
}

export interface BlacklistDto {
  customerUserId: string;
  blacklisted: boolean;
  reason?: string;
}

export interface BrandingDto {
  branding: unknown;
}

export interface BulkSetSettingsDto {
  settings: SettingEntryDto[];
}

export interface BulkTransferDto {
  bookingIds: string[];
  toTripId: string;
  reason?: string;
}

export interface CancelBookingDto {
  reason?: string;
  refundToWallet?: boolean;
}

export interface ChangeEmailRequestDto {
  newEmail: string;
}

export interface ChangePasswordDto {
  oldPassword: string;
  newPassword: string;
}

export interface ChangePhoneRequestDto {
  newPhone: string;
}

export interface CheckInDto {
  employeeId: string;
  shiftStart: string;
  checkIn?: string;
}

export interface ClearOverrideQueryDto {
  role: 'SUPERADMIN' | 'ACCOUNTANT' | 'PLATFORM_SUPPORT' | 'OPERATOR_ADMIN' | 'OPERATIONS_MANAGER' | 'FINANCE_MANAGER' | 'DEPOT_MANAGER' | 'CREW' | 'SUPPORT' | 'DRIVER' | 'CUSTOMER';
  permissionKey: string;
}

export interface CloneLayoutDto {
  name?: string;
  asNewFamily?: boolean;
}

export interface CloseWorkOrderDto {
  cost?: number;
}

export interface CommissionDto {
  commissionRate: number;
}

export interface ConfirmOtpDto {
  otp: string;
}

export interface CreateAgentDto {
  name: string;
  counterId?: string;
  phone?: string;
}

export interface CreateBookingDto {
  holdToken: string;
  passengers: PassengerDto[];
  optInsurance?: boolean;
  couponCode?: string;
}

export interface CreateBusDto {
  registrationNumber: string;
  name: string;
  busType: 'AC_SEATER' | 'NON_AC_SEATER' | 'AC_SLEEPER' | 'NON_AC_SLEEPER' | 'VOLVO';
  totalSeats: number;
  /** drag-and-drop layout (optional); na de to seatMap se simple layout */
  seatLayout?: unknown;
  seatMap?: string[];
}

export interface CreateComplaintDto {
  subject: string;
  customerUserId?: string;
}

export interface CreateCorporateDto {
  companyName: string;
  adminEmail: string;
  gstin?: string;
  creditLimit?: number;
}

export interface CreateCounterDto {
  name: string;
  location?: string;
}

export interface CreateCouponDto {
  code: string;
  type: 'PERCENT' | 'FLAT';
  value: number;
  maxDiscount?: number;
  minFare?: number;
  usageLimit?: number;
  perUserLimit?: number;
  validFrom?: string;
  validTo?: string;
  active?: boolean;
}

export interface CreateCustomRoleDto {
  /** What the operator calls it — "Counter Clerk", "Night Shift Supervisor". */
  name: string;
  description?: string;
  permissions: string[];
}

export interface CreateDriverDto {
  fullName: string;
  phone: string;
  licenseNumber: string;
  licenseExpiry?: string;
}

export interface CreateDsrDto {
  subjectEmail: string;
  type: string;
  note?: string;
}

export interface CreateEmployeeDto {
  fullName: string;
  designation: string;
  phone?: string;
}

export interface CreateForecastDto {
  routeId: string;
  forecastDate: string;
  predictedOccupancy: number;
}

export interface CreateHubDto {
  name: string;
  stopId: string;
  city?: string;
}

export interface CreateLayoutDto {
  name: string;
  busType?: string;
  definition?: LayoutDefinitionDto;
}

export interface CreateLeadDto {
  companyName: string;
  contactName: string;
  email: string;
  mobile: string;
  totalBuses: number;
  city?: string;
  details?: string;
  /** Full business details + document attachment URLs, submitted with the application. */
  kyc?: KycDetailsDto;
}

export interface CreateMaintenanceDto {
  startAt: string;
  endAt: string;
  message: string;
}

export interface CreateOrderDto {
  bookingId: string;
}

export interface CreatePlatformStaffDto {
  fullName: string;
  email: string;
  role: 'SUPERADMIN' | 'ACCOUNTANT' | 'PLATFORM_SUPPORT' | 'OPERATOR_ADMIN' | 'OPERATIONS_MANAGER' | 'FINANCE_MANAGER' | 'DEPOT_MANAGER' | 'CREW' | 'SUPPORT' | 'DRIVER' | 'CUSTOMER';
  phone?: string;
}

export interface CreateReviewDto {
  tripId: string;
  rating: number;
  comment?: string;
}

export interface CreateRouteDto {
  name: string;
  stops: RouteStopDto[];
}

export interface CreateScheduleDto {
  name: string;
  routeId: string;
  busId: string;
  departureTime: string;
  daysOfWeek: number[];
  recurrence?: string;
  seasonStart?: string;
  seasonEnd?: string;
  fareMultiplier?: number;
}

export interface CreateSeatAlertDto {
  boardingStopId: string;
  droppingStopId: string;
  email: string;
  phone?: string;
}

export interface CreateShiftDto {
  name: string;
  startAt: string;
  endAt: string;
  employeeId?: string;
}

export interface CreateStaffDto {
  fullName: string;
  email: string;
  role: 'SUPERADMIN' | 'ACCOUNTANT' | 'PLATFORM_SUPPORT' | 'OPERATOR_ADMIN' | 'OPERATIONS_MANAGER' | 'FINANCE_MANAGER' | 'DEPOT_MANAGER' | 'CREW' | 'SUPPORT' | 'DRIVER' | 'CUSTOMER';
  phone?: string;
}

export interface CreateStopDto {
  name: string;
  city: string;
  state?: string;
  code: string;
  latitude?: number;
  longitude?: number;
}

export interface CreateTicketDto {
  subject: string;
  description?: string;
}

export interface CreateTripDto {
  routeId: string;
  busId: string;
  departureDate: string;
  departureTime: string;
  fareMultiplier?: number;
}

export interface CreateVersionDto {
  version: string;
}

export interface CreateWorkOrderDto {
  busId: string;
  title: string;
  description?: string;
}

export interface DeckDto {
  deck: string;
  items: LayoutItemDto[];
}

export interface DeclareDisruptionDto {
  type: string;
  severity: string;
  description: string;
  tripId?: string;
}

export interface DivertDto {
  divertedToRouteId: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ForgotPasswordOtpDto {
  /** Registered email, or the 10-digit mobile number. */
  identifier: string;
}

export interface FreezeFareDto {
  boardingStopId: string;
  droppingStopId: string;
}

export interface FuelCardDto {
  cardNumber: string;
  busId?: string;
}

export interface FuelTxnDto {
  busId: string;
  type: string;
  litres: number;
  pricePerLitre?: number;
  odometerKm?: number;
  note?: string;
}

export interface GenerateInvoiceDto {
  operatorId: string;
  customerGstin?: string;
  customerStateCode?: string;
  gstRate?: number;
  items: LineItemDto[];
  dueDays?: number;
}

export interface GenerateKeyDto {
  name: string;
  scopes?: string[];
  expiresInDays?: number;
}

export interface GenerateTripsDto {
  fromDate: string;
  toDate: string;
}

export interface HoldDto {
  tripId: string;
  boardingStopId: string;
  droppingStopId: string;
  seatNumbers: string[];
  freezeToken?: string;
}

export interface InitiateTransferDto {
  bookingId: string;
  toTripId: string;
  reason?: string;
}

export interface JournalLineDto {
  account: string;
  debit: number;
  credit: number;
}

export interface JourneySearchDto {
  /** Optional: restrict the search to a single operator's trips. */
  operatorId?: string;
  fromStopId: string;
  toStopId: string;
  date?: string;
  minLayover?: number;
  maxLayover?: number;
  maxConnections?: number;
}

export interface KycDetailsDto {
  gstin?: string;
  pan?: string;
  legalName?: string;
  address?: unknown;
  bankDetails?: unknown;
  documents?: unknown;
}

export interface LadiesReservedDto {
  seatNumbers: string[];
}

export interface LayoutDefinitionDto {
  decks: DeckDto[];
}

export interface LayoutItemDto {
  id: string;
  kind: string;
  /** Twice, because this is the only place a malformed payload can be stopped at the door. */
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  /** Bookable items only. Uniqueness is enforced across the whole layout at publish. */
  seatNumber?: string;
  props?: SeatPropsDto;
}

export interface LeaveDto {
  employeeId: string;
  fromAt: string;
  toAt: string;
  reason?: string;
}

export interface LineItemDto {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface LogDeploymentDto {
  version: string;
}

export interface LoginDto {
  identifier: string;
  password: string;
}

export interface LogoutDto {
  refreshToken: string;
}

export interface LostFoundDto {
  itemDescription: string;
  tripId?: string;
}

export interface ManualBoardDto {
  tripId: string;
  pnr: string;
}

export interface MapDeviceDto {
  busId: string;
  imei: string;
  deviceId?: string;
}

export interface MapRouteDto {
  routeId: string;
}

export interface NoteDto {
  amount: number;
  reason: string;
}

export interface OfferUpgradeDto {
  bookingId: string;
  fromCategory: string;
  toCategory: string;
  fromPrice: number;
  toPrice: number;
  complimentary?: boolean;
}

export interface OperatorOverrideDto {
  operatorId: string;
  enabled: boolean;
}

export interface OtaBlockDto {
  tripId: string;
  boardingStopId: string;
  droppingStopId: string;
  seatNumbers: string[];
}

export interface OtaCancelDto {
  pnr: string;
}

export interface OtaConfirmDto {
  holdToken: string;
  passengers: OtaPassengerDto[];
  otaRef: string;
  channelCode?: string;
}

export interface OtaPassengerDto {
  seatNumber: string;
  name: string;
  age?: number;
  gender?: string;
}

export interface OtaSearchDto {
  fromStopId: string;
  toStopId: string;
  date?: string;
}

export interface PartDto {
  partName: string;
  quantity: number;
}

export interface PartialCancelDto {
  seatNumbers: string[];
  reason?: string;
  refundToWallet?: boolean;
}

export interface PassengerDto {
  seatNumber: string;
  /** Provide a saved-passenger id to prefill details, or the fields directly. */
  savedPassengerId?: string;
  name?: string;
  age?: number;
  gender?: string;
}

export interface PeriodDto {
  from: string;
  to: string;
}

export interface PeriodQueryDto {
  from: string;
  to: string;
  /** Platform staff must name the operator; operator staff may omit it. */
  operatorId?: string;
}

export interface PingDto {
  tripId: string;
  latitude: number;
  longitude: number;
  speedKmph?: number;
}

export interface PostJournalDto {
  period: string;
  narration: string;
  lines: JournalLineDto[];
}

export interface RcaDto {
  rootCause: string;
}

export interface RecordConsentDto {
  subjectEmail: string;
  purpose: string;
  granted: boolean;
}

export interface RecordPaymentDto {
  amount: number;
  method: string;
  reference?: string;
}

export interface RecordSaleDto {
  counterId: string;
  agentId: string;
  bookingId: string;
  amount: number;
  paymentMode: string;
}

export interface RedeemPointsDto {
  points: number;
}

export interface RedeemReferralDto {
  code: string;
}

export interface RefreshDto {
  refreshToken: string;
}

export interface RegisterChannelDto {
  code: string;
  displayName: string;
  channelCommissionRate?: number;
}

export interface RegisterDto {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  consentGiven?: boolean;
}

export interface RegisterJobDto {
  name: string;
}

export interface RegisterPartnerDto {
  name: string;
  email: string;
  callbackUrl?: string;
  rateLimitPerMinute?: number;
  scopes?: string[];
}

export interface RegisterWebhookDto {
  url: string;
  eventTypes: string[];
  maxAttempts?: number;
}

export interface RejectDto {
  reason: string;
}

export interface RequestOtpDto {
  email: string;
  purpose: 'REGISTER' | 'LOGIN';
  fullName?: string;
  phone?: string;
}

export interface RescheduleDto {
  newTripId: string;
}

export interface ResendVerificationDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

export interface ResetPasswordOtpDto {
  identifier: string;
  otp: string;
  newPassword: string;
}

export interface RotateKeyDto {
  keyAlias: string;
}

export interface RouteStopDto {
  stopId: string;
  stopOrder: number;
  fareFromOrigin: number;
  arrivalOffsetMin?: number;
}

export interface RunStatementDto {
  /** ISO date (YYYY-MM-DD). Defaults to yesterday. */
  date?: string;
}

export interface SaveGpsConfigDto {
  provider: string;
  apiBaseUrl: string;
  apiKey: string;
  apiSecret?: string;
  clientId?: string;
  accessToken?: string;
  webhookUrl?: string;
}

export interface SavePassengerDto {
  fullName: string;
  age?: number;
  gender?: string;
  idType?: string;
  idNumber?: string;
}

export interface ScanDto {
  tripId: string;
  qrPayload: string;
}

export interface SearchTripDto {
  /** Optional: restrict the search to a single operator's trips. */
  operatorId?: string;
  fromStopId: string;
  toStopId: string;
  date?: string;
}

export interface SeatAdjacencyDto {
  /** Pairs of seats that sit next to each other, e.g. [['1A','1B'], ['2A','2B']]. */
  pairs: [string, string][];
}

export interface SeatAvailabilityDto {
  boardingStopId: string;
  droppingStopId: string;
}

export interface SeatFareRuleDto {
  seatNumber: string;
  /** Relative to the base segment fare. 1.15 = 15% dearer than a standard seat. */
  multiplier: number;
  /** A flat premium added after the multiplier, for operators who price berths that way. */
  delta?: number;
}

export interface SeatPropsDto {
  gender?: string;
  fareZone?: string;
  isWindow?: boolean;
  isAisle?: boolean;
  reserved?: boolean;
  blocked?: boolean;
  wheelchair?: boolean;
  label?: string;
  notes?: string;
}

export interface SetOperatorPrefDto {
  notificationKey: string;
  channel: string;
  enabled: boolean;
}

export interface SetOverrideDto {
  role: 'SUPERADMIN' | 'ACCOUNTANT' | 'PLATFORM_SUPPORT' | 'OPERATOR_ADMIN' | 'OPERATIONS_MANAGER' | 'FINANCE_MANAGER' | 'DEPOT_MANAGER' | 'CREW' | 'SUPPORT' | 'DRIVER' | 'CUSTOMER';
  permissionKey: string;
  granted: boolean;
}

export interface SetPasswordDto {
  newPassword: string;
}

export interface SetProviderStatusDto {
  providerName: string;
  enabled: boolean;
}

export interface SetSeatFaresDto {
  fares: SeatFareRuleDto[];
}

export interface SetSettingDto {
  namespace: string;
  key: string;
  /** in the service, which knows the controlled schema for every namespace.key. */
  value: unknown;
}

export interface SettingEntryDto {
  key: string;
  value: unknown;
}

export interface TestWebhookDto {
  event: string;
  payload: unknown;
}

export interface TopupDto {
  amount: number;
}

export interface TrainingDto {
  driverId: string;
  program: string;
  completedAt?: string;
}

export interface UpdateBusDto {
  registrationNumber?: string;
  name?: string;
  busType?: 'AC_SEATER' | 'NON_AC_SEATER' | 'AC_SLEEPER' | 'NON_AC_SLEEPER' | 'VOLVO';
  totalSeats?: number;
  seatLayout?: unknown;
  seatMap?: string[];
}

export interface UpdateCustomRoleDto {
  name?: string;
  description?: string;
  permissions?: string[];
}

export interface UpdateDriverDto {
  fullName?: string;
  phone?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  isActive?: boolean;
}

export interface UpdateLayoutDto {
  name?: string;
  busType?: string;
  definition?: LayoutDefinitionDto;
}

export interface UpdateOperatorDto {
  legalName?: string;
  brandName?: string;
  email?: string;
  mobile?: string;
  commissionRate?: number;
  isActive?: boolean;
  /** Per-operator billing config (set by SuperAdmin; different per operator). */
  oneTimePlatformFee?: number;
  smsCharge?: number;
  whatsappCharge?: number;
  emailCharge?: number;
  extraCharges?: unknown;
}

export interface UpdateProfileDto {
  fullName?: string;
  phone?: string;
  /** Requirement 4 — profile-completion fields. */
  dateOfBirth?: string;
  gender?: string;
}

export interface UpdateRouteDto {
  name?: string;
  stops?: RouteStopDto[];
}

export interface UpsertFlagDto {
  key: string;
  description?: string;
  enabledGlobally?: boolean;
  scheduledAt?: string;
}

export interface ValidateCouponDto {
  code: string;
  fare: number;
}

export interface VehicleDocDto {
  busId: string;
  docType: string;
  documentNumber: string;
  expiresAt: string;
}

export interface VerifyEmailDto {
  email?: string;
  otp?: string;
  token?: string;
}

export interface VerifyOtpDto {
  email: string;
  code: string;
}

export interface VerifyPaymentDto {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface ViolationDto {
  driverId: string;
  type: string;
  note?: string;
}

export interface WalletPayDto {
  bookingId: string;
}
