import { Role } from '../enums/role.enum';
import { PermissionDef } from './permission.types';

/**
 * THE single source of truth for the permission catalog. Every permission is defined
 * once here with its group and default roles. Duplicate functionality from the source
 * matrix (API/marketplace/pricing/waitlist appearing in multiple sections) is collapsed
 * into one canonical permission. Per-operator overrides (RbacService) refine these defaults.
 */
export const PERMISSION_CATALOG: PermissionDef[] = [
  // ---- PLATFORM_USER_SECURITY ----
  { key: 'MANAGE_COUNTER', label: 'Manage counters/agents', group: 'OPERATOR_STAFF', roles: [Role.OPERATOR_ADMIN] },
  { key: 'VIEW_COUNTER', label: 'View counters', group: 'OPERATOR_STAFF', roles: [Role.OPERATOR_ADMIN, Role.SUPPORT] },
  { key: 'COUNTER_SALE', label: 'Record counter sale', group: 'OPERATOR_STAFF', roles: [Role.OPERATOR_ADMIN, Role.SUPPORT] },
  { key: 'MANAGE_COUPON', label: 'Manage coupons', group: 'PRICING', roles: [Role.SUPERADMIN, Role.OPERATOR_ADMIN, Role.FINANCE_MANAGER] },
  { key: 'VIEW_COUPON', label: 'View coupons', group: 'PRICING', roles: [Role.SUPERADMIN, Role.OPERATOR_ADMIN, Role.FINANCE_MANAGER] },
  { key: 'CREATE_PLATFORM_USER', label: 'Create Platform User', group: 'PLATFORM_USER_SECURITY', roles: [Role.SUPERADMIN] },
  { key: 'EDIT_PLATFORM_USER', label: 'Edit Platform User', group: 'PLATFORM_USER_SECURITY', roles: [Role.SUPERADMIN] },
  { key: 'SUSPEND_PLATFORM_USER', label: 'Suspend Platform User', group: 'PLATFORM_USER_SECURITY', roles: [Role.SUPERADMIN] },
  { key: 'RESET_USER_PASSWORD', label: 'Reset User Password', group: 'PLATFORM_USER_SECURITY', roles: [Role.SUPERADMIN, Role.PLATFORM_SUPPORT, Role.SUPPORT] },
  { key: 'ASSIGN_ROLE', label: 'Assign Role', group: 'PLATFORM_USER_SECURITY', roles: [Role.SUPERADMIN] },
  { key: 'IMPERSONATE_USER', label: 'Impersonate Operator User', group: 'PLATFORM_USER_SECURITY', roles: [Role.SUPERADMIN] },
  { key: 'VIEW_LOGIN_HISTORY', label: 'View Login History', group: 'PLATFORM_USER_SECURITY', roles: [Role.SUPERADMIN, Role.PLATFORM_SUPPORT, Role.SUPPORT] },
  { key: 'VIEW_SECURITY_DASHBOARD', label: 'View Security Dashboard', group: 'PLATFORM_USER_SECURITY', roles: [Role.SUPERADMIN] },
  // ---- PLATFORM_OPERATOR ----
  { key: 'CREATE_OPERATOR', label: 'Create Operator', group: 'PLATFORM_OPERATOR', roles: [Role.SUPERADMIN] },
  { key: 'EDIT_OPERATOR', label: 'Edit Operator', group: 'PLATFORM_OPERATOR', roles: [Role.SUPERADMIN] },
  { key: 'SUSPEND_OPERATOR', label: 'Suspend Operator', group: 'PLATFORM_OPERATOR', roles: [Role.SUPERADMIN] },
  { key: 'ACTIVATE_OPERATOR', label: 'Activate Operator', group: 'PLATFORM_OPERATOR', roles: [Role.SUPERADMIN] },
  { key: 'DELETE_OPERATOR', label: 'Delete Operator', group: 'PLATFORM_OPERATOR', roles: [Role.SUPERADMIN] },
  { key: 'VIEW_OPERATOR', label: 'View Operator Details', group: 'PLATFORM_OPERATOR', roles: [Role.SUPERADMIN, Role.OPERATOR_ADMIN, Role.PLATFORM_SUPPORT] },
  { key: 'CONFIGURE_OPERATOR_FEATURES', label: 'Configure Operator Features', group: 'PLATFORM_OPERATOR', roles: [Role.SUPERADMIN] },
  { key: 'VIEW_OPERATOR_USAGE', label: 'View Operator Usage', group: 'PLATFORM_OPERATOR', roles: [Role.SUPERADMIN] },
  { key: 'PROVISION_OPERATOR', label: 'Provision Operator', group: 'PLATFORM_OPERATOR', roles: [Role.SUPERADMIN] },
  { key: 'PURGE_OPERATOR_DATA', label: 'Purge Operator Data', group: 'PLATFORM_OPERATOR', roles: [Role.SUPERADMIN] },
  { key: 'VIEW_CROSS_OPERATOR_DASHBOARD', label: 'View Cross-Operator Dashboard', group: 'PLATFORM_OPERATOR', roles: [Role.SUPERADMIN] },
  // ---- PLATFORM_SUBSCRIPTION ----
  { key: 'CREATE_SUBSCRIPTION_PLAN', label: 'Create Subscription Plan', group: 'PLATFORM_SUBSCRIPTION', roles: [Role.SUPERADMIN] },
  { key: 'EDIT_SUBSCRIPTION_PLAN', label: 'Edit Subscription Plan', group: 'PLATFORM_SUBSCRIPTION', roles: [Role.SUPERADMIN] },
  { key: 'DELETE_SUBSCRIPTION_PLAN', label: 'Delete Subscription Plan', group: 'PLATFORM_SUBSCRIPTION', roles: [Role.SUPERADMIN] },
  { key: 'ACTIVATE_SUBSCRIPTION_PLAN', label: 'Activate Subscription Plan', group: 'PLATFORM_SUBSCRIPTION', roles: [Role.SUPERADMIN] },
  { key: 'ASSIGN_SUBSCRIPTION', label: 'Assign Subscription', group: 'PLATFORM_SUBSCRIPTION', roles: [Role.SUPERADMIN, Role.ACCOUNTANT] },
  { key: 'CHANGE_SUBSCRIPTION_PLAN', label: 'Change Subscription Plan', group: 'PLATFORM_SUBSCRIPTION', roles: [Role.SUPERADMIN, Role.ACCOUNTANT] },
  { key: 'RENEW_SUBSCRIPTION', label: 'Renew Subscription', group: 'PLATFORM_SUBSCRIPTION', roles: [Role.SUPERADMIN, Role.ACCOUNTANT] },
  { key: 'EXTEND_TRIAL', label: 'Extend Trial Period', group: 'PLATFORM_SUBSCRIPTION', roles: [Role.SUPERADMIN, Role.ACCOUNTANT] },
  { key: 'SUSPEND_SUBSCRIPTION', label: 'Suspend Subscription', group: 'PLATFORM_SUBSCRIPTION', roles: [Role.SUPERADMIN, Role.ACCOUNTANT] },
  { key: 'VIEW_SUBSCRIPTION', label: 'View Subscription History', group: 'PLATFORM_SUBSCRIPTION', roles: [Role.SUPERADMIN, Role.ACCOUNTANT, Role.OPERATOR_ADMIN] },
  { key: 'VIEW_MRR_ARR', label: 'View MRR/ARR Dashboard', group: 'PLATFORM_SUBSCRIPTION', roles: [Role.SUPERADMIN, Role.ACCOUNTANT] },
  // ---- PLATFORM_BILLING ----
  { key: 'CREATE_SAAS_INVOICE', label: 'Create Operator Invoice', group: 'PLATFORM_BILLING', roles: [Role.SUPERADMIN, Role.ACCOUNTANT] },
  { key: 'VOID_SAAS_INVOICE', label: 'Void Operator Invoice', group: 'PLATFORM_BILLING', roles: [Role.SUPERADMIN, Role.ACCOUNTANT] },
  { key: 'RECORD_SAAS_PAYMENT', label: 'Record Subscription Payment', group: 'PLATFORM_BILLING', roles: [Role.SUPERADMIN, Role.ACCOUNTANT] },
  { key: 'CREATE_SAAS_CREDIT_NOTE', label: 'Generate Credit Note', group: 'PLATFORM_BILLING', roles: [Role.SUPERADMIN, Role.ACCOUNTANT] },
  { key: 'CREATE_SAAS_DEBIT_NOTE', label: 'Generate Debit Note', group: 'PLATFORM_BILLING', roles: [Role.SUPERADMIN, Role.ACCOUNTANT] },
  { key: 'VIEW_SAAS_LEDGER', label: 'View Subscription Ledger', group: 'PLATFORM_BILLING', roles: [Role.SUPERADMIN, Role.ACCOUNTANT] },
  // ---- PLATFORM_CONFIG ----
  { key: 'CONFIGURE_PLATFORM_SETTINGS', label: 'Configure Platform Settings', group: 'PLATFORM_CONFIG', roles: [Role.SUPERADMIN] },
  { key: 'CONFIGURE_FEATURE_FLAGS', label: 'Configure Feature Flags', group: 'PLATFORM_CONFIG', roles: [Role.SUPERADMIN] },
  { key: 'CONFIGURE_MAINTENANCE_WINDOW', label: 'Configure Maintenance Window', group: 'PLATFORM_CONFIG', roles: [Role.SUPERADMIN] },
  { key: 'ENABLE_MAINTENANCE_MODE', label: 'Enable Maintenance Mode', group: 'PLATFORM_CONFIG', roles: [Role.SUPERADMIN] },
  { key: 'VIEW_CONFIG_VERSIONS', label: 'View Config Versions', group: 'PLATFORM_CONFIG', roles: [Role.SUPERADMIN] },
  { key: 'RESTORE_CONFIG_VERSION', label: 'Restore Config Version', group: 'PLATFORM_CONFIG', roles: [Role.SUPERADMIN] },
  // ---- PLATFORM_API ----
  { key: 'CREATE_API_PARTNER', label: 'Register API Partner', group: 'PLATFORM_API', roles: [Role.SUPERADMIN] },
  { key: 'APPROVE_API_PARTNER', label: 'Approve API Partner', group: 'PLATFORM_API', roles: [Role.SUPERADMIN] },
  { key: 'SUSPEND_API_PARTNER', label: 'Suspend API Partner', group: 'PLATFORM_API', roles: [Role.SUPERADMIN] },
  { key: 'GENERATE_API_KEY', label: 'Generate API Key', group: 'PLATFORM_API', roles: [Role.SUPERADMIN] },
  { key: 'REVOKE_API_KEY', label: 'Revoke API Key', group: 'PLATFORM_API', roles: [Role.SUPERADMIN] },
  { key: 'CONFIGURE_WEBHOOKS', label: 'Configure Webhooks', group: 'PLATFORM_API', roles: [Role.SUPERADMIN] },
  { key: 'MANAGE_API_VERSIONS', label: 'Manage API Versions', group: 'PLATFORM_API', roles: [Role.SUPERADMIN] },
  { key: 'VIEW_API_USAGE', label: 'View API Usage', group: 'PLATFORM_API', roles: [Role.SUPERADMIN] },
  // ---- PLATFORM_MARKETPLACE ----
  { key: 'CREATE_PARTNER_ACCOUNT', label: 'Create Partner Account', group: 'PLATFORM_MARKETPLACE', roles: [Role.SUPERADMIN] },
  { key: 'APPROVE_PARTNER', label: 'Approve Partner Registration', group: 'PLATFORM_MARKETPLACE', roles: [Role.SUPERADMIN] },
  { key: 'SUSPEND_PARTNER', label: 'Suspend Partner Account', group: 'PLATFORM_MARKETPLACE', roles: [Role.SUPERADMIN] },
  { key: 'CONFIGURE_PARTNER_COMMISSION', label: 'Configure Partner Commission', group: 'PLATFORM_MARKETPLACE', roles: [Role.SUPERADMIN] },
  { key: 'CONFIGURE_REVENUE_SHARING', label: 'Configure Revenue Sharing', group: 'PLATFORM_MARKETPLACE', roles: [Role.SUPERADMIN] },
  { key: 'VIEW_MARKETPLACE_ANALYTICS', label: 'View Marketplace Analytics', group: 'PLATFORM_MARKETPLACE', roles: [Role.SUPERADMIN] },
  // ---- PLATFORM_COMPLIANCE ----
  { key: 'PROCESS_DATA_ACCESS_REQUEST', label: 'Process Data Access Request', group: 'PLATFORM_COMPLIANCE', roles: [Role.SUPERADMIN, Role.PLATFORM_SUPPORT, Role.SUPPORT] },
  { key: 'PROCESS_DATA_DELETION_REQUEST', label: 'Process Data Deletion Request', group: 'PLATFORM_COMPLIANCE', roles: [Role.SUPERADMIN] },
  { key: 'CONFIGURE_CONSENT', label: 'Configure Consent Framework', group: 'PLATFORM_COMPLIANCE', roles: [Role.SUPERADMIN] },
  { key: 'VIEW_COMPLIANCE_DASHBOARD', label: 'View Compliance Dashboard', group: 'PLATFORM_COMPLIANCE', roles: [Role.SUPERADMIN] },
  { key: 'CONFIGURE_ENCRYPTION_KEYS', label: 'Configure/Rotate Encryption Keys', group: 'PLATFORM_COMPLIANCE', roles: [Role.SUPERADMIN] },
  // ---- PLATFORM_RELIABILITY ----
  { key: 'VIEW_SYSTEM_HEALTH', label: 'View System Health Dashboard', group: 'PLATFORM_RELIABILITY', roles: [Role.SUPERADMIN] },
  { key: 'VIEW_BACKGROUND_JOBS', label: 'View Background Jobs', group: 'PLATFORM_RELIABILITY', roles: [Role.SUPERADMIN] },
  { key: 'MANAGE_BACKGROUND_JOBS', label: 'Retry/Cancel Background Jobs', group: 'PLATFORM_RELIABILITY', roles: [Role.SUPERADMIN] },
  { key: 'SCHEDULE_SYSTEM_JOB', label: 'Schedule System Job', group: 'PLATFORM_RELIABILITY', roles: [Role.SUPERADMIN] },
  { key: 'APPROVE_DEPLOYMENT', label: 'Approve Production Deployment', group: 'PLATFORM_RELIABILITY', roles: [Role.SUPERADMIN] },
  { key: 'ROLLBACK_DEPLOYMENT', label: 'Rollback Production Deployment', group: 'PLATFORM_RELIABILITY', roles: [Role.SUPERADMIN] },
  // ---- PLATFORM_ANALYTICS ----
  { key: 'VIEW_EXECUTIVE_DASHBOARD', label: 'View Executive Dashboard', group: 'PLATFORM_ANALYTICS', roles: [Role.SUPERADMIN] },
  { key: 'VIEW_CROSS_OPERATOR_ANALYTICS', label: 'View Cross-Operator Analytics', group: 'PLATFORM_ANALYTICS', roles: [Role.SUPERADMIN] },
  { key: 'VIEW_PLATFORM_AUDIT_LOGS', label: 'View Global Audit Logs', group: 'PLATFORM_ANALYTICS', roles: [Role.SUPERADMIN] },
  // ---- OPERATOR_STAFF ----
  { key: 'CREATE_OPERATOR_STAFF', label: 'Create Operator Staff User', group: 'OPERATOR_STAFF', roles: [Role.OPERATOR_ADMIN] },
  { key: 'EDIT_OPERATOR_STAFF', label: 'Edit Operator Staff User', group: 'OPERATOR_STAFF', roles: [Role.OPERATOR_ADMIN] },
  { key: 'VIEW_STAFF_LIST', label: 'View Staff List', group: 'OPERATOR_STAFF', roles: [Role.OPERATOR_ADMIN] },
  { key: 'CONFIGURE_STAFF_PERMISSIONS', label: 'Tune Staff Permissions (operator override)', group: 'OPERATOR_STAFF', roles: [Role.OPERATOR_ADMIN] },
  // ---- BUS ----
  { key: 'CREATE_BUS', label: 'Create Bus', group: 'BUS', roles: [Role.OPERATOR_ADMIN] },
  { key: 'EDIT_BUS', label: 'Edit Bus', group: 'BUS', roles: [Role.OPERATOR_ADMIN] },
  { key: 'DELETE_BUS', label: 'Delete Bus', group: 'BUS', roles: [Role.OPERATOR_ADMIN] },
  { key: 'VIEW_BUS', label: 'View Bus Details', group: 'BUS', roles: [Role.OPERATOR_ADMIN, Role.DRIVER, Role.OPERATIONS_MANAGER, Role.DEPOT_MANAGER, Role.CREW] },
  { key: 'ACTIVATE_BUS', label: 'Activate/Deactivate Bus', group: 'BUS', roles: [Role.OPERATOR_ADMIN, Role.DEPOT_MANAGER] },
  { key: 'CREATE_SEAT_LAYOUT', label: 'Create Seat Layout', group: 'BUS', roles: [Role.OPERATOR_ADMIN] },
  // ---- ROUTE ----
  { key: 'CREATE_ROUTE', label: 'Create Route', group: 'ROUTE', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER] },
  { key: 'EDIT_ROUTE', label: 'Edit Route', group: 'ROUTE', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER] },
  { key: 'DELETE_ROUTE', label: 'Delete Route', group: 'ROUTE', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER] },
  { key: 'VIEW_ROUTE', label: 'View Route', group: 'ROUTE', roles: [Role.OPERATOR_ADMIN, Role.DRIVER, Role.OPERATIONS_MANAGER, Role.CREW] },
  { key: 'MANAGE_ROUTE_STOPS', label: 'Create/Edit/Delete Route Stops', group: 'ROUTE', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER] },
  // ---- SCHEDULE ----
  { key: 'CREATE_SCHEDULE', label: 'Create Schedule', group: 'SCHEDULE', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER] },
  { key: 'EDIT_SCHEDULE', label: 'Edit Schedule', group: 'SCHEDULE', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER] },
  { key: 'VIEW_SCHEDULE', label: 'View Schedule', group: 'SCHEDULE', roles: [Role.OPERATOR_ADMIN, Role.DRIVER, Role.OPERATIONS_MANAGER, Role.CREW] },
  { key: 'ACTIVATE_SCHEDULE', label: 'Activate/Suspend Schedule', group: 'SCHEDULE', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER] },
  // ---- TRIP ----
  { key: 'CREATE_TRIP', label: 'Create Trip', group: 'TRIP', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER] },
  { key: 'CANCEL_TRIP', label: 'Cancel Trip', group: 'TRIP', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER] },
  { key: 'ASSIGN_DRIVER', label: 'Assign Driver', group: 'TRIP', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER, Role.DEPOT_MANAGER] },
  { key: 'START_TRIP', label: 'Start Trip', group: 'TRIP', roles: [Role.OPERATOR_ADMIN, Role.DRIVER, Role.OPERATIONS_MANAGER] },
  { key: 'END_TRIP', label: 'End Trip', group: 'TRIP', roles: [Role.OPERATOR_ADMIN, Role.DRIVER, Role.OPERATIONS_MANAGER] },
  { key: 'VIEW_PASSENGER_MANIFEST', label: 'View Passenger Manifest', group: 'TRIP', roles: [Role.OPERATOR_ADMIN, Role.DRIVER, Role.OPERATIONS_MANAGER, Role.CREW] },
  // ---- SEAT_INVENTORY ----
  { key: 'BLOCK_SEATS', label: 'Block/Release Seats', group: 'SEAT_INVENTORY', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER] },
  { key: 'VIEW_SEAT_INVENTORY', label: 'View Seat Inventory', group: 'SEAT_INVENTORY', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER] },
  // ---- BOOKING ----
  { key: 'SEARCH_BUSES', label: 'Search Buses & Availability', group: 'BOOKING', roles: [Role.OPERATOR_ADMIN, Role.SUPPORT, Role.CUSTOMER, Role.OPERATIONS_MANAGER] },
  { key: 'CREATE_BOOKING', label: 'Create Booking', group: 'BOOKING', roles: [Role.OPERATOR_ADMIN, Role.SUPPORT, Role.CUSTOMER] },
  { key: 'EDIT_BOOKING', label: 'Edit Booking', group: 'BOOKING', roles: [Role.OPERATOR_ADMIN, Role.SUPPORT] },
  { key: 'CANCEL_BOOKING', label: 'Cancel Booking', group: 'BOOKING', roles: [Role.OPERATOR_ADMIN, Role.SUPPORT, Role.CUSTOMER, Role.PLATFORM_SUPPORT] },
  { key: 'HOLD_SEAT', label: 'Hold Seat Before Payment', group: 'BOOKING', roles: [Role.OPERATOR_ADMIN, Role.SUPPORT, Role.CUSTOMER] },
  { key: 'VIEW_BOOKING', label: 'View Booking & PNR', group: 'BOOKING', roles: [Role.OPERATOR_ADMIN, Role.SUPPORT, Role.CUSTOMER, Role.PLATFORM_SUPPORT, Role.FINANCE_MANAGER] },
  { key: 'SEARCH_BOOKING', label: 'Search Booking (PNR/Mobile/Name)', group: 'BOOKING', roles: [Role.OPERATOR_ADMIN, Role.SUPPORT, Role.PLATFORM_SUPPORT, Role.FINANCE_MANAGER] },
  { key: 'VIEW_BOOKING_DASHBOARD', label: 'View Booking Dashboard', group: 'BOOKING', roles: [Role.OPERATOR_ADMIN, Role.PLATFORM_SUPPORT, Role.OPERATIONS_MANAGER, Role.FINANCE_MANAGER] },
  // ---- TICKETING ----
  { key: 'PRINT_TICKET', label: 'Print/Reprint Ticket', group: 'TICKETING', roles: [Role.OPERATOR_ADMIN, Role.SUPPORT, Role.CUSTOMER] },
  { key: 'DOWNLOAD_TICKET', label: 'Download Ticket PDF', group: 'TICKETING', roles: [Role.OPERATOR_ADMIN, Role.SUPPORT, Role.CUSTOMER] },
  // ---- PASSENGER_TRANSFER ----
  { key: 'INITIATE_PASSENGER_TRANSFER', label: 'Initiate Passenger Transfer', group: 'PASSENGER_TRANSFER', roles: [Role.OPERATOR_ADMIN] },
  { key: 'APPROVE_PASSENGER_TRANSFER', label: 'Approve Passenger Transfer', group: 'PASSENGER_TRANSFER', roles: [Role.OPERATOR_ADMIN] },
  { key: 'REGENERATE_TICKET', label: 'Regenerate Ticket / New QR After Transfer', group: 'PASSENGER_TRANSFER', roles: [Role.OPERATOR_ADMIN] },
  { key: 'VIEW_TRANSFER_REPORTS', label: 'View Transfer Reports', group: 'PASSENGER_TRANSFER', roles: [Role.OPERATOR_ADMIN] },
  // ---- SEAT_UPGRADE ----
  { key: 'OFFER_SEAT_UPGRADE', label: 'Offer/Apply Seat Upgrade', group: 'SEAT_UPGRADE', roles: [Role.OPERATOR_ADMIN] },
  { key: 'APPROVE_SEAT_UPGRADE', label: 'Approve Seat Upgrade', group: 'SEAT_UPGRADE', roles: [Role.OPERATOR_ADMIN] },
  { key: 'VIEW_UPGRADE_REPORTS', label: 'View Upgrade Reports', group: 'SEAT_UPGRADE', roles: [Role.OPERATOR_ADMIN] },
  // ---- BOARDING ----
  { key: 'VIEW_BOARDING_LIST', label: 'View Boarding List', group: 'BOARDING', roles: [Role.OPERATOR_ADMIN, Role.DRIVER, Role.OPERATIONS_MANAGER, Role.CREW] },
  { key: 'SCAN_QR', label: 'Scan/Validate QR Ticket', group: 'BOARDING', roles: [Role.DRIVER, Role.CREW] },
  { key: 'MARK_BOARDED', label: 'Mark Passenger Boarded', group: 'BOARDING', roles: [Role.DRIVER, Role.CREW] },
  { key: 'MARK_NO_SHOW', label: 'Mark Passenger No Show', group: 'BOARDING', roles: [Role.DRIVER, Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER, Role.CREW] },
  // ---- PRICING ----
  { key: 'CREATE_FARE_RULE', label: 'Create Fare Rule', group: 'PRICING', roles: [Role.OPERATOR_ADMIN, Role.FINANCE_MANAGER] },
  { key: 'CONFIGURE_DYNAMIC_PRICING', label: 'Configure Dynamic Pricing', group: 'PRICING', roles: [Role.OPERATOR_ADMIN, Role.FINANCE_MANAGER] },
  { key: 'VIEW_FARE_CALENDAR', label: 'View Fare Calendar', group: 'PRICING', roles: [Role.OPERATOR_ADMIN, Role.FINANCE_MANAGER] },
  // ---- REFUND ----
  { key: 'CREATE_REFUND_REQUEST', label: 'Create Refund Request', group: 'REFUND', roles: [Role.OPERATOR_ADMIN, Role.SUPPORT, Role.CUSTOMER, Role.PLATFORM_SUPPORT, Role.FINANCE_MANAGER] },
  { key: 'APPROVE_REFUND', label: 'Approve Refund Request', group: 'REFUND', roles: [Role.OPERATOR_ADMIN, Role.FINANCE_MANAGER] },
  { key: 'PROCESS_REFUND', label: 'Process Refund', group: 'REFUND', roles: [Role.OPERATOR_ADMIN, Role.FINANCE_MANAGER] },
  { key: 'VIEW_REFUND_STATUS', label: 'View Refund Status', group: 'REFUND', roles: [Role.OPERATOR_ADMIN, Role.SUPPORT, Role.CUSTOMER, Role.PLATFORM_SUPPORT, Role.FINANCE_MANAGER] },
  // ---- SETTLEMENT ----
  { key: 'CREATE_SETTLEMENT', label: 'Create Settlement', group: 'SETTLEMENT', roles: [Role.OPERATOR_ADMIN, Role.FINANCE_MANAGER] },
  { key: 'APPROVE_SETTLEMENT', label: 'Approve Settlement', group: 'SETTLEMENT', roles: [Role.OPERATOR_ADMIN, Role.FINANCE_MANAGER] },
  { key: 'VIEW_SETTLEMENT_REPORTS', label: 'View Settlement Reports', group: 'SETTLEMENT', roles: [Role.OPERATOR_ADMIN, Role.FINANCE_MANAGER] },
  // ---- OPERATOR_FINANCE ----
  { key: 'VIEW_FINANCIAL_DASHBOARD', label: 'View Financial Dashboard', group: 'OPERATOR_FINANCE', roles: [Role.OPERATOR_ADMIN, Role.FINANCE_MANAGER] },
  { key: 'VIEW_LEDGER', label: 'View Ledger', group: 'OPERATOR_FINANCE', roles: [Role.OPERATOR_ADMIN, Role.FINANCE_MANAGER] },
  { key: 'CREATE_INVOICE', label: 'Create Invoice', group: 'OPERATOR_FINANCE', roles: [Role.OPERATOR_ADMIN, Role.FINANCE_MANAGER] },
  { key: 'VIEW_GST_REPORTS', label: 'View/Export GST Reports', group: 'OPERATOR_FINANCE', roles: [Role.OPERATOR_ADMIN, Role.FINANCE_MANAGER] },
  { key: 'VIEW_REVENUE_REPORTS', label: 'View Revenue/Profitability Reports', group: 'OPERATOR_FINANCE', roles: [Role.OPERATOR_ADMIN, Role.FINANCE_MANAGER] },
  { key: 'CLOSE_FINANCIAL_PERIOD', label: 'Close Financial Period', group: 'OPERATOR_FINANCE', roles: [Role.OPERATOR_ADMIN, Role.FINANCE_MANAGER] },
  // ---- DRIVER_COMPLIANCE ----
  { key: 'CREATE_DRIVER', label: 'Create Driver Profile', group: 'DRIVER_COMPLIANCE', roles: [Role.OPERATOR_ADMIN, Role.DEPOT_MANAGER] },
  { key: 'EDIT_DRIVER', label: 'Edit Driver Profile', group: 'DRIVER_COMPLIANCE', roles: [Role.OPERATOR_ADMIN, Role.DEPOT_MANAGER] },
  { key: 'UPLOAD_DRIVER_DOCUMENTS', label: 'Upload Driver License/Documents/Verification', group: 'DRIVER_COMPLIANCE', roles: [Role.OPERATOR_ADMIN, Role.DEPOT_MANAGER] },
  { key: 'RECORD_DRIVER_VIOLATION', label: 'Record Driver Violation/Incident', group: 'DRIVER_COMPLIANCE', roles: [Role.OPERATOR_ADMIN, Role.DEPOT_MANAGER] },
  { key: 'ASSIGN_DRIVER_TRAINING', label: 'Assign/Record Driver Training', group: 'DRIVER_COMPLIANCE', roles: [Role.OPERATOR_ADMIN, Role.DEPOT_MANAGER] },
  { key: 'VIEW_DRIVER_COMPLIANCE_DASHBOARD', label: 'View Driver Compliance Dashboard', group: 'DRIVER_COMPLIANCE', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER, Role.DEPOT_MANAGER] },
  { key: 'VIEW_EXPIRING_DOCS', label: 'View Expiring Document Reports', group: 'DRIVER_COMPLIANCE', roles: [Role.OPERATOR_ADMIN, Role.DEPOT_MANAGER] },
  // ---- FUEL ----
  { key: 'CREATE_FUEL_TXN', label: 'Create Fuel Transaction', group: 'FUEL', roles: [Role.OPERATOR_ADMIN, Role.DEPOT_MANAGER] },
  { key: 'APPROVE_FUEL_TXN', label: 'Approve Fuel Transaction', group: 'FUEL', roles: [Role.OPERATOR_ADMIN, Role.DEPOT_MANAGER] },
  { key: 'MANAGE_FUEL_CARD', label: 'Assign/Suspend Fuel Card', group: 'FUEL', roles: [Role.OPERATOR_ADMIN, Role.DEPOT_MANAGER] },
  { key: 'VIEW_FUEL_REPORTS', label: 'View Fuel Consumption/Efficiency/Variance Reports', group: 'FUEL', roles: [Role.OPERATOR_ADMIN, Role.FINANCE_MANAGER, Role.DEPOT_MANAGER] },
  // ---- FLEET_MAINTENANCE ----
  { key: 'CREATE_WORK_ORDER', label: 'Create Maintenance Work Order', group: 'FLEET_MAINTENANCE', roles: [Role.OPERATOR_ADMIN, Role.DEPOT_MANAGER] },
  { key: 'APPROVE_WORK_ORDER', label: 'Approve/Close Work Order', group: 'FLEET_MAINTENANCE', roles: [Role.OPERATOR_ADMIN, Role.DEPOT_MANAGER] },
  { key: 'MANAGE_PARTS_INVENTORY', label: 'Manage Tyre/Spare Parts Inventory', group: 'FLEET_MAINTENANCE', roles: [Role.OPERATOR_ADMIN, Role.DEPOT_MANAGER] },
  { key: 'MANAGE_VEHICLE_DOCS', label: 'Manage Insurance/Permit/Pollution Records', group: 'FLEET_MAINTENANCE', roles: [Role.OPERATOR_ADMIN, Role.DEPOT_MANAGER] },
  { key: 'VIEW_VEHICLE_HEALTH', label: 'View Vehicle Health Dashboard', group: 'FLEET_MAINTENANCE', roles: [Role.OPERATOR_ADMIN, Role.DEPOT_MANAGER] },
  // ---- CREW_HR ----
  { key: 'CREATE_EMPLOYEE', label: 'Create Employee Record', group: 'CREW_HR', roles: [Role.OPERATOR_ADMIN, Role.DEPOT_MANAGER] },
  { key: 'MANAGE_SHIFT', label: 'Create/Edit/Assign Shift', group: 'CREW_HR', roles: [Role.OPERATOR_ADMIN, Role.DEPOT_MANAGER] },
  { key: 'MANAGE_DUTY_ROSTER', label: 'Create/Edit/Publish Duty Roster', group: 'CREW_HR', roles: [Role.OPERATOR_ADMIN, Role.DEPOT_MANAGER] },
  { key: 'MANAGE_ATTENDANCE', label: 'Record/Correct Attendance', group: 'CREW_HR', roles: [Role.OPERATOR_ADMIN, Role.DEPOT_MANAGER] },
  { key: 'APPROVE_LEAVE', label: 'Approve/Reject Leave Request', group: 'CREW_HR', roles: [Role.OPERATOR_ADMIN, Role.DEPOT_MANAGER] },
  // ---- DISRUPTION ----
  { key: 'CREATE_DISRUPTION', label: 'Create Disruption Event', group: 'DISRUPTION', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER] },
  { key: 'CLOSE_DISRUPTION', label: 'Close Disruption Event', group: 'DISRUPTION', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER] },
  { key: 'DIVERT_ROUTE', label: 'Divert Route / Change Boarding/Drop', group: 'DISRUPTION', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER] },
  { key: 'DEPLOY_BACKUP', label: 'Deploy Backup Bus/Crew', group: 'DISRUPTION', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER] },
  { key: 'VIEW_DISRUPTION_DASHBOARD', label: 'View Disruption Dashboard', group: 'DISRUPTION', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER] },
  { key: 'RECORD_RCA', label: 'Record/Approve Root Cause Analysis', group: 'DISRUPTION', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER] },
  // ---- FORECASTING ----
  { key: 'GENERATE_FORECAST', label: 'Generate Demand/Occupancy/Revenue Forecast', group: 'FORECASTING', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER] },
  { key: 'VIEW_FORECAST_DASHBOARD', label: 'View Forecast Dashboard', group: 'FORECASTING', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER] },
  // ---- SUPPORT_CRM ----
  { key: 'CREATE_SUPPORT_TICKET', label: 'Create Support Ticket', group: 'SUPPORT_CRM', roles: [Role.OPERATOR_ADMIN, Role.SUPPORT, Role.CUSTOMER, Role.PLATFORM_SUPPORT] },
  { key: 'ASSIGN_SUPPORT_TICKET', label: 'Assign/Escalate Support Ticket', group: 'SUPPORT_CRM', roles: [Role.SUPPORT, Role.PLATFORM_SUPPORT] },
  { key: 'CLOSE_SUPPORT_TICKET', label: 'Close Support Ticket', group: 'SUPPORT_CRM', roles: [Role.SUPPORT, Role.PLATFORM_SUPPORT] },
  { key: 'VIEW_SUPPORT_TICKETS', label: 'View Support Tickets', group: 'SUPPORT_CRM', roles: [Role.OPERATOR_ADMIN, Role.SUPPORT, Role.PLATFORM_SUPPORT] },
  { key: 'CREATE_COMPLAINT', label: 'Create Customer Complaint', group: 'SUPPORT_CRM', roles: [Role.SUPPORT, Role.CUSTOMER, Role.PLATFORM_SUPPORT] },
  { key: 'RESOLVE_COMPLAINT', label: 'Resolve/Reopen Complaint', group: 'SUPPORT_CRM', roles: [Role.SUPPORT, Role.PLATFORM_SUPPORT] },
  { key: 'VIEW_CUSTOMER_TIMELINE', label: 'View Customer Timeline/Interaction', group: 'SUPPORT_CRM', roles: [Role.OPERATOR_ADMIN, Role.SUPPORT, Role.PLATFORM_SUPPORT] },
  { key: 'BLACKLIST_PASSENGER', label: 'Blacklist/Whitelist Passenger', group: 'SUPPORT_CRM', roles: [Role.OPERATOR_ADMIN, Role.SUPPORT] },
  { key: 'MANAGE_LOST_FOUND', label: 'Manage Lost & Found Cases', group: 'SUPPORT_CRM', roles: [Role.SUPPORT] },
  { key: 'VIEW_SUPPORT_DASHBOARD', label: 'View Support Dashboard', group: 'SUPPORT_CRM', roles: [Role.OPERATOR_ADMIN, Role.SUPPORT, Role.PLATFORM_SUPPORT] },
  // ---- TRACKING ----
  { key: 'GPS_PING', label: 'Send GPS Ping', group: 'TRACKING', roles: [Role.DRIVER] },
  { key: 'MANAGE_GPS_PROVIDER', label: 'Enable/Disable GPS Provider', group: 'PLATFORM_CONFIG', roles: [Role.SUPERADMIN] },
  { key: 'CONFIGURE_GPS', label: 'Configure GPS Integration', group: 'TRACKING', roles: [Role.OPERATOR_ADMIN, Role.DEPOT_MANAGER] },
  { key: 'MAP_GPS_DEVICE', label: 'Map Bus to GPS Device', group: 'TRACKING', roles: [Role.OPERATOR_ADMIN, Role.DEPOT_MANAGER] },
  { key: 'VIEW_LIVE_TRACKING', label: 'View Live GPS Tracking', group: 'TRACKING', roles: [Role.OPERATOR_ADMIN, Role.DRIVER, Role.CUSTOMER, Role.OPERATIONS_MANAGER, Role.DEPOT_MANAGER, Role.CREW] },
  // ---- REPORTS ----
  { key: 'VIEW_OPERATIONS_DASHBOARD', label: 'View Operations Dashboard', group: 'REPORTS', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER, Role.DEPOT_MANAGER] },
  { key: 'CREATE_CUSTOM_REPORT', label: 'Create/Edit Custom Report', group: 'REPORTS', roles: [Role.OPERATOR_ADMIN] },
  { key: 'VIEW_OCCUPANCY_REPORT', label: 'View Occupancy Report', group: 'REPORTS', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER] },
  // ---- AUDIT ----
  { key: 'VIEW_AUDIT_LOGS', label: 'View Audit Logs', group: 'AUDIT', roles: [Role.OPERATOR_ADMIN, Role.SUPPORT, Role.FINANCE_MANAGER] },
  { key: 'EXPORT_AUDIT_LOGS', label: 'Export Audit Logs', group: 'AUDIT', roles: [Role.OPERATOR_ADMIN, Role.FINANCE_MANAGER] },
  // ---- WORKFLOW / APPROVAL ----
  { key: 'CREATE_APPROVAL_REQUEST', label: 'Create Approval Request', group: 'WORKFLOW', roles: [Role.OPERATOR_ADMIN, Role.SUPPORT, Role.OPERATIONS_MANAGER, Role.FINANCE_MANAGER, Role.DEPOT_MANAGER] },
  { key: 'VIEW_APPROVAL_REQUESTS', label: 'View Approval Requests', group: 'WORKFLOW', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER, Role.FINANCE_MANAGER] },
  { key: 'DECIDE_APPROVAL_REQUEST', label: 'Approve/Reject Approval Request', group: 'WORKFLOW', roles: [Role.OPERATOR_ADMIN] },
  // ---- HUB & SPOKE ----
  { key: 'MANAGE_HUB', label: 'Manage Hubs', group: 'HUB', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER, Role.DEPOT_MANAGER] },
  { key: 'VIEW_HUB', label: 'View Hubs', group: 'HUB', roles: [Role.OPERATOR_ADMIN, Role.SUPPORT, Role.OPERATIONS_MANAGER, Role.DEPOT_MANAGER] },
  { key: 'MANAGE_HUB_ROUTE', label: 'Manage Hub Spoke Routes', group: 'HUB', roles: [Role.OPERATOR_ADMIN, Role.OPERATIONS_MANAGER] },
];

export const ALL_PERMISSIONS: string[] = PERMISSION_CATALOG.map((p) => p.key);

export function permissionsForRole(role: Role): string[] {
  return PERMISSION_CATALOG.filter((p) => p.roles.includes(role)).map((p) => p.key);
}
