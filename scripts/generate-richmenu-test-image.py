#!/usr/bin/env python3
"""Deterministic 2500x1686 LINE six-cell test menu. Requires Pillow + Noto Sans CJK."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import sys

W,H=2500,1686
font_reg='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
font_bold='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
F=lambda size,bold=False: ImageFont.truetype(font_bold if bold else font_reg,size,index=3)

im=Image.new('RGB',(W,H),'#0D2037')
d=ImageDraw.Draw(im)
xs=[0,833,1666,2500]
ys=[0,843,1686]
base=[('#163B65','#12345A'),('#152B47','#112841'),('#162E4A','#122940'),('#142B46','#112940'),('#152D48','#112940'),('#142A45','#11263F')]
for row in range(2):
 for col in range(3):
  i=row*3+col
  x0,y0,x1,y1=xs[col],ys[row],xs[col+1],ys[row+1]
  d.rectangle((x0,y0,x1-1,y1-1),fill=base[i][0])
d.polygon([(0,0),(833,0),(833,345),(0,820)],fill='#1B548E')
d.polygon([(380,0),(833,0),(833,842),(668,842)],fill='#23639E')
d.polygon([(770,0),(833,0),(833,843),(525,843)],fill='#2A72AE')
d.rectangle((0,0,12,842),fill='#A5D7FC')
for i in range(6):
 x=615+i*34
 d.rounded_rectangle((x,156,x+13,306+(i%3)*25),radius=7,fill='#86C6F1' if i%2 else '#599BCC')
for i in range(1,6):
 row,col=divmod(i,3)
 x0,y0,x1,y1=xs[col],ys[row],xs[col+1],ys[row+1]
 d.polygon([(x1-375,y0+1),(x1-1,y0+1),(x1-1,y0+275)],fill='#183653')
 d.line([(x1-134,y0+58),(x1-66,y0+58),(x1-66,y0+126)],fill='#385571',width=4)
for x in (833,1666):
 d.line([(x,0),(x,H)],fill='#60778C',width=3)
d.line([(0,843),(W,843)],fill='#60778C',width=3)

def centered(txt,font,cx,y,color):
 box=d.textbbox((0,0),txt,font=font)
 d.text((cx-(box[2]-box[0])/2,y),txt,font=font,fill=color,stroke_width=0)
def book_icon(cx,cy,s=1):
 color='#F0FAFF'
 d.line([(cx,cy+20*s),(cx-84*s,cy+2*s),(cx-142*s,cy+19*s),(cx-142*s,cy+135*s),(cx-80*s,cy+116*s),(cx,cy+134*s)],fill=color,width=int(11*s),joint='curve')
 d.line([(cx,cy+20*s),(cx+84*s,cy+2*s),(cx+142*s,cy+19*s),(cx+142*s,cy+135*s),(cx+80*s,cy+116*s),(cx,cy+134*s)],fill=color,width=int(11*s),joint='curve')
 d.line([(cx,cy+20*s),(cx,cy+134*s)],fill=color,width=int(8*s))
def lock_icon(cx,cy):
 c='#7890A7'
 d.arc([cx-49,cy-75,cx+49,cy+52],start=184,end=357,fill=c,width=12)
 d.rounded_rectangle([cx-70,cy-13,cx+70,cy+116],radius=22,outline=c,width=11)
 d.ellipse([cx-9,cy+34,cx+9,cy+52],fill=c)
 d.rounded_rectangle([cx-4,cy+48,cx+4,cy+77],radius=3,fill=c)

cx=416
book_icon(cx,198,0.9)
centered('我的課程',F(95,True),cx,428,'#FFFFFF')
centered('點擊開啟學員中心',F(43),cx,572,'#E5F4FF')
d.rounded_rectangle((246,691,586,757),radius=33,outline='#A6D8FF',width=3,fill='#265C8B')
centered('唯一啟用',F(34,True),cx,700,'#E6F7FF')
for i,label in enumerate(['課程講義','作業上傳','我要提問','推薦好友','學員服務'],1):
 r,c=divmod(i,3)
 x0,y0,x1,y1=xs[c],ys[r],xs[c+1],ys[r+1]
 center=(x0+x1)//2
 lock_icon(center,y0+255)
 centered(label,F(79,True),center,y0+428,'#B1C3D3')
 centered('尚未開放',F(40),center,y0+570,'#8DA5BC')
 centered('TEST  ·  INACTIVE',F(26,True),center,y0+731,'#617F9C')
outfile=Path(sys.argv[1]) if len(sys.argv)>1 else Path('piano_richmenu_six_cell_test_2500x1686.png')
im.save(outfile,optimize=True,compress_level=9)
assert outfile.stat().st_size<=1024*1024
print(outfile, W, H, outfile.stat().st_size)
