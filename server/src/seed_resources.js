// 课程资料「首次启动自动播种」模块（单一数据源）
// - 仅当 resource 表为空时执行（count==0），幂等、可重复启动；
// - 资料文件用「稳定 slug」命名（与数据库 id 解耦），保证刷新/新环境都能对应；
// - 由 db.js 的 migrate() 在每次启动时调用，确保任何新部署都自带示例资料。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STUDY_DIR = path.join(__dirname, '..', 'study-content');
const SOURCE = '点滴进步·自编资料';

// ── 知识库（与小程序端展示的年级/科目一致）──
const KB = [
  // 初一 · 全年重点回顾
  { grade: '初一', subject: '语文', title: '初一语文·全年重点回顾',
    desc: '古诗词默写、文言文实词、名著导读三大板块的全年梳理，开学前温故知新。',
    tags: ['重点回顾', '古诗词', '文言文', '名著'],
    sections: [
      { h: '一、必背古诗词（默写零失分）', items: [
        '《观沧海》曹操：日月之行，若出其中；星汉灿烂，若出其里。',
        '《闻王昌龄左迁龙标遥有此寄》李白：我寄愁心与明月，随君直到夜郎西。',
        '《次北固山下》王湾：海日生残夜，江春入旧年。（哲理句）',
        '《天净沙·秋思》马致远：夕阳西下，断肠人在天涯。（思乡）' ] },
      { h: '二、文言文核心实词', items: [
        '《〈论语〉十二章》：罔/殆/乐/善/省/信 等高频考点。',
        '《咏雪》《陈太丘与友期行》：拟/因/舍去/委/引 等。',
        '《诫子书》诸葛亮：静/淡泊/致远/广才/险躁。',
        '《狼》蒲松龄：缀/窘/苫/眈眈/顷刻/黠。' ] },
      { h: '三、名著导读要点', items: [
        '《朝花夕拾》鲁迅：温馨的回忆与理性的批判。',
        '《西游记》吴承恩：孙悟空成长线 + 经典情节。',
        '《骆驼祥子》老舍：祥子三起三落 → 悲剧根源（社会）。',
        '《海底两万里》凡尔纳：尼摩船长 + 科幻想象。' ] },
      { h: '四、易错提醒', items: [
        '默写务必写对字：如“生残夜”非“升”、“郎西”非“郎”。',
        '文言文翻译“留、补、调、换、删”五字法。' ] },
    ] },
  { grade: '初一', subject: '数学', title: '初一数学·全年重点回顾',
    desc: '有理数、整式加减、一元一次方程、几何图形初步四大模块的要点与易错。',
    tags: ['重点回顾', '有理数', '方程', '几何初步'],
    sections: [
      { h: '一、有理数', items: [
        '分类：正/负/0；整数/分数；数轴三要素（原点、正方向、单位长度）。',
        '相反数、绝对值（非负）；科学记数法 a×10ⁿ。',
        '运算：先乘方后乘除加减，注意符号法则。' ] },
      { h: '二、整式加减', items: [
        '单项式：系数+次数；多项式：项+次数。',
        '同类项：字母相同且相同字母指数相同，合并系数。',
        '去括号：括号前是“-”号，里面各项变号。' ] },
      { h: '三、一元一次方程', items: [
        '解法五步：去分母→去括号→移项→合并→系数化为1。',
        '应用题：设未知数→列方程→求解→检验→答。' ] },
      { h: '四、几何图形初步', items: [
        '线段/射线/直线；两点之间线段最短。',
        '角：度分秒换算；余角(90°)、补角(180°)。',
        '平行线判定与性质（同位角、内错角、同旁内角）。' ] },
    ] },
  { grade: '初一', subject: '英语', title: '初一英语·全年重点回顾',
    desc: '三大时态、核心词法、重点句型的系统回顾，夯实基础。',
    tags: ['重点回顾', '时态', '句型', '词汇'],
    sections: [
      { h: '一、三大基础时态', items: [
        '一般现在时：主语三单动词加 -s/-es；表习惯/真理。',
        '现在进行时：am/is/are + doing；表正在发生。',
        '一般过去时：规则动词 +ed，不规则需背。' ] },
      { h: '二、核心词法', items: [
        '名词单复数；代词（主格/宾格/形物代）。',
        '介词 in/on/at；there be 就近原则。',
        '情态动词 can/must/may 后接动词原形。' ] },
      { h: '三、重点句型', items: [
        'What/Who/Where/How 引导的特殊疑问句。',
        '祈使句（动词原形开头）；Let\'s + 动原。',
        '主系表结构：主语 + be + 形容词/名词。' ] },
      { h: '四、提分技巧', items: [
        '完形先看首尾知大意；阅读找关键词定位。',
        '写作：三段式，用 and/but/because 连接。' ] },
    ] },
  { grade: '初一', subject: '生物', title: '初一生物·全年重点回顾',
    desc: '细胞、植物、人体的结构与生理，配核心图表记忆。',
    tags: ['重点回顾', '细胞', '植物', '人体'],
    sections: [
      { h: '一、细胞是生命活动的基本单位', items: [
        '结构：细胞膜/细胞质/细胞核(遗传)/线粒体(能量)。',
        '植物细胞特有：细胞壁、叶绿体、液泡。',
        '细胞分裂：染色体先复制再均分。' ] },
      { h: '二、植物生理', items: [
        '光合作用：二氧化碳+水 →(光)→ 有机物+氧。',
        '呼吸作用：有机物+氧 → 二氧化碳+水+能量。',
        '蒸腾作用：促进水和无机盐运输。' ] },
      { h: '三、人体系统', items: [
        '消化系统；呼吸系统：肺是气体交换场所。',
        '循环系统：心脏泵血，血管分动脉/静脉/毛细血管。' ] },
      { h: '四、易错点', items: [
        '叶绿体≠线粒体。',
        '动脉血≠动脉：肺动脉流静脉血。' ] },
    ] },
  { grade: '初一', subject: '历史', title: '初一历史·全年重点回顾',
    desc: '中国古代史主线：从史前到明清（鸦片战争前）的重大事件与制度。',
    tags: ['重点回顾', '中国古代史', '朝代', '制度'],
    sections: [
      { h: '一、史前与早期国家', items: [
        '元谋人、北京人；河姆渡(水稻)、半坡(粟)。',
        '夏商周：世袭制、分封制、甲骨文。' ] },
      { h: '二、秦汉——大一统', items: [
        '秦：中央集权、统一文字货币度量衡、修长城。',
        '汉：文景之治、汉武帝大一统。' ] },
      { h: '三、三国两晋南北朝', items: [
        '赤壁之战奠定三国鼎立；北魏孝文帝改革(汉化)。',
        '江南开发：北方人口南迁。' ] },
      { h: '四、隋唐宋元明清', items: [
        '隋：大运河、科举制。唐：贞观之治、开元盛世。',
        '宋：经济重心南移完成。元：行省制。明清：君主专制强化。' ] },
    ] },
  { grade: '初一', subject: '地理', title: '初一地理·全年重点回顾',
    desc: '地球与地图、世界地形气候、海陆分布的读图要点。',
    tags: ['重点回顾', '地球', '地图', '气候'],
    sections: [
      { h: '一、地球与地图', items: [
        '地球：赤道周长约4万km；自转(昼夜)、公转(四季)。',
        '地图三要素：方向、比例尺、图例。',
        '等高线：密集坡陡，稀疏坡缓。' ] },
      { h: '二、海陆分布', items: [
        '七分海洋三分陆地；六大板块。',
        '喜马拉雅山由亚欧与印度洋板块碰撞形成。' ] },
      { h: '三、天气与气候', items: [
        '气温：从赤道向两极递减；地形(海拔每升100m降0.6℃)。',
        '气候类型：热带/温带/寒带。' ] },
      { h: '四、读图技巧', items: [
        '先看图名、图例、比例尺；再找经纬网定位。',
        '气候图看气温曲线+降水柱状。' ] },
    ] },
  { grade: '初一', subject: '道德与法治', title: '初一道法·全年重点回顾',
    desc: '成长、友谊、师生、生命的价值观主线梳理。',
    tags: ['重点回顾', '成长', '友谊', '生命'],
    sections: [
      { h: '一、成长的节拍', items: [ '中学时代是人生发展新阶段；少年有梦，努力是桥梁。', '学习伴成长：终身学习的态度。' ] },
      { h: '二、友谊与网络', items: [ '友谊的特质：亲密、平等、双向。', '网上交友：理性辨别、慎重结交。' ] },
      { h: '三、师生交往', items: [ '老师风格不同；学会尊重、主动沟通。', '正确对待老师的表扬与批评。' ] },
      { h: '四、生命的思考', items: [ '生命来之不易、独特、不可逆、短暂。', '敬畏生命、活出生命的精彩。' ] },
    ] },

  // 初二 · 上学期重点预习
  { grade: '初二', subject: '语文', title: '初二语文·上学期重点预习',
    desc: '文言文、说明文、新闻与名著的阅读方法提前准备。',
    tags: ['预习', '文言文', '说明文', '名著'],
    sections: [
      { h: '一、文言文进阶', items: [ '《三峡》《答谢中书书》《记承天寺夜游》：写景抒情类。', '《孟子》三章、《愚公移山》：议论说理类。', '方法：结合注释 + 诵读 + 归类实词。' ] },
      { h: '二、说明文阅读', items: [ '说明对象及特征；说明顺序（时间/空间/逻辑）。', '说明方法：举例子、列数字、作比较、打比方。' ] },
      { h: '三、新闻与传记', items: [ '新闻六要素(5W1H)；标题/导语/主体结构。', '人物传记：抓典型事件看品格。' ] },
      { h: '四、名著预告', items: [ '《红星照耀中国》《昆虫记》《傅雷家书》《钢铁是怎样炼成的》。' ] },
    ] },
  { grade: '初二', subject: '数学', title: '初二数学·上学期重点预习',
    desc: '三角形全等、轴对称、整式乘除、分式、二次根式提前弄清。',
    tags: ['预习', '全等三角形', '轴对称', '分式'],
    sections: [
      { h: '一、三角形与全等', items: [ '三边关系：两边之和大于第三边。', '全等判定：SSS/SAS/ASA/AAS/HL。', '角平分线、垂直平分线性质。' ] },
      { h: '二、轴对称', items: [ '轴对称图形与对称轴。', '等腰三角形：等边对等角，三线合一。' ] },
      { h: '三、整式乘除与因式分解', items: [ '幂的运算；乘法公式 (a±b)²。', '因式分解：提公因式、公式法。' ] },
      { h: '四、分式与二次根式', items: [ '分式有意义：分母≠0。', '二次根式：√a 中 a≥0。' ] },
    ] },
  { grade: '初二', subject: '英语', title: '初二英语·上学期重点预习',
    desc: '时态综合、从句初步、阅读写作提分提前准备。',
    tags: ['预习', '时态', '从句', '写作'],
    sections: [
      { h: '一、时态综合', items: [ '一般将来时：will / be going to。', '现在完成时：have/has + done。', '过去进行时：was/were + doing。' ] },
      { h: '二、从句初步', items: [ '宾语从句：陈述语序、时态呼应。', 'if 条件状语从句：主将从现。' ] },
      { h: '三、词汇与阅读', items: [ '构词法：前缀 un-/dis-，后缀 -ness/-ful。', '阅读：Skim 抓主旨，Scan 找细节。' ] },
      { h: '四、写作升格', items: [ '用连接词：first, besides, however。', '适当用从句避免通篇简单句。' ] },
    ] },
  { grade: '初二', subject: '物理', title: '初二物理·入门重点',
    desc: '声、光、物态变化、运动与力——物理 first year 核心概念。',
    tags: ['预习', '声学', '光学', '力学'],
    sections: [
      { h: '一、声现象', items: [ '声音由振动产生；靠介质传播（真空不传声）。', '特性：音调/响度/音色。' ] },
      { h: '二、光现象', items: [ '光的直线传播：影子、日食。', '反射定律：三线共面、两角相等。', '折射：池水变浅。' ] },
      { h: '三、透镜与视觉', items: [ '凸透镜会聚、凹透镜发散。', '照相机(物远像小)、放大镜。' ] },
      { h: '四、物态变化 & 运动力', items: [ '熔化/凝固、汽化/液化六态。', '速度 v=s/t；力：作用相互。' ] },
    ] },
  { grade: '初二', subject: '生物', title: '初二生物·重点梳理',
    desc: '人体生理、生殖发育、遗传变异与生态。',
    tags: ['预习', '人体生理', '遗传', '生态'],
    sections: [
      { h: '一、人体生理', items: [ '运动系统：骨、关节、肌肉。', '神经调节：反射弧五部分。', '激素调节。' ] },
      { h: '二、生殖与发育', items: [ '有性生殖：精卵结合。', '昆虫/两栖/鸟的生殖发育对比。' ] },
      { h: '三、遗传与变异', items: [ '基因→DNA→染色体。', '显隐性、基因型与表现型。' ] },
      { h: '四、进化与生态', items: [ '达尔文自然选择。', '生态系统：生产者/消费者/分解者。' ] },
    ] },
  { grade: '初二', subject: '历史', title: '初二历史·重点预习',
    desc: '中国近代史主线：从鸦片战争到新中国成立。',
    tags: ['预习', '中国近代史', '抗争', '探索'],
    sections: [
      { h: '一、侵略与抗争', items: [ '鸦片战争→《南京条约》。', '甲午战争→《马关条约》；八国联军→《辛丑条约》。' ] },
      { h: '二、近代化探索', items: [ '洋务运动、戊戌变法、辛亥革命。', '新文化运动：民主与科学。' ] },
      { h: '三、新民主主义革命', items: [ '五四运动(1919)开端。', '中共成立(1921)、抗战、解放战争。' ] },
      { h: '四、记忆技巧', items: [ '时间轴法；对比各条约异同。' ] },
    ] },
  { grade: '初二', subject: '地理', title: '初二地理·重点预习',
    desc: '中国地理：疆域、人口、地形、气候、河流与区域差异。',
    tags: ['预习', '中国地理', '地形', '气候'],
    sections: [
      { h: '一、疆域与人口', items: [ '34个省级行政区(记轮廓/简称)。', '人口分布：黑河—腾冲线东南密西北疏。' ] },
      { h: '二、自然地理', items: [ '地形：西高东低三级阶梯。', '气候：季风气候显著。', '长江/黄河开发与治理。' ] },
      { h: '三、区域差异', items: [ '四大地理区域：北方/南方/西北/青藏。' ] },
      { h: '四、读图', items: [ '中国地形图、气候类型图常考。' ] },
    ] },
  { grade: '初二', subject: '道德与法治', title: '初二道法·重点预习',
    desc: '社会生活、网络、规则与责任的核心观念。',
    tags: ['预习', '社会', '网络', '责任'],
    sections: [
      { h: '一、走进社会生活', items: [ '个人与社会关系；亲社会行为。', '社会规则保障社会秩序。' ] },
      { h: '二、网络生活', items: [ '利：便利、交往、创新。', '合理利用：提高媒介素养、守道德法律。' ] },
      { h: '三、规则与法律', items: [ '道德、纪律、法律等规则。', '违法行为的分类与后果。' ] },
      { h: '四、责任', items: [ '角色不同责任不同。', '关爱他人、服务社会。' ] },
    ] },

  // 初三 · 中考总复习
  { grade: '初三', subject: '语文', title: '初三语文·中考总复习',
    desc: '议论文、小说、文言文综合与中考写作冲刺框架。',
    tags: ['中考', '议论文', '文言文', '写作'],
    sections: [
      { h: '一、现代文阅读', items: [ '议论文：论点/论据/论证。', '小说：人物、情节、环境三要素。', '散文：形散神聚，抓线索。' ] },
      { h: '二、文言文综合', items: [ '实词18个高频系统复习。', '《出师表》《送东阳马生序》等必背。' ] },
      { h: '三、名著冲刺', items: [ '《水浒传》《儒林外史》《简·爱》要点。' ] },
      { h: '四、中考写作', items: [ '审题立意不偏题；结构三段式。', '素材：亲情、成长、文化、科技。' ] },
    ] },
  { grade: '初三', subject: '数学', title: '初三数学·中考重点',
    desc: '一元二次方程、二次函数、圆、相似、三角函数的中考主线。',
    tags: ['中考', '二次函数', '圆', '相似'],
    sections: [
      { h: '一、方程与函数', items: [ '一元二次方程：配方法、公式法。', '二次函数：对称轴、顶点、最值。' ] },
      { h: '二、图形与证明', items: [ '平行四边形性质判定。', '圆：垂径定理、圆周角、切线。', '相似：判定与性质。' ] },
      { h: '三、锐角三角函数', items: [ 'sin/cos/tan；特殊角值。', '解直角三角形。' ] },
      { h: '四、概率与统计', items: [ '列表法/树状图；统计图表。' ] },
    ] },
  { grade: '初三', subject: '英语', title: '初三英语·中考重点',
    desc: '综合时态、定语从句、听说读写冲刺。',
    tags: ['中考', '时态', '从句', '听说'],
    sections: [
      { h: '一、语法综合', items: [ '被动语态：be + done。', '定语从句：that/which/who。' ] },
      { h: '二、题型突破', items: [ '完形：上下文+搭配。', '阅读：主旨/细节/推断。' ] },
      { h: '三、听说', items: [ '听力抓关键词；口语连贯表达。' ] },
      { h: '四、写作模板', items: [ '书信/征文三段式；高级表达。' ] },
    ] },
  { grade: '初三', subject: '物理', title: '初三物理·中考重点',
    desc: '内能、电学(欧姆定律/电功率)、磁、热机与能源。',
    tags: ['中考', '电学', '欧姆定律', '能量'],
    sections: [
      { h: '一、内能及其利用', items: [ '比热容 Q=cmΔt。', '热机：四冲程；热值。' ] },
      { h: '二、电学核心', items: [ '串并联识别；电流表(串)电压表(并)。', '欧姆定律 I=U/R。', '电功率 P=UI；焦耳定律。' ] },
      { h: '三、磁与信息', items: [ '电生磁(奥斯特)；电动机/发电机。' ] },
      { h: '四、能源', items: [ '可再生/不可再生；能量守恒。' ] },
    ] },
  { grade: '初三', subject: '化学', title: '初三化学·入门重点',
    desc: '物质构成、化学用语、空气氧气、水碳、金属与酸碱盐。',
    tags: ['中考', '化学用语', '氧气', '酸碱盐'],
    sections: [
      { h: '一、入门基础', items: [ '物理变化 vs 化学变化。', '化学用语：元素符号、化学式、方程式。', '原子结构：质子/中子/电子。' ] },
      { h: '二、空气与氧气', items: [ '空气：N₂约78%、O₂约21%。', '实验室制氧；催化剂。' ] },
      { h: '三、水、碳与金属', items: [ '水的电解：正氧负氢。', '碳：金刚石/石墨/活性炭。', '金属活动性顺序。' ] },
      { h: '四、溶液与酸碱盐', items: [ '溶解度曲线。', '中和反应(酸+碱→盐+水)。' ] },
    ] },
  { grade: '初三', subject: '历史', title: '初三历史·中考重点',
    desc: '中国现代史 + 世界史综合，构建时空观念。',
    tags: ['中考', '中国现代史', '世界史', '综合'],
    sections: [
      { h: '一、中国现代史', items: [ '新中国成立(1949)、一五计划。', '改革开放(1978)：经济特区。' ] },
      { h: '二、世界近代史', items: [ '文艺复兴、新航路、工业革命。' ] },
      { h: '三、世界现代史', items: [ '两次世界大战；冷战格局。' ] },
      { h: '四、复习方法', items: [ '时空观念：时间轴+地图。' ] },
    ] },
  { grade: '初三', subject: '道德与法治', title: '初三道法·中考重点',
    desc: '国情、法治、品德与全球视野的模块整合。',
    tags: ['中考', '国情', '法治', '全球'],
    sections: [
      { h: '一、国情教育', items: [ '基本国情：社会主义初级阶段。', '共同富裕、高质量发展。' ] },
      { h: '二、法治建设', items: [ '依法治国：科学立法等十六字。', '宪法是根本法；权利义务统一。' ] },
      { h: '三、品德与价值', items: [ '社会主义核心价值观；创新精神。' ] },
      { h: '四、全球视野', items: [ '人类命运共同体；生态文明。' ] },
    ] },
];

