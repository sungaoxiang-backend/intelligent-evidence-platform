/**
 * 文书模板数据映射工具
 * 将案件信息和证据卡片数据映射到文书模板表单字段
 */

import type { Case, CaseParty } from "./types"
import type { EvidenceCard } from "./api"
import type { TemplateSchema } from "./document-template-api"

/**
 * 从案件和卡片数据生成表单预填充数据
 */
export function mapCaseAndCardsToFormData(
  caseData: Case | null,
  cardList: EvidenceCard[],
  templateSchema: TemplateSchema,
  slotCards?: Record<string, number | null>
): Record<string, any> {
  const formData: Record<string, any> = {}

  if (!caseData) {
    console.log('[mapCaseAndCardsToFormData] caseData is null')
    return formData
  }

  console.log('[mapCaseAndCardsToFormData] 开始映射:', {
    caseId: caseData.id,
    cardListCount: cardList.length,
    caseParties: caseData.case_parties?.length || 0,
    cardFeatures: cardList.map(card => ({
      cardType: card.card_info?.card_type,
      features: card.card_info?.card_features?.map((f: any) => f.slot_name) || []
    }))
  })

  // 获取当事人信息
  const creditor = caseData.case_parties?.find(p => p.party_role === 'creditor')
  const debtor = caseData.case_parties?.find(p => p.party_role === 'debtor')
  const thirdParty = caseData.case_parties?.find(p => p.party_role === 'third_party')

  // 根据角色获取卡片ID列表
  const getCardIdsByRole = (role: 'creditor' | 'debtor'): number[] => {
    if (!slotCards) return []
    
    const cardIds: number[] = []
    for (const [slotId, cardId] of Object.entries(slotCards)) {
      // slot_id 格式: slot::{role}::{cardType}::{index}
      const parts = slotId.split('::')
      if (parts.length >= 2 && parts[1] === role && cardId !== null && cardId !== undefined) {
        cardIds.push(cardId)
      }
    }
    return [...new Set(cardIds)] // 去重
  }

  // 从卡片中提取特征值（支持同义词映射）
  // role: 'creditor' | 'debtor' | undefined - 如果指定角色，只从该角色的卡片中提取
  const extractCardFeature = (slotName: string, cardType?: string, role?: 'creditor' | 'debtor'): string | null => {
    // 字段名同义词映射表
    const slotNameAliases: Record<string, string[]> = {
      '经营名称': ['公司名称', '经营名称', '名称', '企业名称', '个体工商户名称'],
      '公司名称': ['公司名称', '企业名称', '名称', '经营名称'],
      '住所地': ['住所地', '地址', '住址', '注册地址', '经营场所', '住所'],
      '统一社会信用代码': ['统一社会信用代码', '社会信用代码', '信用代码', '统一代码'],
      '法定代表人': ['法定代表人', '法人代表', '负责人', '法人'],
      '经营者姓名': ['经营者姓名', '经营者', '姓名', '经营者名称'],
      '经营类型': ['经营类型', '公司类型', '企业类型', '类型'],
      '出生': ['出生', '出生日期', '生日', '出生年月日'],
      '出生日期': ['出生', '出生日期', '生日', '出生年月日'],
      '住址': ['住址', '地址', '住所地', '居住地址', '户籍地址'],
      '公民身份号码': ['公民身份号码', '身份证号', '身份证号码', '身份证'],
      '身份证号': ['公民身份号码', '身份证号', '身份证号码', '身份证'],
      '身份证号码': ['公民身份号码', '身份证号', '身份证号码', '身份证'],
      '姓名': ['姓名', '名字', '真名', '名称'],
      '真名': ['真名', '姓名', '名字', '名称'],
      '地址': ['地址', '住址', '住所地', '居住地址', '注册地址', '经营场所'],
    }
    
    // 获取目标字段名的所有可能别名
    const possibleNames = slotNameAliases[slotName] || [slotName]
    
    // 如果指定了角色，只从该角色的卡片中查找
    let cardsToSearch = cardList
    if (role && slotCards) {
      const roleCardIds = getCardIdsByRole(role)
      cardsToSearch = cardList.filter(card => roleCardIds.includes(card.id))
      console.log(`[extractCardFeature] 角色过滤: role="${role}", cardIds=[${roleCardIds.join(', ')}], cardsCount=${cardsToSearch.length}`)
    }
    
    for (const card of cardsToSearch) {
      const cardInfo = card.card_info || {}
      const cardTypeMatch = !cardType || cardInfo.card_type === cardType
      
      if (!cardTypeMatch) continue

      const cardFeatures = cardInfo.card_features || []
      const feature = cardFeatures.find((f: any) => {
        if (!f || !f.slot_name) return false
        const normalizedSlotName = f.slot_name.trim()
        
        // 检查是否匹配任何可能的别名
        return possibleNames.some(alias => {
          const normalizedAlias = alias.trim()
          return normalizedSlotName === normalizedAlias
        })
      })

      if (feature && feature.slot_value != null && feature.slot_value !== '') {
        const value = String(feature.slot_value).trim()
        if (value) {
          console.log(`[extractCardFeature] 找到匹配: slotName="${slotName}", matched="${feature.slot_name}", cardType="${cardInfo.card_type}", role="${role || 'all'}", cardId=${card.id}, value="${value}"`)
          return value
        }
      }
    }
    return null
  }

  // 从卡片中提取特征值（支持多个可能的字段名）
  const extractCardFeatureMultiple = (possibleNames: string[], cardType?: string, role?: 'creditor' | 'debtor'): string | null => {
    for (const name of possibleNames) {
      const value = extractCardFeature(name, cardType, role)
      if (value) return value
    }
    return null
  }

  // 从当事人信息中提取值
  const getPartyValue = (party: CaseParty | undefined, field: string): string => {
    if (!party) return ""
    
    // 根据字段名映射到当事人属性
    const fieldMap: Record<string, keyof CaseParty> = {
      name: 'name',
      gender: 'gender',
      birthday: 'birthday',
      nation: 'nation',
      address: 'address',
      id_card: 'id_card',
      phone: 'phone',
      company_name: 'company_name',
      company_address: 'address', // 公司地址可能使用 address
      unified_social_credit_code: 'company_code',
    }

    const mappedField = fieldMap[field] || field
    const value = party[mappedField as keyof CaseParty]
    return value ? String(value) : ""
  }

  // 获取当事人名称（用于诉讼请求和事实理由）
  // 从证据卡槽和卡片的映射记录中获取
  const getPartyDisplayName = (party: CaseParty | undefined, role?: 'creditor' | 'debtor'): string => {
    if (!party) return ""
    
    // 个人：使用身份证上的姓名
    if (party.party_type === 'person') {
      // 优先从该角色的身份证卡片中提取姓名
      return extractCardFeature('姓名', '身份证', role) || 
             extractCardFeature('姓名', '中华人民共和国居民户籍档案', role) ||
             getPartyValue(party, 'name') || 
             party.party_name || 
             ""
    }
    
    // 公司：使用公司名称
    if (party.party_type === 'company') {
      // 优先从该角色的公司营业执照卡片中提取公司名称
      return extractCardFeature('公司名称', '公司营业执照', role) ||
             extractCardFeature('公司名称', '公司全国企业公示系统截图', role) ||
             extractCardFeature('公司名称', undefined, role) || 
             getPartyValue(party, 'company_name') || 
             party.party_name || 
             ""
    }
    
    // 个体工商户：使用经营名称（公司名称）
    if (party.party_type === 'individual') {
      // 优先从该角色的个体工商户营业执照卡片中提取经营名称
      return extractCardFeature('经营名称', '个体工商户营业执照', role) ||
             extractCardFeature('经营名称', '个体工商户全国企业公示系统截图', role) ||
             extractCardFeature('公司名称', '个体工商户营业执照', role) ||
             extractCardFeature('公司名称', '个体工商户全国企业公示系统截图', role) ||
             extractCardFeature('经营名称', undefined, role) ||
             extractCardFeature('公司名称', undefined, role) ||
             getPartyValue(party, 'company_name') || 
             party.party_name || 
             ""
    }
    
    return party.party_name || ""
  }

  // 获取原告名称（债权人）
  const getPlaintiffName = (): string => {
    return getPartyDisplayName(creditor, 'creditor')
  }

  // 获取被告名称（债务人）
  const getDefendantName = (): string => {
    return getPartyDisplayName(debtor, 'debtor')
  }

  // 遍历模板的所有字段，进行映射
  templateSchema.blocks.forEach((block) => {
    block.rows.forEach((row) => {
      row.fields.forEach((field) => {
        const fieldId = field.field_id

        // 跳过已填充的字段
        if (formData[fieldId] !== undefined) {
          return
        }

        // 记录字段映射过程（仅对关键字段）
        const shouldLog = fieldId.includes('plaintiff_') || fieldId.includes('defendant_')
        if (shouldLog) {
          console.log(`[mapCaseAndCardsToFormData] 处理字段: ${fieldId}, label: ${field.label}`)
        }

        // 原告（自然人）字段映射
        // 原告 = 债权人，自然人 = party_type === 'person'
        // 只从债权人的卡片中提取信息
        if (fieldId.startsWith('plaintiff_') && !fieldId.startsWith('plaintiff_company_') && !fieldId.startsWith('plaintiff_agent_') && creditor?.party_type === 'person') {
          const baseField = fieldId.replace('plaintiff_', '')
          
          if (baseField === 'name') {
            // 优先从债权人的身份证卡片中提取姓名
            formData[fieldId] = extractCardFeature('姓名', '身份证', 'creditor') || 
                               extractCardFeature('姓名', '中华人民共和国居民户籍档案', 'creditor') ||
                               getPartyValue(creditor, 'name') || 
                               creditor.party_name || 
                               ""
          } else if (baseField === 'gender') {
            formData[fieldId] = extractCardFeature('性别', '身份证', 'creditor') || 
                               extractCardFeature('性别', '中华人民共和国居民户籍档案', 'creditor') ||
                               getPartyValue(creditor, 'gender') || 
                               ""
          } else if (baseField === 'birthday') {
            formData[fieldId] = extractCardFeature('出生', '身份证', 'creditor') || 
                               extractCardFeature('出生日期', '身份证', 'creditor') ||
                               extractCardFeature('出生', '中华人民共和国居民户籍档案', 'creditor') ||
                               getPartyValue(creditor, 'birthday') || 
                               extractCardFeatureMultiple(['出生', '出生日期', '生日'], undefined, 'creditor') || 
                               ""
          } else if (baseField === 'nation') {
            formData[fieldId] = extractCardFeature('民族', '身份证', 'creditor') || 
                               extractCardFeature('民族', '中华人民共和国居民户籍档案', 'creditor') ||
                               getPartyValue(creditor, 'nation') || 
                               "汉族"
          } else if (baseField === 'address') {
            formData[fieldId] = extractCardFeature('住址', '身份证', 'creditor') || 
                               extractCardFeature('地址', '身份证', 'creditor') ||
                               extractCardFeature('住址', '中华人民共和国居民户籍档案', 'creditor') ||
                               getPartyValue(creditor, 'address') || 
                               extractCardFeatureMultiple(['住址', '地址', '住所地'], undefined, 'creditor') || 
                               ""
          } else if (baseField === 'current_residence') {
            formData[fieldId] = extractCardFeature('住址', '身份证', 'creditor') || 
                               extractCardFeature('现住址', '身份证', 'creditor') ||
                               getPartyValue(creditor, 'address') || 
                               extractCardFeatureMultiple(['住址', '现住址', '地址'], undefined, 'creditor') || 
                               ""
          } else if (baseField === 'id_card') {
            formData[fieldId] = extractCardFeature('公民身份号码', '身份证', 'creditor') || 
                               extractCardFeature('身份证号', '身份证', 'creditor') ||
                               extractCardFeature('公民身份号码', '中华人民共和国居民户籍档案', 'creditor') ||
                               getPartyValue(creditor, 'id_card') || 
                               extractCardFeatureMultiple(['公民身份号码', '身份证号', '身份证号码'], undefined, 'creditor') || 
                               ""
          } else if (baseField === 'contact_phone') {
            formData[fieldId] = getPartyValue(creditor, 'phone') || extractCardFeature('联系电话', undefined, 'creditor') || ""
          }
        }

        // 原告（法人、非法人组织）字段映射
        // 注意：法人包括公司(company)和个体工商户(individual)
        // 只从债权人的卡片中提取信息
        if (fieldId.startsWith('plaintiff_company_') && creditor && creditor.party_type !== 'person') {
          const baseField = fieldId.replace('plaintiff_company_', '').replace('plaintiff_legal_rep_', '')
          
          if (fieldId.includes('company_name')) {
            // 优先从债权人的卡片中提取：公司使用"公司名称"，个体工商户使用"经营名称"
            const companyName = creditor.party_type === 'individual' 
              ? (extractCardFeature('经营名称', undefined, 'creditor') || extractCardFeature('公司名称', undefined, 'creditor'))
              : extractCardFeature('公司名称', undefined, 'creditor')
            
            formData[fieldId] = companyName || 
                               getPartyValue(creditor, 'company_name') || 
                               creditor.party_name || 
                               ""
          } else if (fieldId.includes('company_address')) {
            formData[fieldId] = getPartyValue(creditor, 'address') || extractCardFeature('地址', undefined, 'creditor') || ""
          } else if (fieldId.includes('unified_social_credit_code')) {
            formData[fieldId] = getPartyValue(creditor, 'unified_social_credit_code') || extractCardFeature('统一社会信用代码', undefined, 'creditor') || ""
          } else if (fieldId.includes('legal_representative')) {
            // 法定代表人：公司使用"法定代表人"，个体工商户使用"经营者姓名"
            const legalRep = creditor.party_type === 'individual'
              ? (extractCardFeature('经营者姓名', undefined, 'creditor') || extractCardFeature('法定代表人', undefined, 'creditor'))
              : extractCardFeature('法定代表人', undefined, 'creditor')
            
            formData[fieldId] = legalRep || getPartyValue(creditor, 'name') || ""
          } else if (fieldId.includes('position')) {
            formData[fieldId] = extractCardFeature('职务', undefined, 'creditor') || ""
          } else if (fieldId.includes('legal_rep_')) {
            // 法定代表人个人信息（从债权人的身份证卡片中提取）
            const repField = fieldId.replace('plaintiff_legal_rep_', '')
            if (repField === 'gender') {
              formData[fieldId] = extractCardFeature('性别', '身份证', 'creditor') || ""
            } else if (repField === 'birthday') {
              formData[fieldId] = extractCardFeature('出生日期', '身份证', 'creditor') || ""
            } else if (repField === 'nation') {
              formData[fieldId] = extractCardFeature('民族', '身份证', 'creditor') || "汉族"
            } else if (repField === 'address' || repField === 'current_residence') {
              formData[fieldId] = extractCardFeature('地址', '身份证', 'creditor') || ""
            } else if (repField === 'id_card') {
              formData[fieldId] = extractCardFeature('身份证号', '身份证', 'creditor') || ""
            }
          }
        }

        // 委托诉讼代理人字段映射
        if (fieldId.startsWith('plaintiff_agent_')) {
          const baseField = fieldId.replace('plaintiff_agent_', '')
          
          if (baseField === 'name') {
            formData[fieldId] = extractCardFeature('代理人姓名') || ""
          } else if (baseField === 'gender') {
            formData[fieldId] = extractCardFeature('性别') || ""
          } else if (baseField === 'birthday') {
            formData[fieldId] = extractCardFeature('出生日期') || ""
          } else if (baseField === 'nation') {
            formData[fieldId] = extractCardFeature('民族') || "汉族"
          } else if (baseField === 'address' || baseField === 'current_residence') {
            formData[fieldId] = extractCardFeature('地址') || ""
          } else if (baseField === 'id_card') {
            formData[fieldId] = extractCardFeature('身份证号') || ""
          } else if (baseField === 'contact_phone') {
            formData[fieldId] = extractCardFeature('联系电话') || ""
          }
        }

        // 被告（自然人）字段映射
        // 被告 = 债务人，自然人 = party_type === 'person'
        // 只从债务人的卡片中提取信息
        if (fieldId.startsWith('defendant_') && !fieldId.startsWith('defendant_company_') && debtor?.party_type === 'person') {
          const baseField = fieldId.replace('defendant_', '')
          
          if (baseField === 'name') {
            // 优先从债务人的身份证卡片中提取姓名
            formData[fieldId] = extractCardFeature('姓名', '身份证', 'debtor') || 
                               extractCardFeature('姓名', '中华人民共和国居民户籍档案', 'debtor') ||
                               getPartyValue(debtor, 'name') || 
                               debtor.party_name || 
                               extractCardFeatureMultiple(['姓名', '微信备注名', '名称'], undefined, 'debtor') || 
                               ""
          } else if (baseField === 'gender') {
            formData[fieldId] = extractCardFeature('性别', '身份证', 'debtor') || 
                               extractCardFeature('性别', '中华人民共和国居民户籍档案', 'debtor') ||
                               getPartyValue(debtor, 'gender') || 
                               ""
          } else if (baseField === 'birthday') {
            formData[fieldId] = extractCardFeature('出生', '身份证', 'debtor') || 
                               extractCardFeature('出生日期', '身份证', 'debtor') ||
                               extractCardFeature('出生', '中华人民共和国居民户籍档案', 'debtor') ||
                               getPartyValue(debtor, 'birthday') || 
                               extractCardFeatureMultiple(['出生', '出生日期', '生日'], undefined, 'debtor') || 
                               ""
          } else if (baseField === 'nation') {
            formData[fieldId] = extractCardFeature('民族', '身份证', 'debtor') || 
                               extractCardFeature('民族', '中华人民共和国居民户籍档案', 'debtor') ||
                               getPartyValue(debtor, 'nation') || 
                               "汉族"
          } else if (baseField === 'address' || baseField === 'current_residence') {
            formData[fieldId] = extractCardFeature('住址', '身份证', 'debtor') || 
                               extractCardFeature('地址', '身份证', 'debtor') ||
                               extractCardFeature('住址', '中华人民共和国居民户籍档案', 'debtor') ||
                               getPartyValue(debtor, 'address') || 
                               extractCardFeatureMultiple(['住址', '地址', '现住址'], undefined, 'debtor') || 
                               ""
          } else if (baseField === 'id_card') {
            formData[fieldId] = extractCardFeature('公民身份号码', '身份证', 'debtor') || 
                               extractCardFeature('身份证号', '身份证', 'debtor') ||
                               extractCardFeature('公民身份号码', '中华人民共和国居民户籍档案', 'debtor') ||
                               getPartyValue(debtor, 'id_card') || 
                               extractCardFeatureMultiple(['公民身份号码', '身份证号', '身份证号码'], undefined, 'debtor') || 
                               ""
          } else if (baseField === 'contact_phone') {
            formData[fieldId] = getPartyValue(debtor, 'phone') || extractCardFeatureMultiple(['联系电话', '电话', '手机号'], undefined, 'debtor') || ""
          }
        }

        // 被告（法人、非法人组织）字段映射
        // 注意：法人包括公司(company)和个体工商户(individual)
        // 只从债务人的卡片中提取信息
        if (fieldId.startsWith('defendant_company_') && debtor && debtor.party_type !== 'person') {
          const baseField = fieldId.replace('defendant_company_', '').replace('defendant_legal_rep_', '')
          
          if (fieldId.includes('company_name')) {
            // 优先从债务人的卡片中提取：公司使用"公司名称"，个体工商户使用"经营名称"
            const companyName = debtor.party_type === 'individual' 
              ? (extractCardFeature('经营名称', undefined, 'debtor') || extractCardFeature('公司名称', undefined, 'debtor'))
              : extractCardFeature('公司名称', undefined, 'debtor')
            
            formData[fieldId] = companyName || 
                               getPartyValue(debtor, 'company_name') || 
                               debtor.party_name || 
                               ""
          } else if (fieldId.includes('company_address')) {
            formData[fieldId] = getPartyValue(debtor, 'address') || extractCardFeature('地址', undefined, 'debtor') || ""
          } else if (fieldId.includes('unified_social_credit_code')) {
            formData[fieldId] = getPartyValue(debtor, 'unified_social_credit_code') || extractCardFeature('统一社会信用代码', undefined, 'debtor') || ""
          } else if (fieldId.includes('legal_representative')) {
            // 法定代表人：公司使用"法定代表人"，个体工商户使用"经营者姓名"
            const legalRep = debtor.party_type === 'individual'
              ? (extractCardFeature('经营者姓名', undefined, 'debtor') || extractCardFeature('法定代表人', undefined, 'debtor'))
              : extractCardFeature('法定代表人', undefined, 'debtor')
            
            formData[fieldId] = legalRep || getPartyValue(debtor, 'name') || ""
          } else if (fieldId.includes('position')) {
            formData[fieldId] = extractCardFeature('职务', undefined, 'debtor') || ""
          } else if (fieldId.includes('legal_rep_')) {
            // 法定代表人个人信息（从债务人的身份证卡片中提取）
            const repField = fieldId.replace('defendant_legal_rep_', '')
            if (repField === 'gender') {
              formData[fieldId] = extractCardFeature('性别', '身份证', 'debtor') || ""
            } else if (repField === 'birthday') {
              formData[fieldId] = extractCardFeature('出生日期', '身份证', 'debtor') || ""
            } else if (repField === 'nation') {
              formData[fieldId] = extractCardFeature('民族', '身份证', 'debtor') || "汉族"
            } else if (repField === 'address' || repField === 'current_residence') {
              formData[fieldId] = extractCardFeature('地址', '身份证', 'debtor') || ""
            } else if (repField === 'id_card') {
              formData[fieldId] = extractCardFeature('身份证号', '身份证', 'debtor') || ""
            }
          }
        }

        // 第三人字段映射（类似被告）
        if (fieldId.startsWith('third_party_') && thirdParty) {
          const baseField = fieldId.replace('third_party_', '').replace('third_party_company_', '').replace('third_party_legal_rep_', '')
          
          if (fieldId.includes('company_name')) {
            formData[fieldId] = getPartyValue(thirdParty, 'company_name') || thirdParty.party_name || ""
          } else if (fieldId.includes('name') && !fieldId.includes('company')) {
            formData[fieldId] = getPartyValue(thirdParty, 'name') || thirdParty.party_name || ""
          } else if (baseField === 'gender') {
            formData[fieldId] = getPartyValue(thirdParty, 'gender') || extractCardFeature('性别') || ""
          } else if (baseField === 'birthday') {
            formData[fieldId] = getPartyValue(thirdParty, 'birthday') || extractCardFeatureMultiple(['出生', '出生日期', '生日']) || ""
          } else if (baseField === 'nation') {
            formData[fieldId] = getPartyValue(thirdParty, 'nation') || extractCardFeature('民族') || "汉族"
          } else if (baseField === 'address' || baseField === 'current_residence') {
            formData[fieldId] = getPartyValue(thirdParty, 'address') || extractCardFeatureMultiple(['住址', '地址', '现住址']) || ""
          } else if (baseField === 'id_card') {
            formData[fieldId] = getPartyValue(thirdParty, 'id_card') || extractCardFeatureMultiple(['公民身份号码', '身份证号', '身份证号码']) || ""
          } else if (baseField === 'contact_phone') {
            formData[fieldId] = getPartyValue(thirdParty, 'phone') || extractCardFeature('联系电话') || ""
          } else if (fieldId.includes('unified_social_credit_code')) {
            formData[fieldId] = getPartyValue(thirdParty, 'unified_social_credit_code') || extractCardFeature('统一社会信用代码') || ""
          } else if (fieldId.includes('legal_representative')) {
            formData[fieldId] = extractCardFeature('法定代表人') || ""
          } else if (fieldId.includes('position')) {
            formData[fieldId] = extractCardFeature('职务') || ""
          }
        }

        // 诉讼请求和依据字段映射
        if (fieldId === 'claim_content') {
          // 可以从案件描述或卡片中提取
          const loanAmount = caseData.loan_amount
          const plaintiffName = getPlaintiffName()
          const defendantName = getDefendantName()
          
          if (loanAmount && loanAmount > 0) {
            const amountStr = loanAmount.toLocaleString('zh-CN')
            formData[fieldId] = `一、请求判令被告${defendantName || ''}向原告${plaintiffName || ''}支付货款人民币${amountStr}元；\n二、请求判令被告${defendantName || ''}支付逾期付款利息；\n三、请求判令本案诉讼费由被告${defendantName || ''}承担。`
          } else {
            formData[fieldId] = caseData.description || ""
          }
        }

        if (fieldId === 'facts_and_reasons') {
          const plaintiffName = getPlaintiffName()
          const defendantName = getDefendantName()
          const loanAmount = caseData.loan_amount
          const amountStr = loanAmount ? loanAmount.toLocaleString('zh-CN') : ''
          
          // 构建事实和理由
          let factsText = caseData.description || extractCardFeature('欠款合意') || ""
          
          // 如果模板中有creditor_name和debtor_name字段，也填充它们
          if (fieldId === 'facts_and_reasons' && (plaintiffName || defendantName)) {
            // 在事实理由中替换原被告名称
            if (plaintiffName && factsText) {
              factsText = factsText.replace(/原告/g, `原告${plaintiffName}`)
            }
            if (defendantName && factsText) {
              factsText = factsText.replace(/被告/g, `被告${defendantName}`)
            }
          }
          
          formData[fieldId] = factsText
        }
        
        // 处理creditor_name和debtor_name字段（用于诉讼请求和事实理由中的原被告名称）
        if (fieldId === 'creditor_name') {
          formData[fieldId] = getPlaintiffName()
        }
        
        if (fieldId === 'debtor_name') {
          formData[fieldId] = getDefendantName()
        }

        // 金额相关字段
        if (fieldId.includes('amount') || fieldId.includes('金额')) {
          const amount = extractCardFeature('欠款金额') || caseData.loan_amount
          if (amount) {
            formData[fieldId] = typeof amount === 'number' ? amount : parseFloat(String(amount)) || ""
          }
        }
      })
    })
  })

  console.log('[mapCaseAndCardsToFormData] 映射完成，结果字段数:', Object.keys(formData).length)
  console.log('[mapCaseAndCardsToFormData] 映射结果（非空字段）:', 
    Object.entries(formData)
      .filter(([_, value]) => value !== '' && value !== null && value !== undefined)
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
  )

  return formData
}

