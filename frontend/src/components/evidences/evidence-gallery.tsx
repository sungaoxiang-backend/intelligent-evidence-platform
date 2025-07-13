"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, Download, FileText, Eye } from "lucide-react";
import { formatFileSize, getFileIcon, isImageFile } from "@/lib/utils";

interface FileWithPreview extends File {
  id: string;
  preview?: string;
  uploadProgress?: number;
  uploadStatus?: 'pending' | 'uploading' | 'uploaded' | 'classifying' | 'completed' | 'error';
  classificationResult?: {
    evidence_type: string;
    confidence: number;
    reasoning: string;
  };
}

interface EvidenceGalleryProps {
  onFilesClassified?: (results: any[]) => void;
}

export function EvidenceGallery({ onFilesClassified }: EvidenceGalleryProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileWithPreview | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);

  // 文件拖拽上传
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => {
      const fileWithPreview: FileWithPreview = Object.assign(file, {
        id: Math.random().toString(36).substr(2, 9),
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        uploadProgress: 0,
        uploadStatus: 'pending' as const,
      });
      return fileWithPreview;
    });

    const updatedFiles = [...files, ...newFiles];
    setFiles(updatedFiles);
    
    // 自动选择第一个文件
    if (!selectedFile && newFiles.length > 0) {
      setSelectedFile(newFiles[0]);
    }
  }, [files, selectedFile]);

  // 修改useDropzone配置
  // 修复useDropzone配置
  const { getInputProps, getRootProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    noClick: true, // 禁用全局点击
    noKeyboard: true, // 禁用键盘事件
    noDrag: true, // 禁用全局拖拽
  });

  // 单个文件分类（真实WebSocket连接）
  const classifyFile = async (file: FileWithPreview) => {
    const updateFileStatus = (status: FileWithPreview['uploadStatus'], progress?: number, result?: any) => {
      setFiles(prev => prev.map(f => 
        f.id === file.id 
          ? { ...f, uploadStatus: status, uploadProgress: progress, classificationResult: result }
          : f
      ));
      
      setSelectedFile(prev => 
        prev?.id === file.id 
          ? { ...prev, uploadStatus: status, uploadProgress: progress, classificationResult: result }
          : prev
      );
    };

    return new Promise((resolve, reject) => {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${wsProtocol}//${window.location.host}/api/v1/agentic/ws/classify`);
  
      ws.onopen = async () => {
        updateFileStatus('uploading', 10);
        // 读取文件为ArrayBuffer并发送
        const arrayBuffer = await file.arrayBuffer();
        ws.send(arrayBuffer);
      };
  
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.status) {
            case 'uploading':
              updateFileStatus('uploading', 25);
              break;
            case 'uploaded':
              updateFileStatus('uploading', 50);
              break;
            case 'classifying':
              updateFileStatus('uploading', 75);
              break;
            case 'completed':
              if (data.result && data.result.results && data.result.results.length > 0) {
                const classificationResult = {
                  evidenceType: data.result.results[0].evidence_type,
                  confidence: data.result.results[0].confidence,
                  reasoning: data.result.results[0].reasoning
                };
                updateFileStatus('completed', 100, classificationResult);
              } else {
                updateFileStatus('error', 0);
              }
              ws.close();
              resolve(data.result);
              break;
            case 'error':
              updateFileStatus('error', 0);
              ws.close();
              reject(new Error(data.message || '分类失败'));
              break;
          }
        } catch (error) {
          console.error('解析WebSocket消息失败:', error);
          updateFileStatus('error', 0);
          ws.close();
          reject(error);
        }
      };
  
      ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
        updateFileStatus('error', 0);
        reject(error);
      };
    });
  };

  // 开始分类识别
  const startClassification = async () => {
    if (files.length === 0) return;
    
    setIsClassifying(true);
    
    try {
      // 并发处理所有文件
      const classificationPromises = files
        .filter(file => file.uploadStatus !== 'completed')
        .map(file => classifyFile(file).catch(error => {
          console.error(`文件 ${file.name} 分类失败:`, error);
          return null;
        }));
      
      const results = await Promise.allSettled(classificationPromises);
      
      // 调用回调函数，传递分类结果
      if (onFilesClassified) {
        const successResults = results
          .filter(result => result.status === 'fulfilled' && result.value)
          .map(result => (result as PromiseFulfilledResult<any>).value);
        onFilesClassified(successResults);
      }
    } catch (error) {
      console.error('批量分类失败:', error);
    } finally {
      setIsClassifying(false);
    }
  };

  // 选择文件
  const selectFile = (file: FileWithPreview) => {
    setSelectedFile(file);
  };

  // 获取状态文本
  const getStatusText = (status: FileWithPreview['uploadStatus']) => {
    switch (status) {
      case 'pending': return '待上传';
      case 'uploading': return '上传中...';
      case 'uploaded': return '上传完成';
      case 'classifying': return '识别中...';
      case 'completed': return '识别完成';
      case 'error': return '识别失败';
      default: return '未知状态';
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 左侧面板 - 文件列表 */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold mb-4">证据文件</h2>
          
          {/* 文件上传区域 */}
          <div
            {...getRootProps()}
            onClick={(e) => {
              e.stopPropagation();
              open(); // 手动触发文件选择
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const files = Array.from(e.dataTransfer.files);
              onDrop(files);
            }}
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-blue-400'
            }`}
          >
            <input {...getInputProps()} style={{ display: 'none' }} />
            <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">
              {isDragActive ? '放下文件' : '选择文件'}
            </p>
          </div>
          
          <Button 
            onClick={startClassification}
            disabled={files.length === 0 || isClassifying}
            className="w-full mt-3"
          >
            {isClassifying ? '识别中...' : '开始识别'}
          </Button>
        </div>
        
        {/* 文件缩略图列表 */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {files.map((file) => {
            const isSelected = selectedFile?.id === file.id;
            const fileIcon = getFileIcon(file.name?.split('.').pop() || '');
            
            return (
              <div
                key={file.id}
                onClick={() => selectFile(file)}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  isSelected 
                    ? 'bg-blue-100 border-2 border-blue-500' 
                    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center space-x-3">
                  {file.preview ? (
                    <img 
                      src={file.preview} 
                      alt={file.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 flex items-center justify-center bg-gray-200 rounded text-2xl">
                      {fileIcon}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                
                {/* 进度条 */}
                {file.uploadStatus !== 'pending' && (
                  <div className="mt-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-600">
                        {getStatusText(file.uploadStatus)}
                      </span>
                      <span className="text-xs text-gray-600">
                        {file.uploadProgress || 0}%
                      </span>
                    </div>
                    <Progress 
                      value={file.uploadProgress || 0} 
                      className="h-1"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* 中间面板 - 图片预览 */}
      <div className="flex-1 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            {selectedFile ? selectedFile.name : '请选择文件'}
          </h2>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-4">
          {selectedFile ? (
            <div className="max-w-full max-h-full">
              {selectedFile.preview ? (
                <img
                  src={selectedFile.preview}
                  alt={selectedFile.name}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                />
              ) : (
                <div className="text-center space-y-4">
                  <div className="text-6xl">
                    {getFileIcon(selectedFile.name?.split('.').pop() || '')}
                  </div>
                  <div>
                    <p className="text-xl font-medium">{selectedFile.name || '未知文件'}</p>
                    <p className="text-gray-500">
                      {selectedFile.name?.split('.').pop()?.toUpperCase() || '未知'} 文件
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500">
              <FileText className="mx-auto h-16 w-16 mb-4" />
              <p>请在左侧选择一个文件进行预览</p>
            </div>
          )}
        </div>
      </div>
      
      {/* 右侧面板 - 分类结果 */}
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">识别结果</h2>
        </div>
        
        <div className="flex-1 p-4 overflow-y-auto">
          {selectedFile?.classificationResult ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-700">证据类型:</span>
                    <p className="text-lg font-semibold text-green-800">
                      {selectedFile.classificationResult.evidence_type}
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-gray-700">置信度:</span>
                    <div className="flex items-center space-x-2 mt-1">
                      <Progress 
                        value={selectedFile.classificationResult.confidence * 100} 
                        className="flex-1"
                      />
                      <span className="text-sm font-medium">
                        {(selectedFile.classificationResult.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-gray-700">分析说明:</span>
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                      {selectedFile.classificationResult.reasoning}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedFile?.uploadStatus === 'classifying' ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">正在识别中，请稍候...</p>
            </div>
          ) : selectedFile ? (
            <div className="text-center py-8 text-gray-500">
              <Eye className="mx-auto h-8 w-8 mb-4" />
              <p>该文件的识别结果尚未生成</p>
              <p className="text-sm mt-2">请点击"开始识别"按钮</p>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText className="mx-auto h-8 w-8 mb-4" />
              <p>请先选择文件</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}