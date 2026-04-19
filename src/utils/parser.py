# src/utils/parser.py
import os
import pandas as pd
import pdfplumber
import docx

def parse_excel(file_path: str, text_column: str = "客诉内容") -> list:
    """
    解析 Excel/CSV 文件，智能识别真正包含客诉内容的列
    """
    try:
        ext = os.path.splitext(file_path)[1].lower()
        
        # 1. 正常读取表格（默认第一行是表头）
        if ext == '.csv':
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
            
        target_col = None
        
        # 2. 策略A：精确匹配用户指定的列名
        if text_column in df.columns:
            target_col = text_column
        else:
            # 3. 策略B：模糊匹配常见表头（如果第一列是客户名，第二列是"内容"或"反馈"，它能精准抓取）
            for col in df.columns:
                if any(kw in str(col) for kw in ["内容", "反馈", "客诉", "文本", "诉求", "问题"]):
                    target_col = col
                    break
                    
        # 4. 策略C：兜底方案。如果连关键词都没匹配上，通常企业表格的最后一列才是长文本备注
        if target_col is None:
            target_col = df.columns[-1] 
            
        # 5. 提取目标列的数据，过滤空值
        texts = df[target_col].dropna().astype(str).tolist()
        
        # （可选容错）如果用户恰好没写表头，第一行真的是数据，且刚好被 pandas 当成了表头吞掉
        # 我们可以把它补回来：
        if target_col not in ["内容", "反馈", "客诉", "文本", "诉求", "问题"] and len(str(target_col)) > 10:
             texts.insert(0, str(target_col))

        return [{"text": t} for t in texts]
        
    except Exception as e:
        raise RuntimeError(f"表格解析失败: {str(e)}")

def parse_pdf(file_path: str) -> str:
    """
    解析 PDF 文件，返回合并后的长字符串。
    """
    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
        return text
    except Exception as e:
        raise RuntimeError(f"PDF 解析失败: {str(e)}")

def parse_word(file_path: str) -> str:
    """
    解析 Word 文件，返回合并后的长字符串。
    """
    try:
        doc = docx.Document(file_path)
        return "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
    except Exception as e:
        raise RuntimeError(f"Word 解析失败: {str(e)}")

def parse_document(file_path: str) -> dict:
    """
    统一解析入口：根据文件后缀名调用对应的解析器，并返回适配 AgentState 的格式。
    """
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext in ['.xlsx', '.xls', '.csv']:
        return {
            "file_type": "excel", 
            "raw_content": parse_excel(file_path)
        }
    elif ext == '.pdf':
        return {
            "file_type": "pdf", 
            "raw_content": parse_pdf(file_path)
        }
    elif ext in ['.doc', '.docx']:
        # 虽然我们的 Router 目前只处理 pdf 和 excel，但 Word 长文也是走深度分析子图，所以先归类为 pdf 模式的路由
        return {
            "file_type": "pdf", 
            "raw_content": parse_word(file_path)
        }
    else:
        raise ValueError(f"不支持的文件类型: {ext}")