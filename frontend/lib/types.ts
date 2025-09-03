// 数据类型定义
export type CaseType = "debt" | "contract";
export type PartyType = "person" | "company" | "individual";

export interface AssociationEvidenceFeature {
  id: number;
  slot_group_name: string;
  association_evidence_ids: number[];
  evidence_feature_status: string;
  evidence_features: Array<{
    slot_name: string;
    slot_value: string;
    slot_value_from_url: string[];
    confidence: number;
    reasoning: string;
  }>;
  features_extracted_at: string;
  validation_status: string;
  case_id: number;
}

export interface CaseParty {
  id?: number;  // 创建时可选
  party_name: string;
  party_role: string;
  party_type: PartyType | null;
  // 主体信息
  name?: string;
  gender?: string;
  birthday?: string;
  nation?: string;
  address?: string;
  id_card?: string;
  phone?: string;
  // 公司或个体工商户信息
  company_name?: string;
  company_address?: string;
  company_code?: string;
  // 银行信息
  owner_name?: string;
  bank_address?: string;
  bank_account?: string;
  bank_phone?: string;
}

export interface Case {
  id: number;
  user_id: number;
  case_type: CaseType | null;
  case_parties: CaseParty[];
  loan_amount?: number;
  loan_date?: string;
  court_name?: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  user?: User;
  association_evidence_features?: AssociationEvidenceFeature[];
  // 保留旧字段以兼容，但标记为可选
  creditor_name?: string;
  creditor_phone?: string;
  creditor_bank_account?: string;
  creditor_bank_address?: string;
  creditor_type?: PartyType | null;
  debtor_name?: string;
  debtor_phone?: string;
  debtor_type?: PartyType | null;
}

export interface Evidence {
  id: string
  name: string
  caseId: string
  caseTitle: string
  type: string
  format: string
  size: string
  uploadDate: string
  uploader: string
  status: "已标注" | "待标注" | "标注中" | "已拒绝"
  description: string
  isKey: boolean
  thumbnail?: string
  fullImage?: string
  aiAnnotations?: {
    extractedText: string
    entities: string[]
    confidence: number
    category: string
    tags: string[]
  }
  metadata: {
    resolution?: string
    fileSize: string
    createTime: string
    device: string
    location: string
    duration?: string
  }
}

export interface User {
  id: number
  name: string
  id_card?: string
  phone?: string
  type?: string
  email?: string
  address?: string
  status?: "活跃" | "待联系" | "已结案"
  wechat_nickname?: string
  wechat_number?: string
  wechat_avatar?: string
  caseCount?: number
  totalAmount?: string
  registerDate?: string
  lastContact?: string
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface Staff {
  id: string
  name: string
  email: string
  role: string
  department: string
  status: "在线" | "离线" | "忙碌"
  joinDate: string
  caseCount: number
}

// API 响应类型
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  total?: number
  pagination?: any
}

// 分页参数
export interface PaginationParams {
  page: number
  pageSize: number
  search?: string
  filters?: Record<string, any>
  user_id?: number
}
