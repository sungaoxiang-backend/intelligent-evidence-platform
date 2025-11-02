# 撤诉申请书

{% if instructions %}
{{ instructions.content }}

{% if instructions.get('items') %}
{% for item in instructions['items'] %}
{{ loop.index }}.{{ item }}
{% endfor %}
{% endif %}

{% endif %}

{% if special_notice %}
## ★特别提示★

{{ special_notice.content }}

{% endif %}

---

## 当事人信息

### 申请人（自然人）

{% if applicant_name or applicant_gender or applicant_birthday or applicant_nation or applicant_address or applicant_current_residence or applicant_id_card or applicant_contact_phone %}
姓名：{{ applicant_name or "" }}
性别：{{ applicant_gender or "" }}
出生日期：{{ applicant_birthday or "" }}
民族：{{ applicant_nation or "" }}
住所地：{{ applicant_address or "" }}
经常居住地：{{ applicant_current_residence or "" }}
身份证号：{{ applicant_id_card or "" }}
联系电话：{{ applicant_contact_phone or "" }}

{% endif %}

### 申请人（法人、非法人组织）

{% if applicant_company_name or applicant_company_address or applicant_unified_social_credit_code or applicant_legal_representative or applicant_position or applicant_legal_rep_gender or applicant_legal_rep_birthday or applicant_legal_rep_nation or applicant_legal_rep_address or applicant_legal_rep_current_residence or applicant_legal_rep_id_card or applicant_contact_phone %}
名称：{{ applicant_company_name or "" }}
住所地：{{ applicant_company_address or "" }}
统一社会信用代码：{{ applicant_unified_social_credit_code or "" }}
代表人/负责人名称：{{ applicant_legal_representative or "" }}
代表人/负责人职务：{{ applicant_position or "" }}
性别：{{ applicant_legal_rep_gender or "" }}
出生日期：{{ applicant_legal_rep_birthday or "" }}
民族：{{ applicant_legal_rep_nation or "" }}
住所地：{{ applicant_legal_rep_address or "" }}
经常居住地：{{ applicant_legal_rep_current_residence or "" }}
身份证号：{{ applicant_legal_rep_id_card or "" }}
联系电话：{{ applicant_contact_phone or "" }}

{% endif %}

### 委托诉讼代理人

{% if applicant_agent_name or applicant_agent_gender or applicant_agent_birthday or applicant_agent_nation or applicant_agent_address or applicant_agent_current_residence or applicant_agent_id_card or applicant_agent_contact_phone %}
姓名：{{ applicant_agent_name or "" }}
性别：{{ applicant_agent_gender or "" }}
出生日期：{{ applicant_agent_birthday or "" }}
民族：{{ applicant_agent_nation or "" }}
住所地：{{ applicant_agent_address or "" }}
经常居住地：{{ applicant_agent_current_residence or "" }}
身份证号：{{ applicant_agent_id_card or "" }}
联系电话：{{ applicant_agent_contact_phone or "" }}

{% endif %}

### 被申请人（自然人）

{% if respondent_name or respondent_gender or respondent_birthday or respondent_nation or respondent_address or respondent_current_residence or respondent_id_card or respondent_contact_phone %}
姓名：{{ respondent_name or "" }}
性别：{{ respondent_gender or "" }}
出生日期：{{ respondent_birthday or "" }}
民族：{{ respondent_nation or "" }}
住所地：{{ respondent_address or "" }}
经常居住地：{{ respondent_current_residence or "" }}
身份证号：{{ respondent_id_card or "" }}
联系电话：{{ respondent_contact_phone or "" }}

{% endif %}

### 被申请人（法人、非法人组织）

{% if respondent_company_name or respondent_company_address or respondent_unified_social_credit_code or respondent_legal_representative or respondent_position or respondent_legal_rep_gender or respondent_legal_rep_birthday or respondent_legal_rep_nation or respondent_legal_rep_address or respondent_legal_rep_current_residence or respondent_legal_rep_id_card or respondent_contact_phone %}
名称：{{ respondent_company_name or "" }}
住所地：{{ respondent_company_address or "" }}
统一社会信用代码：{{ respondent_unified_social_credit_code or "" }}
代表人/负责人名称：{{ respondent_legal_representative or "" }}
代表人/负责人职务：{{ respondent_position or "" }}
性别：{{ respondent_legal_rep_gender or "" }}
出生日期：{{ respondent_legal_rep_birthday or "" }}
民族：{{ respondent_legal_rep_nation or "" }}
住所地：{{ respondent_legal_rep_address or "" }}
经常居住地：{{ respondent_legal_rep_current_residence or "" }}
身份证号：{{ respondent_legal_rep_id_card or "" }}
联系电话：{{ respondent_contact_phone or "" }}

{% endif %}

### 第三人（自然人）

{% if third_party_name or third_party_gender or third_party_birthday or third_party_nation or third_party_address or third_party_current_residence or third_party_id_card or third_party_contact_phone %}
姓名：{{ third_party_name or "" }}
性别：{{ third_party_gender or "" }}
出生日期：{{ third_party_birthday or "" }}
民族：{{ third_party_nation or "" }}
住所地：{{ third_party_address or "" }}
经常居住地：{{ third_party_current_residence or "" }}
身份证号：{{ third_party_id_card or "" }}
联系电话：{{ third_party_contact_phone or "" }}

{% endif %}

### 第三人（法人、非法人组织）

{% if third_party_company_name or third_party_company_address or third_party_unified_social_credit_code or third_party_legal_representative or third_party_position or third_party_legal_rep_gender or third_party_legal_rep_birthday or third_party_legal_rep_nation or third_party_legal_rep_address or third_party_legal_rep_current_residence or third_party_legal_rep_id_card or third_party_contact_phone %}
名称：{{ third_party_company_name or "" }}
住所地：{{ third_party_company_address or "" }}
统一社会信用代码：{{ third_party_unified_social_credit_code or "" }}
代表人/负责人名称：{{ third_party_legal_representative or "" }}
代表人/负责人职务：{{ third_party_position or "" }}
性别：{{ third_party_legal_rep_gender or "" }}
出生日期：{{ third_party_legal_rep_birthday or "" }}
民族：{{ third_party_legal_rep_nation or "" }}
住所地：{{ third_party_legal_rep_address or "" }}
经常居住地：{{ third_party_legal_rep_current_residence or "" }}
身份证号：{{ third_party_legal_rep_id_card or "" }}
联系电话：{{ third_party_contact_phone or "" }}

{% endif %}

---

## 诉讼请求和依据

### 诉讼请求

请求撤回申请人{{applicant_name}}与被申请人{{respondent_name}}{{case_cause_type}}纠纷的诉讼（案号：{{case_number}}）。

### 事实和理由

申请人{{applicant_name}}与被申请人{{respondent_name}}{{case_cause_type}}纠纷（案号{{case_number}}），因{{reason}}申请人自愿撤回起诉，故依据《中华人民共和国民事诉讼法》的相关规定，向贵院申请撤回对被申请人的起诉，恳请贵院予以准许。

---

**生成日期：** {{ current_date }}

