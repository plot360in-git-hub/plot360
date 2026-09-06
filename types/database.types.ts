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
  | 'ec_reference_copy';
export type TaskStatus = 'not_done' | 'in_progress' | 'complete';
export type MediaType = 'photo' | 'video';

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
export type MonitoringJobStatus = 'assigned' | 'accepted' | 'submitted' | 'approved' | 'rejected';

export interface AgentProfile {
  id: string;
  status: AgentStatus;
  admin_notes: string | null;
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
  assigned_at: string;
  accepted_at: string | null;
  submitted_at: string | null;
  decided_at: string | null;
}

export interface MonitoringMedia {
  id: string;
  job_id: string;
  media_type: MediaType;
  file_path: string;
  uploaded_at: string;
}
