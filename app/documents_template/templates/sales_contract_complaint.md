# 民事起诉状
## （买卖合同纠纷）

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

### 原告（自然人）

{% if plaintiff_name or plaintiff_gender or plaintiff_birthday or plaintiff_nation or plaintiff_address or plaintiff_current_residence or plaintiff_id_card or plaintiff_contact_phone %}
姓名：{{ plaintiff_name or "" }}
性别：{{ plaintiff_gender or "" }}
出生日期：{{ plaintiff_birthday or "" }}
民族：{{ plaintiff_nation or "" }}
住所地：{{ plaintiff_address or "" }}
经常居住地：{{ plaintiff_current_residence or "" }}
身份证号：{{ plaintiff_id_card or "" }}
联系电话：{{ plaintiff_contact_phone or "" }}

{% endif %}

### 原告（法人、非法人组织）

{% if plaintiff_company_name or plaintiff_company_address or plaintiff_unified_social_credit_code or plaintiff_legal_representative or plaintiff_position or plaintiff_legal_rep_gender or plaintiff_legal_rep_birthday or plaintiff_legal_rep_nation or plaintiff_legal_rep_address or plaintiff_legal_rep_current_residence or plaintiff_legal_rep_id_card or plaintiff_contact_phone %}
名称：{{ plaintiff_company_name or "" }}
住所地：{{ plaintiff_company_address or "" }}
统一社会信用代码：{{ plaintiff_unified_social_credit_code or "" }}
代表人/负责人名称：{{ plaintiff_legal_representative or "" }}
代表人/负责人职务：{{ plaintiff_position or "" }}
性别：{{ plaintiff_legal_rep_gender or "" }}
出生日期：{{ plaintiff_legal_rep_birthday or "" }}
民族：{{ plaintiff_legal_rep_nation or "" }}
住所地：{{ plaintiff_legal_rep_address or "" }}
经常居住地：{{ plaintiff_legal_rep_current_residence or "" }}
身份证号：{{ plaintiff_legal_rep_id_card or "" }}
联系电话：{{ plaintiff_contact_phone or "" }}

{% endif %}

### 委托诉讼代理人

{% if plaintiff_agent_name or plaintiff_agent_gender or plaintiff_agent_birthday or plaintiff_agent_nation or plaintiff_agent_address or plaintiff_agent_current_residence or plaintiff_agent_id_card or plaintiff_agent_contact_phone %}
姓名：{{ plaintiff_agent_name or "" }}
性别：{{ plaintiff_agent_gender or "" }}
出生日期：{{ plaintiff_agent_birthday or "" }}
民族：{{ plaintiff_agent_nation or "" }}
住所地：{{ plaintiff_agent_address or "" }}
经常居住地：{{ plaintiff_agent_current_residence or "" }}
身份证号：{{ plaintiff_agent_id_card or "" }}
联系电话：{{ plaintiff_agent_contact_phone or "" }}

{% endif %}

### 被告（自然人）

{% if defendant_name or defendant_gender or defendant_birthday or defendant_nation or defendant_address or defendant_current_residence or defendant_id_card or defendant_contact_phone %}
姓名：{{ defendant_name or "" }}
性别：{{ defendant_gender or "" }}
出生日期：{{ defendant_birthday or "" }}
民族：{{ defendant_nation or "" }}
住所地：{{ defendant_address or "" }}
经常居住地：{{ defendant_current_residence or "" }}
身份证号：{{ defendant_id_card or "" }}
联系电话：{{ defendant_contact_phone or "" }}

{% endif %}

### 被告（法人、非法人组织）

{% if defendant_company_name or defendant_company_address or defendant_unified_social_credit_code or defendant_legal_representative or defendant_position or defendant_legal_rep_gender or defendant_legal_rep_birthday or defendant_legal_rep_nation or defendant_legal_rep_address or defendant_legal_rep_current_residence or defendant_legal_rep_id_card or defendant_contact_phone %}
名称：{{ defendant_company_name or "" }}
住所地：{{ defendant_company_address or "" }}
统一社会信用代码：{{ defendant_unified_social_credit_code or "" }}
代表人/负责人名称：{{ defendant_legal_representative or "" }}
代表人/负责人职务：{{ defendant_position or "" }}
性别：{{ defendant_legal_rep_gender or "" }}
出生日期：{{ defendant_legal_rep_birthday or "" }}
民族：{{ defendant_legal_rep_nation or "" }}
住所地：{{ defendant_legal_rep_address or "" }}
经常居住地：{{ defendant_legal_rep_current_residence or "" }}
身份证号：{{ defendant_legal_rep_id_card or "" }}
联系电话：{{ defendant_contact_phone or "" }}

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

一、请求判令被告向原告支付货款{{case_amount}}元及逾期付款损失（自起诉之日起，按全国银行间同业拆借中心公布的一年期贷款市场报价利率加计50%计算至货款实际清偿完毕之日止）。

二、请求判令本案诉讼费由被告承担。

### 事实与理由

原告{{creditor_name}}与被告{{debtor_name}}之间素有交易往来。截至起诉之日，被告余欠原告货款{{case_amount}}元。经原告多次催讨，被告仍未履行付款义务，故双方纠纷成讼。

综上所述，原告为维护自身合法权益，特依据《中华人民共和国民法典》及相关法律法规向贵院提起诉讼，要求被告承担相应的民事责任，诚望判如所请！

---

**生成日期：** {{ current_date }}