/**
 * 存储案件和卡片数据到 localStorage（用于页面跳转）
 */
export function storeCaseDataForDocument(
  caseId: string | number, 
  caseData: Case, 
  cardList: EvidenceCard[],
  slotCards?: Record<string, number | null>
) {
  const key = `document_template_case_data_${caseId}`
  const data = {
    caseData,
    cardList,
    slotCards: slotCards || {},
    timestamp: Date.now(),
  }
  localStorage.setItem(key, JSON.stringify(data))
  
  // 设置过期时间（1小时后自动清理）
  setTimeout(() => {
    localStorage.removeItem(key)
  }, 60 * 60 * 1000)
}

/**
 * 从 localStorage 读取案件和卡片数据
 */
export function getCaseDataForDocument(caseId: string | number): { 
  caseData: Case | null; 
  cardList: EvidenceCard[]; 
  slotCards?: Record<string, number | null> 
} | null {
  const key = `document_template_case_data_${caseId}`
  const stored = localStorage.getItem(key)
  
  if (!stored) {
    return null
  }

  try {
    const data = JSON.parse(stored)
    // 检查是否过期（超过1小时）
    if (Date.now() - data.timestamp > 60 * 60 * 1000) {
      localStorage.removeItem(key)
      return null
    }
    return {
      caseData: data.caseData,
      cardList: data.cardList || [],
      slotCards: data.slotCards || {},
    }
  } catch (error) {
    console.error('Failed to parse stored case data:', error)
    localStorage.removeItem(key)
    return null
  }
}

/**
 * 清理存储的案件数据
 */
export function clearCaseDataForDocument(caseId: string | number) {
  const key = `document_template_case_data_${caseId}`
  localStorage.removeItem(key)
}

