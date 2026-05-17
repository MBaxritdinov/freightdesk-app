import io
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from auth import get_current_user
from database import get_db
from models import Load, LoadEvent, LoadStatus, User, UserRole

CARRIER_NAME = "SV GLOBAL INC"
CARRIER_MC = "MC# 1650011"

loads_router = APIRouter(tags=["bol"])
tracking_router = APIRouter(tags=["tracking"])


def _log_event(db: Session, load_id: int, event_type: str, description: str, user_id: Optional[int] = None):
    ev = LoadEvent(load_id=load_id, event_type=event_type, description=description, created_by=user_id)
    db.add(ev)
    db.commit()


def _generate_bol_pdf(load: Load) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        topMargin=0.5 * inch, bottomMargin=0.45 * inch,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch,
    )

    # usable width = 8.5 - 0.75 - 0.75 = 7.0 inches
    W       = 7.0
    BLK     = colors.black
    WHT     = colors.white
    LGRAY   = colors.HexColor("#f0f0f0")
    DGRAY   = colors.HexColor("#1a1a1a")
    MGRAY   = colors.HexColor("#555555")
    CGRAY   = colors.HexColor("#444444")

    # ── paragraph style helper ────────────────────────────────────────────────
    def _ps(name, size=9, bold=False, color=BLK, align=TA_LEFT, leading=None):
        return ParagraphStyle(
            name,
            fontName="Helvetica-Bold" if bold else "Helvetica",
            fontSize=size,
            textColor=color,
            alignment=align,
            leading=leading or (size * 1.35),
        )

    p_title  = _ps("BT",  size=18, bold=True,  align=TA_CENTER)
    p_sh     = _ps("SH",  size=7,  bold=True,  color=WHT,   align=TA_LEFT)
    p_val    = _ps("V",   size=9,                             align=TA_LEFT)
    p_vbold  = _ps("VB",  size=9,  bold=True,               align=TA_LEFT)
    p_sm     = _ps("SM",  size=7,               color=MGRAY, align=TA_LEFT)
    p_ctr    = _ps("C",   size=9,                             align=TA_CENTER)
    p_ctrbld = _ps("CB",  size=8,  bold=True,  color=WHT,   align=TA_CENTER)
    p_rgt    = _ps("R",   size=9,                             align=TA_RIGHT)
    p_rgtbld = _ps("RB",  size=10, bold=True,               align=TA_RIGHT)
    p_ftr    = _ps("FT",  size=7,               color=MGRAY, align=TA_CENTER)
    p_sigsub = _ps("SS",  size=7,               color=MGRAY, align=TA_CENTER)

    # ── data ─────────────────────────────────────────────────────────────────
    pu_date_str  = load.pu_date.strftime("%m/%d/%Y")  if load.pu_date  else "___/___/______"
    del_date_str = load.del_date.strftime("%m/%d/%Y") if load.del_date else "___/___/______"
    broker_name  = load.broker.name  if load.broker  else "—"
    driver_name  = load.driver.name  if load.driver  else "To be assigned"
    pm_str       = load.payment_method.value if load.payment_method else "—"
    gross_str    = f"${float(load.gross_rate):,.2f}"

    # ── common TableStyle factories ───────────────────────────────────────────
    BOX  = ("BOX",       (0, 0), (-1, -1), 0.75, BLK)
    GRID = ("INNERGRID", (0, 0), (-1, -1), 0.5,  BLK)

    def hdr_bg(row=0):
        return [
            ("BACKGROUND",    (0, row), (-1, row), DGRAY),
            ("TOPPADDING",    (0, row), (-1, row), 3),
            ("BOTTOMPADDING", (0, row), (-1, row), 3),
            ("LEFTPADDING",   (0, row), (-1, row), 5),
            ("RIGHTPADDING",  (0, row), (-1, row), 5),
        ]

    def body_pad(r0=1, r1=-1):
        return [
            ("TOPPADDING",    (0, r0), (-1, r1), 5),
            ("BOTTOMPADDING", (0, r0), (-1, r1), 6),
            ("LEFTPADDING",   (0, r0), (-1, r1), 6),
            ("RIGHTPADDING",  (0, r0), (-1, r1), 6),
        ]

    story = []
    GAP4 = Spacer(1, 4)

    # ══════════════════════════════════════════════════════════════════════════
    # 1. TITLE BAR
    # ══════════════════════════════════════════════════════════════════════════
    t1 = Table(
        [[Paragraph("BILL OF LADING", p_title)]],
        colWidths=[W * inch],
        rowHeights=[0.52 * inch],
    )
    t1.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LGRAY),
        BOX,
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(t1)
    story.append(GAP4)

    # ══════════════════════════════════════════════════════════════════════════
    # 2. CARRIER INFORMATION  |  DOCUMENT DETAILS
    # ══════════════════════════════════════════════════════════════════════════
    half = W / 2 * inch  # 3.5"
    carrier_p = Paragraph(
        f"<b>SV GLOBAL INC</b><br/>"
        f"<font size='8'>MC# 1650011</font><br/>"
        f"<font size='7' color='#555555'>Phone: (___) ___-____</font><br/>"
        f"<font size='7' color='#555555'>Address: ___________________________</font>",
        p_val,
    )
    bol_info_p = Paragraph(
        f"<b>BOL Number:</b>  {load.load_number}<br/>"
        f"<b>Date Issued:</b>  {date.today().strftime('%B %d, %Y')}",
        p_rgt,
    )
    t2 = Table(
        [
            [Paragraph("CARRIER INFORMATION", p_sh), Paragraph("DOCUMENT DETAILS", p_sh)],
            [carrier_p, bol_info_p],
        ],
        colWidths=[half, half],
        rowHeights=[0.22 * inch, None],
    )
    t2.setStyle(TableStyle([
        BOX, GRID,
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        *hdr_bg(0),
        *body_pad(1),
    ]))
    story.append(t2)
    story.append(GAP4)

    # ══════════════════════════════════════════════════════════════════════════
    # 3. SHIPPER / ORIGIN  |  CONSIGNEE / DESTINATION
    # ══════════════════════════════════════════════════════════════════════════
    shipper_p = Paragraph(
        f"<b>{broker_name}</b><br/>"
        f"{load.pu_location or '___________________________'}<br/>"
        f"<font size='7' color='#555555'>Pickup Date:  {pu_date_str}</font><br/>"
        f"<font size='7' color='#555555'>Time Window: __________ to __________</font>",
        p_val,
    )
    consignee_p = Paragraph(
        f"<b>_________________________</b><br/>"
        f"{load.del_location or '___________________________'}<br/>"
        f"<font size='7' color='#555555'>Delivery Date:  {del_date_str}</font><br/>"
        f"<font size='7' color='#555555'>Time Window: __________ to __________</font>",
        p_val,
    )
    t3 = Table(
        [
            [Paragraph("SHIPPER / ORIGIN", p_sh), Paragraph("CONSIGNEE / DESTINATION", p_sh)],
            [shipper_p, consignee_p],
        ],
        colWidths=[half, half],
        rowHeights=[0.22 * inch, None],
    )
    t3.setStyle(TableStyle([
        BOX, GRID,
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        *hdr_bg(0),
        *body_pad(1),
    ]))
    story.append(t3)
    story.append(GAP4)

    # ══════════════════════════════════════════════════════════════════════════
    # 4. CARRIER & DRIVER INFORMATION
    # ══════════════════════════════════════════════════════════════════════════
    cd_p = Paragraph(
        f"<b>Carrier:</b> SV GLOBAL INC &nbsp;&nbsp;&nbsp;&nbsp;"
        f"<b>Driver:</b> {driver_name} &nbsp;&nbsp;&nbsp;&nbsp;"
        f"<b>Truck #:</b> _______________ &nbsp;&nbsp;&nbsp;&nbsp;"
        f"<b>Trailer #:</b> _______________ &nbsp;&nbsp;&nbsp;&nbsp;"
        f"<b>MC #:</b> 1650011",
        p_val,
    )
    t4 = Table(
        [
            [Paragraph("CARRIER & DRIVER INFORMATION", p_sh)],
            [cd_p],
        ],
        colWidths=[W * inch],
        rowHeights=[0.22 * inch, None],
    )
    t4.setStyle(TableStyle([
        BOX,
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        *hdr_bg(0),
        *body_pad(1),
    ]))
    story.append(t4)
    story.append(GAP4)

    # ══════════════════════════════════════════════════════════════════════════
    # 5. FREIGHT DETAILS TABLE
    #    cols: QTY | DESCRIPTION | WEIGHT | CLASS | RATE
    #    colWidths must sum to W = 7.0"
    # ══════════════════════════════════════════════════════════════════════════
    fcols = [0.5 * inch, 3.1 * inch, 1.05 * inch, 0.7 * inch, 1.65 * inch]
    t5 = Table(
        [
            # Row 0: section header (spanned)
            [Paragraph("FREIGHT DETAILS", p_sh), "", "", "", ""],
            # Row 1: column headers
            [
                Paragraph("QTY",                    p_ctrbld),
                Paragraph("DESCRIPTION OF ARTICLES", p_ctrbld),
                Paragraph("WEIGHT (LBS)",            p_ctrbld),
                Paragraph("CLASS",                   p_ctrbld),
                Paragraph("RATE",                    p_ctrbld),
            ],
            # Row 2: data
            [
                Paragraph("1",              p_ctr),
                Paragraph("General Freight", p_val),
                Paragraph("__________",     p_ctr),
                Paragraph("70",             p_ctr),
                Paragraph(gross_str,        p_rgtbld),
            ],
            # Row 3: blank (room for additional items)
            ["", "", "", "", ""],
        ],
        colWidths=fcols,
        rowHeights=[0.22 * inch, 0.25 * inch, 0.3 * inch, 0.25 * inch],
    )
    t5.setStyle(TableStyle([
        BOX, GRID,
        # section header row
        ("SPAN",          (0, 0), (-1, 0)),
        ("BACKGROUND",    (0, 0), (-1, 0), DGRAY),
        ("TOPPADDING",    (0, 0), (-1, 0), 3),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 3),
        ("LEFTPADDING",   (0, 0), (-1, 0), 5),
        # column header row
        ("BACKGROUND", (0, 1), (-1, 1), CGRAY),
        ("TOPPADDING",    (0, 1), (-1, 1), 3),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 3),
        # data rows
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 2), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 2), (-1, -1), 4),
        ("LEFTPADDING",   (0, 2), (-1, -1), 5),
        ("ALIGN",         (0, 2), (0, -1), "CENTER"),   # QTY col
        ("ALIGN",         (2, 2), (3, -1), "CENTER"),   # WEIGHT, CLASS
        ("ALIGN",         (4, 2), (4, -1), "RIGHT"),    # RATE
        ("RIGHTPADDING",  (4, 2), (4, -1), 6),
    ]))
    story.append(t5)
    story.append(GAP4)

    # ══════════════════════════════════════════════════════════════════════════
    # 6. SPECIAL INSTRUCTIONS / NOTES  (empty box)
    # ══════════════════════════════════════════════════════════════════════════
    t6 = Table(
        [
            [Paragraph("SPECIAL INSTRUCTIONS / NOTES", p_sh)],
            [""],
        ],
        colWidths=[W * inch],
        rowHeights=[0.22 * inch, 0.65 * inch],
    )
    t6.setStyle(TableStyle([
        BOX,
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND",    (0, 0), (-1, 0), DGRAY),
        ("TOPPADDING",    (0, 0), (-1, 0), 3),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 3),
        ("LEFTPADDING",   (0, 0), (-1, 0), 5),
        ("LINEBELOW",     (0, 0), (-1, 0), 0.75, BLK),
    ]))
    story.append(t6)
    story.append(GAP4)

    # ══════════════════════════════════════════════════════════════════════════
    # 7. RATE & PAYMENT INFORMATION
    # ══════════════════════════════════════════════════════════════════════════
    third = W / 3 * inch  # 2.333"
    t7 = Table(
        [
            [Paragraph("RATE & PAYMENT INFORMATION", p_sh), "", ""],
            [
                Paragraph(f"<b>Gross Rate:</b>  {gross_str}", p_val),
                Paragraph(f"<b>Payment Method:</b>  {pm_str}", p_val),
                Paragraph("<b>Payment Terms:</b>  Net 30", p_val),
            ],
        ],
        colWidths=[third, third, third],
        rowHeights=[0.22 * inch, None],
    )
    t7.setStyle(TableStyle([
        BOX, GRID,
        ("SPAN",  (0, 0), (-1, 0)),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        *hdr_bg(0),
        *body_pad(1),
    ]))
    story.append(t7)
    story.append(GAP4)

    # ══════════════════════════════════════════════════════════════════════════
    # 8. SIGNATURES & ACKNOWLEDGMENT
    # ══════════════════════════════════════════════════════════════════════════
    sig_hdr_style  = _ps("SigH", size=7, bold=True,  align=TA_CENTER)
    sig_line_style = _ps("SigL", size=9,             align=TA_CENTER)
    sig_date_style = _ps("SigD", size=7, color=MGRAY, align=TA_CENTER)

    t8 = Table(
        [
            # Row 0: section header (spanned)
            [Paragraph("SIGNATURES & ACKNOWLEDGMENT", p_sh), "", ""],
            # Row 1: column sub-headers
            [
                Paragraph("SHIPPER SIGNATURE",     sig_hdr_style),
                Paragraph("DRIVER SIGNATURE",       sig_hdr_style),
                Paragraph("CARRIER REP SIGNATURE",  sig_hdr_style),
            ],
            # Row 2: signature lines
            [
                Paragraph("X _______________________________", sig_line_style),
                Paragraph("X _______________________________", sig_line_style),
                Paragraph("X _______________________________", sig_line_style),
            ],
            # Row 3: date lines
            [
                Paragraph("Date: ___________________________", sig_date_style),
                Paragraph("Date: ___________________________", sig_date_style),
                Paragraph("Date: ___________________________", sig_date_style),
            ],
        ],
        colWidths=[third, third, third],
        rowHeights=[0.22 * inch, 0.22 * inch, 0.42 * inch, 0.22 * inch],
    )
    t8.setStyle(TableStyle([
        BOX, GRID,
        ("SPAN",          (0, 0), (-1, 0)),
        *hdr_bg(0),
        # sub-header row
        ("BACKGROUND",    (0, 1), (-1, 1), LGRAY),
        ("TOPPADDING",    (0, 1), (-1, 1), 3),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 3),
        # all rows
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN",         (0, 1), (-1, -1), "CENTER"),
        ("TOPPADDING",    (0, 2), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 2), (-1, -1), 5),
    ]))
    story.append(t8)

    # ══════════════════════════════════════════════════════════════════════════
    # 9. FOOTER
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "This Bill of Lading is subject to the terms and conditions of the carrier agreement.",
        p_ftr,
    ))
    story.append(Paragraph(
        f"Generated by FreightDesk  ·  {CARRIER_NAME}  ·  {CARRIER_MC}  ·  {date.today().strftime('%B %d, %Y')}",
        p_ftr,
    ))

    doc.build(story)
    return buf.getvalue()


