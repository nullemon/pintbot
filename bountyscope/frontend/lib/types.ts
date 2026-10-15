export type Page<T> = { items: T[]; total: number; limit: number; offset: number };
export type ScopeRule = { id?: string; rule_type: string; value: string; enabled: boolean };
export type Project = {
  id: string; name: string; organization: string; program_name: string; program_url: string;
  rules_text: string; authorization_type: string; authorization_confirmed: boolean;
  root_domains: string[]; notes: string; max_rps: number; max_concurrency: number;
  max_depth: number; url_cap: number; request_budget: number; created_at: string; scope?: ScopeRule[];
};
export type Scan = {
  id: string; project_id: string; target: string; status: string; scan_profile: string;
  created_at: string; started_at?: string; finished_at?: string; requests_sent: number;
  assets_found: number; endpoints_found: number; findings_found: number; errors: unknown[];
  limits?: Record<string, number>; scope_snapshot?: ScopeRule[]; cancel_requested?: boolean;
};
export type ScanEvent = { id: string; kind: string; data: Record<string, unknown>; created_at: string };
export type Finding = {
  id: string; project_id: string; scan_id: string; title: string; severity: string; confidence: number;
  status: string; scanner: string; category: string; affected_url: string; description: string;
  recommendation: string; evidence_summary: string; researcher_notes: string; cwe: string;
  owasp_category: string; affected_parameter?: string; fingerprint: string; created_at: string; updated_at: string;
  ai_analysis: Record<string, unknown>; evidence?: Evidence[];
};
export type Evidence = { id: string; type: string; request_metadata: Record<string, unknown>; response_metadata: Record<string, unknown>; redacted_excerpt: string; body_sha256: string };
export type Asset = { id: string; hostname: string; ip: string; port: number; scheme: string; status_code?: number; title: string; technology: string[]; in_scope: boolean; last_seen: string; server: string };
export type Endpoint = { id: string; url: string; method: string; status_code?: number; content_type: string; source: string; parameters: unknown[]; content_length: number };
export type Report = { id: string; finding_id: string; format: string; content: string; created_at: string };
export type Dashboard = { projects: number; scans: number; assets: number; endpoints: number; findings: number; active_scans: number; severity_counts: Record<string, number>; recent_scans: Scan[]; recent_findings: Finding[] };
