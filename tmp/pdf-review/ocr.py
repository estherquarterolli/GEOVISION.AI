from pathlib import Path
import pymupdf, numpy as np, json, time
from rapidocr_onnxruntime import RapidOCR
ocr=RapidOCR(intra_op_num_threads=2, inter_op_num_threads=1)
root=Path('C:/Users/esther.santos/Downloads'); out=Path('tmp/pdf-review')
for n,pattern in [(2,'417620118*'),(3,'686421887*')]:
 p=next(root.glob(pattern)); d=pymupdf.open(p)
 folder=out/f'ocr{n}'; folder.mkdir(exist_ok=True)
 for i,page in enumerate(d):
  dest=folder/f'{i+1:04}.txt'
  if dest.exists(): continue
  pix=page.get_pixmap(matrix=pymupdf.Matrix(1.65,1.65),alpha=False)
  a=np.frombuffer(pix.samples,dtype=np.uint8).reshape(pix.height,pix.width,3)
  results,_=ocr(a)
  text='\n'.join(r[1] for r in results or [])
  dest.write_text(text,encoding='utf-8')
  if i%10==0: print(f'DOC {n} {i+1}/{len(d)} chars {len(text)}',flush=True)
 print('CONCLUIDO',n,flush=True)