def _generate_invoice_pdf(load: Load) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch,
    )
    styles = getSampleStyleSheet()
    blue = colors.HexColor("#1e40af")
    border = colors.HexColor("#e2e8f0")
    muted = colors.HexColor("#94a3b8")
    footer_style = ParagraphStyle("InvFooter", parent=styles["Normal"], fontSize=7, textColor=muted, alignment=1)
    right_style = ParagraphStyle("InvRight", parent=styles["Normal"], alignment=2)

    invoice_num = f"INV-{load.load_number}"
    broker_name = load.broker.name if load.broker else "—"
    pm = load.payment_method.value if load.payment_method else "Contact broker"

    story = []

    hdr_table = Table(
        [[
            Paragraph(
                f"<b><font size='18' color='#1e40af'>{CARRIER_NAME}</font></b><br/>"
                f"<font size='9' color='#64748b'>{CARRIER_MC}</font>",
                styles["Normal"],
            ),
            Paragraph(
                f"<b><font size='18' color='#0f172a'>INVOICE</font></b><br/>"
                f"<font size='9' color='#64748b'>#{invoice_num}</font>",
                right_style,
            ),
        ]],
        colWidths=[3.5 * inch, 3.5 * inch],
    )
    hdr_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("PADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(hdr_table)
    story.append(HRFlowable(width="100%", thickness=2, color=blue, spaceAfter=16, spaceBefore=12))

    details_table = Table(
        [[
            Paragraph(
                f"<b><font size='8' color='#94a3b8'>BILL TO</font></b><br/>"
                f"<b><font size='12'>{broker_name}</font></b>",
                styles["Normal"],
            ),
            Paragraph(
                f"<b><font size='8' color='#94a3b8'>INVOICE DATE</font></b><br/>"
                f"{date.today().strftime('%B %d, %Y')}<br/><br/>"
                f"<b><font size='8' color='#94a3b8'>LOAD NUMBER</font></b><br/>{load.load_number}",
                right_style,
            ),
        ]],
        colWidths=[3.5 * inch, 3.5 * inch],
    )
    details_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("PADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(details_table)
    story.append(Spacer(1, 20))

    pu_loc = load.pu_location or "—"
    del_loc = load.del_location or "—"
    line_data = [
        ["DESCRIPTION", "PICKUP", "DELIVERY", "AMOUNT"],
        ["Freight Transportation Services", pu_loc, del_loc, f"${float(load.gross_rate):,.2f}"],
    ]
    if float(load.cut_rate) > 0:
        line_data.append(["Deduction", "", "", f"-${float(load.cut_rate):,.2f}"])
    if float(load.added_rate) > 0:
        line_data.append(["Additional Charges", "", "", f"+${float(load.added_rate):,.2f}"])

    lines_table = Table(line_data, colWidths=[3 * inch, 1.5 * inch, 1.5 * inch, 1 * inch])
    lines_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), blue),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 10),
        ("PADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, border),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("ALIGN", (-1, 0), (-1, -1), "RIGHT"),
    ]))
    story.append(lines_table)
    story.append(Spacer(1, 14))

    total_table = Table(
        [["TOTAL DUE", f"${float(load.final_rate):,.2f}"]],
        colWidths=[6 * inch, 1 * inch],
    )
    total_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), blue),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 12),
        ("PADDING", (0, 0), (-1, -1), 10),
        ("ALIGN", (-1, 0), (-1, -1), "RIGHT"),
    ]))
    story.append(total_table)
    story.append(Spacer(1, 30))

    story.append(Paragraph(f"<b>Payment Method:</b> {pm}", styles["Normal"]))
    story.append(Spacer(1, 40))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1"), spaceAfter=6))
    story.append(Paragraph(
        f"Thank you for your business  ·  {CARRIER_NAME}  ·  {CARRIER_MC}",
        footer_style,
    ))

    doc.build(story)
    return buf.getvalue()


