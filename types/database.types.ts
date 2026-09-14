// Hand-authored equivalent of what `supabase gen types typescript` would produce.
// Once the project is live, replace this file with the real generated types:
//   npx supabase gen types typescript --project-id <id> > types/database.types.ts

export type PropertyType = 'residential' | 'commercial' | 'agricultural' | 'industrial';
export type PlotShape = 'square' | 'rectangular' | 'irregular' | 'l_shape';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type DocumentType =
  | 'title_deed'
  | 'encumbrance_certificate'
  | 'noc'
  | 'approval_letter'
  | 'owner_id'
  | 'ownership_proof'
  | 'ec_reference_copy'
  | 'ec_digital_copy';
export type TaskStatus = 'not_done' | 'in_progress' | 'complete';
export type MediaType = 'photo' | 'video' | 'document';

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface GpsPoint {
  lat?: number;
  lng?: number;
}

export interface GpsCorners {
  ne?: GpsPoint;
  se?: GpsPoint;
  nw?: GpsPoint;
  sw?: GpsPoint;
}

export interface Profile {
  id: string;
  username: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string | null;
  gender: 'male' | 'female' | 'other' | null;
  profile_picture_url: string | null;
  email: string;
  phone_country_code: string | null;
  phone_number: string | null;
  current_address: Address;
  permanent_address: Address;
  identity_proof_type: string | null;
  identity_proof_url: string | null;
  security_question_1: string | null;
  security_answer_1: string | null;
  security_question_2: string | null;
  security_answer_2: string | null;
  how_heard_about_us: string | null;
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  owner_id: string;
  property_name: string;
  property_type: PropertyType;
  plot_size: number | null;
  plot_size_unit: string;
  plot_shape: PlotShape | null;
  description: string | null;
  street_address: string | null;
  local_area: string | null;
  village_town: string | null;
  mandal_taluka: string | null;
  district: string | null;
  state: string | null;
  postal_code: string | null;
  registration_office: string | null;
  sro_name: string | null;
  sro_code: string | null;
  plot_gps_coordinate: string | null;
  google_map_lat: number | null;
  google_map_lng: number | null;
  near_by_landmark: string | null;
  gps_corners: GpsCorners;
  status: VerificationStatus;
  registration_date: string | null;
  expiration_date: string | null;
  next_monitoring_due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyOwnership {
  id: string;
  property_id: string;
  owner_full_name: string | null;
  is_registered_user_owner: boolean | null;
  agent_entry_allowed: boolean | null;
  noc_file_url: string | null;
  approval_letter_url: string | null;
  owner_id_proof_url: string | null;
  ownership_proof_url: string | null;
  no_legal_case_declared: boolean;
  agent_entry_terms_agreed: boolean;
  other_terms_conditions: string | null;
  ec_digital_copy_requested: boolean | null;
  ec_document_number: string | null;
  ec_registration_year: string | null;
  ec_registered_sro: string | null;
  created_at: string;
}

export interface PropertyDocument {
  id: string;
  property_id: string;
  doc_type: DocumentType;
  file_path: string;
  uploaded_at: string;
}

export interface Task {
  id: string;
  property_id: string;
  task_name: string;
  task_type: string | null;
  status: TaskStatus;
  start_date: string | null;
  completed_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskMedia {
  id: string;
  task_id: string;
  media_type: MediaType;
  file_path: string;
  uploaded_at: string;
}

export type AgentStatus = 'pending' | 'verified' | 'rejected';
export type AgentDocumentType = 'driving_license' | 'secondary_id';
export type MonitoringJobStatus = 'assigned' | 'accepted' | 'submitted' | 'approved' | 'ec_pending' | 'rejected';
export type BoundarySide = 'N' | 'E' | 'S' | 'W';
export type WhatsappMessageState = 'sent' | 'failed';
export type BanSubjectType = 'customer' | 'agent';
export type EnquiryStatus = 'new' | 'contacted';

export interface AgentProfile {
  id: string;
  status: AgentStatus;
  admin_notes: string | null;
  sro_name: string | null;
  sro_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentDocument {
  id: string;
  agent_id: string;
  doc_type: AgentDocumentType;
  file_path: string;
  uploaded_at: string;
}

export interface MonitoringJob {
  id: string;
  property_id: string;
  agent_id: string;
  assigned_by: string | null;
  status: MonitoringJobStatus;
  observations: string | null;
  admin_feedback: string | null;
  admin_remarks: string | null;
  assigned_at: string;
  accepted_at: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  // Redesign 2026-09 (visits) — see supabase/schema.sql "Redesign 2026-09 — foundation"
  visit_number: number | null;
  requested_window_start: string | null;
  requested_window_end: string | null;
  gps_distance_meters: number | null;
  flagged: boolean;
  visit_credit_id: string | null;
  // The ten fixed on-site checks (lib/visitReportQuestions.ts is the source of truth for keys/labels)
  q_boundary_intact: boolean | null;
  q_encroachment: boolean | null;
  q_illegal_dumping: boolean | null;
  q_vacant_as_expected: boolean | null;
  q_unauthorized_construction: boolean | null;
  q_boundary_markers_visible: boolean | null;
  q_govt_notice_posted: boolean | null;
  q_water_logging: boolean | null;
  q_overall_condition: string | null;
  q_attention_needed: string | null;
}

export interface MonitoringMedia {
  id: string;
  job_id: string;
  media_type: MediaType;
  file_path: string;
  uploaded_at: string;
  // Redesign 2026-09 (visit_media) — which side of the boundary this photo covers
  boundary_side: BoundarySide | null;
}

export interface MonitoringUploadToken {
  id: string;
  job_id: string;
  token: string;
  expires_at: string;
  created_at: string;
  // Redesign 2026-09 (agent_upload_links) — set the moment a submission
  // goes through, so the link dies immediately even within its 7-day window
  consumed_at: string | null;
}

// ---------- Redesign 2026-09 — visit credits, WhatsApp log, admin timeline, bans, enquiries ----------
// See supabase/schema.sql "Redesign 2026-09 — foundation" for the migration
// these types describe, and design_handoff_plot360_redesign/README.md for
// the product spec ("Data — what needs storing").

export interface VisitCredit {
  id: string;
  property_id: string;
  payment_id: string | null;
  quantity_purchased: number;
  quantity_used: number;
  purchased_at: string;
  expires_at: string;
  extension_granted: boolean;
  extension_reason: string | null;
  extension_days: number | null;
  extended_by: string | null;
  extended_at: string | null;
  created_at: string;
}

export type WhatsappRelatedEntityType =
  | 'monitoring_job'
  | 'property'
  | 'agent_profile'
  | 'payment'
  | 'service_request'
  | 'enquiry';

export interface WhatsappMessage {
  id: string;
  related_entity_type: WhatsappRelatedEntityType;
  related_entity_id: string | null;
  recipient_phone: string | null;
  body: string;
  state: WhatsappMessageState;
  failure_reason: string | null;
  sent_by: string | null;
  resent_at: string | null;
  created_at: string;
}

export interface AdminAction {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string | null;
  note: string | null;
  created_at: string;
}

export interface Ban {
  id: string;
  subject_type: BanSubjectType;
  subject_id: string;
  active: boolean;
  reason: string | null;
  actor: string | null;
  created_at: string;
  updated_at: string;
}

export interface Enquiry {
  id: string;
  name: string;
  mobile: string;
  plot_location: string | null;
  notes: string | null;
  status: EnquiryStatus;
  created_at: string;
}
