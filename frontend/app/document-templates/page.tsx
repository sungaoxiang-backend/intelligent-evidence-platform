"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { documentTemplateApi, type TemplateInfo, type TemplateSchema } from "@/lib/document-template-api"
import { API_CONFIG } from "@/lib/config"
import { FileText, Download, Save, Loader2, AlertCircle, Sparkles, ChevronDown } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function DocumentTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateInfo[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateInfo | null>(null)
  const [templateSchema, setTemplateSchema] = useState<TemplateSchema | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const { toast } = useToast()

  // 加载模板列表
  useEffect(() => {
    loadTemplates()
  }, [])

  // 加载选中的模板详情
  useEffect(() => {
    if (selectedTemplate) {
      loadTemplateDetail(selectedTemplate.template_id)
    }
  }, [selectedTemplate])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const data = await documentTemplateApi.getTemplateList()
      setTemplates(data)
      if (data.length > 0 && !selectedTemplate) {
        setSelectedTemplate(data[0])
      }
    } catch (error: any) {
      toast({
        title: "加载失败",
        description: error.message || "获取模板列表失败",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadTemplateDetail = async (template_id: string) => {
    try {
      setLoading(true)
      const schema = await documentTemplateApi.getTemplateDetail(template_id)
      setTemplateSchema(schema)
      // 初始化表单数据
      initializeFormData(schema)
    } catch (error: any) {
      toast({
        title: "加载失败",
        description: error.message || "获取模板详情失败",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const initializeFormData = (schema: TemplateSchema) => {
    const data: Record<string, any> = {}
    schema.blocks.forEach((block) => {
      block.rows.forEach((row) => {
        row.fields.forEach((field) => {
          if (field.default) {
            data[field.field_id] = field.default
          } else if (field.type === "checkbox") {
            data[field.field_id] = []
          } else {
            data[field.field_id] = ""
          }
        })
      })
    })
    setFormData(data)
  }

  const handleFieldChange = (field_id: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field_id]: value,
    }))
  }

  const handleCheckboxChange = (field_id: string, value: string, checked: boolean) => {
    setFormData((prev) => {
      const current = prev[field_id] || []
      if (checked) {
        return { ...prev, [field_id]: [...current, value] }
      } else {
        return { ...prev, [field_id]: current.filter((v: string) => v !== value) }
      }
    })
  }

  const handleSave = () => {
    // 保存逻辑
    toast({
      title: "保存成功",
      description: "表单数据已保存",
    })
  }

  const generateMockData = (schema: TemplateSchema): Record<string, any> => {
    const mockData: Record<string, any> = {}
    
    // Mock数据映射
    const mockValues: Record<string, any> = {
      // 原告（自然人）
      plaintiff_name: "张三",
      plaintiff_gender: "男",
      plaintiff_birthday: "1990-01-01",
      plaintiff_nation: "汉族",
      plaintiff_address: "北京市朝阳区某某街道123号",
      plaintiff_current_residence: "北京市朝阳区某某街道123号",
      plaintiff_id_card: "110101199001011234",
      plaintiff_contact_phone: "13800138000",
      
      // 原告（法人、非法人组织）
      plaintiff_company_name: "北京某某科技有限公司",
      plaintiff_company_address: "北京市海淀区某某路456号",
      plaintiff_unified_social_credit_code: "91110000MA01234567",
      plaintiff_legal_representative: "李四",
      plaintiff_position: "董事长",
      plaintiff_legal_rep_gender: "男",
      plaintiff_legal_rep_birthday: "1980-05-15",
      plaintiff_legal_rep_nation: "汉族",
      plaintiff_legal_rep_address: "北京市海淀区某某路789号",
      plaintiff_legal_rep_current_residence: "北京市海淀区某某路789号",
      plaintiff_legal_rep_id_card: "110101198005151234",
      
      // 委托诉讼代理人
      plaintiff_agent_name: "王五",
      plaintiff_agent_gender: "女",
      plaintiff_agent_birthday: "1985-08-20",
      plaintiff_agent_nation: "汉族",
      plaintiff_agent_address: "北京市西城区某某街100号",
      plaintiff_agent_current_residence: "北京市西城区某某街100号",
      plaintiff_agent_id_card: "110101198508201234",
      plaintiff_agent_contact_phone: "13900139000",
      
      // 被告（自然人）
      defendant_name: "赵六",
      defendant_gender: "男",
      defendant_birthday: "1992-03-10",
      defendant_nation: "汉族",
      defendant_address: "上海市浦东新区某某大道200号",
      defendant_current_residence: "上海市浦东新区某某大道200号",
      defendant_id_card: "310115199203101234",
      defendant_contact_phone: "13700137000",
      
      // 被告（法人、非法人组织）
      defendant_company_name: "上海某某贸易有限公司",
      defendant_company_address: "上海市浦东新区某某路300号",
      defendant_unified_social_credit_code: "91310000MA98765432",
      defendant_legal_representative: "钱七",
      defendant_position: "总经理",
      defendant_legal_rep_gender: "女",
      defendant_legal_rep_birthday: "1988-11-25",
      defendant_legal_rep_nation: "汉族",
      defendant_legal_rep_address: "上海市黄浦区某某路400号",
      defendant_legal_rep_current_residence: "上海市黄浦区某某路400号",
      defendant_legal_rep_id_card: "310101198811251234",
      
      // 第三人（自然人）
      third_party_name: "孙八",
      third_party_gender: "男",
      third_party_birthday: "1987-07-05",
      third_party_nation: "汉族",
      third_party_address: "广州市天河区某某路500号",
      third_party_current_residence: "广州市天河区某某路500号",
      third_party_id_card: "440106198707051234",
      third_party_contact_phone: "13600136000",
      
      // 第三人（法人、非法人组织）
      third_party_company_name: "广州某某实业有限公司",
      third_party_company_address: "广州市天河区某某路600号",
      third_party_unified_social_credit_code: "91440000MA11223344",
      third_party_legal_representative: "周九",
      third_party_position: "执行董事",
      third_party_legal_rep_gender: "男",
      third_party_legal_rep_birthday: "1983-12-30",
      third_party_legal_rep_nation: "汉族",
      third_party_legal_rep_address: "广州市越秀区某某路700号",
      third_party_legal_rep_current_residence: "广州市越秀区某某路700号",
      third_party_legal_rep_id_card: "440104198312301234",
      
      // 诉讼请求和依据
      claim_content: "一、请求判令被告向原告支付货款人民币50,000元；\n二、请求判令被告支付逾期付款利息（自2024年1月1日起，按全国银行间同业拆借中心公布的一年期贷款市场报价利率计算至实际清偿之日止）；\n三、请求判令本案诉讼费由被告承担。",
      facts_and_reasons: "原告与被告于2023年6月1日签订《买卖合同》，约定原告向被告供应货物，货款总额为人民币50,000元。合同签订后，原告已按约定向被告交付全部货物，但被告至今未支付货款。原告多次催讨未果，故诉至法院。",
    }
    
    // 根据schema填充mock数据
    schema.blocks.forEach((block) => {
      block.rows.forEach((row) => {
        row.fields.forEach((field) => {
          const fieldId = field.field_id
          
          if (mockValues.hasOwnProperty(fieldId)) {
            mockData[fieldId] = mockValues[fieldId]
          } else {
            // 对于未定义的字段，根据类型生成默认值
            switch (field.type) {
              case "select":
                if (field.options && field.options.length > 0) {
                  mockData[fieldId] = field.options[0].value
                }
                break
              case "radio":
                if (field.options && field.options.length > 0) {
                  mockData[fieldId] = field.options[0].value
                }
                break
              case "checkbox":
                mockData[fieldId] = []
                break
              case "date":
                mockData[fieldId] = "1990-01-01"
                break
              case "textarea":
                mockData[fieldId] = "测试内容"
                break
              case "text":
                mockData[fieldId] = "测试" + field.label
                break
              default:
                mockData[fieldId] = ""
            }
          }
          
          // 处理嵌套选项
          if (field.type === "checkbox" && field.options) {
            field.options.forEach((option: any) => {
              if (option.sub_options) {
                const nestedKey = `${fieldId}_${option.value}`
                if (option.sub_options.length > 0) {
                  mockData[nestedKey] = option.sub_options[0].value
                }
              }
            })
          }
        })
      })
    })
    
    return mockData
  }

  const handleMockData = () => {
    if (!templateSchema) return
    
    const mockData = generateMockData(templateSchema)
    setFormData(mockData)
    
    toast({
      title: "模拟数据已填充",
      description: "已填入测试数据，可直接生成文书",
    })
  }

  const downloadDocumentFile = async (filename: string) => {
    try {
      const url = `${documentTemplateApi.getBaseUrl()}/document-templates/download/${filename}`
      const token = localStorage.getItem(API_CONFIG.TOKEN_KEY)
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("未授权，请重新登录")
        }
        throw new Error(`下载失败: ${response.statusText}`)
      }
      
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    } catch (error: any) {
      toast({
        title: "下载失败",
        description: error.message || "下载文件失败",
        variant: "destructive",
      })
      throw error
    }
  }

  const handleGenerate = async () => {
    if (!selectedTemplate) return
    
    try {
      setLoading(true)
      setErrors([])
      
      // 不再强制验证，直接生成文书
      const result = await documentTemplateApi.generateDocument(
        selectedTemplate.template_id,
        formData
      )
      
      // 如果生成成功，下载文件
      if (result.filename) {
        await downloadDocumentFile(result.filename)
      }
      
      toast({
        title: "生成成功",
        description: "文书生成成功，正在下载",
      })
    } catch (error: any) {
      toast({
        title: "生成失败",
        description: error.message || "生成文书失败",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const renderField = (field: any) => {
    const value = formData[field.field_id] || field.default || ""
    
    switch (field.type) {
      case "textarea":
        return (
          <Textarea
            id={field.field_id}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => handleFieldChange(field.field_id, e.target.value)}
            rows={field.rows || 3}
          />
        )
      
      case "select":
        // 对于性别等只有2个选项的字段，使用单选按钮；其他使用下拉框
        if (field.options && field.options.length <= 3 && (field.field_id.includes('gender') || field.label === '性别')) {
          return (
            <RadioGroup
              value={value || ""}
              onValueChange={(val) => handleFieldChange(field.field_id, val)}
              className="flex items-center space-x-4"
            >
              {field.options?.map((option: any) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={`${field.field_id}-${option.value}`} />
                  <Label htmlFor={`${field.field_id}-${option.value}`} className="font-normal text-sm cursor-pointer">
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )
        }
        return (
          <Select
            value={value}
            onValueChange={(val) => handleFieldChange(field.field_id, val)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={field.placeholder || "请选择"} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option: any) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      
      case "radio":
        return (
          <RadioGroup
            value={value || ""}
            onValueChange={(val) => handleFieldChange(field.field_id, val)}
            className="flex items-center space-x-4"
          >
            {field.options?.map((option: any) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={`${field.field_id}-${option.value}`} />
                <Label htmlFor={`${field.field_id}-${option.value}`} className="font-normal text-sm cursor-pointer">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )
      
      case "checkbox":
        const checkboxValues = formData[field.field_id] || []
        return (
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {field.options?.map((option: any) => (
              <div key={option.value} className="flex items-center space-x-1 flex-wrap">
                <Checkbox
                  id={`${field.field_id}-${option.value}`}
                  checked={checkboxValues.includes(option.value)}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange(field.field_id, option.value, !!checked)
                  }
                />
                <Label htmlFor={`${field.field_id}-${option.value}`} className="font-normal text-sm cursor-pointer">
                  {option.label}
                </Label>
                {/* 处理嵌套选项（如"国有"下的"控股"、"参股"） */}
                {option.sub_options && checkboxValues.includes(option.value) && (
                  <RadioGroup
                    value={formData[`${field.field_id}_${option.value}`] || ""}
                    onValueChange={(val) => handleFieldChange(`${field.field_id}_${option.value}`, val)}
                    className="ml-2 flex items-center space-x-2"
                  >
                    {option.sub_options.map((subOption: any) => (
                      <div key={subOption.value} className="flex items-center space-x-1">
                        <RadioGroupItem value={subOption.value} id={`${field.field_id}-${option.value}-${subOption.value}`} />
                        <Label htmlFor={`${field.field_id}-${option.value}-${subOption.value}`} className="font-normal text-sm cursor-pointer">
                          {subOption.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}
              </div>
            ))}
          </div>
        )
      
      case "date":
      case "datetime":
        return (
          <Input
            id={field.field_id}
            type={field.type === "datetime" ? "datetime-local" : "date"}
            value={value}
            onChange={(e) => handleFieldChange(field.field_id, e.target.value)}
            placeholder={field.placeholder}
          />
        )
      
      case "number":
        return (
          <Input
            id={field.field_id}
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.field_id, e.target.value)}
            placeholder={field.placeholder}
          />
        )
      
      default:
        return (
          <Input
            id={field.field_id}
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.field_id, e.target.value)}
            placeholder={field.placeholder}
          />
        )
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">文书生成</h1>
          {/* 模板选择下拉框 */}
          <Select
            value={selectedTemplate?.template_id || ""}
            onValueChange={(value) => {
              const template = templates.find(t => t.template_id === value)
              if (template) {
                setSelectedTemplate(template)
              }
            }}
          >
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="请选择模板" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.template_id} value={template.template_id}>
                  <div className="flex items-center">
                    <FileText className="mr-2 h-4 w-4" />
                    {template.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedTemplate && (
          <div className="flex items-center space-x-2">
            <Button onClick={handleMockData} variant="outline" disabled={loading}>
              <Sparkles className="mr-2 h-4 w-4" />
              填入模拟数据
            </Button>
            <Button onClick={handleSave} variant="outline" disabled={loading}>
              <Save className="mr-2 h-4 w-4" />
              保存
            </Button>
            <Button onClick={handleGenerate} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              下载
            </Button>
          </div>
        )}
      </div>

      {/* 表单居中展示 */}
      <div className="flex justify-center">
        <div className="w-full max-w-5xl">
          {templateSchema ? (
            <div className="bg-white border border-gray-200 rounded-lg">
              {/* 上部分：文书名称和说明信息 */}
              <div className="p-6 border-b border-gray-200">
                {/* 文书名称 */}
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold">{templateSchema.name}</h2>
                </div>

                {/* 说明 */}
                {templateSchema.instructions && (
                  <div className="mb-4">
                    <h3 className="font-semibold mb-2">{templateSchema.instructions.title}</h3>
                    <p className="text-sm text-gray-700 mb-2">{templateSchema.instructions.content}</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                      {templateSchema.instructions.items?.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* 特别提示 */}
                {templateSchema.special_notice && (
                  <div className="mb-4">
                    <h3 className="font-semibold mb-2">{templateSchema.special_notice.title}</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-line">
                      {templateSchema.special_notice.content}
                    </p>
                  </div>
                )}
              </div>

              {/* 错误提示 */}
              {errors.length > 0 && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>验证失败</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside">
                        {errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* 下部分：表格风格的表单 */}
              <div className="p-6">
                {templateSchema.blocks.map((block) => (
                  <div key={block.block_id} className="mb-8 last:mb-0">
                    {/* 一级标题（独占一行，居中） */}
                    <div className="text-center py-4 mb-4 border-b border-gray-300">
                      <h3 className="text-xl font-bold">{block.title}</h3>
                    </div>

                    {/* 表格风格的字段行 */}
                    <div className="border border-gray-300">
                      <table className="w-full border-collapse bg-white">
                        <colgroup>
                          <col style={{ width: `${Math.max(...block.rows.map(r => r.subtitle_width || 150))}px` }} />
                          <col style={{ width: '120px' }} />
                          <col />
                        </colgroup>
                        <tbody>
                          {block.rows.map((row) => (
                            <React.Fragment key={row.row_id}>
                              {row.fields.map((field, fieldIndex) => (
                                <tr key={field.field_id} className="border-b border-gray-200 last:border-b-0">
                                  {/* 二级标题（第一行显示，使用rowspan） */}
                                  {fieldIndex === 0 && (
                                    <td
                                      className="align-middle py-3 px-4 font-medium text-gray-900 text-left border-r border-gray-300 bg-gray-50"
                                      rowSpan={row.fields.length}
                                      style={{ verticalAlign: 'middle' }}
                                    >
                                      {row.subtitle}
                                    </td>
                                  )}
                                  {/* 字段标签 */}
                                  <td className="align-middle py-3 px-3 text-sm font-normal text-gray-700 text-left border-r border-gray-200 whitespace-nowrap">
                                    {field.label}:
                                  </td>
                                  {/* 输入框（右对齐） */}
                                  <td className="align-middle py-3 px-4">
                                    <div className="flex justify-end">
                                      {renderField(field)}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                {loading ? (
                  <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                ) : (
                  <p className="text-gray-500">请选择一个模板</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