@loads_router.get("/rate-history")
def get_rate_history(
    pu_location: str = "",
    del_location: str = "",
    broker_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Load)
    if broker_id:
        query = query.filter(Load.broker_id == broker_id)
    if len(pu_location) >= 2:
        query = query.filter(Load.pu_location.ilike(f"%{pu_location}%"))
    if len(del_location) >= 2:
        query = query.filter(Load.del_location.ilike(f"%{del_location}%"))
    loads = query.order_by(Load.created_at.desc()).limit(5).all()
    return [
        {
            "load_number": l.load_number,
            "gross_rate": float(l.gross_rate),
            "del_date": l.del_date.isoformat() if l.del_date else None,
            "load_status": (l.load_status or LoadStatus.NEW).value,
        }
        for l in loads
    ]


@loads_router.get("/{load_id}/bol")
def generate_bol(
    load_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    load = (
        db.query(Load)
        .options(joinedload(Load.broker), joinedload(Load.driver))
        .filter(Load.id == load_id)
        .first()
    )
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    pdf_bytes = _generate_bol_pdf(load)
    _log_event(db, load_id, "BOL_GENERATED", f"BOL generated by {current_user.name}", current_user.id)

    filename = f"BOL-{load.load_number}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@loads_router.get("/{load_id}/invoice")
def generate_invoice(
    load_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.HEAD_ACCOUNTANT:
        raise HTTPException(status_code=403, detail="HEAD_ACCOUNTANT role required")

    load = (
        db.query(Load)
        .options(joinedload(Load.broker), joinedload(Load.driver))
        .filter(Load.id == load_id)
        .first()
    )
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    pdf_bytes = _generate_invoice_pdf(load)
    _log_event(db, load_id, "INVOICE_GENERATED", f"Invoice generated by {current_user.name}", current_user.id)

    filename = f"INV-{load.load_number}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@tracking_router.get("/track/{load_number}")
def track_load(load_number: str, db: Session = Depends(get_db)):
    load = (
        db.query(Load)
        .options(joinedload(Load.broker), joinedload(Load.driver))
        .filter(Load.load_number == load_number)
        .first()
    )
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    return {
        "load_number": load.load_number,
        "broker_name": load.broker.name if load.broker else None,
        "driver_name": load.driver.name if load.driver else None,
        "pu_location": load.pu_location,
        "del_location": load.del_location,
        "pu_date": load.pu_date.isoformat() if load.pu_date else None,
        "del_date": load.del_date.isoformat() if load.del_date else None,
        "load_status": (load.load_status or LoadStatus.NEW).value,
        "distance_miles": load.distance_miles,
        "calculated_eta": load.calculated_eta.isoformat() if load.calculated_eta else None,
        "driver_eta": load.driver_eta.isoformat() if load.driver_eta else None,
        "eta_notes": load.eta_notes,
    }
