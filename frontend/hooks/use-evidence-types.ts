import { useState, useEffect } from 'react';

interface EvidenceTypeConfig {
  type: string;
  description: string;
  category: string;
  supported_roles: string[];
}

interface EvidenceTypesResponse {
  metadata: {
    version: string;
    last_updated: string;
    total_evidence_types: number;
    categories: string[];
  };
  evidence_types: Record<string, EvidenceTypeConfig>;
}

export const useEvidenceTypes = () => {
  const [evidenceTypes, setEvidenceTypes] = useState<Record<string, EvidenceTypeConfig>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvidenceTypes = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:8008/api/v1/config/evidence-types');
        
        if (!response.ok) {
          throw new Error(`获取证据类型配置失败: ${response.status}`);
        }
        
        const data: EvidenceTypesResponse = await response.json();
        setEvidenceTypes(data.evidence_types);
        setError(null);
      } catch (err) {
        console.error('获取证据类型配置失败:', err);
        setError(err instanceof Error ? err.message : '获取证据类型配置失败');
      } finally {
        setLoading(false);
      }
    };

    fetchEvidenceTypes();
  }, []);

  const getSupportedRolesForEvidenceType = (evidenceType: string): string[] => {
    // 首先尝试通过type字段匹配
    const config = Object.values(evidenceTypes).find(
      (config) => config.type === evidenceType
    );
    
    if (config) {
      return config.supported_roles || [];
    }
    
    // 如果没有找到，返回空数组
    return [];
  };

  const getEvidenceTypeByKey = (key: string): EvidenceTypeConfig | undefined => {
    return evidenceTypes[key];
  };

  const getAllEvidenceTypes = (): Record<string, EvidenceTypeConfig> => {
    return evidenceTypes;
  };

  return {
    evidenceTypes,
    loading,
    error,
    getSupportedRolesForEvidenceType,
    getEvidenceTypeByKey,
    getAllEvidenceTypes,
  };
};
