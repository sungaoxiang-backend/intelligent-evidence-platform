async getCurrentUser() {
    return this.request<any>('/staffs/me');
  }