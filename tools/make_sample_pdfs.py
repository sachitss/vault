import pathlib, os
ROOT = pathlib.Path(__file__).resolve().parents[1]
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
def doc(fn, title, lines, foot):
    c=canvas.Canvas(str(fn),pagesize=A4); w,h=A4
    c.setFillColor(HexColor('#1f3a5f')); c.rect(0,h-70,w,70,fill=1,stroke=0)
    c.setFillColor(HexColor('#ffffff')); c.setFont('Helvetica-Bold',18); c.drawString(40,h-45,title)
    c.setFillColor(HexColor('#b23a3a')); c.setFont('Helvetica-Bold',38); c.saveState(); c.translate(w/2,h/2); c.rotate(30); c.setFillAlpha(0.12); c.drawCentredString(0,0,'SAMPLE - NOT A REAL DOCUMENT'); c.restoreState()
    c.setFillColor(HexColor('#1d2330')); y=h-110
    for l in lines:
        if l.startswith('#'): c.setFont('Helvetica-Bold',12); l=l[1:]
        else: c.setFont('Helvetica',11)
        c.drawString(40,y,l); y-=20
    c.setFont('Helvetica-Oblique',9); c.setFillColor(HexColor('#7b8496')); c.drawString(40,40,foot); c.save()
doc(ROOT/'samples/invoice.pdf','Sample Juwelier GmbH - Rechnung / Invoice',['#Invoice INV-2021-12345','Date: 15.06.2021','Customer: Sachit Shrestha','', '#Item','Gold necklace, 750/18K yellow gold, curb link, 50 cm','Gross weight 52.4 g, hallmark 750 + maker mark','', 'Net price                              EUR 3,781.51','VAT 19 %                               EUR   718.49','#Total                                 EUR 4,500.00','','Paid by card on 15.06.2021'],'Sample document generated for the Valuables Vault prototype.')
doc(ROOT/'samples/cert.pdf','Sample Assay Office - Assay Certificate',['#Certificate ASY-2021-0815','Date: 15.06.2021','','Article: Necklace with pendant','Declared fineness: 750 (18 carat)','Measured fineness: 751 +/- 2','Gross weight: 52.4 g','Hallmark: 750 and maker mark verified'],'Sample document generated for the Valuables Vault prototype.')
doc(ROOT/'samples/appraisal.pdf','Sample Gutachter - Wertgutachten / Appraisal',['#Appraisal GA-2026-118','Date of valuation: 20.05.2026','Object: Gold necklace JWL-2026-00001, 750/18K, 52.4 g','','Market value (resale):                 EUR 5,900','Replacement value (insurance):         EUR 7,000','','Basis: gold price EUR 98/g fine, craftsmanship, condition very good.','Valid for insurance purposes for 24 months.'],'Sample document generated for the Valuables Vault prototype.')
