import io
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

import pandas as pd
from bs4 import BeautifulSoup


def _limpar_tags_html(texto: str) -> str:
    """Remove tags HTML mantendo quebras de linha limpas."""
    if not texto:
        return ""
    texto = re.sub(r"<br\s*/?>", "\n", texto, flags=re.IGNORECASE)
    texto = re.sub(r"</p>", "\n\n", texto, flags=re.IGNORECASE)
    texto = re.sub(r"</li>", "\n", texto, flags=re.IGNORECASE)
    texto = re.sub(r"<[^>]+>", "", texto)
    # Decodifica entidades comuns
    texto = texto.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"')
    return texto.strip()


def extrair_tabelas_html(html_content: str) -> List[pd.DataFrame]:
    """Extrai todas as tags <table> de uma string HTML para lista de DataFrames."""
    dataframes = []
    if not html_content or "<table" not in html_content.lower():
        return dataframes

    try:
        soup = BeautifulSoup(html_content, "html.parser")
        tables = soup.find_all("table")
        for tbl in tables:
            rows = []
            headers = []
            # Cabeçalhos
            thead = tbl.find("thead")
            if thead:
                th_elements = thead.find_all(["th", "td"])
                headers = [th.get_text().strip() for th in th_elements]

            # Linhas do corpo
            tbody = tbl.find("tbody") or tbl
            for tr in tbody.find_all("tr"):
                cells = [td.get_text().strip() for td in tr.find_all(["td", "th"])]
                if cells:
                    # Se não tinha thead e headers está vazio, usa primeira linha
                    if not headers and len(rows) == 0:
                        headers = cells
                    else:
                        rows.append(cells)

            if rows and headers:
                # Normaliza tamanho das colunas
                max_cols = max(len(headers), max(len(r) for r in rows))
                if len(headers) < max_cols:
                    headers += [f"Coluna_{i+1}" for i in range(len(headers), max_cols)]
                norm_rows = []
                for r in rows:
                    if len(r) < max_cols:
                        r = r + [""] * (max_cols - len(r))
                    norm_rows.append(r[:max_cols])

                df = pd.DataFrame(norm_rows, columns=headers[:max_cols])
                dataframes.append(df)
    except Exception as err:
        print(f"[document_generator] Erro ao extrair tabelas HTML: {err}")

    return dataframes