const TPL = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>{TITLE} · 点滴进步</title>
<style>
:root{--purple:#7C5CFF;--blue:#4D9BFF;--ink:#1f2233;--muted:#6b7280;}
*{box-sizing:border-box;}
body{margin:0;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:linear-gradient(160deg,#f3f0ff,#eef4ff);color:var(--ink);line-height:1.7;}
.wrap{max-width:780px;margin:0 auto;padding:24px 18px 60px;}
.hero{background:linear-gradient(135deg,var(--purple),var(--blue));color:#fff;border-radius:18px;padding:26px 22px;box-shadow:0 10px 30px rgba(124,92,255,.35);}
.hero .tag{display:inline-block;background:rgba(255,255,255,.22);padding:4px 12px;border-radius:999px;font-size:13px;margin-bottom:10px;}
.hero h1{margin:6px 0 8px;font-size:24px;} .hero p{margin:0;opacity:.95;font-size:14px;}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 4px;} .chip{background:#fff;border:1px solid #e3ddff;color:var(--purple);font-size:12px;padding:3px 10px;border-radius:999px;}
.card{background:#fff;border-radius:14px;padding:18px;margin-top:16px;box-shadow:0 4px 16px rgba(31,34,51,.06);}
.card h2{font-size:17px;margin:0 0 10px;color:var(--purple);border-left:4px solid var(--purple);padding-left:10px;}
.card ul{margin:6px 0 0;padding-left:20px;} .card li{margin:6px 0;} .card p{margin:6px 0;}
.foot{text-align:center;color:var(--muted);font-size:12px;margin-top:28px;}
.tip{background:#fff7e6;border:1px solid #ffe1a8;color:#8a5b00;border-radius:10px;padding:10px 12px;font-size:13px;margin-top:14px;}
</style></head><body><div class="wrap">
<div class="hero"><div class="tag">{GRADE} · {SUBJECT}</div><h1>{TITLE}</h1><p>{DESC}</p></div>
<div class="meta">{CHIPS}</div>
{SECTIONS}
<div class="tip">📌 本资料由「点滴进步」系统整理，供复习参考。老师可在管理端补充或替换更贴合教材版本的内容。</div>
<div class="foot">点滴进步 · 课程资料</div>
</div></body></html>`;

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function renderHtml(e) {
  const chips = (e.tags || []).map((t) => `<span class="chip">#${esc(t)}</span>`).join('');
  const secs = (e.sections || []).map((s) => {
    if (Array.isArray(s.items)) {
      const lis = s.items.map((i) => `<li>${esc(i)}</li>`).join('');
      return `<div class="card"><h2>${esc(s.h)}</h2><ul>${lis}</ul></div>`;
    }
    return `<div class="card"><h2>${esc(s.h)}</h2><p>${esc(s.p || '')}</p></div>`;
  }).join('\n');
  return TPL.replace('{TITLE}', esc(e.title)).replace('{GRADE}', esc(e.grade))
    .replace('{SUBJECT}', esc(e.subject)).replace('{DESC}', esc(e.desc))
    .replace('{CHIPS}', chips).replace('{SECTIONS}', secs);
}
function slugOf(e) {
  return 'r' + crypto.createHash('md5').update(e.grade + e.subject + e.title).digest('hex').slice(0, 12);
}

// 仅当 resource 表为空时播种，保证幂等且不覆盖老师后续增删
async function seedResources(db) {
  try {
    // ── 安全网：确保 resource 表存在（防御 exec 部分失败导致表未建）──
    try { await db.prepare(`CREATE TABLE IF NOT EXISTS resource (
      id INT PRIMARY KEY AUTO_INCREMENT,
      grade VARCHAR(32) NOT NULL,
      subject VARCHAR(64) NOT NULL,
      title VARCHAR(512) NOT NULL,
      cover TEXT,
      type VARCHAR(32) NOT NULL,
      url TEXT NOT NULL,
      description TEXT,
      source TEXT,
      tags TEXT,
      content TEXT,
      sort_order INT DEFAULT 0,
      view_count INT DEFAULT 0,
      unlock_count INT DEFAULT 0,
      created_by INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_resource_gs (grade, subject, sort_order)
    )`).run(); } catch (_) { /* 表已存在或建表失败，继续尝试 */ }

    const cnt = await (await db.prepare('SELECT COUNT(*) AS c FROM resource').get()).c;
    if (cnt > 0) return;
    fs.mkdirSync(STUDY_DIR, { recursive: true });
    const admin = await db.prepare("SELECT id FROM sys_user WHERE role='ADMIN' ORDER BY id LIMIT 1").get();
    const createdBy = admin ? admin.id : null;
    const ins = await db.prepare(
      'INSERT INTO resource(grade,subject,title,cover,type,url,description,source,tags,content,sort_order,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)'
    );
    let n = 0;
    for (const e of KB) {
      const slug = slugOf(e);
      const url = `/study/${slug}.html`;
      const contentJson = JSON.stringify({ sections: e.sections || [], tags: e.tags || [] });
      fs.writeFileSync(path.join(STUDY_DIR, `${slug}.html`), renderHtml(e), 'utf-8');
      ins.run(e.grade, e.subject, e.title, null, 'article', url, e.desc, SOURCE,
        JSON.stringify(e.tags || []), contentJson, 0, createdBy);
      n++;
    }
    console.log(`[seed_resources] 已自动播种 ${n} 条课程资料到 /study/`);
  } catch (err) {
    console.error('[seed_resources] 播种失败（不影响主服务启动）:', err.message);
  }
}

module.exports = { seedResources, KB, renderHtml, slugOf };
