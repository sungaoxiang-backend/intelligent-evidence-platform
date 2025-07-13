const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    // 从 localStorage 获取 token
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('access_token');
    }
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // 认证相关
  async login(credentials: { username: string; password: string }) {
    const formData = new FormData();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);

    const response = await fetch(`${this.baseURL}/login/access-token`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('登录失败');
    }

    const result = await response.json();
    // 修复：从 result.data 中获取 access_token
    this.setToken(result.data.access_token);
    return result.data;
  }

  async getCurrentUser() {
    return this.request<any>('/staffs/me');
  }

  // 员工相关
  async getStaffs(params?: { skip?: number; limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    
    const query = searchParams.toString();
    return this.request<any>(`/staffs${query ? `?${query}` : ''}`);
  }

  async getStaff(id: number) {
    return this.request<any>(`/staffs/${id}`);
  }

  async createStaff(data: any) {
    return this.request<any>('/staffs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateStaff(id: number, data: any) {
    return this.request<any>(`/staffs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteStaff(id: number) {
    return this.request<any>(`/staffs/${id}`, {
      method: 'DELETE',
    });
  }

  // 用户相关
  async getUsers(params?: { skip?: number; limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    
    const query = searchParams.toString();
    return this.request<any>(`/users${query ? `?${query}` : ''}`);
  }

  async getUser(id: number) {
    return this.request<any>(`/users/${id}`);
  }

  async createUser(data: any) {
    return this.request<any>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: number, data: any) {
    return this.request<any>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id: number) {
    return this.request<any>(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  // 案件相关
  async getCases(params?: { skip?: number; limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    
    const query = searchParams.toString();
    return this.request<any>(`/cases${query ? `?${query}` : ''}`);
  }

  async getCase(id: number) {
    return this.request<any>(`/cases/${id}`);
  }

  async createCase(data: any) {
    return this.request<any>('/cases', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCase(id: number, data: any) {
    return this.request<any>(`/cases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCase(id: number) {
    return this.request<any>(`/cases/${id}`, {
      method: 'DELETE',
    });
  }

  // 证据相关
  async getEvidences(params?: { skip?: number; limit?: number; case_id?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.case_id) searchParams.append('case_id', params.case_id.toString());
    
    const query = searchParams.toString();
    return this.request<any>(`/evidences${query ? `?${query}` : ''}`);
  }

  async getEvidence(id: number) {
    return this.request<any>(`/evidences/${id}`);
  }

  async createEvidence(data: any) {
    return this.request<any>('/evidences', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEvidence(id: number, data: any) {
    return this.request<any>(`/evidences/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEvidence(id: number) {
    return this.request<any>(`/evidences/${id}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);