def gerar_documento_docx(
    titulo: str,
    conteudo_html_ou_texto: str,
    autor: str = "DataInsight Copiloto IA",
    metadados: Optional[Dict[str, Any]] = None,
) -> io.BytesIO:
    """Gera um documento Microsoft Word (.docx) estruturado e formatado."""
    import docx
    from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml import OxmlElement, parse_xml
    from docx.oxml.ns import nsdecls, qn
    from docx.shared import Inches, Pt, RGBColor

    doc = docx.Document()

    # Configuração de Margens
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.9)
        section.right_margin = Inches(0.9)

    # Cores do Sistema
    COR_AZUL_ESC = RGBColor(15, 23, 42)     # #0f172a
    COR_AZUL_DIR = RGBColor(37, 99, 235)    # #2563eb
    COR_CINZA = RGBColor(100, 116, 139)     # #64748b

    # Cabeçalho Superior Institucional
    p_header = doc.add_paragraph()
    p_header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run_brand = p_header.add_run("📊 DataInsight · Centro de Inteligência Analítica")
    run_brand.font.size = Pt(8.5)
    run_brand.font.bold = True
    run_brand.font.color.rgb = COR_CINZA

    # Título do Documento
    p_titulo = doc.add_paragraph()
    p_titulo.paragraph_format.space_before = Pt(12)
    p_titulo.paragraph_format.space_after = Pt(4)
    run_t = p_titulo.add_run(titulo or "Relatório de Análise Estratégica")
    run_t.font.size = Pt(22)
    run_t.font.bold = True
    run_t.font.color.rgb = COR_AZUL_ESC

    # Subtítulo com Data e Agente
    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_after = Pt(14)
    data_str = datetime.now().strftime("%d/%m/%Y às %H:%M")
    run_sub = p_sub.add_run(f"Emitido em: {data_str} | Especialista: {autor}")
    run_sub.font.size = Pt(9.5)
    run_sub.font.color.rgb = COR_AZUL_DIR

    # Box de Metadados / Arquivo Anexado (se houver)
    if metadados and isinstance(metadados, dict):
        nome_arq = metadados.get("nome") or metadados.get("arquivo_nome")
        if nome_arq:
            tam_arq = metadados.get("tamanho_fmt") or ""
            tipo_arq = metadados.get("tipo") or metadados.get("extensao") or ""

            tbl_meta = doc.add_table(rows=1, cols=1)
            tbl_meta.alignment = WD_TABLE_ALIGNMENT.CENTER
            cell = tbl_meta.cell(0, 0)
            # Fundo suave
            shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="F1F5F9"/>')
            cell._tc.get_or_add_tcPr().append(shading)

            p_meta = cell.paragraphs[0]
            p_meta.paragraph_format.space_before = Pt(6)
            p_meta.paragraph_format.space_after = Pt(6)
            r_meta_icon = p_meta.add_run("📎 Arquivo Analisado: ")
            r_meta_icon.font.bold = True
            r_meta_icon.font.size = Pt(10)
            r_meta_icon.font.color.rgb = COR_AZUL_ESC

            r_meta_val = p_meta.add_run(f"{nome_arq} ({tam_arq}) [{tipo_arq}]")
            r_meta_val.font.size = Pt(9.5)
            doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # Linha divisória estética
    p_div = doc.add_paragraph()
    p_div.paragraph_format.space_after = Pt(12)
    p_div_border = parse_xml(f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="12" w:space="1" w:color="2563EB"/></w:pBdr>')
    p_div._p.get_or_add_pPr().append(p_div_border)

    # Processamento de Conteúdo (HTML -> Parágrafos / Listas / Tabelas Word)
    soup = BeautifulSoup(conteudo_html_ou_texto, "html.parser")
    elementos = soup.find_all(["h1", "h2", "h3", "h4", "p", "ul", "ol", "table", "blockquote"])

    if not elementos:
        # Se for texto puro sem tags estruturadas
        for linha in conteudo_html_ou_texto.split("\n"):
            linha = linha.strip()
            if not linha:
                continue
            if linha.startswith("#"):
                nivel = min(linha.count("#"), 3)
                p = doc.add_heading(linha.lstrip("#").strip(), level=nivel)
            elif linha.startswith("- ") or linha.startswith("* "):
                p = doc.add_paragraph(linha[2:], style="List Bullet")
            else:
                doc.add_paragraph(linha)
    else:
        for elem in elementos:
            tag = elem.name.lower()
            txt = elem.get_text().strip()
            if not txt and tag != "table":
                continue

            if tag in ["h1", "h2"]:
                h = doc.add_heading(txt, level=1)
                h.paragraph_format.space_before = Pt(14)
                h.paragraph_format.space_after = Pt(4)
                for run in h.runs:
                    run.font.color.rgb = COR_AZUL_ESC
                    run.font.bold = True
            elif tag in ["h3", "h4"]:
                h = doc.add_heading(txt, level=2)
                h.paragraph_format.space_before = Pt(10)
                h.paragraph_format.space_after = Pt(3)
                for run in h.runs:
                    run.font.color.rgb = COR_AZUL_DIR
                    run.font.bold = True
            elif tag == "p":
                p = doc.add_paragraph()
                p.paragraph_format.space_after = Pt(6)
                p.paragraph_format.line_spacing = 1.15
                # Preserva negritos internos
                for child in elem.children:
                    if hasattr(child, "name") and child.name in ["strong", "b"]:
                        r = p.add_run(child.get_text())
                        r.font.bold = True
                    else:
                        p.add_run(child if isinstance(child, str) else child.get_text())
            elif tag in ["ul", "ol"]:
                for li in elem.find_all("li"):
                    li_txt = li.get_text().strip()
                    if li_txt:
                        doc.add_paragraph(li_txt, style="List Bullet")
            elif tag == "table":
                # Converte tag table em tabela Word real
                dfs = extrair_tabelas_html(str(elem))
                if dfs:
                    df = dfs[0]
                    t_word = doc.add_table(rows=len(df) + 1, cols=len(df.columns))
                    t_word.alignment = WD_TABLE_ALIGNMENT.CENTER
                    t_word.autofit = True

                    # Cabeçalho da Tabela
                    hdr_cells = t_word.rows[0].cells
                    for i, col_name in enumerate(df.columns):
                        hdr_cells[i].text = str(col_name)
                        shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="1E293B"/>')
                        hdr_cells[i]._tc.get_or_add_tcPr().append(shading)
                        p_hdr = hdr_cells[i].paragraphs[0]
                        for r in p_hdr.runs:
                            r.font.bold = True
                            r.font.color.rgb = RGBColor(255, 255, 255)
                            r.font.size = Pt(9.5)

                    # Linhas de Dados
                    for r_idx, row in df.iterrows():
                        row_cells = t_word.rows[r_idx + 1].cells
                        is_even = (r_idx % 2 == 0)
                        fill_color = "F8FAFC" if is_even else "FFFFFF"
                        for c_idx, val in enumerate(row):
                            row_cells[c_idx].text = str(val)
                            shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_color}"/>')
                            row_cells[c_idx]._tc.get_or_add_tcPr().append(shd)
                            p_cell = row_cells[c_idx].paragraphs[0]
                            for r in p_cell.runs:
                                r.font.size = Pt(9)
                                r.font.color.rgb = RGBColor(51, 65, 85)

                    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # Rodapé Institucional
    p_foot = doc.add_paragraph()
    p_foot.paragraph_format.space_before = Pt(20)
    p_foot.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_foot = p_foot.add_run("Documento Oficial · Gerado por DataInsight Copiloto IA")
    r_foot.font.size = Pt(8)
    r_foot.font.italic = True
    r_foot.font.color.rgb = COR_CINZA

    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer


def gerar_documento_xlsx(
    titulo: str,
    conteudo_html_ou_texto: str,
    tabelas_data: Optional[List[pd.DataFrame]] = None,
    metadados: Optional[Dict[str, Any]] = None,
) -> io.BytesIO:
    """Gera uma planilha Excel (.xlsx) altamente estruturada e formatada."""
    import openpyxl
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter

    wb = openpyxl.Workbook()
    # Remove sheet default criada vazia
    ws_default = wb.active

    # Extrai tabelas HTML caso não tenham sido passadas explicitamente
    tabelas = tabelas_data or extrair_tabelas_html(conteudo_html_ou_texto)

    # Estilos de Célula
    fill_header = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")  # Azul escuro
    font_header = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    fill_zebra = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    font_data = Font(name="Calibri", size=10, color="0F172A")
    border_thin = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )

    if tabelas:
        wb.remove(ws_default)
        for idx, df in enumerate(tabelas):
            sheet_title = f"Tabela_{idx+1}" if len(tabelas) > 1 else "Dados Analisados"
            ws = wb.create_sheet(title=sheet_title[:30])
            ws.views.sheetView[0].showGridLines = True

            # Título da Tabela
            ws.cell(row=1, column=1, value=f"{titulo} — {sheet_title}")
            ws.cell(row=1, column=1).font = Font(name="Calibri", size=13, bold=True, color="1E3A8A")
            ws.cell(row=2, column=1, value=f"Gerado em {datetime.now().strftime('%d/%m/%Y %H:%M')} por DataInsight Copiloto IA")
            ws.cell(row=2, column=1).font = Font(name="Calibri", size=9, italic=True, color="64748B")

            start_row = 4
            # Cabeçalhos
            for col_idx, col_name in enumerate(df.columns, 1):
                cell = ws.cell(row=start_row, column=col_idx, value=str(col_name))
                cell.fill = fill_header
                cell.font = font_header
                cell.alignment = Alignment(horizontal="center", vertical="center")
                cell.border = border_thin

            # Linhas de Dados
            for r_idx, row in df.iterrows():
                current_row = start_row + 1 + r_idx
                is_even = (r_idx % 2 == 0)
                for c_idx, val in enumerate(row, 1):
                    # Tenta converter para número se aplicável
                    val_formatado = val
                    if isinstance(val, str):
                        val_limpo = val.replace("R$", "").replace("%", "").replace(".", "").replace(",", ".").strip()
                        try:
                            val_formatado = float(val_limpo) if "." in val_limpo else int(val_limpo)
                        except Exception:
                            val_formatado = val

                    cell = ws.cell(row=current_row, column=c_idx, value=val_formatado)
                    cell.font = font_data
                    cell.border = border_thin
                    if is_even:
                        cell.fill = fill_zebra

                    if isinstance(val_formatado, (int, float)):
                        cell.alignment = Alignment(horizontal="right")
                    else:
                        cell.alignment = Alignment(horizontal="left")

            # Auto-ajuste da largura das colunas
            for col in ws.columns:
                max_len = 0
                col_letter = get_column_letter(col[0].column)
                for cell in col:
                    if cell.row >= start_row and cell.value:
                        max_len = max(max_len, len(str(cell.value)))
                ws.column_dimensions[col_letter].width = max(max_len + 4, 12)
    else:
        # Se não há tabelas estruturadas, monta folha de Diagnóstico e Insights
        ws = ws_default
        ws.title = "Diagnóstico Executivo"
        ws.views.sheetView[0].showGridLines = True

        ws.cell(row=1, column=1, value=titulo or "Relatório Executivo")
        ws.cell(row=1, column=1).font = Font(name="Calibri", size=14, bold=True, color="1E3A8A")
        ws.cell(row=2, column=1, value=f"DataInsight IA · {datetime.now().strftime('%d/%m/%Y %H:%M')}")
        ws.cell(row=2, column=1).font = Font(name="Calibri", size=9, italic=True, color="64748B")

        linhas_texto = _limpar_tags_html(conteudo_html_ou_texto).split("\n")
        r_atual = 4
        for l in linhas_texto:
            l = l.strip()
            if not l:
                continue
            cell = ws.cell(row=r_atual, column=1, value=l)
            if l.endswith(":") or (len(l) < 50 and not l.startswith("-")):
                cell.font = Font(name="Calibri", size=11, bold=True, color="1E293B")
            else:
                cell.font = font_data
            r_atual += 1

        ws.column_dimensions["A"].width = 90

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def gerar_documento_pdf(
    titulo: str,
    conteudo_html_ou_texto: str,
    autor: str = "DataInsight Copiloto IA",
    metadados: Optional[Dict[str, Any]] = None,
) -> io.BytesIO:
    """Gera um PDF oficial com capa, cabeçalho e tabelas via ReportLab."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import cm, mm
    from reportlab.platypus import HRFlowable, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
    )

    styles = getSampleStyleSheet()

    # Estilos Customizados
    style_brand = ParagraphStyle(
        "BrandHeader",
        parent=styles["Normal"],
        fontSize=8.5,
        textColor=colors.HexColor("#64748b"),
        alignment=2,  # Direita
        fontName="Helvetica-Bold",
        spaceAfter=6,
    )

    style_title = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        spaceAfter=4,
    )

    style_sub = ParagraphStyle(
        "DocSub",
        parent=styles["Normal"],
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#2563eb"),
        fontName="Helvetica",
        spaceAfter=12,
    )

    style_h2 = ParagraphStyle(
        "DocH2",
        parent=styles["Heading2"],
        fontSize=13,
        leading=17,
        textColor=colors.HexColor("#1e293b"),
        fontName="Helvetica-Bold",
        spaceBefore=12,
        spaceAfter=6,
    )

    style_body = ParagraphStyle(
        "DocBody",
        parent=styles["Normal"],
        fontSize=9.5,
        leading=14.5,
        textColor=colors.HexColor("#334155"),
        fontName="Helvetica",
        spaceAfter=6,
    )

    style_bullet = ParagraphStyle(
        "DocBullet",
        parent=styles["Normal"],
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor("#334155"),
        leftIndent=14,
        firstLineIndent=-10,
        spaceAfter=4,
    )

    story = []

    # Cabeçalho Superior
    story.append(Paragraph("📊 <b>DataInsight</b> · Centro de Inteligência Analítica", style_brand))
    story.append(Paragraph(titulo or "Relatório Executivo de Análise IA", style_title))

    data_str = datetime.now().strftime("%d/%m/%Y às %H:%M")
    story.append(Paragraph(f"Emitido em: <b>{data_str}</b> | Especialista: <b>{autor}</b>", style_sub))

    # Box de Anexo (se houver)
    if metadados and isinstance(metadados, dict):
        nome_arq = metadados.get("nome") or metadados.get("arquivo_nome")
        if nome_arq:
            tam_arq = metadados.get("tamanho_fmt") or ""
            t_meta = [
                [Paragraph(f"📎 <b>Arquivo Analisado:</b> {nome_arq} &nbsp;·&nbsp; <b>Tamanho:</b> {tam_arq}", style_body)]
            ]
            tbl_meta = Table(t_meta, colWidths=[174 * mm])
            tbl_meta.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ]))
            story.append(tbl_meta)
            story.append(Spacer(1, 4 * mm))

    # Linha divisória
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2563eb"), spaceAfter=10))

    # Processamento dos Elementos HTML
    soup = BeautifulSoup(conteudo_html_ou_texto, "html.parser")
    elementos = soup.find_all(["h1", "h2", "h3", "h4", "p", "ul", "ol", "table", "blockquote"])

    if not elementos:
        for linha in _limpar_tags_html(conteudo_html_ou_texto).split("\n"):
            linha = linha.strip()
            if not linha:
                continue
            if linha.startswith("- ") or linha.startswith("* "):
                story.append(Paragraph(f"• {linha[2:]}", style_bullet))
            else:
                story.append(Paragraph(linha, style_body))
    else:
        for elem in elementos:
            tag = elem.name.lower()
            txt = elem.get_text().strip()
            if not txt and tag != "table":
                continue

            if tag in ["h1", "h2", "h3", "h4"]:
                story.append(Paragraph(f"<b>{txt}</b>", style_h2))
            elif tag == "p":
                story.append(Paragraph(str(elem).replace("<p>", "").replace("</p>", ""), style_body))
            elif tag in ["ul", "ol"]:
                for li in elem.find_all("li"):
                    story.append(Paragraph(f"• {li.get_text().strip()}", style_bullet))
            elif tag == "table":
                dfs = extrair_tabelas_html(str(elem))
                if dfs:
                    df = dfs[0]
                    col_count = len(df.columns)
                    avail_width = 174 * mm
                    col_width = avail_width / max(col_count, 1)

                    t_data = []
                    # Header
                    hdr_row = [Paragraph(f"<b>{col}</b>", ParagraphStyle("TH", parent=style_body, textColor=colors.white, fontSize=8.5, alignment=1)) for col in df.columns]
                    t_data.append(hdr_row)

                    # Rows
                    for _, row in df.iterrows():
                        r_data = [Paragraph(str(val), ParagraphStyle("TD", parent=style_body, fontSize=8)) for val in row]
                        t_data.append(r_data)

                    table_obj = Table(t_data, colWidths=[col_width] * col_count)
                    table_obj.setStyle(TableStyle([
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                    ]))
                    story.append(Spacer(1, 3 * mm))
                    story.append(table_obj)
                    story.append(Spacer(1, 4 * mm))

    # Rodapé do PDF
    def rodape(canvas, d):
        canvas.saveState()
        canvas.setFont("Helvetica-Oblique", 8)
        canvas.setFillColor(colors.HexColor("#94a3b8"))
        canvas.drawString(18 * mm, 10 * mm, "DataInsight Copiloto IA · Documento Confidencial")
        canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Página {canvas._pageNumber}")
        canvas.restoreState()

    doc.build(story, onFirstPage=rodape, onLaterPages=rodape)
    buffer.seek(0)
    return buffer


def compilar_conversa_para_documento(sessao_id: str, usuario_id: str) -> Dict[str, Any]:
    """Recupera e estrutura todas as mensagens da sessão em um relatório compilado."""
    from backend.db import chat_historico

    docs = list(chat_historico.find({
        "usuario_id": usuario_id,
        "sessao_id": sessao_id
    }).sort("data", 1))

    if not docs:
        return {
            "titulo": "Histórico de Conversa",
            "conteudo_html": "<p>Nenhuma mensagem encontrada nesta conversa.</p>",
            "metadados": None
        }

    html_parts = []
    anexo_info = None

    for d in docs:
        remetente = d.get("remetente")
        msg = d.get("mensagem", "")
        data_m = d.get("data")
        data_str = data_m.strftime("%d/%m/%Y %H:%M") if data_m else ""
        anexo = d.get("anexo")
        if anexo and not anexo_info:
            anexo_info = anexo

        if remetente == "user":
            html_parts.append(f"<h3 style='color:#2563eb;'>👤 Usuário ({data_str}):</h3>")
            if anexo and isinstance(anexo, dict):
                html_parts.append(
                    f"<p style='padding:6px 10px;background:#f1f5f9;border-radius:6px;font-size:0.9em;'>"
                    f"📎 <b>Arquivo enviado:</b> {anexo.get('nome')} ({anexo.get('tamanho_fmt', '')})</p>"
                )
            html_parts.append(f"<p>{msg}</p>")
        else:
            html_parts.append(f"<h3 style='color:#0f172a;'>🤖 Copiloto IA ({data_str}):</h3>")
            html_parts.append(f"<div>{msg}</div>")
        html_parts.append("<hr style='border:0;border-top:1px solid #e2e8f0;margin:12px 0;'/>")

    return {
        "titulo": f"Histórico Completo da Conversa — {sessao_id[:8]}",
        "conteudo_html": "".join(html_parts),
        "metadados": anexo_info
    }
