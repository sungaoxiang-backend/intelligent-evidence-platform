// API 响应类型
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ListResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    size: number;
    pages: number;
  };
}

// 员工相关类型
export interface Staff {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  phone?: string;
  is_active: boolean;
  is_superuser: boolean;
}

export interface StaffCreate {
  username: string;
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
  is_active?: boolean;
  is_superuser?: boolean;
}

export interface StaffLogin {
  username: string;
  password: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

// 用户相关类型
export interface User {
  id: number;
  name: string;
  id_card?: string;
  phone?: string;
}

export interface UserCreate {
  name: string;
  id_card?: string;
  phone?: string;
}

// 案件相关类型
export enum CaseType {
  DEBT = "debt",
  CONTRACT = "contract"
}

export enum PartyType {
  PERSON = "person",
  COMPANY = "company",
  INDIVIDUAL = "individual"
}

export interface Case {
  id: number;
  title: string;
  description?: string;
  case_number: string;
  case_type: CaseType;
  creaditor_name: string;
  creditor_type?: PartyType;
  debtor_name: string;
  debtor_type?: PartyType;
  user_id: number;
  assigned_staff_id?: number;
  created_at: string;
  updated_at: string;
}

export interface CaseWithUser extends Case {
  user: User;
}

export interface CaseCreate {
  title: string;
  description?: string;
  case_number: string;
  case_type: CaseType;
  creaditor_name: string;
  creditor_type?: PartyType;
  debtor_name: string;
  debtor_type?: PartyType;
  user_id: number;
  assigned_staff_id?: number;
}

// 证据类型枚举
export enum EvidenceType {
  WECHAT_CHAT = "wechat_chat",
  ALIPAY_TRANSFER = "alipay_transfer",
  IOU = "iou",
  CONTRACT = "contract",
  BANK_STATEMENT = "bank_statement",
  INVOICE = "invoice",
  RECEIPT = "receipt",
  ID_CARD = "id_card",
  BUSINESS_LICENSE = "business_license",
  COURT_DOCUMENT = "court_document",
  OTHER = "other"
}

// 证据相关类型
export interface Evidence {
  id: number;
  case_id: number;
  uploaded_by_id: number;
  file_url: string;
  file_name: string;
  file_size: number;
  file_extension: string;
  tags?: string[];
  // 修改分类相关字段
  evidence_type?: string;  // 直接使用字符串类型，匹配后端返回的中文值
  classification_confidence?: number;
  classification_reasoning?: string;
  is_classified: boolean;
  created_at: string;
  updated_at: string;
}

export interface EvidenceWithCase extends Evidence {
  case: Case;
}

export interface EvidenceCreate {
  case_id: number;
  tags?: string[];
}

// 批量删除请求类型
export interface BatchDeleteRequest {
  evidence_ids: number[];
}

// 分类结果类型
export interface ClassificationResult {
  image_url: string;
  evidence_type: EvidenceType;
  confidence: number;
  reasoning: string;
}

export interface ClassificationResults {
  results?: ClassificationResult[];
}